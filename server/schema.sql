-- MindCare PostgreSQL Schema
-- AI-Based Cognitive Gaming and Memory Assistance Platform

-- Auth: caregivers with phone OTP
CREATE TABLE IF NOT EXISTS caregivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE NOT NULL,
  pin_hash TEXT,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_login TIMESTAMPTZ,
  token_version INTEGER DEFAULT 0
);

-- Patients (one per caregiver for MVP)
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id UUID NOT NULL REFERENCES caregivers(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  preferred_name TEXT,
  age INTEGER,
  hometown TEXT,
  region_state TEXT,
  language_code TEXT DEFAULT 'en-IN',
  dementia_notes TEXT,
  morning_hour INTEGER DEFAULT 9,
  morning_minute INTEGER DEFAULT 0,
  evening_hour INTEGER DEFAULT 19,
  evening_minute INTEGER DEFAULT 0,
  curriculum_started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Memory photos with captions
CREATE TABLE IF NOT EXISTS memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  caption TEXT NOT NULL,
  short_label TEXT NOT NULL,
  aliases JSONB DEFAULT '[]',
  category TEXT,
  relation TEXT,
  image_url TEXT,
  thumbnail_url TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Cognitive sessions
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  session_type TEXT NOT NULL,
  status TEXT DEFAULT 'in_progress',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  accuracy REAL,
  avg_response_ms INTEGER,
  hints_used INTEGER DEFAULT 0,
  repetitions INTEGER DEFAULT 0,
  composite_score REAL,
  hint_rate REAL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Individual item responses
CREATE TABLE IF NOT EXISTS responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  memory_id UUID REFERENCES memories(id),
  prompt_text TEXT,
  expected_answers JSONB,
  transcript TEXT,
  is_correct BOOLEAN,
  response_ms INTEGER,
  hints_used INTEGER DEFAULT 0,
  match_score REAL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Caregiver alerts
CREATE TABLE IF NOT EXISTS caregiver_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  read_at TIMESTAMPTZ
);

-- Audit trail
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id UUID REFERENCES caregivers(id),
  patient_id UUID REFERENCES patients(id),
  event_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_patients_caregiver ON patients(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_memories_patient ON memories(patient_id);
CREATE INDEX IF NOT EXISTS idx_sessions_patient_date ON sessions(patient_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_responses_session ON responses(session_id);
CREATE INDEX IF NOT EXISTS idx_alerts_patient ON caregiver_alerts(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_caregiver ON events(caregiver_id, created_at DESC);
