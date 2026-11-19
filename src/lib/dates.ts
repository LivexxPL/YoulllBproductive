import {
  addDays,
  differenceInCalendarDays,
  differenceInMinutes,
  format,
  isSameYear,
  startOfDay,
} from 'date-fns';
import { pl } from 'date-fns/locale';

export const locale = pl;

/** Polska odmiana liczebników: [1, 2–4, 5+] np. ['minuta','minuty','minut']. */
export function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n);
  if (abs === 1) return forms[0];
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return forms[1];
  return forms[2];
}

export const fmt = (d: Date, pattern: string) => format(d, pattern, { locale: pl });

export const formatTime = (d: Date) => format(d, 'HH:mm');

/** „Dziś”, „Jutro”, „Wczoraj” albo „pt., 21 lis”. */
export function dayLabel(d: Date, now = new Date()): string {
  const diff = differenceInCalendarDays(d, now);
  if (diff === 0) return 'Dziś';
  if (diff === 1) return 'Jutro';
  if (diff === 2) return 'Pojutrze';
  if (diff === -1) return 'Wczoraj';
  if (diff > 1 && diff < 7) return capitalize(fmt(d, 'EEEE'));
  return capitalize(fmt(d, isSameYear(d, now) ? 'EEE, d MMM' : 'EEE, d MMM yyyy'));
}

/** Pełny opis dnia: „Czwartek, 19 listopada”. */
export function longDayLabel(d: Date, now = new Date()): string {
  return capitalize(fmt(d, isSameYear(d, now) ? 'EEEE, d MMMM' : 'EEEE, d MMMM yyyy'));
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** „za 25 min”, „za 2 godz.”, „5 min temu”, „teraz”. */
export function relativeShort(target: Date, now = new Date()): string {
  const mins = differenceInMinutes(target, now, { roundingMethod: 'round' });
  const abs = Math.abs(mins);
  let body: string;
  if (abs < 1) return 'teraz';
  if (abs < 60) body = `${abs} min`;
  else if (abs < 60 * 24) {
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    body = m && h < 5 ? `${h} godz. ${m} min` : `${h} godz.`;
  } else {
    const days = Math.round(abs / (60 * 24));
    body = `${days} ${plural(days, ['dzień', 'dni', 'dni'])}`;
  }
  return mins > 0 ? `za ${body}` : `${body} temu`;
}

export function durationLabel(min: number): string {
  if (min <= 0) return 'Bez czasu trwania';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** yyyy-MM-dd w czasie lokalnym. */
export const toDateKey = (d: Date) => format(d, 'yyyy-MM-dd');

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function setTimeOfDay(d: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const r = new Date(d);
  r.setHours(h || 0, m || 0, 0, 0);
  return r;
}

export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function nextRoundHour(now = new Date()): Date {
  const d = new Date(now);
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 5) return 'Dobranoc';
  if (h < 12) return 'Dzień dobry';
  if (h < 18) return 'Miłego popołudnia';
  return 'Dobry wieczór';
}

export const WEEKDAY_SHORT = ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb'];
export const WEEKDAY_NAMES = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];

/** Dni tygodnia w kolejności od poniedziałku (lub niedzieli). */
export function orderedWeekdays(weekStartsOn: 0 | 1): number[] {
  return weekStartsOn === 1 ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];
}

export function daysRange(from: Date, count: number): Date[] {
  const s = startOfDay(from);
  return Array.from({ length: count }, (_, i) => addDays(s, i));
}
