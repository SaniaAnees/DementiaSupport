const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { resolveRegion, listStates } = require('../curriculum/geo');

const router = express.Router();
router.use(authMiddleware);

function resolvePatientRegion(hometown, regionState) {
  return resolveRegion(hometown, regionState);
}

// GET /api/patients/meta/ner-states — list Seven Sister packs
router.get('/meta/ner-states', (_req, res) => {
  res.json(listStates());
});

// GET /api/patients
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM patients WHERE caregiver_id = $1 ORDER BY created_at DESC',
      [req.caregiverId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

// POST /api/patients
router.post('/', async (req, res) => {
  const {
    fullName, preferredName, age, hometown, regionState, languageCode,
    dementiaNotes, morningHour, morningMinute, eveningHour, eveningMinute,
  } = req.body;
  if (!fullName) return res.status(400).json({ error: 'fullName required' });

  const resolved = resolvePatientRegion(hometown, regionState);
  const region = regionState || resolved?.code || null;

  try {
    const result = await db.query(
      `INSERT INTO patients (caregiver_id, full_name, preferred_name, age, hometown, region_state, language_code, dementia_notes, morning_hour, morning_minute, evening_hour, evening_minute, curriculum_started_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now()) RETURNING *`,
      [
        req.caregiverId, fullName, preferredName, age, hometown, region,
        languageCode || resolved?.languageHint || 'en-IN',
        dementiaNotes, morningHour || 9, morningMinute || 0,
        eveningHour || 19, eveningMinute || 0,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create patient' });
  }
});

// GET /api/patients/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM patients WHERE id = $1 AND caregiver_id = $2',
      [req.params.id, req.caregiverId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch patient' });
  }
});

// PUT /api/patients/:id
router.put('/:id', async (req, res) => {
  const {
    fullName, preferredName, age, hometown, regionState, languageCode,
    dementiaNotes, morningHour, morningMinute, eveningHour, eveningMinute,
  } = req.body;
  const resolved = resolvePatientRegion(hometown, regionState);
  const region = regionState || resolved?.code || null;

  try {
    const result = await db.query(
      `UPDATE patients SET full_name=$1, preferred_name=$2, age=$3, hometown=$4, region_state=$5, language_code=$6, dementia_notes=$7, morning_hour=$8, morning_minute=$9, evening_hour=$10, evening_minute=$11, updated_at=now()
       WHERE id=$12 AND caregiver_id=$13 RETURNING *`,
      [
        fullName, preferredName, age, hometown, region, languageCode,
        dementiaNotes, morningHour, morningMinute, eveningHour, eveningMinute,
        req.params.id, req.caregiverId,
      ]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update patient' });
  }
});

// DELETE /api/patients/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM patients WHERE id = $1 AND caregiver_id = $2', [req.params.id, req.caregiverId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete patient' });
  }
});

// GET /api/patients/:id/memories
router.get('/:id/memories', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM memories WHERE patient_id = $1 ORDER BY sort_order',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch memories' });
  }
});

// POST /api/patients/:id/memories
router.post('/:id/memories', async (req, res) => {
  const { caption, shortLabel, aliases, category, relation, imageUrl, sortOrder } = req.body;
  if (!caption || !shortLabel) {
    return res.status(400).json({ error: 'caption and shortLabel required' });
  }

  try {
    const result = await db.query(
      `INSERT INTO memories (patient_id, caption, short_label, aliases, category, relation, image_url, sort_order)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8) RETURNING *`,
      [req.params.id, caption, shortLabel, JSON.stringify(aliases || []), category, relation, imageUrl, sortOrder || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add memory' });
  }
});

// DELETE /api/patients/:id/memories/:memoryId
router.delete('/:id/memories/:memoryId', async (req, res) => {
  try {
    const patient = await db.query(
      'SELECT id FROM patients WHERE id = $1 AND caregiver_id = $2',
      [req.params.id, req.caregiverId]
    );
    if (!patient.rows.length) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    await db.query(
      'DELETE FROM memories WHERE id = $1 AND patient_id = $2',
      [req.params.memoryId, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete memory' });
  }
});

module.exports = router;
