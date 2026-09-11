export type SyncStatus = 'pending' | 'synced' | 'error';

export type MemoryCategory = 'person' | 'place' | 'object';

export type SessionType = 'morning' | 'evening';

export type ItemType = 'memory_teach' | 'memory_quiz' | 'orientation';

export type TrendState = 'improving' | 'stable' | 'declining' | 'insufficient_data';

export type AlertSeverity = 'info' | 'watch' | 'attention';

export interface Caregiver {
  id: string;
  name: string;
  email: string | null;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
}

export interface Patient {
  id: string;
  caregiver_id: string;
  full_name: string;
  preferred_name: string | null;
  age: number | null;
  hometown: string | null;
  dementia_notes: string | null;
  medical_recommendations: string | null;
  language_code: string;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
}

export interface Memory {
  id: string;
  patient_id: string;
  local_uri: string;
  remote_url: string | null;
  caption: string;
  short_label: string;
  aliases: string; // JSON array
  category: MemoryCategory | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
}

export interface Session {
  id: string;
  patient_id: string;
  session_type: SessionType;
  started_at: string;
  ended_at: string | null;
  accuracy: number | null;
  avg_response_ms: number | null;
  hints_used: number;
  repetitions: number;
  composite_score: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
}

export interface SessionItem {
  id: string;
  session_id: string;
  item_type: ItemType;
  memory_id: string | null;
  prompt_text: string;
  expected_answers: string; // JSON array
  sort_order: number;
}

export interface ResponseRow {
  id: string;
  session_item_id: string;
  session_id: string;
  transcript: string | null;
  is_correct: number;
  response_ms: number | null;
  hints_used: number;
  repetitions: number;
  match_score: number | null;
  created_at: string;
  sync_status: SyncStatus;
}

export interface CaregiverAlert {
  id: string;
  patient_id: string;
  severity: AlertSeverity;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
  sync_status: SyncStatus;
}

export interface BuiltSessionItem {
  id: string;
  item_type: ItemType;
  memory_id: string | null;
  prompt_text: string;
  expected_answers: string[];
  hint_text?: string;
  local_uri?: string | null;
  caption?: string | null;
  chip_options?: string[];
}
