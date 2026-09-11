import { getDb } from './database';
import { isWebRuntime, webLoad, webReset, webSave, webUpsert } from './webStore';
import type {
  Caregiver,
  CaregiverAlert,
  Memory,
  Patient,
  ResponseRow,
  Session,
  SessionItem,
  SyncStatus,
} from '../types/models';
import { newId, nowIso } from '../utils/ids';

async function enqueue(entity_type: string, entity_id: string, payload: unknown) {
  if (isWebRuntime()) {
    const db = webLoad();
    db.sync_queue.push({
      id: newId(),
      entity_type,
      entity_id,
      operation: 'upsert',
      payload: JSON.stringify(payload),
      created_at: nowIso(),
      attempts: 0,
      last_error: null,
    });
    webSave(db);
    return;
  }
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO sync_queue (id, entity_type, entity_id, operation, payload, created_at, attempts)
     VALUES (?, ?, ?, 'upsert', ?, ?, 0)`,
    [newId(), entity_type, entity_id, JSON.stringify(payload), nowIso()]
  );
}

export const caregiverRepo = {
  async getPrimary(): Promise<Caregiver | null> {
    if (isWebRuntime()) return webLoad().caregivers[0] ?? null;
    const db = await getDb();
    return (await db.getFirstAsync<Caregiver>(`SELECT * FROM caregivers LIMIT 1`)) ?? null;
  },
  async upsert(row: Caregiver): Promise<void> {
    if (isWebRuntime()) {
      const db = webLoad();
      db.caregivers = webUpsert(db.caregivers, row);
      webSave(db);
      await enqueue('caregiver', row.id, row);
      return;
    }
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO caregivers (id, name, email, created_at, updated_at, sync_status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [row.id, row.name, row.email, row.created_at, row.updated_at, row.sync_status]
    );
    await enqueue('caregiver', row.id, row);
  },
};

export const patientRepo = {
  async list(): Promise<Patient[]> {
    if (isWebRuntime()) {
      return [...webLoad().patients].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
    }
    const db = await getDb();
    return db.getAllAsync<Patient>(`SELECT * FROM patients ORDER BY updated_at DESC`);
  },
  async get(id: string): Promise<Patient | null> {
    if (isWebRuntime()) return webLoad().patients.find((p) => p.id === id) ?? null;
    const db = await getDb();
    return (await db.getFirstAsync<Patient>(`SELECT * FROM patients WHERE id = ?`, [id])) ?? null;
  },
  async upsert(row: Patient): Promise<void> {
    if (isWebRuntime()) {
      const db = webLoad();
      db.patients = webUpsert(db.patients, row);
      webSave(db);
      await enqueue('patient', row.id, row);
      return;
    }
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO patients (
        id, caregiver_id, full_name, preferred_name, age, hometown, dementia_notes,
        medical_recommendations, language_code, created_at, updated_at, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.caregiver_id,
        row.full_name,
        row.preferred_name,
        row.age,
        row.hometown,
        row.dementia_notes,
        row.medical_recommendations,
        row.language_code,
        row.created_at,
        row.updated_at,
        row.sync_status,
      ]
    );
    await enqueue('patient', row.id, row);
  },
};

export const memoryRepo = {
  async listByPatient(patientId: string): Promise<Memory[]> {
    if (isWebRuntime()) {
      return webLoad()
        .memories.filter((m) => m.patient_id === patientId)
        .sort((a, b) => a.sort_order - b.sort_order);
    }
    const db = await getDb();
    return db.getAllAsync<Memory>(
      `SELECT * FROM memories WHERE patient_id = ? ORDER BY sort_order ASC, created_at ASC`,
      [patientId]
    );
  },
  async get(id: string): Promise<Memory | null> {
    if (isWebRuntime()) return webLoad().memories.find((m) => m.id === id) ?? null;
    const db = await getDb();
    return (await db.getFirstAsync<Memory>(`SELECT * FROM memories WHERE id = ?`, [id])) ?? null;
  },
  async upsert(row: Memory): Promise<void> {
    if (isWebRuntime()) {
      const db = webLoad();
      db.memories = webUpsert(db.memories, row);
      webSave(db);
      await enqueue('memory', row.id, row);
      return;
    }
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO memories (
        id, patient_id, local_uri, remote_url, caption, short_label, aliases, category,
        sort_order, created_at, updated_at, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.patient_id,
        row.local_uri,
        row.remote_url,
        row.caption,
        row.short_label,
        row.aliases,
        row.category,
        row.sort_order,
        row.created_at,
        row.updated_at,
        row.sync_status,
      ]
    );
    await enqueue('memory', row.id, row);
  },
  async remove(id: string): Promise<void> {
    if (isWebRuntime()) {
      const db = webLoad();
      db.memories = db.memories.filter((m) => m.id !== id);
      webSave(db);
      await enqueue('memory_delete', id, { id });
      return;
    }
    const db = await getDb();
    await db.runAsync(`DELETE FROM memories WHERE id = ?`, [id]);
    await enqueue('memory_delete', id, { id });
  },
};

export const sessionRepo = {
  async listByPatient(patientId: string): Promise<Session[]> {
    if (isWebRuntime()) {
      return webLoad()
        .sessions.filter((s) => s.patient_id === patientId)
        .sort((a, b) => (a.started_at < b.started_at ? 1 : -1));
    }
    const db = await getDb();
    return db.getAllAsync<Session>(
      `SELECT * FROM sessions WHERE patient_id = ? ORDER BY started_at DESC`,
      [patientId]
    );
  },
  async get(id: string): Promise<Session | null> {
    if (isWebRuntime()) return webLoad().sessions.find((s) => s.id === id) ?? null;
    const db = await getDb();
    return (await db.getFirstAsync<Session>(`SELECT * FROM sessions WHERE id = ?`, [id])) ?? null;
  },
  async upsert(row: Session): Promise<void> {
    if (isWebRuntime()) {
      const db = webLoad();
      db.sessions = webUpsert(db.sessions, row);
      webSave(db);
      await enqueue('session', row.id, row);
      return;
    }
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO sessions (
        id, patient_id, session_type, started_at, ended_at, accuracy, avg_response_ms,
        hints_used, repetitions, composite_score, notes, created_at, updated_at, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.patient_id,
        row.session_type,
        row.started_at,
        row.ended_at,
        row.accuracy,
        row.avg_response_ms,
        row.hints_used,
        row.repetitions,
        row.composite_score,
        row.notes,
        row.created_at,
        row.updated_at,
        row.sync_status,
      ]
    );
    await enqueue('session', row.id, row);
  },
  async insertItems(items: SessionItem[]): Promise<void> {
    if (isWebRuntime()) {
      const db = webLoad();
      for (const item of items) db.session_items = webUpsert(db.session_items, item);
      webSave(db);
      return;
    }
    const db = await getDb();
    for (const item of items) {
      await db.runAsync(
        `INSERT OR REPLACE INTO session_items (
          id, session_id, item_type, memory_id, prompt_text, expected_answers, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          item.session_id,
          item.item_type,
          item.memory_id,
          item.prompt_text,
          item.expected_answers,
          item.sort_order,
        ]
      );
    }
  },
  async insertResponse(row: ResponseRow): Promise<void> {
    if (isWebRuntime()) {
      const db = webLoad();
      db.responses = webUpsert(db.responses, row);
      webSave(db);
      await enqueue('response', row.id, row);
      return;
    }
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO responses (
        id, session_item_id, session_id, transcript, is_correct, response_ms,
        hints_used, repetitions, match_score, created_at, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.session_item_id,
        row.session_id,
        row.transcript,
        row.is_correct,
        row.response_ms,
        row.hints_used,
        row.repetitions,
        row.match_score,
        row.created_at,
        row.sync_status,
      ]
    );
    await enqueue('response', row.id, row);
  },
};

export const alertRepo = {
  async listByPatient(patientId: string): Promise<CaregiverAlert[]> {
    if (isWebRuntime()) {
      return webLoad()
        .caregiver_alerts.filter((a) => a.patient_id === patientId)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    }
    const db = await getDb();
    return db.getAllAsync<CaregiverAlert>(
      `SELECT * FROM caregiver_alerts WHERE patient_id = ? ORDER BY created_at DESC`,
      [patientId]
    );
  },
  async upsert(row: CaregiverAlert): Promise<void> {
    if (isWebRuntime()) {
      const db = webLoad();
      db.caregiver_alerts = webUpsert(db.caregiver_alerts, row);
      webSave(db);
      return;
    }
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO caregiver_alerts (
        id, patient_id, severity, title, body, created_at, read_at, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.patient_id,
        row.severity,
        row.title,
        row.body,
        row.created_at,
        row.read_at,
        row.sync_status,
      ]
    );
  },
  async markRead(id: string): Promise<void> {
    if (isWebRuntime()) {
      const db = webLoad();
      db.caregiver_alerts = db.caregiver_alerts.map((a) =>
        a.id === id ? { ...a, read_at: nowIso() } : a
      );
      webSave(db);
      return;
    }
    const db = await getDb();
    await db.runAsync(`UPDATE caregiver_alerts SET read_at = ? WHERE id = ?`, [nowIso(), id]);
  },
};

export const metaRepo = {
  async get(key: string): Promise<string | null> {
    if (isWebRuntime()) return webLoad().app_meta[key] ?? null;
    const db = await getDb();
    const row = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM app_meta WHERE key = ?`,
      [key]
    );
    return row?.value ?? null;
  },
  async set(key: string, value: string): Promise<void> {
    if (isWebRuntime()) {
      const db = webLoad();
      db.app_meta[key] = value;
      webSave(db);
      return;
    }
    const db = await getDb();
    await db.runAsync(`INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)`, [key, value]);
  },
};

export async function wipeAllData(): Promise<void> {
  if (isWebRuntime()) {
    webReset();
    return;
  }
  const db = await getDb();
  await db.execAsync(`
    DELETE FROM responses;
    DELETE FROM session_items;
    DELETE FROM sessions;
    DELETE FROM caregiver_alerts;
    DELETE FROM sync_queue;
    DELETE FROM memories;
    DELETE FROM patients;
    DELETE FROM caregivers;
    DELETE FROM app_meta;
  `);
}

export type { SyncStatus };
