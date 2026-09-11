import Constants from 'expo-constants';
import NetInfo from '@react-native-community/netinfo';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getDb } from '../db/database';
import { isWebRuntime, webLoad, webSave } from '../db/webStore';

export type SyncUiStatus = 'online' | 'offline' | 'syncing' | 'local_only';

function env(key: string): string {
  const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
  return (extra?.[key] as string) || (process.env[key] as string) || '';
}

export function isDemoMode(): boolean {
  const flag = env('EXPO_PUBLIC_DEMO_MODE');
  if (flag === 'false') return false;
  const url = env('EXPO_PUBLIC_SUPABASE_URL');
  const key = env('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  return !url || !key || flag !== 'false';
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (isDemoMode()) return null;
  if (client) return client;
  client = createClient(env('EXPO_PUBLIC_SUPABASE_URL'), env('EXPO_PUBLIC_SUPABASE_ANON_KEY'));
  return client;
}

export async function getConnectivityStatus(): Promise<SyncUiStatus> {
  if (isDemoMode()) return 'local_only';
  const state = await NetInfo.fetch();
  return state.isConnected ? 'online' : 'offline';
}

/** Best-effort flush. Never throws to callers of session completion. */
export async function flushSyncQueue(): Promise<{ flushed: number; message: string }> {
  if (isDemoMode()) {
    return { flushed: 0, message: 'Local only — cloud sync skipped in demo mode.' };
  }
  const supabase = getSupabase();
  if (!supabase) {
    return { flushed: 0, message: 'Supabase not configured.' };
  }

  const net = await NetInfo.fetch();
  if (!net.isConnected) {
    return { flushed: 0, message: 'Offline — will sync when connected.' };
  }

  if (isWebRuntime()) {
    const db = webLoad();
    let flushed = 0;
    const remaining = [];
    for (const row of db.sync_queue.slice(0, 50)) {
      try {
        if (row.payload) {
          await supabase.from('sync_events').upsert({
            id: row.entity_id,
            entity_type: row.entity_type,
            payload: JSON.parse(row.payload),
            updated_at: new Date().toISOString(),
          });
        }
        flushed += 1;
      } catch (e) {
        remaining.push({
          ...row,
          attempts: row.attempts + 1,
          last_error: String(e),
        });
      }
    }
    db.sync_queue = [...remaining, ...db.sync_queue.slice(50)];
    webSave(db);
    return { flushed, message: flushed ? `Synced ${flushed} items.` : 'Nothing to sync.' };
  }

  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    entity_type: string;
    entity_id: string;
    payload: string | null;
  }>(`SELECT * FROM sync_queue ORDER BY created_at ASC LIMIT 50`);

  let flushed = 0;
  for (const row of rows) {
    try {
      if (row.payload) {
        await supabase.from('sync_events').upsert({
          id: row.entity_id,
          entity_type: row.entity_type,
          payload: JSON.parse(row.payload),
          updated_at: new Date().toISOString(),
        });
      }
      await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [row.id]);
      flushed += 1;
    } catch (e) {
      await db.runAsync(
        `UPDATE sync_queue SET attempts = attempts + 1, last_error = ? WHERE id = ?`,
        [String(e), row.id]
      );
    }
  }
  return { flushed, message: flushed ? `Synced ${flushed} items.` : 'Nothing to sync.' };
}

export function subscribeNetInfo(onChange: (status: SyncUiStatus) => void) {
  return NetInfo.addEventListener(async (state) => {
    if (isDemoMode()) {
      onChange('local_only');
      return;
    }
    onChange(state.isConnected ? 'online' : 'offline');
    if (state.isConnected) {
      onChange('syncing');
      await flushSyncQueue();
      onChange('online');
    }
  });
}
