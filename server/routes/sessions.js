const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { shuffle, chips, expected, variedPrompt, computeSessionScores, domainScoresFromResponses } = require('../utils/scoring');
const { buildCurriculumSession } = require('../curriculum/builder');

const router = express.Router();
router.use(authMiddleware);

// Helper: verify patient belongs to caregiver
async function verifyPatient(patientId, caregiverId) {
  const result = await db.query(
    'SELECT * FROM patients WHERE id = $1 AND caregiver_id = $2',
    [patientId, caregiverId]
  );
  return result.rows[0];
}

// POST /api/sessions — start a new session
router.post('/', async (req, res) => {
  const { patientId, sessionType } = req.body;
  if (!patientId || !sessionType) {
    return res.status(400).json({ error: 'patientId and sessionType required' });
  }

  try {
    const patient = await verifyPatient(patientId, req.caregiverId);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    // Fetch memories
    const memResult = await db.query(
      'SELECT * FROM memories WHERE patient_id = $1 ORDER BY sort_order',
      [patientId]
    );
    const memories = memResult.rows.map((m) => ({
      id: m.id,
      localUri: m.image_url,
      caption: m.caption,
      shortLabel: m.short_label,
      aliases: m.aliases || [],
      relation: m.relation,
      category: m.category,
    }));

    // Prefer NER curriculum pack; fall back to legacy memory teach/quiz
    const curriculum = buildCurriculumSession(patient, memories, sessionType);
    const items = curriculum
      ? curriculum.items
      : buildSessionItems(patient, memories, sessionType);

    // Create session record
    const sessionResult = await db.query(
      `INSERT INTO sessions (patient_id, session_type, status, started_at)
       VALUES ($1, $2, 'in_progress', now()) RETURNING *`,
      [patientId, sessionType]
    );
    const session = sessionResult.rows[0];

    res.status(201).json({
      session: {
        ...session,
        curriculum: curriculum?.meta || null,
      },
      items: items.map((item, i) => ({
        ...item,
        sessionId: session.id,
        sortOrder: i,
      })),
    });
  } catch (err) {
    console.error('Session start error:', err);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

function buildSessionItems(patient, memories, sessionType) {
  const labels = memories.map((m) => m.shortLabel);
  const items = [];

  if (sessionType === 'morning') {
    // Morning: teach phase then quiz phase
    const selected = shuffle(memories).slice(0, Math.min(4, memories.length));

    // Teach items
    selected.forEach((memory) => {
      const p = variedPrompt(memory, 'teach');
      items.push({
        itemType: 'memory_teach',
        memoryId: memory.id,
        promptText: p.shown,
        spokenPrompt: p.spoken,
        expectedAnswers: expected(memory),
        localUri: memory.localUri,
        caption: memory.caption,
        hintText: memory.shortLabel,
        chipOptions: null,
      });
    });

    // Quiz items
    shuffle(selected).forEach((memory) => {
      const p = variedPrompt(memory, 'quiz');
      items.push({
        itemType: 'memory_quiz',
        memoryId: memory.id,
        promptText: p.shown,
        spokenPrompt: p.spoken,
        expectedAnswers: expected(memory),
        localUri: memory.localUri,
        caption: memory.caption,
        hintText: `It is ${memory.shortLabel}.`,
        chipOptions: chips(memory.shortLabel, labels),
      });
    });
  } else {
    // Evening: orientation + memory quiz
    const names = [patient.preferred_name, patient.full_name].filter(Boolean);
    if (names.length) {
      items.push({
        itemType: 'orientation',
        memoryId: null,
        promptText: 'What is your name?',
        spokenPrompt: 'What is your name?',
        expectedAnswers: names,
        hintText: `Your name is ${names[0]}.`,
        chipOptions: chips(names[0], [...names, ...labels.filter((l) => l !== names[0]).slice(0, 3)]),
      });
    }
    if (patient.hometown) {
      items.push({
        itemType: 'orientation',
        memoryId: null,
        promptText: 'Where are you from?',
        spokenPrompt: 'Where are you from?',
        expectedAnswers: [patient.hometown, `from ${patient.hometown}`],
        hintText: `You are from ${patient.hometown}.`,
        chipOptions: chips(patient.hometown, [patient.hometown, 'Guwahati', 'Shillong', 'Kohima', 'Imphal']),
      });
    }

    // 1-2 memory quizzes
    shuffle(memories).slice(0, Math.min(2, memories.length)).forEach((memory) => {
      const p = variedPrompt(memory, 'quiz');
      items.push({
        itemType: 'memory_quiz',
        memoryId: memory.id,
        promptText: p.shown,
        spokenPrompt: p.spoken,
        expectedAnswers: expected(memory),
        localUri: memory.localUri,
        caption: memory.caption,
        hintText: `This is ${memory.shortLabel}.`,
        chipOptions: chips(memory.shortLabel, labels),
      });
    });
  }

  return items;
}

// POST /api/sessions/:id/complete — submit results
router.post('/:id/complete', async (req, res) => {
  const { responses } = req.body;
  if (!responses || !Array.isArray(responses)) {
    return res.status(400).json({ error: 'responses array required' });
  }

  try {
    // Calculate scores — skip teach / story beats (auto-continue)
    const scored = responses.filter(
      (r) => !['story_beat', 'registration_teach', 'memory_teach'].includes(r.itemType)
    );
    const scores = computeSessionScores(
      scored.map((r) => ({
        outcome: r.isCorrect ? 'correct' : r.skipped ? 'skipped' : 'wrong',
        responseMs: r.responseMs || 0,
        hintsUsed: r.hintsUsed || 0,
        repetitions: r.repetitions || 0,
      }))
    );

    const domains =
      (req.body.domains && typeof req.body.domains === 'object' ? req.body.domains : null) ||
      domainScoresFromResponses(responses);
    scores.domains = domains;

    // Update session (domains JSON for skill meters on caregiver dashboard)
    const sessionResult = await db.query(
      `UPDATE sessions SET status='completed', ended_at=now(), accuracy=$1, avg_response_ms=$2, hints_used=$3, repetitions=$4, composite_score=$5, hint_rate=$6, domains=$7::jsonb
       WHERE id=$8 RETURNING *`,
      [
        scores.accuracy,
        scores.avgResponseMs,
        scores.hintsUsed,
        scores.repetitions,
        scores.compositeScore,
        scores.hintRate,
        JSON.stringify(domains || {}),
        req.params.id,
      ]
    );

    if (!sessionResult.rows[0]) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Insert responses (include domain for rebuild / analytics)
    for (const r of responses) {
      await db.query(
        `INSERT INTO responses (session_id, item_type, memory_id, prompt_text, expected_answers, transcript, is_correct, response_ms, hints_used, match_score, domain)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11)`,
        [
          req.params.id,
          r.itemType,
          r.memoryId,
          r.promptText,
          JSON.stringify(r.expectedAnswers || []),
          r.transcript,
          r.isCorrect,
          r.responseMs,
          r.hintsUsed,
          r.matchScore,
          r.domain || null,
        ]
      );
    }

    // Log event
    await db.query(
      'INSERT INTO events (caregiver_id, patient_id, event_type, metadata) VALUES ($1,$2,$3,$4::jsonb)',
      [req.caregiverId, sessionResult.rows[0].patient_id, 'session_complete', JSON.stringify({ compositeScore: scores.compositeScore })]
    );

    // Check for trend alerts
    await checkAndCreateAlert(sessionResult.rows[0].patient_id);

    res.json({ session: sessionResult.rows[0], scores });
  } catch (err) {
    console.error('Session complete error:', err);
    res.status(500).json({ error: 'Failed to complete session' });
  }
});

async function checkAndCreateAlert(patientId) {
  const { classifyTrend } = require('../utils/trends');
  const sessions = await db.query(
    `SELECT accuracy, composite_score, session_type, hint_rate, started_at FROM sessions
     WHERE patient_id = $1 AND status = 'completed' ORDER BY started_at DESC LIMIT 30`,
    [patientId]
  );
  const trend = classifyTrend(sessions.rows);
  if (trend.state === 'declining') {
    await db.query(
      `INSERT INTO caregiver_alerts (patient_id, severity, title, body) VALUES ($1, $2, $3, $4)`,
      [patientId, 'watch', 'Performance declining', trend.message]
    );
  }
}

// GET /api/sessions?patientId=&days= — list sessions for caregiver dashboard (real DB only)
router.get('/', async (req, res) => {
  try {
    const patientId = req.query.patientId;
    if (!patientId) return res.status(400).json({ error: 'patientId required' });
    const patient = await verifyPatient(patientId, req.caregiverId);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 90));
    const cutoffIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const result = await db.query(
      `SELECT * FROM sessions WHERE patient_id = $1 AND started_at > $2
       ORDER BY started_at DESC`,
      [patientId, cutoffIso]
    );
    res.json({ sessions: result.rows });
  } catch (err) {
    console.error('List sessions error:', err);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

// GET /api/sessions/:id — get session with responses
router.get('/:id', async (req, res) => {
  try {
    const sessionResult = await db.query('SELECT * FROM sessions WHERE id = $1', [req.params.id]);
    if (!sessionResult.rows[0]) return res.status(404).json({ error: 'Not found' });

    const responsesResult = await db.query(
      'SELECT * FROM responses WHERE session_id = $1 ORDER BY created_at',
      [req.params.id]
    );

    res.json({ ...sessionResult.rows[0], responses: responsesResult.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

module.exports = router;
