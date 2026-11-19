import type { Category, Reminder } from '../lib/types';
import type { DataRepository } from './repository';

/**
 * Szkielet synchronizacji – gotowy pod Supabase (lub inny backend).
 *
 * Model: „ostatni zapis wygrywa” po polu `updatedAt`. Usunięcia to rekordy
 * z ustawionym `deletedAt` (tombstone), więc też się synchronizują.
 *
 * Żeby dodać Supabase:
 *  1. utwórz tabele `reminders` i `categories` z kolumnami jak w `lib/types.ts`
 *     (+ `user_id`, RLS po `auth.uid()`),
 *  2. zaimplementuj `SyncAdapter` (pull = select where updated_at > since,
 *     push = upsert),
 *  3. wywołuj `syncOnce(repository, adapter)` po starcie i co kilka minut.
 */
export interface SyncPayload {
  reminders: Reminder[];
  categories: Category[];
}

export interface SyncAdapter {
  readonly name: string;
  pull(since: string | null): Promise<SyncPayload & { serverTime: string }>;
  push(changes: SyncPayload): Promise<void>;
}

const LAST_SYNC_KEY = 'lastSyncAt';

function mergeLww<T extends { id: string; updatedAt: string }>(local: T[], remote: T[]): T[] {
  const map = new Map(local.map((x) => [x.id, x]));
  const toWrite: T[] = [];
  for (const r of remote) {
    const l = map.get(r.id);
    if (!l || l.updatedAt < r.updatedAt) toWrite.push(r);
  }
  return toWrite;
}

export async function syncOnce(repo: DataRepository, adapter: SyncAdapter): Promise<{ pulled: number; pushed: number }> {
  const since = await repo.meta.get(LAST_SYNC_KEY);

  const [localReminders, localCategories] = await Promise.all([
    repo.reminders.changedSince(since),
    repo.categories.changedSince(since),
  ]);
  await adapter.push({ reminders: localReminders, categories: localCategories });

  const remote = await adapter.pull(since);
  const [allR, allC] = await Promise.all([repo.reminders.getAllRaw(), repo.categories.getAllRaw()]);
  const writeR = mergeLww(allR, remote.reminders);
  const writeC = mergeLww(allC, remote.categories);
  await repo.transaction(async () => {
    await repo.reminders.bulkPut(writeR);
    await repo.categories.bulkPut(writeC);
    await repo.meta.set(LAST_SYNC_KEY, remote.serverTime);
  });
  return { pulled: writeR.length + writeC.length, pushed: localReminders.length + localCategories.length };
}

export { mergeLww };
