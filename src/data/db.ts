import Dexie, { type EntityTable } from 'dexie';
import type { Category, Reminder } from '../lib/types';

export interface MetaRow {
  key: string;
  value: string;
}

/**
 * Lokalna baza IndexedDB (Dexie). Nie importuj jej bezpośrednio w UI –
 * korzystaj z `repository.ts`, żeby dało się podmienić/rozszerzyć źródło danych.
 */
export class AppDatabase extends Dexie {
  reminders!: EntityTable<Reminder, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  meta!: EntityTable<MetaRow, 'key'>;

  constructor() {
    super('youlllbproductive');
    this.version(1).stores({
      reminders: 'id, start, categoryId, updatedAt, deletedAt',
      categories: 'id, order, updatedAt',
      meta: 'key',
    });
  }
}

export const db = new AppDatabase();
