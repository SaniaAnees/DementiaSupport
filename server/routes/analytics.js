const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { classifyTrend, detectFlags } = require('../utils/trends');
const { buildHeroInsights, normalizeSession } = require('../utils/heroInsights');

const router = express.Router();
router.use(authMiddleware);

// GET /api/analytics/:patientId — full dashboard
router.get('/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const days = parseInt(req.query.days) || 30;

    const patientResult = await db.query(
      'SELECT * FROM patients WHERE id = $1 AND caregiver_id = $2',
      [patientId, req.caregiverId]
    );
    if (!patientResult.rows[0]) return res.status(404).json({ error: 'Not found' });

    // Hero needs week + 30-day history (ISO cutoff works on Postgres + SQLite)
    const heroDays = Math.max(days, 45);
    const cutoffIso = new Date(Date.now() - heroDays * 24 * 60 * 60 * 1000).toISOString();
    const sessionsResult = await db.query(
      `SELECT * FROM sessions WHERE patient_id = $1 AND started_at > $2
       ORDER BY started_at DESC`,
      [patientId, cutoffIso]
    );
    const sessions = sessionsResult.rows;
    const normalized = sessions.map((s) => ({
      ...normalizeSession(s),
      hintRate: s.hint_rate ?? s.hintRate,
      avgResponseMs: s.avg_response_ms ?? s.avgResponseMs,
    }));

    const alertsResult = await db.query(
      `SELECT * FROM caregiver_alerts WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [patientId]
    );

    const completed = normalized.filter((s) => s.status === 'completed');
    const trend = classifyTrend(completed);
    const flags = detectFlags(completed);
    const hero = buildHeroInsights(patientResult.rows[0], sessions, {
      trendState: trend.state,
    });

    const totalSessions = completed.length;
    const avgAccuracy = completed.length
      ? completed.reduce((s, x) => s + (x.accuracy || 0), 0) / completed.length
      : 0;
    const avgComposite = completed.length
      ? completed.reduce((s, x) => s + (x.compositeScore || 0), 0) / completed.length
      : 0;
    const avgResponseMs = completed.length
      ? Math.round(completed.reduce((s, x) => s + (x.avgResponseMs || 0), 0) / completed.length)
      : 0;

    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const dailyScores = completed
      .filter((s) => s.startedAt && new Date(s.startedAt).getTime() > cutoff)
      .slice()
      .reverse()
      .map((s) => ({
        date: s.startedAt?.slice(0, 10),
        accuracy: s.accuracy,
        composite: s.compositeScore,
        type: s.sessionType,
      }));

    res.json({
      patient: patientResult.rows[0],
      summary: {
        totalSessions,
        avgAccuracy: Math.round(avgAccuracy * 100) / 100,
        avgComposite: Math.round(avgComposite * 10) / 10,
        avgResponseMs,
      },
      hero,
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
