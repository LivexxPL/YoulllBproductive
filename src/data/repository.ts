import { liveQuery } from 'dexie';
import { db } from './db';
import type { Category, Reminder, SyncEntity } from '../lib/types';

/**
 * Warstwa dostępu do danych.
 *
 * UI rozmawia wyłącznie z tym interfejsem. Dziś implementacją jest Dexie
 * (IndexedDB), a synchronizację (np. Supabase) dokłada się w `sync.ts`
 * – bez zmian w komponentach.
 */
export interface EntityRepository<T extends SyncEntity> {
  /** Wszystkie rekordy łącznie z usuniętymi (tombstone) – na potrzeby synchronizacji. */
  getAllRaw(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  put(entity: T): Promise<void>;
  bulkPut(entities: T[]): Promise<void>;
  softDelete(id: string): Promise<void>;
  /** Zmienione od podanej chwili (ISO) – do wypychania zmian na serwer. */
  changedSince(iso: string | null): Promise<T[]>;
  /** Subskrypcja aktywnych (nieusuniętych) rekordów. */
  subscribe(cb: (items: T[]) => void): () => void;
}

export interface MetaRepository {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export interface DataRepository {
  reminders: EntityRepository<Reminder>;
  categories: EntityRepository<Category>;
  meta: MetaRepository;
  transaction<R>(fn: () => Promise<R>): Promise<R>;
}

function dexieEntityRepo<T extends SyncEntity>(table: typeof db.reminders | typeof db.categories): EntityRepository<T> {
  const t = table as unknown as import('dexie').Table<T, string>;
  return {
    getAllRaw: () => t.toArray(),
    get: (id) => t.get(id),
    put: async (e) => {
      await t.put(e);
    },
    bulkPut: async (es) => {
      await t.bulkPut(es);
    },
    softDelete: async (id) => {
      const now = new Date().toISOString();
      await t.update(id, { deletedAt: now, updatedAt: now } as never);
    },
    changedSince: (iso) => (iso ? t.where('updatedAt').above(iso).toArray() : t.toArray()),
    subscribe: (cb) => {
      const sub = liveQuery(() => t.filter((x) => !x.deletedAt).toArray()).subscribe({
        next: cb,
        error: (err) => console.error('[repo] liveQuery error', err),
      });
      return () => sub.unsubscribe();
    },
  };
}

export const repository: DataRepository = {
  reminders: dexieEntityRepo<Reminder>(db.reminders),
  categories: dexieEntityRepo<Category>(db.categories),
  meta: {
    get: async (key) => (await db.meta.get(key))?.value ?? null,
    set: async (key, value) => {
      await db.meta.put({ key, value });
    },
  },
  transaction: (fn) => db.transaction('rw', db.reminders, db.categories, db.meta, fn),
};
