const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// POST /api/sync — bulk sync offline data
router.post('/', async (req, res) => {
  const { items } = req.body;
  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'items array required' });
  }

  const results = [];
  let synced = 0;

  for (const item of items) {
    try {
      switch (item.entityType) {
        case 'session_complete':
          await syncSession(item.payload);
          break;
        case 'patient':
          await syncPatient(item.payload);
          break;
        case 'memory':
          await syncMemory(item.payload);
          break;
      }
      synced++;
      results.push({ id: item.entityId, status: 'synced' });
    } catch (err) {
      results.push({ id: item.entityId, status: 'error', error: err.message });
    }
  }

  res.json({ synced, total: items.length, results });
});

async function syncSession(payload) {
  const { session, responses, scores } = payload;
  // Upsert session
  await db.query(
    `INSERT INTO sessions (id, patient_id, session_type, status, started_at, ended_at, accuracy, avg_response_ms, hints_used, repetitions, composite_score, hint_rate)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (id) DO UPDATE SET
       status=EXCLUDED.status, ended_at=EXCLUDED.ended_at, accuracy=EXCLUDED.accuracy,
       avg_response_ms=EXCLUDED.avg_response_ms, hints_used=EXCLUDED.hints_used,
       repetitions=EXCLUDED.repetitions, composite_score=EXCLUDED.composite_score, hint_rate=EXCLUDED.hint_rate`,
    [session.id, session.patientId, session.sessionType, 'completed', session.startedAt, session.endedAt,
     scores.accuracy, scores.avgResponseMs, scores.hintsUsed, scores.repetitions, scores.compositeScore, scores.hintRate]
  );
  // Insert responses
  for (const r of responses) {
    await db.query(
      `INSERT INTO responses (session_id, item_type, memory_id, prompt_text, expected_answers, transcript, is_correct, response_ms, hints_used, match_score)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10)
       ON CONFLICT DO NOTHING`,
      [session.id, r.itemType, r.memoryId, r.promptText, JSON.stringify(r.expectedAnswers || []),
       r.transcript, r.isCorrect, r.responseMs, r.hintsUsed, r.matchScore]
    );
  }
}

async function syncPatient(payload) {
  await db.query(
    `INSERT INTO patients (id, caregiver_id, full_name, preferred_name, age, hometown, language_code, dementia_notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (id) DO UPDATE SET
       full_name=EXCLUDED.full_name, preferred_name=EXCLUDED.preferred_name, age=EXCLUDED.age,
       hometown=EXCLUDED.hometown, language_code=EXCLUDED.language_code, dementia_notes=EXCLUDED.dementia_notes`,
    [payload.id, payload.caregiverId, payload.fullName, payload.preferredName, payload.age,
     payload.hometown, payload.languageCode, payload.dementiaNotes]
  );
}

async function syncMemory(payload) {
  await db.query(
    `INSERT INTO memories (id, patient_id, caption, short_label, aliases, category, relation, image_url, sort_order)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9)
     ON CONFLICT (id) DO UPDATE SET
       caption=EXCLUDED.caption, short_label=EXCLUDED.short_label, aliases=EXCLUDED.aliases,
       category=EXCLUDED.category, relation=EXCLUDED.relation, image_url=EXCLUDED.image_url`,
    [payload.id, payload.patientId, payload.caption, payload.shortLabel, JSON.stringify(payload.aliases || []),
     payload.category, payload.relation, payload.imageUrl, payload.sortOrder]
  );
}

module.exports = router;
