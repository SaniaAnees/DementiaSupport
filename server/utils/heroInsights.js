// Phase 1 caregiver hero — confidence language from session history (pure, no I/O)

const WEEK_TARGET = 14;
const MS_DAY = 24 * 60 * 60 * 1000;

function normalizeSession(s) {
  return {
    status: s.status,
    accuracy: s.accuracy != null ? Number(s.accuracy) : null,
    compositeScore: s.compositeScore ?? s.composite_score ?? null,
    sessionType: s.sessionType || s.session_type || null,
    startedAt: s.startedAt || s.started_at || s.createdAt || s.created_at || null,
    endedAt: s.endedAt || s.ended_at || null,
  };
}

function startOfLocalDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function weekBounds(now) {
  const end = startOfLocalDay(now);
  end.setHours(23, 59, 59, 999);
  const start = startOfLocalDay(now);
  // Rolling 7-day window ending today (not calendar week)
  start.setDate(start.getDate() - 6);
  return { start, end };
}

function priorWeekBounds(now) {
  const { start } = weekBounds(now);
  const end = new Date(start.getTime() - 1);
  const priorStart = new Date(start);
  priorStart.setDate(priorStart.getDate() - 7);
  return { start: priorStart, end };
}

function inRange(iso, start, end) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

function avgAccuracy(list) {
  const scored = list.filter((s) => s.accuracy != null);
  if (!scored.length) return null;
  return scored.reduce((sum, s) => sum + s.accuracy, 0) / scored.length;
}

function formatLastActive(iso, now = new Date()) {
  if (!iso) {
    return { label: 'Not yet active', relative: 'never', isToday: false };
  }
  const when = new Date(iso);
  const today = startOfLocalDay(now);
  const day = startOfLocalDay(when);
  const diffDays = Math.round((today - day) / MS_DAY);
  const time = when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (diffDays === 0) {
    return { label: `Today, ${time}`, relative: 'today', isToday: true };
  }
  if (diffDays === 1) {
    return { label: `Yesterday, ${time}`, relative: 'yesterday', isToday: false };
  }
  if (diffDays < 7) {
    return {
      label: `${diffDays} days ago, ${time}`,
      relative: `${diffDays}d`,
      isToday: false,
    };
  }
  return {
    label: when.toLocaleDateString([], { month: 'short', day: 'numeric' }) + `, ${time}`,
    relative: 'older',
    isToday: false,
  };
}

function overallFromDelta(weekDeltaPct, trendState) {
  if (trendState === 'insufficient_data' && weekDeltaPct == null) {
    return {
      state: 'building',
      label: 'Building a picture',
      line: 'A few more sessions will show the arc',
      tone: 'muted',
    };
  }
  if (weekDeltaPct != null && weekDeltaPct >= 2) {
    return {
      state: 'improving',
      label: 'Getting better',
      line: `+${Math.round(weekDeltaPct)}% this week`,
      tone: 'up',
    };
  }
  if (weekDeltaPct != null && weekDeltaPct <= -2) {
    return {
      state: 'declining',
      label: 'Needs a closer look',
      line: `${Math.round(weekDeltaPct)}% this week`,
      tone: 'down',
    };
  }
  if (trendState === 'improving') {
    return { state: 'improving', label: 'Getting better', line: 'Trending up', tone: 'up' };
  }
  if (trendState === 'declining') {
    return { state: 'declining', label: 'Needs a closer look', line: 'Trending down', tone: 'down' };
  }
  return {
    state: 'stable',
    label: 'Holding steady',
    line:
      weekDeltaPct != null
        ? `${weekDeltaPct >= 0 ? '+' : ''}${Math.round(weekDeltaPct)}% this week`
        : 'Stable this week',
    tone: 'flat',
  };
}

/**
 * @param {{ preferred_name?: string, preferredName?: string, full_name?: string, fullName?: string }} patient
 * @param {Array<object>} rawSessions
 * @param {{ now?: Date, weekTarget?: number, trendState?: string }} [opts]
 */
function buildHeroInsights(patient, rawSessions, opts = {}) {
  const now = opts.now || new Date();
  const weekTarget = opts.weekTarget || WEEK_TARGET;
  const name =
    patient?.preferred_name ||
    patient?.preferredName ||
    patient?.full_name ||
    patient?.fullName ||
    'Your loved one';

  const sessions = (rawSessions || []).map(normalizeSession);
  const completed = sessions
    .filter((s) => s.status === 'completed')
    .sort((a, b) => (a.startedAt || '').localeCompare(b.startedAt || ''));

  const last = completed.length ? completed[completed.length - 1] : null;
  const lastActive = formatLastActive(last?.startedAt || last?.endedAt, now);

  const thisWeek = weekBounds(now);
  const lastWeek = priorWeekBounds(now);
  const weekSessions = completed.filter((s) => inRange(s.startedAt, thisWeek.start, thisWeek.end));
  const priorSessions = completed.filter((s) => inRange(s.startedAt, lastWeek.start, lastWeek.end));

  const weekCount = weekSessions.length;
  const weekPace = weekTarget > 0 ? weekCount / weekTarget : 0;
  const weekHot = weekPace >= 0.8;

  const weekAvg = avgAccuracy(weekSessions);
  const priorAvg = avgAccuracy(priorSessions);
  let weekDeltaPct = null;
  if (weekAvg != null && priorAvg != null) {
    weekDeltaPct = (weekAvg - priorAvg) * 100;
  } else if (weekAvg != null && priorAvg == null && completed.length >= 3) {
    // No prior week — compare to older baseline if any
    const older = completed.filter((s) => !inRange(s.startedAt, thisWeek.start, thisWeek.end));
    const olderAvg = avgAccuracy(older.slice(-6));
    if (olderAvg != null) weekDeltaPct = (weekAvg - olderAvg) * 100;
  }

  const overall = overallFromDelta(weekDeltaPct, opts.trendState);

  // 30-day memory change: early third vs late third of window
  const windowStart = new Date(now.getTime() - 30 * MS_DAY);
  const in30 = completed.filter((s) => inRange(s.startedAt, windowStart, now));
  let memoryDeltaPct = null;
  if (in30.length >= 4) {
    const third = Math.max(1, Math.floor(in30.length / 3));
    const early = avgAccuracy(in30.slice(0, third));
    const late = avgAccuracy(in30.slice(-third));
    if (early != null && late != null) {
      memoryDeltaPct = Math.round((late - early) * 100);
    }
  }

  // Consistency: expected sessions over last 14 days vs completed
  const consStart = new Date(now.getTime() - 13 * MS_DAY);
  consStart.setHours(0, 0, 0, 0);
  const in14 = completed.filter((s) => inRange(s.startedAt, consStart, now));
  const expected14 = Math.round((weekTarget / 7) * 14);
  const consistency = expected14 > 0
    ? Math.min(100, Math.round((in14.length / expected14) * 100))
    : 0;

  let consistencyWord = 'starting';
  if (consistency >= 85) consistencyWord = 'excellent';
  else if (consistency >= 70) consistencyWord = 'strong';
  else if (consistency >= 50) consistencyWord = 'steady';
  else if (completed.length > 0) consistencyWord = 'building';

  const nudge =
    overall.state === 'improving'
      ? `You're doing this right — ${name}'s recent days are stronger.`
      : overall.state === 'declining'
        ? `A softer stretch. Small changes in timing can help ${name}.`
        : overall.state === 'building'
          ? `Every session adds clarity. Keep going with ${name}.`
          : `${name} is holding steady. Consistency is working.`;

  return {
    patientName: name,
    nudge,
    encouragement: nudge,
    lastActive,
    week: {
      completed: weekCount,
      target: weekTarget,
      label: `${weekCount} of ${weekTarget}`,
      hot: weekHot,
      pace: Math.round(weekPace * 100),
    },
    overall: {
      ...overall,
      weekDeltaPct: weekDeltaPct != null ? Math.round(weekDeltaPct * 10) / 10 : null,
    },
    impact: {
      totalSessions: completed.length,
      memoryDeltaPct,
      consistency,
      consistencyWord,
      consistencyLabel: consistencyWord,
    },
  };
}

module.exports = { buildHeroInsights, normalizeSession, WEEK_TARGET };
