import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { addDays, endOfMonth, endOfWeek, isSameDay, isSameMonth, setHours, startOfMonth, startOfWeek } from 'date-fns';
import { CalendarPlus } from 'lucide-react';
import { startPointerDrag, useBlockTouchScrollWhileDragging } from './drag';
import { ReminderRow } from '../ReminderRow';
import { moveOccurrence, restoreReminder } from '../../data/actions';
import { colorHex } from '../../lib/colors';
import { dayLabel, formatTime, longDayLabel, orderedWeekdays, parseDateKey, toDateKey, WEEKDAY_SHORT } from '../../lib/dates';
import { useIsWide } from '../../lib/hooks';
import type { Category, Occurrence } from '../../lib/types';
import { useSettings } from '../../state/settings';
import { toast, useUi } from '../../state/ui';

interface Props {
  month: Date;
  selected: Date;
  occurrences: Occurrence[];
  categories: Map<string, Category>;
  now: Date;
  periodKey: string;
  enterDir: number;
  onSelectDay: (d: Date) => void;
  onOpenDay: (d: Date) => void;
  contentRef?: React.RefObject<HTMLDivElement | null>;
}

export function monthGridDays(month: Date, weekStartsOn: 0 | 1): Date[] {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn });
  const out: Date[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

export function MonthView({ month, selected, occurrences, categories, now, periodKey, enterDir, onSelectDay, onOpenDay, contentRef }: Props) {
  const wide = useIsWide();
  const weekStartsOn = useSettings((s) => s.weekStartsOn);
  const openEditor = useUi((s) => s.openEditor);
  const days = useMemo(() => monthGridDays(month, weekStartsOn), [month, weekStartsOn]);
  const rows = days.length / 7;
  const gridRef = useRef<HTMLDivElement>(null);
  useBlockTouchScrollWhileDragging(gridRef);

  const byDay = useMemo(() => {
    const m = new Map<string, Occurrence[]>();
    for (const o of occurrences) {
      const k = toDateKey(o.start);
      const arr = m.get(k) ?? [];
      arr.push(o);
      m.set(k, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => Number(b.reminder.allDay) - Number(a.reminder.allDay) || a.start.getTime() - b.start.getTime());
    return m;
  }, [occurrences]);

  // ——— Przeciąganie między dniami (desktop) ———
  const [ghost, setGhost] = useState<{ occ: Occurrence; x: number; y: number; target: string | null } | null>(null);
  const ghostRef = useRef(ghost);
  ghostRef.current = ghost;

  const targetAt = (x: number, y: number) => (document.elementFromPoint(x, y)?.closest('[data-day]') as HTMLElement | null)?.dataset.day ?? null;

  const beginDrag = (e: React.PointerEvent, occ: Occurrence) => {
    e.stopPropagation();
    startPointerDrag(e, {
      onTap: () => openEditor({ reminderId: occ.reminder.id, occurrenceStart: occ.start.toISOString() }),
      onStart: (p) => setGhost({ occ, x: p.x, y: p.y, target: targetAt(p.x, p.y) }),
      onMove: (p) => setGhost((g) => (g ? { ...g, x: p.x, y: p.y, target: targetAt(p.x, p.y) } : g)),
      onEnd: async (_p, cancelled) => {
        const g = ghostRef.current;
        setGhost(null);
        if (!g || cancelled || !g.target || g.target === toDateKey(occ.start)) return;
        const day = parseDateKey(g.target);
        const newStart = new Date(day);
        newStart.setHours(occ.start.getHours(), occ.start.getMinutes(), 0, 0);
        const before = occ.reminder;
        const kind = await moveOccurrence(occ.reminder, occ.start, newStart);
        toast({
          message: `${kind === 'series' ? 'Seria przeniesiona' : 'Przeniesiono'} na ${dayLabel(newStart).toLowerCase()}`,
          actionLabel: 'Cofnij',
          onAction: () => restoreReminder(before),
        });
      },
    });
  };

  const selectedItems = byDay.get(toDateKey(selected)) ?? [];
  const maxPills = rows > 5 ? 3 : 4;

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${wide ? '' : 'overflow-y-auto'}`}>
      <div className="grid shrink-0 grid-cols-7 border-b border-line">
        {orderedWeekdays(weekStartsOn).map((d) => (
          <div key={d} className="py-2 text-center text-[0.6875rem] font-semibold uppercase tracking-wide text-muted">
            {WEEKDAY_SHORT[d]}
          </div>
        ))}
      </div>

      <div ref={contentRef} className={`${wide ? 'min-h-0 flex-1' : 'shrink-0'} will-change-transform`}>
        <motion.div
          key={periodKey}
          ref={gridRef}
          initial={{ opacity: 0, x: enterDir * 28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="grid h-full grid-cols-7"
          style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
        >
          {days.map((d) => {
            const key = toDateKey(d);
            const items = byDay.get(key) ?? [];
            const inMonth = isSameMonth(d, month);
            const isToday = isSameDay(d, now);
            const isSel = isSameDay(d, selected);
            const isTarget = ghost?.target === key;
            return (
              <div
                key={key}
                data-day={key}
                onClick={() => (wide ? openEditor({ draft: { start: setHours(d, 9).toISOString(), allDay: false } }) : onSelectDay(d))}
                className={`group relative min-w-0 cursor-pointer border-b border-r border-line transition-colors [&:nth-child(7n)]:border-r-0 ${
                  wide ? 'p-1' : 'flex h-14 flex-col items-center pt-1.5'
                } ${!inMonth ? 'bg-surface-2/50' : ''} ${isTarget ? 'bg-accent-soft' : ''} ${!wide && isSel ? 'bg-accent-soft' : ''}`}
              >
                <div className={`flex items-center ${wide ? 'justify-between px-1' : 'justify-center'}`}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      wide ? onOpenDay(d) : onSelectDay(d);
                    }}
                    className={`tnum grid h-7 min-w-7 place-items-center rounded-full px-1 text-[0.8125rem] font-semibold transition-colors ${
                      isToday
                        ? 'bg-accent text-white dark:text-[#0b0d12]'
                        : inMonth
                          ? 'text-ink hover:bg-surface-2'
                          : 'text-faint hover:bg-surface-2'
                    }`}
                  >
                    {d.getDate()}
                  </button>
                  {wide && (
                    <CalendarPlus size={14} className="mr-1 text-faint opacity-0 transition-opacity group-hover:opacity-100" />
                  )}
                </div>

                {wide ? (
                  <div className="mt-0.5 space-y-0.5">
                    {items.slice(0, maxPills).map((o) => {
                      const c = o.reminder.categoryId ? categories.get(o.reminder.categoryId) : undefined;
                      const hex = colorHex(c?.color);
                      const dragging = ghost?.occ.key === o.key;
                      return (
                        <div
                          key={o.key}
                          onPointerDown={(e) => beginDrag(e, o)}
                          onClick={(e) => e.stopPropagation()}
                          onContextMenu={(e) => e.preventDefault()}
                          className={`flex select-none items-center gap-1.5 truncate rounded-md px-1.5 py-[3px] text-[0.75rem] leading-tight transition-colors [-webkit-touch-callout:none] ${
                            o.reminder.allDay ? 'event event-solid border-l-0 font-semibold' : 'hover:bg-surface-2'
                          } ${o.done ? 'event-done' : ''} ${dragging ? 'opacity-30' : ''}`}
                          style={{ ['--c' as string]: hex }}
                          title={o.reminder.title}
                        >
                          {!o.reminder.allDay && <span className="dot" style={{ ['--c' as string]: hex }} />}
                          {!o.reminder.allDay && <span className="tnum shrink-0 text-muted">{formatTime(o.start)}</span>}
                          <span className="event-title truncate font-medium">{o.reminder.title}</span>
                        </div>
                      );
                    })}
                    {items.length > maxPills && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenDay(d);
                        }}
                        className="w-full rounded-md px-1.5 text-left text-[0.6875rem] font-semibold text-muted hover:bg-surface-2"
                      >
                        +{items.length - maxPills} więcej
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="mt-1 flex h-1.5 items-center gap-[3px]">
                    {items.slice(0, 4).map((o) => (
                      <span
                        key={o.key}
                        className={`h-1.5 w-1.5 rounded-full ${o.done ? 'opacity-35' : ''}`}
                        style={{ background: colorHex(o.reminder.categoryId ? categories.get(o.reminder.categoryId)?.color : null) }}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </motion.div>
      </div>

      {!wide && (
        <div className="px-3 pb-6 pt-4">
          <div className="mb-2 flex items-baseline justify-between px-2">
            <div className="font-display text-lg font-semibold">{longDayLabel(selected, now)}</div>
            <button className="text-sm font-semibold text-accent" onClick={() => onOpenDay(selected)}>
              Widok dnia
            </button>
          </div>
          <div className="card px-1.5 py-2">
            <AnimatePresence initial={false} mode="popLayout">
              {selectedItems.length ? (
                selectedItems.map((o) => (
                  <ReminderRow
                    key={o.key}
                    reminder={o.reminder}
                    occurrence={o}
                    category={o.reminder.categoryId ? categories.get(o.reminder.categoryId) : undefined}
                    now={now}
                  />
                ))
              ) : (
                <motion.button
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => openEditor({ draft: { start: setHours(selected, 9).toISOString(), allDay: false } })}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-4 text-left text-[0.9375rem] text-muted hover:bg-surface-2"
                >
                  <CalendarPlus size={18} /> Brak wpisów – dodaj coś na ten dzień
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {ghost &&
        createPortal(
          <div
            className="event event-solid pointer-events-none fixed z-[80] max-w-48 -translate-x-1/2 -translate-y-1/2 truncate rounded-lg px-2.5 py-1.5 text-[0.8125rem] font-semibold shadow-[var(--shadow-pop)] ring-2 ring-[var(--c)]"
            style={{
              left: ghost.x,
              top: ghost.y,
              ['--c' as string]: colorHex(ghost.occ.reminder.categoryId ? categories.get(ghost.occ.reminder.categoryId)?.color : null),
            }}
          >
            {ghost.occ.reminder.title}
          </div>,
          document.body,
        )}
    </div>
  );
}
