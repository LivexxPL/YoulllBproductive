import { Capacitor } from '@capacitor/core';
import { format } from 'date-fns';
import { repository } from './repository';
import { mergeLww } from './sync';
import { nowIso } from '../lib/ids';
import type { Category, Reminder } from '../lib/types';
import { NO_REPEAT } from '../lib/types';

export const BACKUP_APP = 'YoulllBproductive';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  reminders: Reminder[];
  categories: Category[];
  settings?: Record<string, unknown>;
}

export async function buildBackup(settings?: Record<string, unknown>): Promise<BackupFile> {
  const [reminders, categories] = await Promise.all([
    repository.reminders.getAllRaw(),
    repository.categories.getAllRaw(),
  ]);
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: nowIso(),
    reminders: reminders.filter((r) => !r.deletedAt),
    categories: categories.filter((c) => !c.deletedAt),
    settings,
  };
}

/** Zapisuje kopię: w przeglądarce pobiera plik, na Androidzie otwiera „Udostępnij”. */
export async function exportBackup(settings?: Record<string, unknown>): Promise<string> {
  const data = await buildBackup(settings);
  const json = JSON.stringify(data, null, 2);
  const fileName = `youlllbproductive-kopia-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`;

  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const res = await Filesystem.writeFile({
      path: fileName,
      data: json,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    try {
      await Share.share({ title: 'Kopia zapasowa', files: [res.uri], dialogTitle: 'Zapisz kopię zapasową' });
    } catch {
      // Użytkownik zamknął okno udostępniania – zapisz jeszcze w Dokumentach
      await Filesystem.writeFile({ path: fileName, data: json, directory: Directory.Documents, encoding: Encoding.UTF8 });
      return `Zapisano w Dokumentach: ${fileName}`;
    }
    return 'Kopia gotowa';
  }

  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return `Pobrano ${fileName}`;
}

function sanitizeReminder(x: Partial<Reminder>): Reminder | null {
  if (!x || typeof x.id !== 'string' || typeof x.start !== 'string' || Number.isNaN(Date.parse(x.start))) return null;
  const now = nowIso();
  return {
    id: x.id,
    title: String(x.title ?? 'Bez tytułu'),
    notes: String(x.notes ?? ''),
    start: x.start,
    allDay: !!x.allDay,
    durationMin: Number(x.durationMin) || 0,
    priority: x.priority === 'high' || x.priority === 'low' ? x.priority : 'medium',
    categoryId: typeof x.categoryId === 'string' ? x.categoryId : null,
    recurrence: { ...NO_REPEAT, ...(x.recurrence ?? {}) },
    completedAt: x.completedAt ?? null,
    completions: Array.isArray(x.completions) ? x.completions.filter((c) => typeof c === 'string') : [],
    snoozedUntil: x.snoozedUntil ?? null,
    createdAt: x.createdAt ?? now,
    updatedAt: x.updatedAt ?? now,
    deletedAt: x.deletedAt ?? null,
  };
}

function sanitizeCategory(x: Partial<Category>, i: number): Category | null {
  if (!x || typeof x.id !== 'string' || typeof x.name !== 'string') return null;
  const now = nowIso();
  return {
    id: x.id,
    name: x.name,
    color: x.color ?? 'slate',
    order: typeof x.order === 'number' ? x.order : i,
    createdAt: x.createdAt ?? now,
    updatedAt: x.updatedAt ?? now,
    deletedAt: x.deletedAt ?? null,
  };
}

export function parseBackup(text: string): BackupFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('To nie jest poprawny plik JSON.');
  }
  const obj = raw as Partial<BackupFile>;
  if (!obj || !Array.isArray(obj.reminders) || !Array.isArray(obj.categories)) {
    throw new Error('Plik nie wygląda na kopię zapasową YoulllBproductive.');
  }
  const reminders = obj.reminders.map(sanitizeReminder).filter((r): r is Reminder => !!r);
  const categories = obj.categories.map(sanitizeCategory).filter((c): c is Category => !!c);
  return {
    app: BACKUP_APP,
    version: Number(obj.version) || 1,
    exportedAt: obj.exportedAt ?? nowIso(),
    reminders,
    categories,
    settings: obj.settings,
  };
}

/**
 * Import kopii.
 * - `merge`: łączy (nowsza wersja rekordu wygrywa),
 * - `replace`: usuwa obecne dane i wczytuje kopię.
 */
export async function importBackup(file: BackupFile, mode: 'merge' | 'replace'): Promise<{ reminders: number; categories: number }> {
  const [curR, curC] = await Promise.all([repository.reminders.getAllRaw(), repository.categories.getAllRaw()]);
  await repository.transaction(async () => {
    if (mode === 'replace') {
      const now = nowIso();
      const keepR = new Set(file.reminders.map((r) => r.id));
      const keepC = new Set(file.categories.map((c) => c.id));
      await repository.reminders.bulkPut(
        curR.filter((r) => !keepR.has(r.id) && !r.deletedAt).map((r) => ({ ...r, deletedAt: now, updatedAt: now })),
      );
      await repository.categories.bulkPut(
        curC.filter((c) => !keepC.has(c.id) && !c.deletedAt).map((c) => ({ ...c, deletedAt: now, updatedAt: now })),
      );
      const stamp = (x: { updatedAt: string }) => ({ ...x, updatedAt: now });
      await repository.reminders.bulkPut(file.reminders.map((r) => stamp(r) as Reminder));
      await repository.categories.bulkPut(file.categories.map((c) => stamp(c) as Category));
    } else {
      await repository.reminders.bulkPut(mergeLww(curR, file.reminders));
      await repository.categories.bulkPut(mergeLww(curC, file.categories));
    }
  });
  return { reminders: file.reminders.length, categories: file.categories.length };
}
