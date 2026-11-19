import { motion } from 'motion/react';
import { memo, useRef, useState } from 'react';
import { AlarmClock, BellRing, Flag, Repeat, StickyNote, Timer } from 'lucide-react';
import { CheckCircle } from './ui/CheckCircle';
import { MenuItem, Popover } from './ui/Popover';
import { SNOOZE_OPTIONS, snoozeWithToast, toggleDone } from './reminderUi';
import { colorHex, PRIORITY_META } from '../lib/colors';
import { dayLabel, durationLabel, formatTime, relativeShort } from '../lib/dates';
import { describeRecurrence, isRecurring } from '../lib/recurrence';
import { effectiveTime } from '../lib/agenda';
import type { Category, Occurrence, Reminder } from '../lib/types';
import { useUi } from '../state/ui';

interface Props {
  reminder: Reminder;
  occurrence?: Occurrence;
  category?: Category;
  now: Date;
  /** Jak opisać termin: godzina (Dziś), data+godzina (lista), względnie (zaległe). */
  timeMode?: 'time' | 'date' | 'relative';
  showSnooze?: boolean;
  tone?: 'danger';
}

function ReminderRowBase({ reminder: r, occurrence, category, now, timeMode = 'time', showSnooze, tone }: Props) {
  const openEditor = useUi((s) => s.openEditor);
  const [checking, setChecking] = useState(false);
  const snoozeRef = useRef<HTMLButtonElement>(null);
  const [snoozeOpen, setSnoozeOpen] = useState(false);

  const color = colorHex(category?.color);
  const done = occurrence ? occurrence.done : !!r.completedAt;
  const checked = done || checking;
  const start = occurrence?.start ?? new Date(r.start);
  const eff = effectiveTime(r);
  const snoozed = !done && r.snoozedUntil && eff.getTime() !== new Date(r.start).getTime();

  let when: string;
  if (r.allDay) when = timeMode === 'time' ? 'Cały dzień' : dayLabel(start, now);
  else if (timeMode === 'relative') when = `${dayLabel(start, now)}, ${formatTime(start)}`;
  else if (timeMode === 'date') when = `${dayLabel(start, now)}, ${formatTime(start)}`;
  else when = formatTime(start) + (r.durationMin > 0 ? `–${formatTime(new Date(start.getTime() + r.durationMin * 60000))}` : '');

  const onToggle = () => {
    const lastDone = r.completions[r.completions.length - 1];
    if (
      occurrence &&
      !occurrence.isCurrent &&
      (!occurrence.done || (!r.completedAt && lastDone !== start.toISOString()))
    ) {
      openEditor({ reminderId: r.id, occurrenceStart: start.toISOString() });
      return;
    }
    if (checked && !done) return;
    if (!done) {
      setChecking(true);
      window.setTimeout(() => {
        toggleDone(r).finally(() => setChecking(false));
      }, 380);
    } else toggleDone(r);
  };

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0, transition: { duration: 0.22 } }}
      transition={{ type: 'spring', damping: 30, stiffness: 360 }}
      className="overflow-hidden"
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => openEditor({ reminderId: r.id, occurrenceStart: occurrence?.start.toISOString() })}
        onKeyDown={(e) => e.key === 'Enter' && openEditor({ reminderId: r.id })}
        className="group flex w-full cursor-pointer items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-surface-2 active:bg-surface-3"
      >
        <div className="pt-0.5">
          <CheckCircle checked={checked} color={color} onToggle={onToggle} size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <span
              className={`min-w-0 flex-1 text-[0.96875rem] font-medium leading-snug transition-colors ${
                checked ? 'text-faint line-through decoration-[color-mix(in_oklab,var(--ink)_30%,transparent)]' : 'text-ink'
              }`}
            >
              {r.title}
            </span>
            {r.priority !== 'low' && !checked && (
              <Flag
                size={15}
                className="mt-0.5 shrink-0"
                style={{ color: PRIORITY_META[r.priority].hex }}
                fill={r.priority === 'high' ? PRIORITY_META.high.hex : 'none'}
                aria-label={`Priorytet: ${PRIORITY_META[r.priority].label}`}
              />
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[0.8125rem] text-muted">
            <span className={`tnum font-medium ${tone === 'danger' && !checked ? 'text-danger' : ''}`}>{when}</span>
            {timeMode === 'relative' && !r.allDay && !checked && (
              <span className="text-danger/80">{relativeShort(eff, now)}</span>
            )}
            {snoozed && (
              <span className="inline-flex items-center gap-1 font-medium text-warn">
                <AlarmClock size={13} /> {formatTime(eff)}
              </span>
            )}
            {category && (
              <span className="inline-flex items-center gap-1.5">
                <span className="dot" style={{ ['--c' as string]: color }} />
                {category.name}
              </span>
            )}
            {r.durationMin > 0 && !r.allDay && timeMode !== 'time' && (
              <span className="inline-flex items-center gap-1">
                <Timer size={13} /> {durationLabel(r.durationMin)}
              </span>
            )}
            {isRecurring(r) && (
              <span className="inline-flex items-center gap-1" title={describeRecurrence(r.recurrence, start)}>
                <Repeat size={13} />
                <span className="hidden sm:inline">{describeRecurrence(r.recurrence, start)}</span>
              </span>
            )}
            {r.notes && <StickyNote size={13} aria-label="Ma notatkę" />}
          </div>
        </div>
        {showSnooze && !checked && (
          <>
            <button
              ref={snoozeRef}
              className="icon-btn -my-1 -mr-1 h-9 w-9 text-muted"
              aria-label="Drzemka"
              onClick={(e) => {
                e.stopPropagation();
                setSnoozeOpen(true);
              }}
            >
              <BellRing size={18} />
            </button>
            <Popover anchor={snoozeRef} open={snoozeOpen} onClose={() => setSnoozeOpen(false)} width={200}>
              <div className="px-3 pb-1 pt-1.5 text-xs font-semibold uppercase tracking-wide text-faint">Drzemka</div>
              {SNOOZE_OPTIONS.map((o) => (
                <MenuItem
                  key={String(o.value)}
                  icon={<AlarmClock size={16} />}
                  hint={o.hint}
                  onClick={() => {
                    setSnoozeOpen(false);
                    snoozeWithToast(r, o.value);
                  }}
                >
                  {o.label}
                </MenuItem>
              ))}
            </Popover>
          </>
        )}
      </div>
    </motion.div>
  );
}

export const ReminderRow = memo(ReminderRowBase);
