import {
  addDays,
  addMinutes,
  addMonths,
  addYears,
  differenceInCalendarWeeks,
  endOfDay,
  getDaysInMonth,
  startOfDay,
} from 'date-fns';
import { plural, WEEKDAY_SHORT } from './dates';
import type { Occurrence, Recurrence, Reminder, RepeatUnit } from './types';

interface NormalizedRule {
  unit: RepeatUnit;
  interval: number;
  weekdays: number[];
}

export function isRecurring(r: Pick<Reminder, 'recurrence'>): boolean {
  return r.recurrence.freq !== 'none';
}

export function normalizeRule(rule: Recurrence, ref: Date): NormalizedRule | null {
  switch (rule.freq) {
    case 'none':
      return null;
    case 'daily':
      return { unit: 'day', interval: 1, weekdays: [] };
    case 'weekdays':
      return { unit: 'week', interval: 1, weekdays: [1, 2, 3, 4, 5] };
    case 'weekly':
      return { unit: 'week', interval: 1, weekdays: rule.weekdays.length ? rule.weekdays : [ref.getDay()] };
    case 'monthly':
      return { unit: 'month', interval: 1, weekdays: [] };
    case 'custom': {
      const interval = Math.max(1, Math.floor(rule.interval || 1));
      const weekdays = rule.unit === 'week' ? (rule.weekdays.length ? rule.weekdays : [ref.getDay()]) : [];
      return { unit: rule.unit, interval, weekdays };
    }
  }
}

function withTimeOf(day: Date, time: Date): Date {
  const r = new Date(day);
  r.setHours(time.getHours(), time.getMinutes(), time.getSeconds(), 0);
  return r;
}

/**
 * Następne wystąpienie ŚCIŚLE po `current` (które samo musi spełniać regułę).
 * Zwraca null, gdy reguła się skończyła (`until`).
 */
export function nextOccurrence(rule: Recurrence, current: Date): Date | null {
  const n = normalizeRule(rule, current);
  if (!n) return null;
  let next: Date | null = null;

  switch (n.unit) {
    case 'day':
      next = addDays(current, n.interval);
      break;
    case 'week': {
      // Szukamy kolejnego dnia z listy, w tygodniu zgodnym z interwałem.
      for (let i = 1; i <= 7 * n.interval + 7; i++) {
        const d = addDays(current, i);
        const weekDiff = differenceInCalendarWeeks(d, current, { weekStartsOn: 1 });
        if (weekDiff % n.interval === 0 && n.weekdays.includes(d.getDay())) {
          next = d;
          break;
        }
      }
      break;
    }
    case 'month': {
      const day = rule.monthDay ?? current.getDate();
      const base = addMonths(new Date(current.getFullYear(), current.getMonth(), 1), n.interval);
      const d = new Date(base.getFullYear(), base.getMonth(), Math.min(day, getDaysInMonth(base)));
      next = withTimeOf(d, current);
      break;
    }
    case 'year':
      next = addYears(current, n.interval);
      break;
  }

  if (next && rule.until) {
    const [y, m, d] = rule.until.split('-').map(Number);
    if (next > endOfDay(new Date(y, m - 1, d))) return null;
  }
  return next;
}

/** Czy data spełnia regułę „w dni robocze” itp. – używane do wyrównania pierwszego wystąpienia. */
export function alignToRule(rule: Recurrence, candidate: Date): Date {
  const n = normalizeRule(rule, candidate);
  if (!n || n.unit !== 'week') return candidate;
  if (n.weekdays.includes(candidate.getDay())) return candidate;
  for (let i = 1; i <= 7; i++) {
    const d = addDays(candidate, i);
    if (n.weekdays.includes(d.getDay())) return d;
  }
  return candidate;
}

export function occurrenceEnd(r: Reminder, start: Date): Date {
  if (r.allDay) return endOfDay(start);
  return addMinutes(start, Math.max(0, r.durationMin));
}

export function occurrenceKey(r: Reminder, start: Date): string {
  return `${r.id}@${start.toISOString()}`;
}

/**
 * Wszystkie wystąpienia nachodzące na przedział [from, to].
 * Dla powtarzalnych: wystąpienia od bieżącego (`start`) w przód + historia zrobionych.
 */
export function occurrencesInRange(r: Reminder, from: Date, to: Date, max = 400): Occurrence[] {
  const out: Occurrence[] = [];
  const first = new Date(r.start);
  const overlaps = (s: Date, e: Date) => {
    const eff = r.allDay ? endOfDay(s) : e.getTime() === s.getTime() ? s : e;
    return s <= to && eff >= from;
  };

  if (!isRecurring(r)) {
    const end = occurrenceEnd(r, first);
    if (overlaps(first, end)) {
      out.push({ key: occurrenceKey(r, first), reminder: r, start: first, end, done: !!r.completedAt, isCurrent: true });
    }
    return out;
  }

  // Historia (zrobione wystąpienia sprzed bieżącego)
  for (const iso of r.completions) {
    const s = new Date(iso);
    const e = occurrenceEnd(r, s);
    if (overlaps(s, e)) out.push({ key: occurrenceKey(r, s), reminder: r, start: s, end: e, done: true, isCurrent: false });
  }

  let cur: Date | null = first;
  let guard = 0;
  while (cur && cur <= to && guard < 5000 && out.length < max) {
    const e = occurrenceEnd(r, cur);
    if (overlaps(cur, e)) {
      out.push({ key: occurrenceKey(r, cur), reminder: r, start: cur, end: e, done: false, isCurrent: guard === 0 });
    }
    cur = nextOccurrence(r.recurrence, cur);
    guard++;
  }
  return out;
}

/** Kolejne N przyszłych wystąpień (do powiadomień). */
export function upcomingOccurrences(r: Reminder, from: Date, until: Date, max: number): Date[] {
  const res: Date[] = [];
  let cur: Date | null = new Date(r.start);
  let guard = 0;
  while (cur && cur <= until && res.length < max && guard < 5000) {
    if (cur >= startOfDay(from)) res.push(cur);
    if (!isRecurring(r)) break;
    cur = nextOccurrence(r.recurrence, cur);
    guard++;
  }
  return res;
}

const UNIT_FORMS: Record<RepeatUnit, [string, string, string]> = {
  day: ['dzień', 'dni', 'dni'],
  week: ['tydzień', 'tygodnie', 'tygodni'],
  month: ['miesiąc', 'miesiące', 'miesięcy'],
  year: ['rok', 'lata', 'lat'],
};

function weekdaysText(days: number[]): string {
  const order = [1, 2, 3, 4, 5, 6, 0];
  return order
    .filter((d) => days.includes(d))
    .map((d) => WEEKDAY_SHORT[d])
    .join(', ');
}

export function describeRecurrence(rule: Recurrence, ref: Date): string {
  switch (rule.freq) {
    case 'none':
      return 'Nie powtarza się';
    case 'daily':
      return 'Codziennie';
    case 'weekdays':
      return 'W dni robocze';
    case 'weekly': {
      const days = rule.weekdays.length ? rule.weekdays : [ref.getDay()];
      return `Co tydzień (${weekdaysText(days)})`;
    }
    case 'monthly':
      return `Co miesiąc (${rule.monthDay ?? ref.getDate()}.)`;
    case 'custom': {
      const n = Math.max(1, rule.interval);
      const unitText = n === 1 ? UNIT_FORMS[rule.unit][0] : `${n} ${plural(n, UNIT_FORMS[rule.unit])}`;
      const prefix = rule.unit === 'week' && n === 1 ? 'Co tydzień' : `Co ${unitText}`;
      if (rule.unit === 'week') {
        const days = rule.weekdays.length ? rule.weekdays : [ref.getDay()];
        return `${prefix} (${weekdaysText(days)})`;
      }
      return prefix;
    }
  }
}

export function makeRecurrence(freq: Recurrence['freq'], ref: Date, extra?: Partial<Recurrence>): Recurrence {
  return {
    freq,
    interval: extra?.interval ?? 1,
    unit: extra?.unit ?? 'day',
    weekdays: extra?.weekdays ?? (freq === 'weekly' ? [ref.getDay()] : []),
    monthDay: freq === 'monthly' || (freq === 'custom' && extra?.unit === 'month') ? ref.getDate() : null,
    until: extra?.until ?? null,
  };
}

