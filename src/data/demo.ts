import { addDays, setHours, setMinutes, startOfDay } from 'date-fns';
import { createReminder } from './actions';
import { categoriesLive } from './store';
import { makeRecurrence } from '../lib/recurrence';
import { NO_REPEAT, type Priority, type ReminderDraft } from '../lib/types';

/** Przykładowe dane – żeby od razu zobaczyć, jak wygląda aplikacja. */
export async function addDemoData(): Promise<number> {
  const cats = categoriesLive.current;
  const cat = (name: string) => cats.find((c) => c.name === name)?.id ?? null;
  const today = startOfDay(new Date());
  const at = (dayOffset: number, h: number, m = 0) => setMinutes(setHours(addDays(today, dayOffset), h), m);

  const items: Array<[string, Date, number, Priority, string | null, ReminderDraft['recurrence']?, string?, boolean?]> = [
    ['Stand-up z zespołem', at(0, 9, 30), 15, 'medium', cat('Praca'), makeRecurrence('weekdays', at(0, 9, 30))],
    ['Telefon do klienta', at(0, 11), 30, 'high', cat('Praca'), undefined, 'Omówić ofertę na Q1 i termin wdrożenia.'],
    ['Lunch z Kasią', at(0, 13), 60, 'low', cat('Osobiste')],
    ['Tabletki', at(0, 8), 0, 'high', cat('Zdrowie'), makeRecurrence('daily', at(0, 8))],
    ['Przegląd tygodnia', at(0, 16), 45, 'medium', cat('Praca')],
    ['Siłownia', at(0, 18, 30), 90, 'medium', cat('Zdrowie'), makeRecurrence('weekly', at(0, 18, 30), { weekdays: [1, 3, 5] })],
    ['Kupić prezent dla mamy', at(1, 0), 0, 'medium', cat('Zakupy'), undefined, undefined, true],
    ['Dentysta', at(1, 10), 60, 'high', cat('Zdrowie')],
    ['Opłacić czynsz', at(2, 9), 0, 'high', cat('Dom'), makeRecurrence('monthly', at(2, 9))],
    ['Wysłać raport', at(-1, 15), 0, 'high', cat('Praca')],
    ['Kino', at(3, 20), 150, 'low', cat('Osobiste')],
  ];

  for (const [title, start, durationMin, priority, categoryId, recurrence, notes, allDay] of items) {
    await createReminder({
      title,
      notes: notes ?? '',
      start: (allDay ? startOfDay(start) : start).toISOString(),
      allDay: !!allDay,
      durationMin,
      priority,
      categoryId,
      recurrence: recurrence ?? NO_REPEAT,
    });
  }
  return items.length;
}
