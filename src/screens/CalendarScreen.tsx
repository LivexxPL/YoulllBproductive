import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  addDays,
  addMonths,
  addWeeks,
  endOfDay,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfWeek,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MonthView, monthGridDays } from '../components/calendar/MonthView';
import { TimeGrid } from '../components/calendar/TimeGrid';
import { useSwipeNav } from '../components/calendar/useSwipe';
import { useCategoryMap, useReminders } from '../data/store';
import { occurrencesBetween } from '../lib/agenda';
import { capitalize, daysRange, fmt, toDateKey } from '../lib/dates';
import { useIsDesktop, useNow } from '../lib/hooks';
import { useSettings, type CalendarView } from '../state/settings';
import { useUi } from '../state/ui';

const VIEWS: Array<{ value: CalendarView; label: string }> = [
  { value: 'day', label: 'Dzień' },
  { value: 'week', label: 'Tydzień' },
  { value: 'month', label: 'Miesiąc' },
];

export function CalendarScreen() {
  const reminders = useReminders();
  const categories = useCategoryMap();
  const now = useNow(60_000);
  const view = useSettings((s) => s.calendarView);
  const weekStartsOn = useSettings((s) => s.weekStartsOn);
  const setSettings = useSettings((s) => s.set);
  const date = useUi((s) => s.calendarDate);
  const setDate = useUi((s) => s.setCalendarDate);
  const desktop = useIsDesktop();
  const [enterDir, setEnterDir] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const days = useMemo(() => {
    if (view === 'day') return [startOfDay(date)];
    if (view === 'week') return daysRange(startOfWeek(date, { weekStartsOn }), 7);
    return monthGridDays(date, weekStartsOn);
  }, [view, date, weekStartsOn]);

  const occurrences = useMemo(
    () => occurrencesBetween(reminders, days[0], endOfDay(days[days.length - 1])),
    [reminders, days],
  );

  const step = useCallback(
    (dir: 1 | -1) => {
      setEnterDir(dir);
      const d = useUi.getState().calendarDate;
      const v = useSettings.getState().calendarView;
      setDate(v === 'day' ? addDays(d, dir) : v === 'week' ? addWeeks(d, dir) : addMonths(d, dir));
    },
    [setDate],
  );

  useSwipeNav(containerRef, contentRef, step);

  // Klawiatura: ← → T, D/W/M
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea') || document.querySelector('[role="dialog"]')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 't') {
        setEnterDir(0);
        setDate(new Date());
      } else if (e.key === 'd') setSettings({ calendarView: 'day' });
      else if (e.key === 'w') setSettings({ calendarView: 'week' });
      else if (e.key === 'm') setSettings({ calendarView: 'month' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, setDate, setSettings]);

  const periodKey = `${view}-${toDateKey(days[0])}`;

  let title: string;
  let subtitle: string;
  if (view === 'month') {
    title = capitalize(fmt(date, 'LLLL'));
    subtitle = fmt(date, 'yyyy');
  } else if (view === 'week') {
    const s = days[0];
    const e = days[6];
    title = capitalize(fmt(s, 'LLLL'));
    subtitle = isSameMonth(s, e) ? `${s.getDate()}–${e.getDate()} ${fmt(e, 'MMM yyyy')}` : `${fmt(s, 'd MMM')} – ${fmt(e, 'd MMM yyyy')}`;
    if (!isSameMonth(s, e)) title = `${capitalize(fmt(s, 'LLL'))} – ${capitalize(fmt(e, 'LLL'))}`;
  } else {
    title = capitalize(fmt(date, desktop ? 'EEEE, d MMMM' : 'd MMMM'));
    subtitle = desktop ? fmt(date, 'yyyy') : capitalize(fmt(date, 'EEEE, yyyy'));
  }

  const isCurrent =
    view === 'day' ? isSameDay(date, now) : view === 'week' ? isSameDay(startOfWeek(date, { weekStartsOn }), startOfWeek(now, { weekStartsOn })) : isSameMonth(date, now);

  return (
    <div className="flex h-[calc(100dvh-5.5rem-var(--safe-bottom))] flex-col lg:h-dvh">
      <header className="pt-safe shrink-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pb-3 pt-4 lg:px-6 lg:pt-6">
          <div className="min-w-0 flex-1">
            <motion.h1
              key={title}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="truncate font-display text-[1.625rem] font-bold leading-tight lg:text-[1.875rem]"
            >
              {title}
            </motion.h1>
            <div className="text-[0.875rem] font-medium text-muted">{subtitle}</div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setEnterDir(0);
                setDate(new Date());
              }}
              disabled={isCurrent}
              className="chip h-9 px-3.5 font-semibold disabled:opacity-50"
            >
              Dziś
            </button>
            <button className="icon-btn" onClick={() => step(-1)} aria-label="Wstecz">
              <ChevronLeft size={20} />
            </button>
            <button className="icon-btn" onClick={() => step(1)} aria-label="Dalej">
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="relative grid w-full grid-cols-3 rounded-xl bg-surface-2 p-1 sm:w-auto">
            {VIEWS.map((v) => {
              const active = view === v.value;
              return (
                <button
                  key={v.value}
                  onClick={() => setSettings({ calendarView: v.value })}
                  className={`relative h-8 rounded-lg px-4 text-[0.8125rem] font-semibold transition-colors ${active ? 'text-ink' : 'text-muted hover:text-ink'}`}
                >
                  {active && (
                    <motion.span
                      layoutId="cal-view"
                      className="absolute inset-0 rounded-lg bg-surface shadow-sm"
                      transition={{ type: 'spring', damping: 30, stiffness: 420 }}
                    />
                  )}
                  <span className="relative">{v.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div
        ref={containerRef}
        className="mx-2 mb-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.25rem] bg-surface shadow-[var(--shadow-card)] lg:mx-6 lg:mb-6"
        style={{ touchAction: 'pan-y' }}
      >
        {view === 'month' ? (
          <MonthView
            month={date}
            selected={date}
            occurrences={occurrences}
            categories={categories}
            now={now}
            periodKey={periodKey}
            enterDir={enterDir}
            contentRef={contentRef}
            onSelectDay={(d) => setDate(d)}
            onOpenDay={(d) => {
              setDate(d);
              setSettings({ calendarView: 'day' });
            }}
          />
        ) : (
          <TimeGrid
            key={view}
            days={days}
            occurrences={occurrences}
            categories={categories}
            now={now}
            periodKey={periodKey}
            enterDir={enterDir}
            contentRef={contentRef}
            onSelectDay={(d) => {
              setDate(d);
              setSettings({ calendarView: 'day' });
            }}
          />
        )}
      </div>
    </div>
  );
}

