import { addDays, addMinutes, differenceInCalendarDays, startOfDay } from 'date-fns';
import { repository } from './repository';
import { categoriesLive, remindersLive } from './store';
import { nowIso, uuid } from '../lib/ids';
import { isRecurring, nextOccurrence } from '../lib/recurrence';
import { CATEGORY_COLOR_KEYS } from '../lib/colors';
import type { Category, CategoryColor, Reminder, ReminderDraft } from '../lib/types';

const MAX_COMPLETIONS = 120;

function touch<T extends { updatedAt: string }>(x: T): T {
  return { ...x, updatedAt: nowIso() };
}

export function findReminder(id: string): Reminder | undefined {
  return remindersLive.current.find((r) => r.id === id);
}

export async function createReminder(draft: ReminderDraft): Promise<Reminder> {
  const now = nowIso();
  const r: Reminder = {
    ...draft,
    id: draft.id ?? uuid(),
    title: draft.title.trim() || 'Bez tytułu',
    completedAt: null,
    completions: [],
    snoozedUntil: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await repository.reminders.put(r);
  return r;
}

export async function updateReminder(id: string, patch: Partial<Reminder>): Promise<Reminder | undefined> {
  const cur = (await repository.reminders.get(id)) ?? findReminder(id);
  if (!cur) return;
  const next = touch({ ...cur, ...patch });
  // Zmiana terminu kasuje drzemkę
  if (patch.start && patch.start !== cur.start && patch.snoozedUntil === undefined) next.snoozedUntil = null;
  await repository.reminders.put(next);
  return next;
}

/** Zapisz cały rekord (np. przy „Cofnij”). */
export async function restoreReminder(r: Reminder): Promise<void> {
  await repository.reminders.put(touch({ ...r, deletedAt: null }));
}

/**
 * Oznacz bieżące wystąpienie jako zrobione.
 * Dla powtarzalnych: zapisz w historii i przesuń na kolejne wystąpienie.
 */
export async function completeReminder(r: Reminder): Promise<Reminder> {
  const now = nowIso();
  let next: Reminder;
  if (isRecurring(r)) {
    const cur = new Date(r.start);
    const nxt = nextOccurrence(r.recurrence, cur);
    const completions = [...r.completions, r.start].slice(-MAX_COMPLETIONS);
    next = nxt
      ? { ...r, start: nxt.toISOString(), completions, snoozedUntil: null, updatedAt: now }
      : { ...r, completions, completedAt: now, snoozedUntil: null, updatedAt: now };
  } else {
    next = { ...r, completedAt: now, snoozedUntil: null, updatedAt: now };
  }
  await repository.reminders.put(next);
  return next;
}

export async function uncompleteReminder(r: Reminder): Promise<void> {
  if (isRecurring(r) && !r.completedAt && r.completions.length) {
    // Cofnij ostatnie wystąpienie
    const last = r.completions[r.completions.length - 1];
    await repository.reminders.put(touch({ ...r, start: last, completions: r.completions.slice(0, -1) }));
    return;
  }
  await repository.reminders.put(touch({ ...r, completedAt: null }));
}

export type SnoozeOption = 5 | 15 | 60 | 'tomorrow';

export function snoozeTarget(r: Reminder, opt: SnoozeOption, now = new Date()): Date {
  if (opt === 'tomorrow') {
    const base = new Date(r.start);
    const d = addDays(startOfDay(now), 1);
    if (r.allDay) d.setHours(9, 0, 0, 0);
    else d.setHours(base.getHours(), base.getMinutes(), 0, 0);
    return d;
  }
  const d = addMinutes(now, opt);
  d.setSeconds(0, 0);
  return d;
}

export async function snoozeReminder(r: Reminder, opt: SnoozeOption): Promise<Date> {
  const target = snoozeTarget(r, opt);
  await updateReminder(r.id, { snoozedUntil: target.toISOString() });
  return target;
}

export async function deleteReminder(id: string): Promise<void> {
  await repository.reminders.softDelete(id);
}

/**
 * Przeniesienie wystąpienia (drag & drop w kalendarzu).
 * Dla serii przesuwamy całą serię o tę samą różnicę.
 */
export async function moveOccurrence(
  r: Reminder,
  occStart: Date,
  newStart: Date,
  newDurationMin?: number,
): Promise<'single' | 'series'> {
  const delta = newStart.getTime() - occStart.getTime();
  const patch: Partial<Reminder> = {};
  if (newDurationMin !== undefined) patch.durationMin = newDurationMin;
  if (!isRecurring(r)) {
    patch.start = newStart.toISOString();
    await updateReminder(r.id, patch);
    return 'single';
  }
  const shifted = new Date(new Date(r.start).getTime() + delta);
  patch.start = shifted.toISOString();
  const dayShift = differenceInCalendarDays(newStart, occStart);
  if (dayShift !== 0) {
    const rec = { ...r.recurrence };
    if (rec.weekdays.length) rec.weekdays = rec.weekdays.map((d) => (((d + dayShift) % 7) + 7) % 7);
    if (rec.monthDay) rec.monthDay = shifted.getDate();
    patch.recurrence = rec;
  }
  if (delta !== 0 || newDurationMin !== undefined) await updateReminder(r.id, patch);
  return 'series';
}

// ——— Kategorie ———

export async function createCategory(name: string, color?: CategoryColor): Promise<Category> {
  const now = nowIso();
  const existing = categoriesLive.current;
  const used = new Set(existing.map((c) => c.color));
  const c: Category = {
    id: uuid(),
    name: name.trim() || 'Nowa kategoria',
    color: color ?? CATEGORY_COLOR_KEYS.find((k) => !used.has(k)) ?? 'slate',
    order: existing.length ? Math.max(...existing.map((x) => x.order)) + 1 : 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await repository.categories.put(c);
  return c;
}

export async function updateCategory(id: string, patch: Partial<Category>): Promise<void> {
  const cur = await repository.categories.get(id);
  if (!cur) return;
  await repository.categories.put(touch({ ...cur, ...patch }));
}

export async function deleteCategory(id: string): Promise<void> {
  await repository.transaction(async () => {
    await repository.categories.softDelete(id);
    const all = await repository.reminders.getAllRaw();
    const now = nowIso();
    await repository.reminders.bulkPut(
      all.filter((r) => r.categoryId === id).map((r) => ({ ...r, categoryId: null, updatedAt: now })),
    );
  });
}
