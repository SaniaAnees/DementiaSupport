import Dexie, { type EntityTable } from 'dexie';
import type {
  AnswerLog,
  Caregiver,
  CaregiverAlert,
  Memory,
  MetaRow,
  Patient,
  Session,
  SessionItem,
  SyncQueueItem,
} from './types';

export class DementiaDB extends Dexie {
  caregivers!: EntityTable<Caregiver, 'id'>;
  patients!: EntityTable<Patient, 'id'>;
  memories!: EntityTable<Memory, 'id'>;
  sessions!: EntityTable<Session, 'id'>;
  sessionItems!: EntityTable<SessionItem, 'id'>;
  answerLogs!: EntityTable<AnswerLog, 'id'>;
  alerts!: EntityTable<CaregiverAlert, 'id'>;
  syncQueue!: EntityTable<SyncQueueItem, 'id'>;
  meta!: EntityTable<MetaRow, 'key'>;

  constructor() {
    super('dementiasupport_user_v1');
    this.version(1).stores({
      caregivers: 'id',
      patients: 'id, caregiverId, updatedAt',
      memories: 'id, patientId, sortOrder',
      sessions: 'id, patientId, startedAt, scheduledFor, sessionType, status',
      sessionItems: 'id, sessionId, sortOrder',
      answerLogs: 'id, sessionId, patientId, createdAt, memoryId',
      alerts: 'id, patientId, createdAt',
      syncQueue: 'id, createdAt, entityType',
      meta: 'key',
    });
  }
}

export const db = new DementiaDB();

export function nid(): string {
  return crypto.randomUUID();
}

export function now(): string {
  return new Date().toISOString();
}

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** MVP PIN hash — not bank-grade; blocks casual exit. */
export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`ds-mvp:${pin}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function enqueueSync(
  entityType: string,
  entityId: string,
  payload: unknown,
  operation: 'upsert' | 'delete' = 'upsert'
) {
  await db.syncQueue.add({
    id: nid(),
    entityType,
    entityId,
    operation,
    payload: JSON.stringify(payload),
    createdAt: now(),
    attempts: 0,
  });
}
