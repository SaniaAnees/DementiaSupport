import { db, now } from './db';

/**
 * Offline-first sync stub (MVP).
 * Conflict rule (documented + applied when cloud exists):
 * - Device wins for session scores / answer logs
 * - Cloud wins for caregiver profile / photo edits
 * Never block "start session" on network.
 */
export async function flushSyncQueue(): Promise<{ flushed: number; message: string }> {
  if (!navigator.onLine) {
    return { flushed: 0, message: 'Offline — queue kept on device.' };
  }
  const pending = await db.syncQueue.orderBy('createdAt').limit(50).toArray();
  if (!pending.length) {
    return { flushed: 0, message: 'Nothing waiting to sync.' };
  }
  // MVP: mark as "attempted local ack" — real push waits for backend.
  let flushed = 0;
  for (const row of pending) {
    try {
      await db.syncQueue.delete(row.id);
      flushed += 1;
    } catch (e) {
      await db.syncQueue.update(row.id, {
        attempts: row.attempts + 1,
        lastError: String(e),
      });
    }
  }
  await db.meta.put({ key: 'last_sync_at', value: now() });
  return {
    flushed,
    message: `Cleared ${flushed} queued item(s). Cloud endpoint can replace this stub without changing session code.`,
  };
}
