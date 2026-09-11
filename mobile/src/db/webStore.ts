import { Platform } from 'react-native';
import type {
  Caregiver,
  CaregiverAlert,
  Memory,
  Patient,
  ResponseRow,
  Session,
  SessionItem,
} from '../types/models';

type WebDbShape = {
  caregivers: Caregiver[];
  patients: Patient[];
  memories: Memory[];
  sessions: Session[];
  session_items: SessionItem[];
  responses: ResponseRow[];
  caregiver_alerts: CaregiverAlert[];
  sync_queue: {
    id: string;
    entity_type: string;
    entity_id: string;
    operation: string;
    payload: string | null;
    created_at: string;
    attempts: number;
    last_error: string | null;
  }[];
  app_meta: Record<string, string>;
};

const KEY = 'dementiasupport.web.db.v1';

const empty = (): WebDbShape => ({
  caregivers: [],
  patients: [],
  memories: [],
  sessions: [],
  session_items: [],
  responses: [],
  caregiver_alerts: [],
  sync_queue: [],
  app_meta: {},
});

export function isWebRuntime(): boolean {
  return Platform.OS === 'web';
}

export function webLoad(): WebDbShape {
  if (typeof localStorage === 'undefined') return empty();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    return { ...empty(), ...JSON.parse(raw) };
  } catch {
    return empty();
  }
}

export function webSave(db: WebDbShape): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(db));
}

export function webReset(): void {
  webSave(empty());
}

export function webUpsert<T extends { id: string }>(list: T[], row: T): T[] {
  const idx = list.findIndex((x) => x.id === row.id);
  if (idx >= 0) {
    const next = [...list];
    next[idx] = row;
    return next;
  }
  return [...list, row];
}
