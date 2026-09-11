import { getDb } from './database';

const MIGRATION_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS caregivers (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY NOT NULL,
  caregiver_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  preferred_name TEXT,
  age INTEGER,
  hometown TEXT,
  dementia_notes TEXT,
  medical_recommendations TEXT,
  language_code TEXT DEFAULT 'en-IN',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  FOREIGN KEY (caregiver_id) REFERENCES caregivers(id)
);

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY NOT NULL,
  patient_id TEXT NOT NULL,
  local_uri TEXT NOT NULL,
  remote_url TEXT,
  caption TEXT NOT NULL,
  short_label TEXT NOT NULL,
  aliases TEXT,
  category TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY NOT NULL,
  patient_id TEXT NOT NULL,
  session_type TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  accuracy REAL,
  avg_response_ms INTEGER,
  hints_used INTEGER DEFAULT 0,
  repetitions INTEGER DEFAULT 0,
  composite_score REAL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

CREATE TABLE IF NOT EXISTS session_items (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL,
  item_type TEXT NOT NULL,
  memory_id TEXT,
  prompt_text TEXT NOT NULL,
  expected_answers TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS responses (
  id TEXT PRIMARY KEY NOT NULL,
  session_item_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  transcript TEXT,
  is_correct INTEGER NOT NULL,
  response_ms INTEGER,
  hints_used INTEGER DEFAULT 0,
  repetitions INTEGER DEFAULT 0,
  match_score REAL,
  created_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  FOREIGN KEY (session_item_id) REFERENCES session_items(id)
);

CREATE TABLE IF NOT EXISTS caregiver_alerts (
  id TEXT PRIMARY KEY NOT NULL,
  patient_id TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS sync_queue (
  id TEXT PRIMARY KEY NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  payload TEXT,
  created_at TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  last_error TEXT
);

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
`;

export async function runMigrations(): Promise<void> {
  const db = await getDb();
  await db.execAsync(MIGRATION_SQL);
}
