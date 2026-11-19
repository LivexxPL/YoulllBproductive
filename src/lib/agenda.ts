import { addDays, endOfDay, isSameDay, startOfDay, subMinutes } from 'date-fns';
import { isRecurring, occurrenceEnd, occurrenceKey, occurrencesInRange } from './recurrence';
import type { Occurrence, Priority, Reminder } from './types';

/** Chwila, w której przypomnienie „dzwoni” (z uwzględnieniem drzemki). */
export function effectiveTime(r: Reminder): Date {
  const start = new Date(r.start);
  if (r.snoozedUntil) {
    const s = new Date(r.snoozedUntil);
    if (s > start) return s;
  }
  return start;
}

export function isPending(r: Reminder): boolean {
  return !r.deletedAt && !r.completedAt;
}

function currentOccurrence(r: Reminder): Occurrence {
  const s = new Date(r.start);
  return { key: occurrenceKey(r, s), reminder: r, start: s, end: occurrenceEnd(r, s), done: false, isCurrent: true };
}

export interface TodayAgenda {
  now: Occurrence[];
  next: Occurrence[];
  allDay: Occurrence[];
  overdue: Occurrence[];
  done: Occurrence[];
  total: number;
  doneCount: number;
  nextUp: Occurrence | null;
}

const byTime = (a: Occurrence, b: Occurrence) => a.start.getTime() - b.start.getTime();
const byPriorityThenTime = (a: Occurrence, b: Occurrence) => {
  const rank: Record<Priority, number> = { high: 3, medium: 2, low: 1 };
  return rank[b.reminder.priority] - rank[a.reminder.priority] || byTime(a, b);
};

/** Ekran „Dziś”: teraz / dalej / zaległe / zrobione + postęp dnia. */
export function buildToday(reminders: Reminder[], now = new Date()): TodayAgenda {
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);
  const res: TodayAgenda = { now: [], next: [], allDay: [], overdue: [], done: [], total: 0, doneCount: 0, nextUp: null };
  const NOW_WINDOW = subMinutes(now, 15);

  for (const r of reminders) {
    if (r.deletedAt) continue;

    // Zrobione dziś (niepowtarzalne)
    if (r.completedAt) {
      if (isSameDay(new Date(r.completedAt), now) || isSameDay(new Date(r.start), now)) {
        res.done.push(currentOccurrence(r));
      }
      continue;
    }

    // Zrobione dziś wystąpienia serii
    if (isRecurring(r)) {
      for (const iso of r.completions) {
        const s = new Date(iso);
        if (s >= dayStart && s <= dayEnd) {
          res.done.push({ key: occurrenceKey(r, s), reminder: r, start: s, end: occurrenceEnd(r, s), done: true, isCurrent: false });
        }
      }
    }

    const occ = currentOccurrence(r);
    const eff = effectiveTime(r);
    const snoozed = eff.getTime() !== occ.start.getTime();

    if (r.allDay && !snoozed) {
      if (occ.start < dayStart) res.overdue.push(occ);
      else if (occ.start <= dayEnd) res.allDay.push(occ);
      continue;
    }

    const effEnd = snoozed ? eff : occ.end;
    const inProgress = !snoozed && r.durationMin > 0 && occ.start <= now && now < occ.end;
    const justDue = eff <= now && eff >= NOW_WINDOW && (snoozed || r.durationMin === 0);

    if (inProgress || justDue) res.now.push(occ);
    else if (effEnd < now || (eff < now && r.durationMin === 0)) res.overdue.push(occ);
    else if (eff <= dayEnd) res.next.push(occ);
  }

  res.now.sort(byTime);
  res.next.sort((a, b) => effectiveTime(a.reminder).getTime() - effectiveTime(b.reminder).getTime());
  res.allDay.sort(byPriorityThenTime);
  res.overdue.sort(byTime);
  res.done.sort(byTime);

  const overdueToday = res.overdue.filter((o) => o.start >= dayStart).length;
  res.doneCount = res.done.length;
  res.total = res.doneCount + res.now.length + res.next.length + res.allDay.length + overdueToday;

  // Najbliższa rzecz (także jutro), gdy „teraz” jest puste
  let best: Occurrence | null = res.next[0] ?? null;
  if (!best) {
    const tomorrowEnd = endOfDay(addDays(now, 1));
    for (const r of reminders) {
      if (!isPending(r) || r.allDay) continue;
      const eff = effectiveTime(r);
      if (eff > now && eff <= tomorrowEnd && (!best || eff < effectiveTime(best.reminder))) best = currentOccurrence(r);
    }
  }
  res.nextUp = best;
  return res;
}

/** Wystąpienia w przedziale (kalendarz). */
export function occurrencesBetween(reminders: Reminder[], from: Date, to: Date): Occurrence[] {
  const out: Occurrence[] = [];
  for (const r of reminders) {
    if (r.deletedAt) continue;
    out.push(...occurrencesInRange(r, from, to));
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime() || Number(b.reminder.allDay) - Number(a.reminder.allDay));
}

export interface ReminderFilter {
  query: string;
  categories: string[]; // puste = wszystkie; 'none' = bez kategorii
  priorities: Priority[];
  status: 'active' | 'done' | 'all';
}

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l');

export function filterReminders(reminders: Reminder[], f: ReminderFilter, categoryNames: Map<string, string>): Reminder[] {
  const q = fold(f.query.trim());
  const words = q ? q.split(/\s+/) : [];
  return reminders.filter((r) => {
    if (r.deletedAt) return false;
    const done = !!r.completedAt;
    if (f.status === 'active' && done) return false;
    if (f.status === 'done' && !done && !(isRecurring(r) && r.completions.length)) return false;
    if (f.categories.length) {
      const key = r.categoryId ?? 'none';
      if (!f.categories.includes(key)) return false;
    }
    if (f.priorities.length && !f.priorities.includes(r.priority)) return false;
    if (words.length) {
      const hay = fold(`${r.title} ${r.notes} ${r.categoryId ? categoryNames.get(r.categoryId) ?? '' : ''}`);
      if (!words.every((w) => hay.includes(w))) return false;
    }
    return true;
  });
}

export interface ListGroup {
  key: string;
  label: string;
  tone?: 'danger' | 'muted';
  items: Reminder[];
}

/** Grupowanie listy: Zaległe, Dziś, Jutro, Ten tydzień, Później, Zrobione. */
export function groupForList(reminders: Reminder[], now = new Date()): ListGroup[] {
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const in2 = addDays(today, 2);
  const week = addDays(today, 7);
  const groups: Record<string, ListGroup> = {
    overdue: { key: 'overdue', label: 'Zaległe', tone: 'danger', items: [] },
    today: { key: 'today', label: 'Dziś', items: [] },
    tomorrow: { key: 'tomorrow', label: 'Jutro', items: [] },
    week: { key: 'week', label: 'Najbliższe 7 dni', items: [] },
    later: { key: 'later', label: 'Później', items: [] },
    done: { key: 'done', label: 'Zrobione', tone: 'muted', items: [] },
  };
  for (const r of reminders) {
    if (r.completedAt) {
      groups.done.items.push(r);
      continue;
    }
    const eff = effectiveTime(r);
    const end = r.allDay ? endOfDay(eff) : eff;
    if (end < now) groups.overdue.items.push(r);
    else if (eff < tomorrow) groups.today.items.push(r);
    else if (eff < in2) groups.tomorrow.items.push(r);
    else if (eff < week) groups.week.items.push(r);
    else groups.later.items.push(r);
  }
  const sortAsc = (a: Reminder, b: Reminder) => effectiveTime(a).getTime() - effectiveTime(b).getTime();
  Object.values(groups).forEach((g) => g.items.sort(sortAsc));
  groups.done.items.sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
  return Object.values(groups).filter((g) => g.items.length);
}
