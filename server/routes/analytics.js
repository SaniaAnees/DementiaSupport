const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { classifyTrend, detectFlags } = require('../utils/trends');

const router = express.Router();
router.use(authMiddleware);

// GET /api/analytics/:patientId — full dashboard
router.get('/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const days = parseInt(req.query.days) || 30;

    // Verify ownership
    const patientResult = await db.query(
      'SELECT * FROM patients WHERE id = $1 AND caregiver_id = $2',
      [patientId, req.caregiverId]
    );
    if (!patientResult.rows[0]) return res.status(404).json({ error: 'Not found' });

    // Get sessions
    const sessionsResult = await db.query(
      `SELECT * FROM sessions WHERE patient_id = $1 AND started_at > now() - $2 * interval '1 day'
       ORDER BY started_at DESC`,
      [patientId, days]
    );
    const sessions = sessionsResult.rows;

    // Get alerts
    const alertsResult = await db.query(
      `SELECT * FROM caregiver_alerts WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [patientId]
    );

    // Compute analytics
    const completed = sessions.filter((s) => s.status === 'completed');
    const trend = classifyTrend(completed);
    const flags = detectFlags(completed);

    // Summary stats
    const totalSessions = completed.length;
    const avgAccuracy = completed.length
      ? completed.reduce((s, x) => s + (x.accuracy || 0), 0) / completed.length
      : 0;
    const avgComposite = completed.length
      ? completed.reduce((s, x) => s + (x.composite_score || 0), 0) / completed.length
      : 0;
    const avgResponseMs = completed.length
      ? Math.round(completed.reduce((s, x) => s + (x.avg_response_ms || 0), 0) / completed.length)
      : 0;

    // Daily scores for chart
    const dailyScores = completed
      .slice()
      .reverse()
      .map((s) => ({
        date: s.started_at?.slice(0, 10),
        accuracy: s.accuracy,
        composite: s.composite_score,
        type: s.session_type,
      }));

    res.json({
      patient: patientResult.rows[0],
      summary: {
        totalSessions,
        avgAccuracy: Math.round(avgAccuracy * 100) / 100,
        avgComposite: Math.round(avgComposite * 10) / 10,
        avgResponseMs,
      },
      trend,
      flags,
      alerts: alertsResult.rows,
      dailyScores,
      recentSessions: sessions.slice(0, 10),
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

module.exports = router;
