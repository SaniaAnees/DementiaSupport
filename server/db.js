// Database layer — PostgreSQL when reachable, otherwise local SQLite fallback
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SQLITE_PATH = path.join(DATA_DIR, 'mindcare.db');

let pool = null;
let sqliteDb = null;
let engine = 'none';

const SQLITE_UUID = `(lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))))`;
const SQLITE_NOW = `(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

const SQLITE_SCHEMA = `
CREATE TABLE IF NOT EXISTS caregivers (
  id TEXT PRIMARY KEY DEFAULT ${SQLITE_UUID},
  phone TEXT UNIQUE NOT NULL,
  pin_hash TEXT,
  name TEXT,
  created_at TEXT DEFAULT ${SQLITE_NOW},
  updated_at TEXT DEFAULT ${SQLITE_NOW},
  last_login TEXT,
  token_version INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY DEFAULT ${SQLITE_UUID},
  caregiver_id TEXT NOT NULL,
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
  curriculum_started_at TEXT,
  created_at TEXT DEFAULT ${SQLITE_NOW},
  updated_at TEXT DEFAULT ${SQLITE_NOW}
);

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY DEFAULT ${SQLITE_UUID},
  patient_id TEXT NOT NULL,
  caption TEXT NOT NULL,
  short_label TEXT NOT NULL,
  aliases TEXT DEFAULT '[]',
  category TEXT,
  relation TEXT,
  image_url TEXT,
  thumbnail_url TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT ${SQLITE_NOW},
  updated_at TEXT DEFAULT ${SQLITE_NOW}
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY DEFAULT ${SQLITE_UUID},
  patient_id TEXT NOT NULL,
  session_type TEXT NOT NULL,
  status TEXT DEFAULT 'in_progress',
  started_at TEXT,
  ended_at TEXT,
  accuracy REAL,
  avg_response_ms INTEGER,
  hints_used INTEGER DEFAULT 0,
  repetitions INTEGER DEFAULT 0,
  composite_score REAL,
  hint_rate REAL,
  created_at TEXT DEFAULT ${SQLITE_NOW}
);

CREATE TABLE IF NOT EXISTS responses (
  id TEXT PRIMARY KEY DEFAULT ${SQLITE_UUID},
  session_id TEXT NOT NULL,
  item_type TEXT NOT NULL,
  memory_id TEXT,
  prompt_text TEXT,
  expected_answers TEXT,
  transcript TEXT,
  is_correct INTEGER,
  response_ms INTEGER,
  hints_used INTEGER DEFAULT 0,
  match_score REAL,
  created_at TEXT DEFAULT ${SQLITE_NOW}
);

CREATE TABLE IF NOT EXISTS caregiver_alerts (
  id TEXT PRIMARY KEY DEFAULT ${SQLITE_UUID},
  patient_id TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT DEFAULT ${SQLITE_NOW},
  read_at TEXT
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY DEFAULT ${SQLITE_UUID},
  caregiver_id TEXT,
  patient_id TEXT,
  event_type TEXT NOT NULL,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT ${SQLITE_NOW}
);
`;

function ensureSqliteColumns() {
  const cols = sqliteDb.prepare('PRAGMA table_info(patients)').all().map((c) => c.name);
  if (!cols.includes('region_state')) {
    sqliteDb.exec('ALTER TABLE patients ADD COLUMN region_state TEXT');
  }
  if (!cols.includes('curriculum_started_at')) {
    sqliteDb.exec('ALTER TABLE patients ADD COLUMN curriculum_started_at TEXT');
  }
}

async function ensurePostgresColumns() {
  if (!pool) return;
  await pool.query('ALTER TABLE patients ADD COLUMN IF NOT EXISTS region_state TEXT');
  await pool.query('ALTER TABLE patients ADD COLUMN IF NOT EXISTS curriculum_started_at TIMESTAMPTZ');
}

function initSQLite() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  sqliteDb = require('better-sqlite3')(SQLITE_PATH);
  sqliteDb.pragma('journal_mode = WAL');
  sqliteDb.exec(SQLITE_SCHEMA);
  ensureSqliteColumns();
  engine = 'sqlite';
  console.log('SQLite ready:', SQLITE_PATH);
}

function initPostgres() {
  const { Pool } = require('pg');
  const url = process.env.DATABASE_URL || '';
  const needsSsl =
    process.env.PGSSLMODE === 'require' ||
    url.includes('railway') ||
    url.includes('rlwy.net') ||
    url.includes('render.com') ||
    url.includes('supabase');
  pool = new Pool({
    connectionString: url,
    ssl: needsSsl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
  });
  pool.on('error', (err) => console.error('PG pool error:', err.message || err.code));
}

async function ensurePostgresSchema() {
  if (!pool) return;
  const schemaPath = path.join(__dirname, 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    console.warn('schema.sql missing — skipping Postgres schema bootstrap');
    return;
  }
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(sql);
}

function normalizeSql(sql) {
  if (!sqliteDb) return sql;
  return sql
    .replace(/\$(\d+)/g, '?')
    .replace(/::jsonb/g, '')
    .replace(/::json/g, '')
    .replace(/::text/g, '')
    .replace(/::uuid/g, '')
    .replace(/::integer/g, '')
    .replace(/\bnow\(\)/gi, "strftime('%Y-%m-%dT%H:%M:%fZ','now')");
}

/**
 * Probe DATABASE_URL. If Postgres is down / unreachable, fall back to SQLite
 * so demo OTP and local PWA keep working.
 * On Railway, prefer a linked Postgres plugin (DATABASE_URL) over ephemeral SQLite.
 */
async function ready() {
  const onRailway = !!(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);

  if (!process.env.DATABASE_URL) {
    try {
      initSQLite();
      return engine;
    } catch (err) {
      console.error('SQLite init failed:', err.message || err);
      if (onRailway) {
        throw new Error(
          'No DATABASE_URL and SQLite failed. Add a Postgres plugin on Railway and set DATABASE_URL.'
        );
      }
      throw err;
    }
  }

  try {
    initPostgres();
    await pool.query('SELECT 1');
    try {
      await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    } catch (_) {
      // may lack permission; schema may already use uuid-ossp
    }
    await ensurePostgresSchema();
    engine = 'postgres';
    await ensurePostgresColumns();
    console.log('PostgreSQL ready');
    return engine;
  } catch (err) {
    const why = err.code || err.message || 'unknown';
    console.warn('PostgreSQL unavailable (' + why + ') — using SQLite fallback');
    try {
      await pool?.end?.();
    } catch (_) {}
    pool = null;
    try {
      initSQLite();
      return engine;
    } catch (sqliteErr) {
      console.error('SQLite fallback failed:', sqliteErr.message || sqliteErr);
      throw new Error(
        'Database unavailable. On Railway: add Postgres, wait until it is Running, then redeploy. Detail: ' +
          why
      );
    }
  }
}

async function query(sql, params = []) {
  if (pool) {
    return pool.query(sql, params);
  }

  return new Promise((resolve, reject) => {
    try {
      sql = normalizeSql(sql);
      params = params.map((p) => {
        if (p === undefined || p === null) return null;
        if (typeof p === 'object') return JSON.stringify(p);
        return p;
      });

      const stmt = sqliteDb.prepare(sql);
      const upper = sql.trim().toUpperCase();
      if (upper.startsWith('SELECT') || upper.startsWith('WITH') || upper.includes('RETURNING')) {
        // better-sqlite3: RETURNING supported on recent versions via .all()
        const rows = stmt.all(...params);
        resolve({ rows });
      } else {
        const info = stmt.run(...params);
        resolve({ rows: [], rowCount: info.changes });
      }
    } catch (err) {
      reject(err);
    }
  });
}

function getEngine() {
  return engine;
}

module.exports = { query, pool, sqliteDb, uuid: randomUUID, ready, getEngine };
