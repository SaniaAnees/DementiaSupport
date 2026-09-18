// Ported from app/src/features/insights/flags.ts
// Pure trend analysis functions — no I/O

/**
 * @param {Array<{ status?: string, accuracy?: number, startedAt?: string, createdAt?: string }>} sessions
 * @returns {{ state: string, message: string }}
 */
function classifyTrend(sessions) {
  const scored = sessions
    .filter((s) => s.status === 'completed' && s.accuracy != null)
    .sort((a, b) => (a.startedAt || a.createdAt || '').localeCompare(b.startedAt || b.createdAt || ''));

  if (scored.length < 3) {
    return {
      state: 'insufficient_data',
      message: 'A few more completed sessions will show a clearer picture.',
    };
  }

  const recent = scored.slice(-3);
  const prior = scored.slice(-6, -3);
  const avg = (list) => list.reduce((s, x) => s + (x.accuracy || 0), 0) / (list.length || 1);

  if (prior.length < 3) {
    return { state: 'stable', message: 'Engagement looks steady so far.' };
  }

  const delta = (avg(recent) - avg(prior)) * 100;
  if (delta <= -20) {
    return {
      state: 'declining',
      message: 'Accuracy dropped about 20%+ across the last few sessions.',
    };
  }
  if (delta >= 15) {
    return { state: 'improving', message: 'Recent sessions are stronger than earlier ones.' };
  }
  return { state: 'stable', message: 'Scores are relatively stable.' };
}

/**
 * @param {Array<{ status?: string, accuracy?: number, sessionType?: string, startedAt?: string, createdAt?: string, hintRate?: number }>} sessions
 * @returns {Array<{ title: string, body: string, severity: 'watch'|'attention' }>}
 */
function detectFlags(sessions) {
  const flags = [];
  const completed = sessions
    .filter((s) => s.status === 'completed' && s.accuracy != null)
    .sort((a, b) => (a.startedAt || '').localeCompare(b.startedAt || ''));

  const last3 = completed.slice(-3);
  const prev3 = completed.slice(-6, -3);
  if (last3.length === 3 && prev3.length === 3) {
    const avg = (xs) => xs.reduce((s, x) => s + (x.accuracy || 0), 0) / 3;
    if (avg(last3) <= avg(prev3) - 0.2) {
      flags.push({
        severity: 'watch',
        title: 'Accuracy down for 3 sessions',
        body: 'Recognition accuracy fell about 20% versus the prior three.',
      });
    }
  }

  const last7 = completed.slice(-7);
  if (last7.length >= 4) {
    const hintRates = last7.map((s) => s.hintRate || 0);
    const recentHint = hintRates.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const earlier = hintRates.slice(0, -3);
    const earlierHint = earlier.length ? earlier.reduce((a, b) => a + b, 0) / earlier.length : recentHint;
    if (recentHint >= earlierHint + 0.25) {
      flags.push({
        severity: 'watch',
        title: 'Hints spiked recently',
        body: 'They needed more hints than usual.',
      });
    }
  }

  const mornings = completed.filter((s) => s.sessionType === 'morning').slice(-5);
  const evenings = completed.filter((s) => s.sessionType === 'evening').slice(-5);
  if (mornings.length >= 3 && evenings.length >= 3) {
    const mAvg = mornings.reduce((s, x) => s + (x.accuracy || 0), 0) / mornings.length;
    const eAvg = evenings.reduce((s, x) => s + (x.accuracy || 0), 0) / evenings.length;
    if (eAvg <= mAvg - 0.2) {
      flags.push({
        severity: 'attention',
        title: 'Evening orientation weaker',
        body: 'Evening scores are trailing morning recognition.',
      });
    }
  }

  const badStreak = completed.slice(-5).filter((s) => (s.accuracy || 1) < 0.4);
  if (badStreak.length >= 4) {
    flags.push({
      severity: 'attention',
      title: 'Hard stretch — talk to the doctor',
      body: 'Several recent sessions scored low.',
    });
  }

  return flags;
}

module.exports = { classifyTrend, detectFlags };
