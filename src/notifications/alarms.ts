import { addDays } from 'date-fns';
import { hash31 } from '../lib/ids';
import { upcomingOccurrences } from '../lib/recurrence';
import { formatTime, dayLabel, setTimeOfDay } from '../lib/dates';
import type { Category, Priority, Reminder } from '../lib/types';

/** Jeden zaplanowany „dzwonek”. */
export interface Alarm {
  /** Stabilne 31-bitowe ID (natywne powiadomienia). Zmienia się, gdy zmieni się treść/czas. */
  id: number;
  /** Klucz wystąpienia: `reminderId@ISO`. */
  key: string;
  reminderId: string;
  occurrence: string;
  at: Date;
  title: string;
  body: string;
  priority: Priority;
  color: string | null;
}

export interface AlarmOptions {
  from: Date;
  horizonDays: number;
  maxTotal: number;
  maxPerReminder: number;
  allDayTime: string;
  /** Dodatkowy składnik ID (np. kanał), by po zmianie ustawień przeplanować. */
  salt?: string;
}

export function computeAlarms(reminders: Reminder[], categories: Map<string, Category>, opts: AlarmOptions): Alarm[] {
  const until = addDays(opts.from, opts.horizonDays);
  const out: Alarm[] = [];
  for (const r of reminders) {
    if (r.deletedAt || r.completedAt) continue;
    const occs = upcomingOccurrences(r, opts.from, until, opts.maxPerReminder);
    const cat = r.categoryId ? categories.get(r.categoryId) : undefined;
    occs.forEach((occ, i) => {
      let at = r.allDay ? setTimeOfDay(occ, opts.allDayTime) : occ;
      const isCurrent = i === 0 && occ.toISOString() === new Date(r.start).toISOString();
      if (isCurrent && r.snoozedUntil) {
        const s = new Date(r.snoozedUntil);
        if (s > at) at = s;
      }
      if (at < opts.from) return;
      const when = r.allDay ? `${dayLabel(occ)} · cały dzień` : `${formatTime(occ)}${r.durationMin ? `–${formatTime(new Date(occ.getTime() + r.durationMin * 60000))}` : ''}`;
      const parts = [when, cat?.name].filter(Boolean).join(' · ');
      const notes = r.notes.split('\n')[0]?.trim();
      const occurrence = occ.toISOString();
      const title = r.priority === 'high' ? `❗ ${r.title}` : r.title;
      const body = notes ? `${parts}\n${notes}` : parts;
      out.push({
        id: hash31(`${r.id}|${occurrence}|${at.toISOString()}|${title}|${body}|${opts.salt ?? ''}`),
        key: `${r.id}@${occurrence}`,
        reminderId: r.id,
        occurrence,
        at,
        title,
        body,
        priority: r.priority,
        color: cat?.color ?? null,
      });
    });
  }
  out.sort((a, b) => a.at.getTime() - b.at.getTime());
  return out.slice(0, opts.maxTotal);
}
