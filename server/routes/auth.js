const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const { sendOtp, verifyOtp, isConfigured } = require('../twilio');
const { signToken, authMiddleware } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/otp/send
router.post('/otp/send', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone required' });

  // Demo mode: any phone, no SMS
  if (process.env.DEMO_MODE === 'true') {
    return res.json({ success: true, demo: true });
  }

  try {
    const result = await sendOtp(phone);
    res.json(result);
  } catch (err) {
    console.error('OTP send error:', err.message);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// POST /api/auth/otp/verify
router.post('/otp/verify', async (req, res) => {
  const { phone, otp } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone required' });

  const demoMode = process.env.DEMO_MODE === 'true';

  try {
    let verified = false;
    if (demoMode) {
      // Judges/demo: any phone + any 4–8 digit code
      verified = /^\d{4,8}$/.test(String(otp || ''));
    } else {
      const result = await verifyOtp(phone, otp);
      verified = result.success;
    }

    if (!verified) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    // Find or create caregiver
    let result = await db.query('SELECT * FROM caregivers WHERE phone = $1', [phone]);
    let caregiver = result.rows[0];

    if (!caregiver) {
      result = await db.query(
        'INSERT INTO caregivers (phone) VALUES ($1) RETURNING *',
        [phone]
      );
      caregiver = result.rows[0];
    }

    // Update last login
    await db.query('UPDATE caregivers SET last_login = now() WHERE id = $1', [caregiver.id]);

    // Log event
    await db.query(
      'INSERT INTO events (caregiver_id, event_type) VALUES ($1, $2)',
      [caregiver.id, 'login']
    );

    const token = signToken(caregiver);
    res.json({
      token,
      caregiver: { id: caregiver.id, phone: caregiver.phone, name: caregiver.name },
      needsPinSetup: !caregiver.pin_hash,
      demo: demoMode,
    });
  } catch (err) {
    console.error('OTP verify error:', err.code || '', err.message || err);
    res.status(500).json({
      error: 'Verification failed',
      detail: process.env.DEMO_MODE === 'true' ? (err.message || err.code || 'database error') : undefined,
    });
  }
});

// POST /api/auth/pin/set
router.post('/pin/set', authMiddleware, async (req, res) => {
  const { pin } = req.body;
  if (!pin || pin.length < 4) {
    return res.status(400).json({ error: 'PIN must be at least 4 digits' });
  }

  try {
    const pinHash = await bcrypt.hash(pin, 10);
    await db.query('UPDATE caregivers SET pin_hash = $1 WHERE id = $2', [pinHash, req.caregiverId]);
    res.json({ success: true });
  } catch (err) {
    console.error('PIN set error:', err.message);
    res.status(500).json({ error: 'Failed to set PIN' });
  }
});

// POST /api/auth/pin/verify
router.post('/pin/verify', authMiddleware, async (req, res) => {
  const { pin } = req.body;
  if (!pin) return res.status(400).json({ error: 'PIN required' });

  try {
    const result = await db.query('SELECT pin_hash FROM caregivers WHERE id = $1', [req.caregiverId]);
    const caregiver = result.rows[0];
    if (!caregiver?.pin_hash) {
      return res.status(400).json({ error: 'No PIN set' });
    }
    const valid = await bcrypt.compare(pin, caregiver.pin_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid PIN' });
    res.json({ success: true });
  } catch (err) {
    console.error('PIN verify error:', err.message);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, phone, name, pin_hash FROM caregivers WHERE id = $1',
      [req.caregiverId]
    );
    const caregiver = result.rows[0];
    if (!caregiver) return res.status(404).json({ error: 'Not found' });
    res.json({
      id: caregiver.id,
      phone: caregiver.phone,
      name: caregiver.name,
      hasPin: !!caregiver.pin_hash,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/auth/me — caregiver profile (name, role)
router.put('/me', authMiddleware, async (req, res) => {
  const { name, role } = req.body;
  try {
    const displayName = role && name ? `${name} (${role})` : name || null;
    const result = await db.query(
      'UPDATE caregivers SET name = $1, updated_at = now() WHERE id = $2 RETURNING id, phone, name',
      [displayName, req.caregiverId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update me error:', err.message);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// POST /api/auth/logout
router.post('/logout', authMiddleware, async (req, res) => {
  // Increment token version to invalidate all existing tokens
  await db.query('UPDATE caregivers SET token_version = token_version + 1 WHERE id = $1', [req.caregiverId]);
  res.json({ success: true });
});

module.exports = router;
