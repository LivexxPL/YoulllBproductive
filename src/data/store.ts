import { useMemo, useSyncExternalStore } from 'react';
import { repository } from './repository';
import { nowIso, uuid } from '../lib/ids';
import type { Category, CategoryColor, Reminder } from '../lib/types';

/** Prosty reaktywny „snapshot” kolekcji – źródłem prawdy jest repozytorium. */
class LiveCollection<T> {
  private items: T[] = [];
  private listeners = new Set<() => void>();
  ready = false;

  set(items: T[]) {
    this.items = items;
    this.ready = true;
    this.listeners.forEach((l) => l());
  }
  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getSnapshot = () => this.items;
  get current() {
    return this.items;
  }
}

export const remindersLive = new LiveCollection<Reminder>();
export const categoriesLive = new LiveCollection<Category>();

const readyListeners = new Set<() => void>();
let readyFlag = false;
const markReady = () => {
  if (readyFlag || !remindersLive.ready || !categoriesLive.ready) return;
  readyFlag = true;
  readyListeners.forEach((l) => l());
};

const DEFAULT_CATEGORIES: Array<[string, CategoryColor]> = [
  ['Praca', 'sky'],
  ['Dom', 'emerald'],
  ['Osobiste', 'violet'],
  ['Zdrowie', 'tomato'],
  ['Zakupy', 'amber'],
];

let started: Promise<void> | null = null;

export function startDataLayer(): Promise<void> {
  if (started) return started;
  started = (async () => {
    const seeded = await repository.meta.get('seeded');
    if (!seeded) {
      const now = nowIso();
      await repository.categories.bulkPut(
        DEFAULT_CATEGORIES.map(([name, color], i) => ({
          id: uuid(),
          name,
          color,
          order: i,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        })),
      );
      await repository.meta.set('seeded', now);
    }
    await new Promise<void>((resolve) => {
      let got = 0;
      const done = () => {
        got++;
        markReady();
        if (got === 2) resolve();
      };
      let firstR = true;
      let firstC = true;
      repository.reminders.subscribe((items) => {
        remindersLive.set(items);
        if (firstR) {
          firstR = false;
          done();
        }
      });
      repository.categories.subscribe((items) => {
        categoriesLive.set([...items].sort((a, b) => a.order - b.order));
        if (firstC) {
          firstC = false;
          done();
        }
      });
    });
  })();
  return started;
}

export function useReminders(): Reminder[] {
  return useSyncExternalStore(remindersLive.subscribe, remindersLive.getSnapshot);
}

export function useCategories(): Category[] {
  return useSyncExternalStore(categoriesLive.subscribe, categoriesLive.getSnapshot);
}

export function useCategoryMap(): Map<string, Category> {
  const cats = useCategories();
  return useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats]);
}

export function useDataReady(): boolean {
  return useSyncExternalStore(
    (l) => {
      readyListeners.add(l);
      return () => readyListeners.delete(l);
    },
    () => readyFlag,
  );
}
