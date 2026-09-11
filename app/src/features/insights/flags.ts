import type { AnswerLog, Session, SoftConstraints } from '../../shared/types';

export function classifyTrend(sessions: Session[]) {
  const scored = sessions
    .filter((s) => s.status === 'completed' && s.accuracy != null)
    .sort((a, b) => (a.startedAt || a.createdAt).localeCompare(b.startedAt || b.createdAt));

  if (scored.length < 3) {
    return {
      state: 'insufficient_data' as const,
      message: 'A few more completed sessions will show a clearer picture.',
      paragraph:
        'Not enough completed sessions yet to judge better, worse, or same. Keep the morning and evening ritual going.',
    };
  }

  const recent = scored.slice(-3);
  const prior = scored.slice(-6, -3);
  const avg = (list: Session[]) =>
    list.reduce((s, x) => s + (x.accuracy ?? 0), 0) / (list.length || 1);

  if (prior.length < 3) {
    return {
      state: 'stable' as const,
      message: 'Engagement looks steady so far.',
      paragraph:
        'Early scores look steady. Keep both daily sessions when you can — consistency matters more than any single day.',
    };
  }

  const delta = (avg(recent) - avg(prior)) * 100;
  if (delta <= -20) {
    return {
      state: 'declining' as const,
      message: 'Accuracy dropped about 20%+ across the last few sessions.',
      paragraph:
        'Recent accuracy is lower than the previous few sessions. Consider slower pacing and more warm-up photos. If this continues for several days, talk to the doctor — this app does not diagnose.',
    };
  }
  if (delta >= 15) {
    return {
      state: 'improving' as const,
      message: 'Recent sessions are stronger than earlier ones.',
      paragraph:
        'Recent scores look stronger than earlier ones. Keep the familiar photo library and the same daily times — the ritual seems to be helping.',
    };
  }
  return {
    state: 'stable' as const,
    message: 'Scores are relatively stable.',
    paragraph:
      'Performance looks about the same as the previous stretch: neither a clear rise nor a sharp fall. That “same” reading is useful for clinic conversations.',
  };
}

/** Flags only when something real shifts. */
export function detectFlags(sessions: Session[], logs: AnswerLog[]) {
  const flags: { title: string; body: string; severity: 'watch' | 'attention' }[] = [];
  const completed = sessions
    .filter((s) => s.status === 'completed' && s.accuracy != null)
    .sort((a, b) => (a.startedAt || '').localeCompare(b.startedAt || ''));

  const last3 = completed.slice(-3);
  const prev3 = completed.slice(-6, -3);
  if (last3.length === 3 && prev3.length === 3) {
    const avg = (xs: Session[]) => xs.reduce((s, x) => s + (x.accuracy ?? 0), 0) / 3;
    if (avg(last3) <= avg(prev3) - 0.2) {
      flags.push({
        severity: 'watch',
        title: 'Accuracy down for 3 sessions',
        body: 'Recognition/orientation accuracy fell about 20% versus the prior three. If this keeps up, talk to the doctor.',
      });
    }
  }

  const last7 = completed.slice(-7);
  if (last7.length >= 4) {
    const hintRates = last7.map((s) => s.hintRate ?? 0);
    const recentHint = hintRates.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const earlier = hintRates.slice(0, -3);
    const earlierHint = earlier.length
      ? earlier.reduce((a, b) => a + b, 0) / earlier.length
      : recentHint;
    if (recentHint >= earlierHint + 0.25) {
      flags.push({
        severity: 'watch',
        title: 'Hints spiked recently',
        body: 'They needed more hints than usual. Try more warm-up photos and a calmer evening.',
      });
    }
  }

  const mornings = completed.filter((s) => s.sessionType === 'morning').slice(-5);
  const evenings = completed.filter((s) => s.sessionType === 'evening').slice(-5);
  if (mornings.length >= 3 && evenings.length >= 3) {
    const mAvg = mornings.reduce((s, x) => s + (x.accuracy ?? 0), 0) / mornings.length;
    const eAvg = evenings.reduce((s, x) => s + (x.accuracy ?? 0), 0) / evenings.length;
    if (eAvg <= mAvg - 0.2) {
      flags.push({
        severity: 'attention',
        title: 'Evening orientation weaker',
        body: 'Evening orientation scores are trailing morning recognition. Worth mentioning at the next clinic visit — not a diagnosis.',
      });
    }
  }

  const badStreak = completed.slice(-5).filter((s) => (s.accuracy ?? 1) < 0.4);
  if (badStreak.length >= 4) {
    flags.push({
      severity: 'attention',
      title: 'Hard stretch — talk to the doctor',
      body: 'Several recent sessions scored low. Use the weekly share note for the clinic. This app cannot diagnose.',
    });
  }

  void logs;
  return flags;
}

export function adaptFromRecent(
  sessions: Session[],
  base: SoftConstraints
): SoftConstraints {
  const recent = sessions
    .filter((s) => s.status === 'completed' && s.accuracy != null)
    .slice(-5);
  if (!recent.length) return base;
  const avgAcc = recent.reduce((s, x) => s + (x.accuracy ?? 0), 0) / recent.length;
  const avgHints = recent.reduce((s, x) => s + (x.hintRate ?? 0), 0) / recent.length;

  const next = { ...base };
  if (avgAcc < 0.55 || avgHints > 0.4) {
    next.warmupCount = Math.min(4, base.warmupCount + 1);
    next.quizCount = Math.max(2, base.quizCount - 1);
    next.pauseBeforeHintMs = base.pauseBeforeHintMs + 2000;
    next.moreHints = true;
  } else if (avgAcc > 0.8 && avgHints < 0.15) {
    next.warmupCount = Math.max(2, base.warmupCount - 1);
    next.quizCount = Math.min(6, base.quizCount + 1);
  }
  return next;
}
