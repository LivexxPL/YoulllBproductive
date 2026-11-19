import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { addDays, addMinutes, isSameDay, startOfDay } from 'date-fns';
import { Repeat } from 'lucide-react';
import { layoutDay, snap, type Placed } from './layout';
import { startPointerDrag, useBlockTouchScrollWhileDragging } from './drag';
import { moveOccurrence, restoreReminder } from '../../data/actions';
import { colorHex } from '../../lib/colors';
import { dayLabel, fmt, formatTime, minutesOfDay, WEEKDAY_SHORT } from '../../lib/dates';
import { isRecurring } from '../../lib/recurrence';
import type { Category, Occurrence } from '../../lib/types';
import { useIsDesktop } from '../../lib/hooks';
import { useSettings } from '../../state/settings';
import { toast, useUi } from '../../state/ui';

interface Props {
  days: Date[];
  occurrences: Occurrence[];
  categories: Map<string, Category>;
  now: Date;
  periodKey: string;
  enterDir: number;
  onSelectDay?: (d: Date) => void;
  contentRef?: React.RefObject<HTMLDivElement | null>;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
}

interface DragState {
  key: string;
  mode: 'move' | 'resize' | 'allday';
  occ: Occurrence;
  dayIdx: number;
  deltaMin: number;
  dayDelta: number;
}

const GUTTER = 48;

export function TimeGrid({ days, occurrences, categories, now, periodKey, enterDir, onSelectDay, contentRef, scrollRef: extScrollRef }: Props) {
  const desktop = useIsDesktop();
  const HOUR_H = desktop ? 60 : 54;
  const n = days.length;
  const ownScrollRef = useRef<HTMLDivElement>(null);
  const scrollRef = extScrollRef ?? ownScrollRef;
  const colsRef = useRef<HTMLDivElement>(null);
  const allDayRef = useRef<HTMLDivElement>(null);
  const openEditor = useUi((s) => s.openEditor);
  const defaultDuration = useSettings((s) => s.defaultDurationMin);
  const [drag, setDragState] = useState<DragState | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const setDrag = (next: DragState | null) => {
    dragStateRef.current = next;
    setDragState(next);
  };
  useBlockTouchScrollWhileDragging(scrollRef);
  useBlockTouchScrollWhileDragging(allDayRef);

  const { timed, allDay } = useMemo(() => {
    const timed: Placed[][] = days.map(() => []);
    const allDay: Occurrence[][] = days.map(() => []);
    days.forEach((d, i) => {
      const dayItems = occurrences.filter((o) => isSameDay(o.start, d));
      allDay[i] = dayItems.filter((o) => o.reminder.allDay);
      timed[i] = layoutDay(
        dayItems.filter((o) => !o.reminder.allDay),
        d,
      );
    });
    return { timed, allDay };
  }, [days, occurrences]);

  const hasAllDay = allDay.some((a) => a.length);
  const todayIdx = days.findIndex((d) => isSameDay(d, now));

  // Startowe przewinięcie: okolice „teraz” albo 7:00
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const target = todayIdx >= 0 ? (minutesOfDay(now) / 60 - 1.5) * HOUR_H : 7 * HOUR_H;
    el.scrollTop = Math.max(0, target);
  }, [HOUR_H]);

  // ——— Przeciąganie ———
  const dragRef = useRef<{ y0: number; scroll0: number; lastX: number; lastY: number; raf: number | null } | null>(null);

  const colIndexAt = (x: number, el: HTMLElement | null) => {
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    const w = r.width / n;
    return Math.max(0, Math.min(n - 1, Math.floor((x - r.left) / w)));
  };

  const beginDrag = (e: React.PointerEvent, occ: Occurrence, mode: DragState['mode'], dayIdx: number) => {
    e.stopPropagation();
    const scroller = scrollRef.current;
    startPointerDrag(e, {
      onTap: () => openEditor({ reminderId: occ.reminder.id, occurrenceStart: occ.start.toISOString() }),
      onStart: (p) => {
        dragRef.current = { y0: p.y, scroll0: scroller?.scrollTop ?? 0, lastX: p.x, lastY: p.y, raf: null };
        setDrag({ key: occ.key, mode, occ, dayIdx, deltaMin: 0, dayDelta: 0 });
        const loop = () => {
          const d = dragRef.current;
          if (!d || !scroller) return;
          if (mode !== 'allday') {
            const r = scroller.getBoundingClientRect();
            const edge = 44;
            let dy = 0;
            if (d.lastY < r.top + edge) dy = -Math.ceil((r.top + edge - d.lastY) / 4);
            else if (d.lastY > r.bottom - edge) dy = Math.ceil((d.lastY - (r.bottom - edge)) / 4);
            if (dy) {
              scroller.scrollTop += dy;
              update(d.lastX, d.lastY);
            }
          }
          d.raf = requestAnimationFrame(loop);
        };
        dragRef.current.raf = requestAnimationFrame(loop);
      },
      onMove: (p) => update(p.x, p.y),
      onEnd: async (_p, cancelled) => {
        const d = dragRef.current;
        if (d?.raf) cancelAnimationFrame(d.raf);
        dragRef.current = null;
        const final = dragStateRef.current;
        setDrag(null);
        if (!final || cancelled) return;
        await commit(final);
      },
    });

    function update(x: number, y: number) {
      const d = dragRef.current;
      if (!d) return;
      d.lastX = x;
      d.lastY = y;
      const scrollDelta = (scroller?.scrollTop ?? 0) - d.scroll0;
      const deltaMin = mode === 'allday' ? 0 : snap(((y - d.y0 + scrollDelta) / HOUR_H) * 60, 15);
      const idx = mode === 'resize' ? dayIdx : colIndexAt(x, mode === 'allday' ? allDayRef.current : colsRef.current);
      const cur = dragStateRef.current;
      if (cur && (cur.deltaMin !== deltaMin || cur.dayDelta !== idx - dayIdx)) setDrag({ ...cur, deltaMin, dayDelta: idx - dayIdx });
    }
  };

  const commit = async (s: DragState) => {
    const r = s.occ.reminder;
    const before = r;
    const startMin = minutesOfDay(s.occ.start);
    const dur = r.durationMin;
    if (s.mode === 'resize') {
      const newDur = Math.max(15, Math.min(24 * 60 - startMin, dur + s.deltaMin));
      if (newDur === dur) return;
      await moveOccurrence(r, s.occ.start, s.occ.start, newDur);
      toast({ message: `Czas trwania: ${formatTime(s.occ.start)}–${formatTime(addMinutes(s.occ.start, newDur))}`, actionLabel: 'Cofnij', onAction: () => restoreReminder(before) });
      return;
    }
    if (!s.deltaMin && !s.dayDelta) return;
    const newStartMin = Math.max(0, Math.min(24 * 60 - 15, startMin + s.deltaMin));
    const base = addDays(startOfDay(s.occ.start), s.dayDelta);
    const newStart = r.allDay ? base : addMinutes(base, newStartMin);
    const kind = await moveOccurrence(r, s.occ.start, newStart);
    toast({
      message: `${kind === 'series' ? 'Seria przeniesiona' : 'Przeniesiono'}: ${dayLabel(newStart)}${r.allDay ? '' : `, ${formatTime(newStart)}`}`,
      actionLabel: 'Cofnij',
      onAction: () => restoreReminder(before),
    });
  };

  const createAt = (dayIdx: number, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const min = snap(((e.clientY - rect.top) / HOUR_H) * 60, 30);
    const start = addMinutes(days[dayIdx], Math.min(min, 23 * 60 + 30));
    openEditor({ draft: { start: start.toISOString(), allDay: false, durationMin: defaultDuration || 30 } });
  };

  const colTemplate = { gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` };
  const nowTop = (minutesOfDay(now) / 60) * HOUR_H;
  const [, force] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => force((x) => x + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Nagłówki dni */}
      <div className="flex shrink-0 border-b border-line">
        <div style={{ width: GUTTER }} className="shrink-0" />
        <motion.div
          key={periodKey}
          initial={{ opacity: 0, x: enterDir * 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="grid flex-1"
          style={colTemplate}
        >
          {days.map((d, i) => {
            const isToday = i === todayIdx;
            return (
              <button
                key={d.toISOString()}
                onClick={() => onSelectDay?.(d)}
                className={`flex flex-col items-center gap-0.5 pb-2 pt-1 ${n === 1 ? 'items-start pl-2' : ''}`}
              >
                <span className={`text-[0.6875rem] font-semibold uppercase tracking-wide ${isToday ? 'text-accent' : 'text-muted'}`}>
                  {n === 1 ? fmt(d, 'EEEE') : WEEKDAY_SHORT[d.getDay()]}
                </span>
                <span
                  className={`tnum grid h-8 min-w-8 place-items-center rounded-full px-1 font-display text-[1.0625rem] font-semibold transition-colors ${
                    isToday ? 'bg-accent text-white dark:text-[#0b0d12]' : 'text-ink hover:bg-surface-2'
                  }`}
                >
                  {d.getDate()}
                </span>
              </button>
            );
          })}
        </motion.div>
      </div>

      {/* Cały dzień */}
      {hasAllDay && (
        <div className="flex shrink-0 border-b border-line bg-surface-2/40">
          <div style={{ width: GUTTER }} className="shrink-0 pt-1.5 pr-1 text-right text-[0.625rem] font-semibold uppercase leading-tight text-faint">
            cały
            <br />
            dzień
          </div>
          <div ref={allDayRef} className="grid flex-1 gap-px py-1" style={colTemplate}>
            {allDay.map((items, i) => {
              const isTarget = drag?.mode === 'allday' && drag.dayIdx + drag.dayDelta === i;
              return (
                <div key={i} className={`min-w-0 space-y-0.5 px-0.5 ${isTarget ? 'rounded-md bg-accent-soft' : ''}`}>
                  {items.slice(0, 3).map((o) => {
                    const c = o.reminder.categoryId ? categories.get(o.reminder.categoryId) : undefined;
                    const dragging = drag?.key === o.key;
                    return (
                      <div
                        key={o.key}
                        onPointerDown={(e) => beginDrag(e, o, 'allday', i)}
                        onContextMenu={(e) => e.preventDefault()}
                        className={`event event-solid cursor-pointer touch-manipulation select-none truncate rounded-md px-1.5 py-0.5 text-[0.6875rem] font-semibold [-webkit-touch-callout:none] ${o.done ? 'event-done' : ''} ${dragging ? 'opacity-40' : ''}`}
                        style={{ ['--c' as string]: colorHex(c?.color) }}
                      >
                        <span className="event-title">{o.reminder.title}</span>
                      </div>
                    );
                  })}
                  {items.length > 3 && <div className="px-1 text-[0.625rem] font-semibold text-muted">+{items.length - 3}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Siatka godzin */}
      <div ref={scrollRef} className="scroll-thin relative min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain">
        <div ref={contentRef} className="relative flex will-change-transform" style={{ height: 24 * HOUR_H }}>
          <div style={{ width: GUTTER }} className="relative shrink-0 select-none">
            {Array.from({ length: 23 }, (_, h) => (
              <div
                key={h}
                className="tnum absolute right-2 -translate-y-1/2 text-[0.6875rem] font-medium text-faint"
                style={{ top: (h + 1) * HOUR_H }}
              >
                {String(h + 1).padStart(2, '0')}:00
              </div>
            ))}
          </div>
          <motion.div
            key={periodKey}
            ref={colsRef}
            initial={{ opacity: 0, x: enterDir * 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative grid flex-1"
            style={{
              ...colTemplate,
              backgroundImage: `linear-gradient(to bottom, var(--grid-line) 1px, transparent 1px), linear-gradient(to bottom, var(--grid-line-half) 1px, transparent 1px)`,
              backgroundSize: `100% ${HOUR_H}px, 100% ${HOUR_H / 2}px`,
            }}
          >
            {days.map((d, i) => (
              <div
                key={d.toISOString()}
                className={`relative border-l border-line ${i === todayIdx && n > 1 ? 'bg-accent/[0.03]' : ''}`}
                onClick={(e) => createAt(i, e)}
              >
                {timed[i].map((p) => {
                  const isDragged = drag?.key === p.occ.key;
                  return (
                    <EventBlock
                      key={p.occ.key}
                      p={p}
                      hourH={HOUR_H}
                      color={colorHex(p.occ.reminder.categoryId ? categories.get(p.occ.reminder.categoryId)?.color : null)}
                      ghost={isDragged}
                      compact={n > 3 && !desktop}
                      onPointerDown={(e, mode) => beginDrag(e, p.occ, mode, i)}
                    />
                  );
                })}
                {drag && drag.mode !== 'allday' && drag.dayIdx + (drag.mode === 'resize' ? 0 : drag.dayDelta) === i && (
                  <DragPreview drag={drag} hourH={HOUR_H} color={colorHex(drag.occ.reminder.categoryId ? categories.get(drag.occ.reminder.categoryId)?.color : null)} />
                )}
                {i === todayIdx && (
                  <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: nowTop }}>
                    <div className="relative h-0.5 bg-danger shadow-[0_0_8px_rgb(229_72_77/0.5)]">
                      <span className="absolute -left-1.5 -top-[5px] h-3 w-3 rounded-full bg-danger ring-2 ring-[var(--surface)]" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function EventBlock({
  p,
  hourH,
  color,
  ghost,
  compact,
  onPointerDown,
}: {
  p: Placed;
  hourH: number;
  color: string;
  ghost: boolean;
  compact: boolean;
  onPointerDown: (e: React.PointerEvent, mode: 'move' | 'resize') => void;
}) {
  const r = p.occ.reminder;
  const top = (p.startMin / 60) * hourH;
  const height = Math.max(20, ((p.endMin - p.startMin) / 60) * hourH - 2);
  const point = r.durationMin === 0;
  const widthPct = 100 / p.cols;
  const style = {
    top,
    height,
    left: `calc(${p.col * widthPct}% + 2px)`,
    width: `calc(${widthPct}% - 4px)`,
    ['--c' as string]: color,
  };
  const showTime = height >= 38 && !compact;

  return (
    <div
      data-event
      onPointerDown={(e) => onPointerDown(e, 'move')}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      className={`group event absolute z-10 cursor-pointer select-none overflow-hidden rounded-lg ${compact ? 'px-1 py-0.5' : 'px-1.5 py-1'} leading-tight shadow-[0_1px_2px_rgb(16_24_40/0.06)] transition-[opacity,box-shadow] duration-150 [-webkit-touch-callout:none] hover:shadow-[0_4px_14px_-4px_rgb(16_24_40/0.25)] ${
        p.occ.done ? 'event-done' : ''
      } ${ghost ? 'opacity-30' : ''} ${point ? 'event-solid' : ''}`}
      style={style}
      title={`${r.title} · ${formatTime(p.occ.start)}`}
    >
      {compact ? (
        <div className="event-title text-[0.625rem] font-semibold leading-[1.15] [overflow-wrap:anywhere]">{r.title}</div>
      ) : (
        <div className="flex items-center gap-1 text-[0.75rem]">
          {point && <span className="tnum shrink-0 font-semibold opacity-70">{formatTime(p.occ.start)}</span>}
          <span className="event-title truncate font-semibold">{r.title}</span>
          {isRecurring(r) && height >= 24 && <Repeat size={10} className="shrink-0 opacity-50" />}
        </div>
      )}
      {showTime && !point && (
        <div className="tnum mt-0.5 truncate text-[0.6875rem] opacity-70">
          {formatTime(p.occ.start)}–{formatTime(p.occ.end)}
        </div>
      )}
      {!point && !p.occ.done && (
        <div
          className="absolute inset-x-0 bottom-0 h-2.5 cursor-ns-resize"
          onPointerDown={(e) => {
            e.stopPropagation();
            onPointerDown(e, 'resize');
          }}
        >
          <div className="mx-auto mt-1 h-[3px] w-6 rounded-full bg-[var(--c)] opacity-0 transition-opacity group-hover:opacity-60" />
        </div>
      )}
    </div>
  );
}

function DragPreview({ drag, hourH, color }: { drag: DragState; hourH: number; color: string }) {
  const r = drag.occ.reminder;
  const startMin = minutesOfDay(drag.occ.start);
  const dur = r.durationMin;
  let s = startMin;
  let e = startMin + Math.max(dur, 25);
  let label: string;
  if (drag.mode === 'resize') {
    const newDur = Math.max(15, dur + drag.deltaMin);
    e = startMin + newDur;
    label = `${formatTime(drag.occ.start)}–${formatTime(addMinutes(drag.occ.start, newDur))}`;
  } else {
    s = Math.max(0, Math.min(24 * 60 - 15, startMin + drag.deltaMin));
    e = s + Math.max(dur, 25);
    const base = startOfDay(drag.occ.start);
    label = dur ? `${formatTime(addMinutes(base, s))}–${formatTime(addMinutes(base, s + dur))}` : formatTime(addMinutes(base, s));
  }
  return (
    <div
      className="event event-solid pointer-events-none absolute inset-x-0.5 z-30 rounded-lg px-1.5 py-1 shadow-[0_12px_28px_-8px_rgb(16_24_40/0.45)] ring-2 ring-[var(--c)]"
      style={{ top: (s / 60) * hourH, height: Math.max(22, ((e - s) / 60) * hourH - 2), ['--c' as string]: color }}
    >
      <div className="truncate text-[0.75rem] font-semibold">{r.title}</div>
      <div className="tnum text-[0.6875rem] font-semibold" style={{ color }}>
        {label}
      </div>
    </div>
  );
}
