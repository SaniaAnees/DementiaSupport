/**
 * Caregiver dashboard engines — all phases (pure compute, offline-first)
 * Overview · Health · Sessions · Behavior · Insights · Consistency · Wellness · Forecast · Correlations
 */
const DashboardEngine = (() => {
  const MS_DAY = 86400000;
  const WEEK_TARGET = 14;
  const SKILLS = [
    { id: 'recall', label: 'Memory', domainKeys: ['recall', 'learning_memory', 'registration', 'orientation'] },
    { id: 'attention', label: 'Attention', domainKeys: ['attention', 'complex_attention'] },
    { id: 'orientation', label: 'Orientation', domainKeys: ['orientation', 'learning_memory'] },
    { id: 'reasoning', label: 'Reasoning', domainKeys: ['reasoning', 'executive_function'] },
    { id: 'language', label: 'Language', domainKeys: ['language'] },
  ];

  function parseDomains(raw) {
    if (!raw) return null;
    if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
      } catch {
        return null;
      }
    }
    return null;
  }

  /** Rebuild skill map from per-item domains when session.domains was wiped */
  function domainsFromResponses(responses) {
    if (!Array.isArray(responses) || !responses.length) return null;
    const by = {};
    const alias = {
      orientation: 'orientation',
      registration: 'recall',
      recall: 'recall',
      learning_memory: 'recall',
      attention: 'attention',
      complex_attention: 'attention',
      reasoning: 'reasoning',
      executive_function: 'reasoning',
      language: 'language',
      perceptual_motor: 'attention',
      social_cognition: 'language',
    };
    for (const r of responses) {
      const domain = r.domain || r.Domain;
      if (!domain || domain === 'story' || r.transcript === '(continue)') continue;
      if (['story_beat', 'registration_teach', 'memory_teach'].includes(r.itemType || r.item_type)) continue;
      const key = alias[domain] || domain;
      if (!by[key]) by[key] = { correct: 0, total: 0 };
      by[key].total += 1;
      if (r.isCorrect || r.is_correct) by[key].correct += 1;
    }
    const keys = Object.keys(by);
    if (!keys.length) return null;
    const out = {};
    for (const [k, v] of Object.entries(by)) {
      out[k] = v.total ? Math.round((v.correct / v.total) * 100) : null;
    }
    if (out.recall != null) out.learning_memory = out.recall;
    if (out.attention != null) out.complex_attention = out.attention;
    if (out.reasoning != null) out.executive_function = out.reasoning;
    if (out.orientation == null && out.learning_memory != null) out.orientation = out.learning_memory;
    return out;
  }

  function norm(s) {
    const domains = parseDomains(s.domains) || domainsFromResponses(s.responses) || null;
    return {
      id: s.id,
      status: s.status,
      accuracy: s.accuracy != null ? Number(s.accuracy) : null,
      compositeScore: s.compositeScore ?? s.composite_score ?? null,
      sessionType: s.sessionType || s.session_type || 'session',
      startedAt: s.startedAt || s.started_at || s.createdAt || s.created_at || null,
      endedAt: s.endedAt || s.ended_at || null,
      domains,
      avgResponseMs: s.avgResponseMs ?? s.avg_response_ms ?? null,
      hintsUsed: s.hintsUsed ?? s.hints_used ?? 0,
      hintRate: s.hintRate ?? s.hint_rate ?? 0,
    };
  }

  function completed(raw) {
    return (raw || [])
      .map(norm)
      .filter((s) => s.status === 'completed' && s.startedAt)
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  }

  function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function inRange(iso, a, b) {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return t >= a.getTime() && t <= b.getTime();
  }

  function avg(xs) {
    const v = xs.filter((n) => n != null && !Number.isNaN(n));
    if (!v.length) return null;
    return v.reduce((a, b) => a + b, 0) / v.length;
  }

  function weekWindow(now, offset = 0) {
    const end = startOfDay(now);
    end.setDate(end.getDate() - offset * 7);
    end.setHours(23, 59, 59, 999);
    const start = startOfDay(end);
    start.setDate(start.getDate() - 6);
    return { start, end };
  }

  function trendTone(delta) {
    if (delta == null) return { tone: 'muted', arrow: '·', label: '—' };
    if (delta >= 3) return { tone: 'up', arrow: '↗', label: 'Improving' };
    if (delta <= -10) return { tone: 'down', arrow: '↘', label: 'Declining' };
    if (delta <= -3) return { tone: 'soft', arrow: '↘', label: 'Softer' };
    return { tone: 'flat', arrow: '→', label: 'Stable' };
  }

  function nameOf(p) {
    return p?.preferred_name || p?.preferredName || p?.full_name || p?.fullName || 'Your loved one';
  }

  function formatWhen(iso, now = new Date()) {
    if (!iso) return { label: 'No sessions yet', isToday: false, short: 'None yet' };
    const when = new Date(iso);
    const diff = Math.round((startOfDay(now) - startOfDay(when)) / MS_DAY);
    const time = when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (diff === 0) return { label: `Today · ${time}`, isToday: true, short: time };
    if (diff === 1) return { label: `Yesterday · ${time}`, isToday: false, short: 'Yesterday' };
    if (diff < 7) return { label: `${diff} days ago · ${time}`, isToday: false, short: `${diff}d ago` };
    return {
      label: when.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` · ${time}`,
      isToday: false,
      short: when.toLocaleDateString([], { month: 'short', day: 'numeric' }),
    };
  }

  /* ── Overview / Story ─────────────────────────────────────── */
  function buildOverview(patient, raw, now = new Date()) {
    const sessions = completed(raw);
    const name = nameOf(patient);
    const last = sessions[sessions.length - 1];
    const thisW = weekWindow(now, 0);
    const lastW = weekWindow(now, 1);
    const week = sessions.filter((s) => inRange(s.startedAt, thisW.start, thisW.end));
    const prior = sessions.filter((s) => inRange(s.startedAt, lastW.start, lastW.end));
    const wAvg = avg(week.map((s) => s.accuracy));
    const pAvg = avg(prior.map((s) => s.accuracy));
    let weekDelta = null;
    if (wAvg != null && pAvg != null) weekDelta = (wAvg - pAvg) * 100;

    let overall;
    if (sessions.length === 0) {
      overall = {
        state: 'empty',
        label: 'No sessions yet',
        line: 'Play a session to see progress',
        tone: 'muted',
      };
    } else if (sessions.length < 3 && weekDelta == null) {
      overall = {
        state: 'building',
        label: 'Getting started',
        line: 'Finish a few sessions to unlock trends',
        tone: 'muted',
      };
    } else if (weekDelta != null && weekDelta >= 2) {
      overall = { state: 'improving', label: 'Getting better', line: `+${Math.round(weekDelta)}% this week`, tone: 'up' };
    } else if (weekDelta != null && weekDelta <= -2) {
      overall = { state: 'declining', label: 'Needs attention', line: `${Math.round(weekDelta)}% this week`, tone: 'down' };
    } else {
      overall = { state: 'stable', label: 'Holding steady', line: weekDelta != null ? `${weekDelta >= 0 ? '+' : ''}${Math.round(weekDelta)}% this week` : 'Stable', tone: 'flat' };
    }

    const win30 = new Date(now.getTime() - 30 * MS_DAY);
    const in30 = sessions.filter((s) => inRange(s.startedAt, win30, now));
    let memoryDelta = null;
    if (in30.length >= 4) {
      const third = Math.max(1, Math.floor(in30.length / 3));
      const early = avg(in30.slice(0, third).map((s) => s.accuracy));
      const late = avg(in30.slice(-third).map((s) => s.accuracy));
      if (early != null && late != null) memoryDelta = Math.round((late - early) * 100);
    }

    const consStart = startOfDay(now);
    consStart.setDate(consStart.getDate() - 13);
    const in14 = sessions.filter((s) => inRange(s.startedAt, consStart, now));
    const expected14 = Math.round((WEEK_TARGET / 7) * 14);
    const consistency =
      sessions.length === 0
        ? 0
        : expected14 > 0
          ? Math.min(100, Math.round((in14.length / expected14) * 100))
          : 0;

    const nudge =
      sessions.length === 0
        ? `No sessions logged yet for ${name}. Complete one on the patient screen to see live progress here.`
        : overall.tone === 'up'
        ? `You're doing this right — ${name}'s recent days are stronger.`
        : overall.tone === 'down'
          ? `A softer stretch. Timing and gentler starts can help ${name}.`
          : overall.state === 'building'
            ? `Every session adds clarity. Keep going with ${name}.`
            : `${name} is holding steady. Consistency is working.`;

    return {
      name,
      nudge,
      lastActive: formatWhen(last?.startedAt, now),
      week: {
        completed: week.length,
        target: WEEK_TARGET,
        label: `${week.length} of ${WEEK_TARGET}`,
        hot: sessions.length > 0 && week.length / WEEK_TARGET >= 0.8,
      },
      overall,
      impact: {
        totalSessions: sessions.length,
        memoryDelta,
        consistency,
        consistencyWord:
          sessions.length === 0
            ? 'not started'
            : consistency >= 85
              ? 'excellent'
              : consistency >= 70
                ? 'strong'
                : consistency >= 50
                  ? 'steady'
                  : 'building',
      },
    };
  }

  /* ── Health ───────────────────────────────────────────────── */
  /** Prefer real per-domain scores — never paint every skill with the same overall %. */
  function skillVal(s, id) {
    if (!s) return null;
    const skill = SKILLS.find((sk) => sk.id === id);
    const keys = skill?.domainKeys || [id];
    if (s.domains && typeof s.domains === 'object') {
      for (const k of keys) {
        if (s.domains[k] != null && Number.isFinite(Number(s.domains[k]))) {
          return Number(s.domains[k]);
        }
      }
    }
    // Legacy sessions before domains were persisted: use overall accuracy so meters aren't blank
    if (s.accuracy != null && Number.isFinite(Number(s.accuracy))) {
      return Math.round(Number(s.accuracy) * 100);
    }
    return null;
  }

  function buildHealth(raw, now = new Date()) {
    const sessions = completed(raw);
    const thisW = weekWindow(now, 0);
    const lastW = weekWindow(now, 1);
    const recent = sessions.filter((s) => inRange(s.startedAt, thisW.start, thisW.end));
    const prior = sessions.filter((s) => inRange(s.startedAt, lastW.start, lastW.end));

    const skills = SKILLS.map((skill) => {
      const cur = avg(recent.map((s) => skillVal(s, skill.id)));
      const prev = avg(prior.map((s) => skillVal(s, skill.id)));
      const all = sessions.map((s) => skillVal(s, skill.id)).filter((n) => n != null);
      const score = cur != null ? Math.round(cur) : all.length ? Math.round(avg(all.slice(-5))) : null;
      const delta = cur != null && prev != null ? Math.round(cur - prev) : null;
      const trend = trendTone(delta);
      return { ...skill, score, delta, trend, flag: delta != null && delta <= -10 };
    });

    const thisScore = avg(recent.map((s) => (s.accuracy != null ? s.accuracy * 100 : null)));
    const lastScore = avg(prior.map((s) => (s.accuracy != null ? s.accuracy * 100 : null)));
    let delta = null;
    if (thisScore != null && lastScore != null) delta = thisScore - lastScore;
    let headline = 'Need a few more sessions to compare weeks.';
    let tone = 'muted';
    if (thisScore != null && lastScore != null) {
      if (delta >= 2) {
        headline = `Stronger than last week · +${Math.round(delta)} pts`;
        tone = 'up';
      } else if (delta <= -2) {
        headline = `Softer than last week · ${Math.round(delta)} pts`;
        tone = 'down';
      } else {
        headline = 'About the same as last week';
        tone = 'flat';
      }
    } else if (thisScore != null) {
      headline = `This week averaging ${Math.round(thisScore)}%`;
      tone = 'flat';
    }

    const flags = skills
      .filter((s) => s.flag)
      .map((s) => ({
        severity: 'attention',
        title: `${s.label} dropped ${Math.abs(s.delta)} pts`,
        body: 'Try a gentler session or an earlier time of day.',
      }));

    const timeline = [];
    for (let i = 3; i >= 0; i--) {
      const w = weekWindow(now, i);
      const list = sessions.filter((s) => inRange(s.startedAt, w.start, w.end));
      const score = avg(list.map((s) => (s.accuracy != null ? s.accuracy * 100 : null)));
      timeline.push({
        label: i === 0 ? 'Now' : i === 1 ? '−1w' : `−${i}w`,
        sessions: list.length,
        score: score != null ? Math.round(score) : null,
      });
    }

    return {
      skills,
      compare: {
        headline,
        tone,
        thisWeek: { sessions: recent.length, score: thisScore != null ? Math.round(thisScore) : null },
        lastWeek: { sessions: prior.length, score: lastScore != null ? Math.round(lastScore) : null },
        delta: delta != null ? Math.round(delta) : null,
      },
      flags,
      timeline,
      hasData: sessions.length > 0,
      sessionCount: sessions.length,
    };
  }

  /* ── Session replay ───────────────────────────────────────── */
  function buildSessions(raw, now = new Date()) {
    const sessions = completed(raw).slice().reverse();
    const byHour = {};
    const morning = [];
    const evening = [];

    const items = sessions.map((s) => {
      const score = s.accuracy != null ? Math.round(s.accuracy * 100) : null;
      const hour = new Date(s.startedAt).getHours();
      byHour[hour] = (byHour[hour] || 0) + (score || 0);
      byHour[`${hour}_n`] = (byHour[`${hour}_n`] || 0) + 1;
      if (s.sessionType === 'morning') morning.push(score);
      if (s.sessionType === 'evening') evening.push(score);

      const domainList = SKILLS.map((sk) => ({
        id: sk.id,
        label: sk.label,
        score: skillVal(s, sk.id),
      })).filter((d) => d.score != null);

      return {
        id: s.id,
        type: s.sessionType,
        when: formatWhen(s.startedAt, now),
        startedAt: s.startedAt,
        score,
        composite: s.compositeScore != null ? Math.round(s.compositeScore) : null,
        responseMs: s.avgResponseMs,
        hints: s.hintsUsed,
        domains: domainList,
        tone: score == null ? 'muted' : score >= 75 ? 'up' : score >= 55 ? 'flat' : 'down',
      };
    });

    const mAvg = avg(morning.filter((n) => n != null));
    const eAvg = avg(evening.filter((n) => n != null));
    let pattern = null;
    if (mAvg != null && eAvg != null && Math.abs(mAvg - eAvg) >= 8) {
      pattern =
        mAvg > eAvg
          ? 'Stronger in morning sessions — protect that window.'
          : 'Stronger in evening sessions — lean into later starts.';
    }

    let bestHour = null;
    let bestAvg = -1;
    for (let h = 6; h <= 21; h++) {
      const n = byHour[`${h}_n`] || 0;
      if (n < 2) continue;
      const a = byHour[h] / n;
      if (a > bestAvg) {
        bestAvg = a;
        bestHour = h;
      }
    }
    if (bestHour != null && !pattern) {
      const label = bestHour < 12 ? `${bestHour}:00 AM` : `${bestHour === 12 ? 12 : bestHour - 12}:00 PM`;
      pattern = `Best results cluster around ${label}.`;
    }

    return { items, pattern, count: items.length };
  }

  /* ── Behavior log + correlations ──────────────────────────── */
  function synthesizeBehavior(sessions, now = new Date()) {
    // Derived observations from session signals (no separate journal DB yet)
    const byDay = {};
    for (const s of sessions) {
      const day = s.startedAt.slice(0, 10);
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(s);
    }
    const entries = Object.keys(byDay)
      .sort()
      .reverse()
      .slice(0, 14)
      .map((day) => {
        const list = byDay[day];
        const score = avg(list.map((s) => (s.accuracy != null ? s.accuracy * 100 : null)));
        const hints = avg(list.map((s) => s.hintRate || 0));
        const hour = new Date(list[0].startedAt).getHours();
        let mood = 'Steady';
        let engagement = 'Present';
        let energy = 'Typical';
        if (score != null && score >= 78) {
          mood = 'Bright';
          engagement = 'High';
        } else if (score != null && score < 50) {
          mood = 'Low';
          engagement = 'Withdrawn';
          energy = 'Fatigued';
        } else if (hints != null && hints > 0.35) {
          engagement = 'Needed support';
          energy = 'Tired';
        }
        if (hour >= 14 && hour <= 16 && score != null && score < 60) {
          energy = 'Post-lunch dip';
        }
        const tags = [];
        if (list.some((s) => s.sessionType === 'morning')) tags.push('morning');
        if (list.some((s) => s.sessionType === 'evening')) tags.push('evening');
        if (new Date(day + 'T12:00:00').getDay() === 1) tags.push('monday');
        return {
          day,
          label: formatWhen(list[0].startedAt, now).label,
          sessions: list.length,
          score: score != null ? Math.round(score) : null,
          mood,
          engagement,
          energy,
          tags,
          note:
            score != null && score >= 78
              ? 'More talkative and accurate on games.'
              : score != null && score < 50
                ? 'Shorter answers; more hints needed.'
                : 'Ordinary day — showed up and finished.',
        };
      });
    return entries;
  }

  function buildCorrelations(sessions) {
    const good = sessions.filter((s) => s.accuracy != null && s.accuracy >= 0.75);
    const low = sessions.filter((s) => s.accuracy != null && s.accuracy < 0.55);
    const hourBucket = (list) => {
      const counts = {};
      for (const s of list) {
        const h = new Date(s.startedAt).getHours();
        const key = h < 11 ? 'Before 11 AM' : h < 14 ? 'Late morning' : h < 17 ? 'Afternoon' : 'Evening';
        counts[key] = (counts[key] || 0) + 1;
      }
      return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'No clear pattern';
    };
    const dow = (list) => {
      const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const counts = {};
      for (const s of list) {
        const d = names[new Date(s.startedAt).getDay()];
        counts[d] = (counts[d] || 0) + 1;
      }
      return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    };

    const goodHour = hourBucket(good);
    const lowDow = dow(low);
    const findings = [];
    if (good.length >= 3) {
      findings.push({
        kind: 'good',
        title: 'Strong session days',
        points: [
          `Usually start ${goodHour.toLowerCase()}`,
          'Family presence · no clear effect yet',
          'Sleep night-before · weak signal',
        ],
      });
    }
    if (low.length >= 3) {
      const pts = [];
      if (lowDow) pts.push(`${lowDow === 'Mon' ? 'Mondays' : lowDow + 's'} show more soft scores`);
      const aft = low.filter((s) => {
        const h = new Date(s.startedAt).getHours();
        return h >= 13 && h <= 16;
      });
      if (aft.length >= 2) pts.push('Afternoon window (1–4 PM) underperforms');
      if (!pts.length) pts.push('Scattered soft days — keep logging');
      findings.push({
        kind: 'soft',
        title: 'Lower engagement days',
        points: pts,
      });
    }

    let recommendation = 'Keep the current routine — signals are still forming.';
    if (goodHour.includes('Before') || goodHour.includes('Late morning')) {
      recommendation = 'Protect morning sessions; avoid scheduling hard games after lunch.';
    }
    if (lowDow === 'Mon') {
      recommendation = 'Move Monday to evening, or open Mondays with easier games.';
    }

    return { findings, recommendation, hasSignal: findings.length > 0 };
  }

  function buildBehavior(raw, now = new Date()) {
    const sessions = completed(raw);
    return {
      entries: synthesizeBehavior(sessions, now),
      correlations: buildCorrelations(sessions),
      hasData: sessions.length > 0,
    };
  }

  /* ── Insight engine ───────────────────────────────────────── */
  function buildInsights(patient, raw, health, overview, behavior, now = new Date()) {
    const name = nameOf(patient);
    const sessions = completed(raw);
    const cards = [];

    if (overview.overall.tone === 'up') {
      cards.push({
        kind: 'win',
        icon: '✓',
        title: 'Memory trending up',
        body: `Keep the current cadence — ${name} is responding.`,
        action: overview.week.hot ? 'Maintain this week’s pace' : 'Aim for one more session today',
      });
    }

    const softSkill = (health.skills || []).find((s) => s.flag || (s.delta != null && s.delta <= -8));
    if (softSkill) {
      cards.push({
        kind: 'watch',
        icon: '!',
        title: `${softSkill.label} dipped`,
        body: 'Possible fatigue. Try an evening session, or start with easier items.',
        action: 'Schedule a lighter evening slot',
      });
    }

    if (behavior.correlations?.recommendation) {
      cards.push({
        kind: 'nudge',
        icon: '→',
        title: 'Timing insight',
        body: behavior.correlations.recommendation,
        action: 'Adjust this week’s reminders',
      });
    }

    const thisW = weekWindow(now, 0);
    const week = sessions.filter((s) => inRange(s.startedAt, thisW.start, thisW.end));
    if (week.length >= 4 && overview.impact.memoryDelta != null) {
      const remain = Math.max(0, WEEK_TARGET - week.length);
      cards.push({
        kind: 'goal',
        icon: '◎',
        title: 'Next milestone',
        body:
          remain === 0
            ? `If you hold this pace, ${name} stays on track for a strong month.`
            : `${remain} more session${remain === 1 ? '' : 's'} this week keeps the upward arc.`,
        action: remain ? 'Complete remaining sessions' : 'Protect the streak',
      });
    }

    if (!cards.length) {
      cards.push({
        kind: 'nudge',
        icon: '·',
        title: 'Gathering signal',
        body: `A few more completed sessions will unlock sharper recommendations for ${name}.`,
        action: 'Start today’s session',
      });
    }

    return { cards };
  }

  /* ── Consistency / streaks ────────────────────────────────── */
  function buildConsistency(raw, now = new Date()) {
    const sessions = completed(raw);
    const days = new Set(sessions.map((s) => s.startedAt.slice(0, 10)));
    let streak = 0;
    const cursor = startOfDay(now);
    // Allow today or yesterday as streak anchor
    const todayKey = cursor.toISOString().slice(0, 10);
    const y = new Date(cursor);
    y.setDate(y.getDate() - 1);
    const yKey = y.toISOString().slice(0, 10);
    if (!days.has(todayKey) && !days.has(yKey)) {
      streak = 0;
    } else {
      if (!days.has(todayKey)) cursor.setDate(cursor.getDate() - 1);
      while (days.has(cursor.toISOString().slice(0, 10))) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      }
    }

    const milestones = [
      { id: 'd5', label: '5-day streak', done: streak >= 5, current: streak >= 5 && streak < 7 },
      { id: 'd7', label: '7-day streak', done: streak >= 7, current: streak >= 7 && streak < 30 },
      { id: 'd30', label: '30 consecutive days', done: streak >= 30, current: false },
      { id: 's100', label: '100 sessions logged', done: sessions.length >= 100, current: sessions.length >= 80 && sessions.length < 100 },
    ];

    const win30 = new Date(now.getTime() - 30 * MS_DAY);
    const in30 = sessions.filter((s) => inRange(s.startedAt, win30, now));
    const early = in30.slice(0, Math.max(1, Math.floor(in30.length / 3)));
    const late = in30.slice(-Math.max(1, Math.floor(in30.length / 3)));
    const memEarly = avg(early.map((s) => skillVal(s, 'recall')));
    const memLate = avg(late.map((s) => skillVal(s, 'recall')));
    const attEarly = avg(early.map((s) => skillVal(s, 'attention')));
    const attLate = avg(late.map((s) => skillVal(s, 'attention')));

    return {
      streak,
      totalSessions: sessions.length,
      milestones,
      month: {
        sessions: in30.length,
        memory: {
          from: memEarly != null ? Math.round(memEarly) : null,
          to: memLate != null ? Math.round(memLate) : null,
        },
        attention: {
          from: attEarly != null ? Math.round(attEarly) : null,
          to: attLate != null ? Math.round(attLate) : null,
        },
      },
      prediction:
        streak >= 5
          ? 'At this pace, major cognitive improvement status is within reach by month’s end.'
          : 'A short daily streak unlocks clearer month-end projections.',
    };
  }

  /* ── Care effort (from patient sessions) — NOT stress/anxiety ─ */
  function buildCareEffort(raw, overview, now = new Date()) {
    const sessions = completed(raw);
    const thisW = weekWindow(now, 0);
    const week = sessions.filter((s) => inRange(s.startedAt, thisW.start, thisW.end));
    const minutes = week.reduce((sum, s) => {
      if (s.startedAt && s.endedAt) {
        return sum + Math.max(3, (new Date(s.endedAt) - new Date(s.startedAt)) / 60000);
      }
      return sum + 8;
    }, 0);
    const hrs = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    const timeInvested = hrs > 0 ? `${hrs} hours ${mins} minutes` : `${mins} minutes`;
    const consistencyPct = overview.impact.consistency || 0;
    const consistencyWord =
      consistencyPct >= 85 ? 'excellent' : consistencyPct >= 70 ? 'strong' : consistencyPct >= 50 ? 'steady' : 'building';

    return {
      weekSessions: `${overview.week.completed}/${overview.week.target}`,
      timeInvested,
      timeShort: hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`,
      consistencyPct,
      consistencyLabel: `${consistencyPct}% (${consistencyWord})`,
      paceOk: overview.week.hot,
    };
  }

  /** @deprecated use WellnessCheckins.buildDashboard — kept as care-effort shim */
  function buildWellness(raw, overview, _consistency, now = new Date()) {
    return buildCareEffort(raw, overview, now);
  }

  /* ── Forecast ─────────────────────────────────────────────── */
  function buildForecast(raw, now = new Date()) {
    const sessions = completed(raw);
    if (sessions.length < 4) {
      return {
        ready: false,
        message: 'Complete a few more sessions to project the next 30 days.',
      };
    }
    const recent = sessions.slice(-10);
    const earlier = sessions.slice(-20, -10);
    const rAvg = avg(recent.map((s) => s.accuracy)) || 0.6;
    const eAvg = avg(earlier.map((s) => s.accuracy)) || rAvg;
    const weeklyLift = (rAvg - eAvg) * 0.35; // dampened

    const project = (skillId, baseFallback) => {
      const vals = recent.map((s) => skillVal(s, skillId)).filter((n) => n != null);
      const cur = vals.length ? avg(vals) : baseFallback * 100;
      const next = Math.max(20, Math.min(95, cur + weeklyLift * 100 * 4));
      return { from: Math.round(cur), to: Math.round(next) };
    };

    const memory = project('recall', rAvg);
    const attention = project('attention', rAvg);
    const orientation = project('orientation', rAvg);
    const overallFrom = Math.round(rAvg * 100);
    const overallTo = Math.max(20, Math.min(95, Math.round((rAvg + weeklyLift * 4) * 100)));

    const thisW = weekWindow(now, 0);
    const weekN = sessions.filter((s) => inRange(s.startedAt, thisW.start, thisW.end)).length;
    const paceOk = weekN >= 8;
    const probability = Math.max(15, Math.min(92, Math.round(55 + (overallTo - 70) + (paceOk ? 12 : -8) + sessions.length * 0.15)));

    return {
      ready: true,
      memory,
      attention,
      orientation,
      overall: { from: overallFrom, to: overallTo },
      probability,
      confidence: `Based on ${sessions.length} sessions`,
      warning: paceOk
        ? null
        : 'If sessions drop below 8/week, progress will plateau. Consistency is key.',
      milestone: `Chance of major cognitive improvement by month’s end: ${probability}%`,
    };
  }

  /* ── Analytics chart series ───────────────────────────────── */
  function buildAnalytics(raw, now = new Date()) {
    const sessions = completed(raw);
    if (!sessions.length) {
      return { ready: false, daily: [], skills: [], morningEvening: null };
    }

    const byDay = {};
    for (const s of sessions) {
      const day = s.startedAt.slice(0, 10);
      if (!byDay[day]) byDay[day] = { scores: [], count: 0 };
      if (s.accuracy != null) byDay[day].scores.push(s.accuracy * 100);
      byDay[day].count += 1;
    }
    const days = Object.keys(byDay).sort().slice(-21);
    const daily = days.map((d) => ({
      date: d,
      label: new Date(d + 'T12:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' }),
      accuracy: Math.round(avg(byDay[d].scores) || 0),
      sessions: byDay[d].count,
    }));

    const recent = sessions.slice(-12);
    const skills = SKILLS.map((sk) => {
      const vals = recent.map((s) => skillVal(s, sk.id)).filter((n) => n != null);
      return { label: sk.label, score: vals.length ? Math.round(avg(vals)) : null };
    });

    const morning = sessions.filter((s) => s.sessionType === 'morning').map((s) => s.accuracy * 100);
    const evening = sessions.filter((s) => s.sessionType === 'evening').map((s) => s.accuracy * 100);
    const morningEvening = {
      morning: morning.length ? Math.round(avg(morning)) : null,
      evening: evening.length ? Math.round(avg(evening)) : null,
    };

    return {
      ready: true,
      daily,
      skills,
      morningEvening,
      totals: {
        sessions: sessions.length,
        avgAccuracy: Math.round(avg(sessions.map((s) => s.accuracy * 100)) || 0),
        avgComposite: Math.round(avg(sessions.map((s) => s.compositeScore).filter((n) => n != null)) || 0),
      },
    };
  }
  function buildExportPayload(patient, bundle) {
    const name = nameOf(patient);
    const lines = [
      `MindCare Care Summary — ${name}`,
      `Generated ${new Date().toLocaleString()}`,
      '',
      'OVERVIEW',
      bundle.overview.nudge,
      `Last active: ${bundle.overview.lastActive.label}`,
      `This week: ${bundle.overview.week.label}`,
      `Overall: ${bundle.overview.overall.label} (${bundle.overview.overall.line})`,
      `Sessions: ${bundle.overview.impact.totalSessions} · Consistency: ${bundle.overview.impact.consistency}/100`,
      '',
      'SKILLS',
      ...(bundle.health.skills || []).map(
        (s) => `${s.label}: ${s.score ?? '—'} ${s.trend?.arrow || ''} ${s.delta != null ? `(${s.delta > 0 ? '+' : ''}${s.delta})` : ''}`
      ),
      '',
      'INSIGHTS',
      ...(bundle.insights.cards || []).map((c) => `• ${c.title}: ${c.body}`),
      '',
      'FORECAST',
      bundle.forecast.ready ? bundle.forecast.milestone : bundle.forecast.message,
      '',
      'Not a medical device. Share with clinicians as engagement context only.',
    ];
    return {
      title: `MindCare — ${name}`,
      text: lines.join('\n'),
      filename: `mindcare-${name.toLowerCase().replace(/\s+/g, '-')}-summary.txt`,
    };
  }

  /* ── Full bundle ──────────────────────────────────────────── */
  function buildAll(patient, raw, opts = {}) {
    const now = opts.now || new Date();
    const overview = buildOverview(patient, raw, now);
    const health = buildHealth(raw, now);
    const sessions = buildSessions(raw, now);
    const behavior = buildBehavior(raw, now);
    const insights = buildInsights(patient, raw, health, overview, behavior, now);
    const consistency = buildConsistency(raw, now);
    const careEffort = buildCareEffort(raw, overview, now);
    const wellness = careEffort;
    const forecast = buildForecast(raw, now);
    const analytics = buildAnalytics(raw, now);
    const bundle = {
      overview,
      health,
      sessions,
      behavior,
      insights,
      consistency,
      careEffort,
      wellness,
      forecast,
      analytics,
    };
    bundle.export = buildExportPayload(patient, bundle);
    return bundle;
  }

  return {
    buildAll,
    buildOverview,
    buildHealth,
    buildSessions,
    buildBehavior,
    buildInsights,
    buildConsistency,
    buildWellness,
    buildCareEffort,
    buildForecast,
    buildAnalytics,
    SKILLS,
    WEEK_TARGET,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DashboardEngine;
}
