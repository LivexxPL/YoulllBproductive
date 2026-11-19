import { useMemo, useState } from 'react';
import { addDays, addMonths, endOfMonth, endOfWeek, isSameDay, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { capitalize, fmt, orderedWeekdays, toDateKey, WEEKDAY_SHORT } from '../lib/dates';
import { occurrencesBetween } from '../lib/agenda';
import { useReminders } from '../data/store';
import { useSettings } from '../state/settings';

interface Props {
  selected: Date;
  onSelect: (d: Date) => void;
}

export function MiniMonth({ selected, onSelect }: Props) {
  const [month, setMonth] = useState(() => startOfMonth(selected));
  const weekStartsOn = useSettings((s) => s.weekStartsOn);
  const reminders = useReminders();
  const today = new Date();

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn });
    const out: Date[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
    return out;
  }, [month, weekStartsOn]);

  const busy = useMemo(() => {
    const set = new Set<string>();
    for (const o of occurrencesBetween(reminders, days[0], days[days.length - 1])) if (!o.done) set.add(toDateKey(o.start));
    return set;
  }, [reminders, days]);

  return (
    <div className="select-none">
      <div className="mb-1 flex items-center px-1">
        <span className="flex-1 text-sm font-semibold">{capitalize(fmt(month, 'LLLL yyyy'))}</span>
        <button className="icon-btn h-7 w-7" onClick={() => setMonth((m) => addMonths(m, -1))} aria-label="Poprzedni miesiąc">
          <ChevronLeft size={16} />
        </button>
        <button className="icon-btn h-7 w-7" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Następny miesiąc">
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-[0.6875rem] font-semibold uppercase text-faint">
        {orderedWeekdays(weekStartsOn).map((d) => (
          <div key={d} className="py-1">
            {WEEKDAY_SHORT[d]}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5 text-center">
        {days.map((d) => {
          const sel = isSameDay(d, selected);
          const isToday = isSameDay(d, today);
          const inMonth = isSameMonth(d, month);
          return (
            <button
              key={d.toISOString()}
              onClick={() => onSelect(d)}
              className={`tnum relative mx-auto grid h-8 w-8 place-items-center rounded-full text-[0.8125rem] font-medium transition-colors ${
                sel
                  ? 'bg-accent text-white dark:text-[#0b0d12]'
                  : isToday
                    ? 'text-accent font-bold'
                    : inMonth
                      ? 'text-ink-2 hover:bg-surface-2'
                      : 'text-faint/70 hover:bg-surface-2'
              }`}
            >
              {d.getDate()}
              {busy.has(toDateKey(d)) && !sel && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-accent/70" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
