/**
 * Model danych aplikacji.
 *
 * Każdy rekord ma `id` (UUID), `createdAt`, `updatedAt` i `deletedAt`
 * (usuwanie „miękkie”, tzw. tombstone). Dzięki temu łatwo dołożyć później
 * synchronizację (np. Supabase) w modelu „ostatni zapis wygrywa”.
 */

export type Priority = 'low' | 'medium' | 'high';

export type RepeatFreq = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'custom';
export type RepeatUnit = 'day' | 'week' | 'month' | 'year';

export interface Recurrence {
  freq: RepeatFreq;
  /** Co ile jednostek (tylko dla `custom`). */
  interval: number;
  /** Jednostka (tylko dla `custom`). */
  unit: RepeatUnit;
  /** Dni tygodnia 0–6 (0 = niedziela) – dla `weekly` i `custom` z jednostką `week`. */
  weekdays: number[];
  /** Dzień miesiąca, przy powtarzaniu miesięcznym (żeby 31. nie „dryfowało”). */
  monthDay: number | null;
  /** Ostatni dzień powtarzania (yyyy-MM-dd, włącznie) albo null = bez końca. */
  until: string | null;
}

export interface SyncEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface Reminder extends SyncEntity {
  title: string;
  notes: string;
  /** ISO – data i godzina bieżącego (oczekującego) wystąpienia. */
  start: string;
  allDay: boolean;
  /** Czas trwania w minutach; 0 = przypomnienie punktowe. */
  durationMin: number;
  priority: Priority;
  categoryId: string | null;
  recurrence: Recurrence;
  /** Kiedy oznaczono jako zrobione (dla niepowtarzalnych). */
  completedAt: string | null;
  /** Dla powtarzalnych: ISO wystąpień oznaczonych jako zrobione (ostatnie ~120). */
  completions: string[];
  /** Drzemka – alarm przesunięty na tę chwilę. */
  snoozedUntil: string | null;
}

export interface Category extends SyncEntity {
  name: string;
  color: CategoryColor;
  order: number;
}

export type CategoryColor =
  | 'tomato'
  | 'tangerine'
  | 'amber'
  | 'lime'
  | 'emerald'
  | 'teal'
  | 'sky'
  | 'indigo'
  | 'violet'
  | 'pink'
  | 'brown'
  | 'slate';

/** Konkretne wystąpienie przypomnienia w czasie (rozwinięte z reguły powtarzania). */
export interface Occurrence {
  key: string;
  reminder: Reminder;
  start: Date;
  end: Date;
  done: boolean;
  /** true = to bieżące (oczekujące) wystąpienie, czyli `reminder.start`. */
  isCurrent: boolean;
}

export type ReminderDraft = Omit<Reminder, keyof SyncEntity | 'completions' | 'completedAt' | 'snoozedUntil'> & {
  id?: string;
};

export const NO_REPEAT: Recurrence = {
  freq: 'none',
  interval: 1,
  unit: 'day',
  weekdays: [],
  monthDay: null,
  until: null,
};
