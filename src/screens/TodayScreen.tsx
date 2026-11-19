import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, Clock, Moon, Plus, Sparkles, Sun, Sunrise, Sunset } from 'lucide-react';
import { ReminderRow } from '../components/ReminderRow';
import { ScreenHeader, SectionTitle } from '../components/ScreenHeader';
import { NotificationBanner } from '../components/NotificationBanner';
import { useCategoryMap, useReminders } from '../data/store';
import { buildToday, effectiveTime, occurrencesBetween } from '../lib/agenda';
import { addDays, endOfDay, startOfDay } from 'date-fns';
import { colorHex } from '../lib/colors';
import { dayLabel, formatTime, greeting, longDayLabel, relativeShort, toDateKey } from '../lib/dates';
import { useNow } from '../lib/hooks';
import type { Occurrence } from '../lib/types';
import { useUi } from '../state/ui';

type Phase = 'morning' | 'day' | 'evening' | 'night';
const phaseOf = (d: Date): Phase => {
  const h = d.getHours();
  if (h >= 5 && h < 11) return 'morning';
  if (h >= 11 && h < 17) return 'day';
  if (h >= 17 && h < 22) return 'evening';
  return 'night';
};
const PHASE_BG: Record<Phase, string> = {
  morning: 'linear-gradient(135deg, #FFC79A 0%, #FB8F8A 42%, #9C83F0 100%)',
  day: 'linear-gradient(135deg, #7CC0FF 0%, #5B7BFA 48%, #7A4FE0 100%)',
  evening: 'linear-gradient(135deg, #F7A1C0 0%, #A57CE6 48%, #4C4FC4 100%)',
  night: 'linear-gradient(135deg, #3E4596 0%, #282C66 55%, #15173A 100%)',
};
const PHASE_ICON = { morning: Sunrise, day: Sun, evening: Sunset, night: Moon };

export function TodayScreen() {
  const reminders = useReminders();
  const cats = useCategoryMap();
  const now = useNow(30_000);
  const setQuickAdd = useUi((s) => s.setQuickAdd);
  const agenda = useMemo(() => buildToday(reminders, now), [reminders, now]);
  const [showDone, setShowDone] = useState(false);

  const row = (o: Occurrence, extra?: Partial<Parameters<typeof ReminderRow>[0]>) => (
    <ReminderRow
      key={o.key}
      reminder={o.reminder}
      occurrence={o}
      category={o.reminder.categoryId ? cats.get(o.reminder.categoryId) : undefined}
      now={now}
      {...extra}
    />
  );

  const empty = !agenda.now.length && !agenda.next.length && !agenda.allDay.length && !agenda.overdue.length;

  return (
    <div className="mx-auto max-w-2xl xl:max-w-[76rem]">
      <ScreenHeader eyebrow={longDayLabel(now)} title="Dziś" />

      <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_21rem] xl:gap-6 xl:px-8">
      <div className="space-y-4 px-3 sm:px-5 lg:px-8 xl:px-0">
        <HeroCard agenda={agenda} now={now} />
        <NotificationBanner />

        <AnimatePresence initial={false}>
          {agenda.now.length > 0 && (
            <Section key="now">
              <SectionTitle tone="live">Teraz</SectionTitle>
              <AnimatePresence initial={false}>{agenda.now.map((o) => row(o, { showSnooze: true }))}</AnimatePresence>
            </Section>
          )}

          {agenda.overdue.length > 0 && (
            <Section key="overdue">
              <SectionTitle tone="danger" count={agenda.overdue.length}>
                Zaległe
              </SectionTitle>
              <AnimatePresence initial={false}>
                {agenda.overdue.map((o) => row(o, { timeMode: 'relative', showSnooze: true, tone: 'danger' }))}
              </AnimatePresence>
            </Section>
          )}

          {agenda.allDay.length > 0 && (
            <Section key="allday">
              <SectionTitle count={agenda.allDay.length}>Cały dzień</SectionTitle>
              <AnimatePresence initial={false}>{agenda.allDay.map((o) => row(o))}</AnimatePresence>
            </Section>
          )}

          {agenda.next.length > 0 && (
            <Section key="next">
              <SectionTitle count={agenda.next.length}>Dalej</SectionTitle>
              <AnimatePresence initial={false}>{agenda.next.map((o) => row(o))}</AnimatePresence>
            </Section>
          )}
        </AnimatePresence>

        {empty && <EmptyDay hasDone={agenda.doneCount > 0} onAdd={() => setQuickAdd(true)} />}

        {agenda.done.length > 0 && (
          <Section>
            <button className="flex w-full items-center" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone}>
              <SectionTitle
                count={agenda.done.length}
                right={<ChevronDown size={18} className={`text-muted transition-transform ${showDone ? 'rotate-180' : ''}`} />}
              >
                Zrobione dziś
              </SectionTitle>
            </button>
            <AnimatePresence initial={false}>
              {showDone && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  {agenda.done.map((o) => row(o))}
                </motion.div>
              )}
            </AnimatePresence>
          </Section>
        )}
        <div className="h-6" />
      </div>
      <aside className="hidden xl:block">
        <UpcomingPanel now={now} />
      </aside>
      </div>
    </div>
  );
}

function UpcomingPanel({ now }: { now: Date }) {
  const reminders = useReminders();
  const cats = useCategoryMap();
  const openEditor = useUi((s) => s.openEditor);
  const days = useMemo(() => {
    const from = startOfDay(addDays(now, 1));
    const to = endOfDay(addDays(now, 7));
    const occ = occurrencesBetween(reminders, from, to).filter((o) => !o.done);
    const map = new Map<string, Occurrence[]>();
    for (const o of occ) {
      const k = toDateKey(o.start);
      map.set(k, [...(map.get(k) ?? []), o]);
    }
    return [...map.entries()];
  }, [reminders, now]);

  return (
    <div className="sticky top-6 card px-2 py-3">
      <div className="px-3 pb-2">
        <div className="font-display text-base font-semibold">Nadchodzące</div>
        <div className="text-[0.8125rem] text-muted">Najbliższe 7 dni</div>
      </div>
      {!days.length && <div className="px-3 py-6 text-center text-sm text-muted">Nic zaplanowanego. Luz!</div>}
      <div className="scroll-thin max-h-[70vh] space-y-3 overflow-y-auto">
        {days.map(([key, items]) => (
          <div key={key}>
            <div className="px-3 pb-1 text-xs font-bold uppercase tracking-wider text-faint">{dayLabel(items[0].start, now)}</div>
            {items.map((o) => {
              const c = o.reminder.categoryId ? cats.get(o.reminder.categoryId) : undefined;
              return (
                <button
                  key={o.key}
                  onClick={() => openEditor({ reminderId: o.reminder.id, occurrenceStart: o.start.toISOString() })}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-surface-2"
                >
                  <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: colorHex(c?.color) }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{o.reminder.title}</span>
                    <span className="tnum text-xs text-muted">{o.reminder.allDay ? 'Cały dzień' : formatTime(o.start)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="card px-1.5 py-2.5"
    >
      {children}
    </motion.section>
  );
}

function HeroCard({ agenda, now }: { agenda: ReturnType<typeof buildToday>; now: Date }) {
  const phase = phaseOf(now);
  const Icon = PHASE_ICON[phase];
  const pct = agenda.total ? agenda.doneCount / agenda.total : 0;
  const R = 30;
  const C = 2 * Math.PI * R;
  const current = agenda.now[0];
  const nextUp = agenda.nextUp;

  let headline: React.ReactNode;
  if (current) {
    const end = current.reminder.durationMin > 0 ? ` · do ${formatTime(current.end)}` : '';
    headline = (
      <>
        <span className="opacity-80">Teraz{end}</span>
        <span className="mt-0.5 block truncate text-[1.125rem] font-semibold">{current.reminder.title}</span>
      </>
    );
  } else if (nextUp) {
    const eff = effectiveTime(nextUp.reminder);
    headline = (
      <>
        <span className="opacity-80">
          Następne {relativeShort(eff, now)} · {dayLabel(eff, now) === 'Dziś' ? formatTime(eff) : `${dayLabel(eff, now).toLowerCase()} ${formatTime(eff)}`}
        </span>
        <span className="mt-0.5 block truncate text-[1.125rem] font-semibold">{nextUp.reminder.title}</span>
      </>
    );
  } else {
    headline = (
      <>
        <span className="opacity-80">{greeting(now)}</span>
        <span className="mt-0.5 block text-[1.125rem] font-semibold">
          {agenda.total && agenda.doneCount === agenda.total ? 'Wszystko zrobione. Brawo!' : 'Spokojny dzień przed Tobą'}
        </span>
      </>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', damping: 26, stiffness: 260 }}
      className="relative overflow-hidden rounded-[1.5rem] p-5 text-white shadow-[0_18px_40px_-18px_rgb(79_107_245/0.6)]"
      style={{ background: PHASE_BG[phase] }}
    >
      <Icon size={148} strokeWidth={1} className="pointer-events-none absolute -right-8 -top-8 text-white/15" />
      <div className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      <div className="relative flex items-center gap-4">
        <div className="relative grid h-[76px] w-[76px] shrink-0 place-items-center">
          <svg width="76" height="76" viewBox="0 0 76 76" className="-rotate-90">
            <circle cx="38" cy="38" r={R} stroke="rgb(255 255 255 / 0.25)" strokeWidth="7" fill="none" />
            <motion.circle
              cx="38"
              cy="38"
              r={R}
              stroke="#fff"
              strokeWidth="7"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={C}
              initial={{ strokeDashoffset: C }}
              animate={{ strokeDashoffset: C * (1 - pct) }}
              transition={{ type: 'spring', damping: 22, stiffness: 90 }}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div className="tnum font-display text-lg font-bold leading-none">
              {agenda.doneCount}
              <span className="text-sm opacity-70">/{agenda.total}</span>
            </div>
          </div>
        </div>
        <div className="min-w-0 flex-1 text-sm">{headline}</div>
      </div>
      <div className="relative mt-4">
        <div className="mb-1.5 flex items-center justify-between text-[0.8125rem] font-medium">
          <span className="opacity-85">Postęp dnia</span>
          <span className="tnum font-semibold">{Math.round(pct * 100)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/25">
          <motion.div
            className="h-full rounded-full bg-white"
            initial={{ width: 0 }}
            animate={{ width: `${pct * 100}%` }}
            transition={{ type: 'spring', damping: 24, stiffness: 120 }}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[0.8125rem] font-medium">
          {agenda.overdue.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-[#ffd0d2]" /> {agenda.overdue.length} zaległe
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 backdrop-blur">
            <Clock size={13} /> {agenda.next.length + agenda.now.length + agenda.allDay.length} do zrobienia
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function EmptyDay({ hasDone, onAdd }: { hasDone: boolean; onAdd: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card flex flex-col items-center px-6 py-10 text-center"
    >
      <div className="relative mb-4 grid h-20 w-20 place-items-center rounded-[1.75rem] bg-accent-soft text-accent">
        <Sparkles size={34} />
      </div>
      <div className="font-display text-xl font-semibold">{hasDone ? 'Wszystko na dziś zrobione' : 'Czysta karta'}</div>
      <p className="mt-1 max-w-xs text-[0.9375rem] text-muted">
        {hasDone
          ? 'Możesz odpocząć albo zaplanować coś na jutro.'
          : 'Dodaj pierwsze przypomnienie – wpisz np. „jutro 15:00 telefon do klienta”.'}
      </p>
      <button className="btn btn-primary mt-5" onClick={onAdd}>
        <Plus size={18} /> Dodaj przypomnienie
      </button>
    </motion.div>
  );
}
