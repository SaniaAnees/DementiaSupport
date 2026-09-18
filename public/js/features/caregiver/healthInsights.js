// Caregiver health metrics — skills, week compare, flags, 4-week arc (pure)

const HealthInsights = (() => {
  const SKILLS = [
    { id: 'recall', label: 'Memory' },
    { id: 'attention', label: 'Attention' },
    { id: 'orientation', label: 'Orientation' },
    { id: 'reasoning', label: 'Reasoning' },
    { id: 'language', label: 'Language' },
  ];

  const MS_DAY = 24 * 60 * 60 * 1000;

  function normalize(s) {
    return {
      status: s.status,
      accuracy: s.accuracy != null ? Number(s.accuracy) : null,
      compositeScore: s.compositeScore ?? s.composite_score ?? null,
      sessionType: s.sessionType || s.session_type || null,
      startedAt: s.startedAt || s.started_at || s.createdAt || s.created_at || null,
      domains: s.domains || null,
    };
  }

  function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function inRange(iso, start, end) {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return t >= start.getTime() && t <= end.getTime();
  }

  function avg(nums) {
    const xs = nums.filter((n) => n != null && !Number.isNaN(n));
    if (!xs.length) return null;
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  }

  function trendFromDelta(deltaPct) {
    if (deltaPct == null) return { tone: 'muted', arrow: '·', label: '—' };
    if (deltaPct >= 3) return { tone: 'up', arrow: '↗', label: 'Improving' };
    if (deltaPct <= -10) return { tone: 'down', arrow: '↘', label: 'Declining' };
    if (deltaPct <= -3) return { tone: 'soft', arrow: '↘', label: 'Softer' };
    return { tone: 'flat', arrow: '→', label: 'Stable' };
  }

  function weekWindow(now, offsetWeeks = 0) {
    const end = startOfDay(now);
    end.setDate(end.getDate() - offsetWeeks * 7);
    end.setHours(23, 59, 59, 999);
    const start = startOfDay(end);
    start.setDate(start.getDate() - 6);
    return { start, end };
  }

  function completedSessions(raw) {
    return (raw || [])
      .map(normalize)
      .filter((s) => s.status === 'completed' && s.startedAt)
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  }

  const DOMAIN_KEYS = {
    recall: ['recall', 'learning_memory', 'registration', 'orientation'],
    attention: ['attention', 'complex_attention'],
    orientation: ['orientation', 'learning_memory'],
    reasoning: ['reasoning', 'executive_function'],
    language: ['language'],
  };

  function skillSeries(sessions, skillId) {
    const keys = DOMAIN_KEYS[skillId] || [skillId];
    return sessions
      .map((s) => {
        if (s.domains && typeof s.domains === 'object') {
          for (const k of keys) {
            if (s.domains[k] != null && Number.isFinite(Number(s.domains[k]))) {
              return Number(s.domains[k]);
            }
          }
        }
        if (s.accuracy != null && Number.isFinite(Number(s.accuracy))) {
          return Math.round(Number(s.accuracy) * 100);
        }
        return null;
      })
      .filter((n) => n != null);
  }

  function skillHeatmap(sessions, now = new Date()) {
    const thisW = weekWindow(now, 0);
    const lastW = weekWindow(now, 1);
    const recent = sessions.filter((s) => inRange(s.startedAt, thisW.start, thisW.end));
    const prior = sessions.filter((s) => inRange(s.startedAt, lastW.start, lastW.end));

    return SKILLS.map((skill) => {
      const all = skillSeries(sessions, skill.id);
      const cur = avg(skillSeries(recent, skill.id));
      const prev = avg(skillSeries(prior, skill.id));
      const score = cur != null ? Math.round(cur) : all.length ? Math.round(avg(all.slice(-5))) : null;
      const delta = cur != null && prev != null ? cur - prev : null;
      const trend = trendFromDelta(delta);
      const flag = delta != null && delta <= -10;

      return {
        id: skill.id,
        label: skill.label,
        score,
        delta: delta != null ? Math.round(delta) : null,
        trend,
        flag,
      };
    });
  }

  function weekCompare(sessions, now = new Date()) {
    const thisW = weekWindow(now, 0);
    const lastW = weekWindow(now, 1);
    const a = sessions.filter((s) => inRange(s.startedAt, thisW.start, thisW.end));
    const b = sessions.filter((s) => inRange(s.startedAt, lastW.start, lastW.end));
    const avgAcc = (list) => avg(list.map((s) => (s.accuracy != null ? s.accuracy * 100 : null)));
    const thisScore = avgAcc(a);
    const lastScore = avgAcc(b);
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

    return {
      thisWeek: {
        sessions: a.length,
        score: thisScore != null ? Math.round(thisScore) : null,
      },
      lastWeek: {
        sessions: b.length,
        score: lastScore != null ? Math.round(lastScore) : null,
      },
      delta: delta != null ? Math.round(delta) : null,
      headline,
      tone,
    };
  }

  function redFlags(skills, sessions) {
    const flags = [];
    for (const s of skills) {
      if (s.flag) {
        flags.push({
          severity: 'attention',
          title: `${s.label} dropped ${Math.abs(s.delta)} pts`,
          body: 'Worth a gentler session or an earlier time of day.',
        });
      }
    }
    const last5 = sessions.slice(-5);
    if (last5.length >= 4) {
      const low = last5.filter((s) => (s.accuracy || 1) < 0.4).length;
      if (low >= 4) {
        flags.push({
          severity: 'attention',
          title: 'Hard stretch this week',
          body: 'Several recent scores were low — consider speaking with their doctor.',
        });
      }
    }
    return flags;
  }

  function fourWeekTimeline(sessions, now = new Date()) {
    const weeks = [];
    for (let i = 3; i >= 0; i--) {
      const w = weekWindow(now, i);
      const list = sessions.filter((s) => inRange(s.startedAt, w.start, w.end));
      const score = avg(list.map((s) => (s.accuracy != null ? s.accuracy * 100 : null)));
      weeks.push({
        index: 3 - i,
        label: i === 0 ? 'This week' : i === 1 ? 'Last week' : `${i}w ago`,
        sessions: list.length,
        score: score != null ? Math.round(score) : null,
      });
    }
    return weeks;
  }

  function build(rawSessions, opts = {}) {
    const now = opts.now || new Date();
    const sessions = completedSessions(rawSessions);
    const skills = skillHeatmap(sessions, now);
    const compare = weekCompare(sessions, now);
    const flags = redFlags(skills, sessions);
    const timeline = fourWeekTimeline(sessions, now);

    return {
      skills,
      compare,
      flags,
      timeline,
      hasData: sessions.length > 0,
      sessionCount: sessions.length,
    };
  }

  return { build, SKILLS, normalize };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = HealthInsights;
}
