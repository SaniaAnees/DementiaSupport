require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../db');

async function setup() {
  const engine = await db.ready();
  if (engine === 'sqlite') {
    console.log('SQLite schema is applied automatically on startup');
    process.exit(0);
  }

  const schema = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8');
  try {
    await db.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  } catch (_) {}

  try {
    await db.query(schema);
    console.log('Database schema created successfully');
  } catch (err) {
    console.error('Schema setup failed:', err.message);
    process.exit(1);
  } finally {
    if (db.pool) await db.pool.end();
    process.exit(0);
  }
}

setup();
