/**
 * Caregiver wellness check-ins — real self-report mini-sessions.
 * Not a medical device / not a diagnosis. Scores drive Wellness analytics.
 */
const WellnessCheckins = (() => {
  const SCALE = [
    { value: 0, label: 'Not at all' },
    { value: 1, label: 'Several days' },
    { value: 2, label: 'More than half the days' },
    { value: 3, label: 'Nearly every day' },
  ];

  const PACKS = {
    stress: {
      id: 'stress',
      title: 'Stress check-in',
      subtitle: 'About 1 minute · how the load has felt',
      disclaimer: 'A self-check for you — not a clinical diagnosis.',
      questions: [
        { id: 's1', text: 'I felt overwhelmed by caregiving tasks.' },
        { id: 's2', text: 'I had trouble winding down after sessions or care duties.' },
        { id: 's3', text: 'Small problems felt bigger than usual.' },
        { id: 's4', text: 'I felt pressure to “do everything right” for them.' },
        { id: 's5', text: 'My body felt tense (jaw, shoulders, sleep).' },
      ],
    },
    anxiety: {
      id: 'anxiety',
      title: 'Anxiety check-in',
      subtitle: 'About 1 minute · worry and unease',
      disclaimer: 'A self-check for you — not a clinical diagnosis.',
      questions: [
        { id: 'a1', text: 'I felt nervous, anxious, or on edge.' },
        { id: 'a2', text: 'I couldn’t stop or control worrying.' },
        { id: 'a3', text: 'I worried too much about different things (their health, the future).' },
        { id: 'a4', text: 'I had trouble relaxing.' },
        { id: 'a5', text: 'I felt afraid something awful might happen.' },
      ],
    },
    mood: {
      id: 'mood',
      title: 'Mood check-in',
      subtitle: 'About 1 minute · energy and low mood',
      disclaimer: 'A self-check for you — not a clinical diagnosis or depression screen for treatment.',
      questions: [
        { id: 'm1', text: 'I felt little interest or pleasure in things I usually enjoy.' },
        { id: 'm2', text: 'I felt down, heavy, or hopeless.' },
        { id: 'm3', text: 'I felt tired or had little energy for myself.' },
        { id: 'm4', text: 'I felt bad about myself as a caregiver — or that I was letting them down.' },
        { id: 'm5', text: 'It was hard to focus on anything beyond care tasks.' },
      ],
    },
  };

  function bandFromPct(pct) {
    if (pct == null) return { id: 'none', label: 'No data yet', tone: 'muted', detail: 'Take a check-in' };
    if (pct < 25) return { id: 'settled', label: 'Settled', tone: 'up', detail: 'manageable' };
    if (pct < 50) return { id: 'mild', label: 'Mild', tone: 'flat', detail: 'watch gently' };
    if (pct < 75) return { id: 'elevated', label: 'Elevated', tone: 'soft', detail: 'needs care' };
    return { id: 'high', label: 'High', tone: 'down', detail: 'prioritize support' };
  }

  function scoreAnswers(answers, questionCount) {
    const max = questionCount * 3;
    const sum = Object.values(answers).reduce((a, b) => a + (Number(b) || 0), 0);
    const pct = max > 0 ? Math.round((sum / max) * 100) : 0;
    return { sum, max, pct, band: bandFromPct(pct) };
  }

  const META_KEY = 'caregiverCheckins.v1';
  const LS_KEY = 'mindcare.caregiverCheckins.v1';

  function dayKey(iso, now = new Date()) {
    const d = iso ? new Date(iso) : now;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function isSameLocalDay(iso, now = new Date()) {
    if (!iso) return false;
    return dayKey(iso, now) === dayKey(null, now);
  }

  function readLocalStorage() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeLocalStorage(rows) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(rows));
    } catch (_) {}
  }

  async function readMetaList() {
    try {
      const raw = await LocalDB.getMeta(META_KEY);
      if (!raw) return [];
      if (Array.isArray(raw)) return raw;
      if (typeof raw === 'string') {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (_) {}
    return [];
  }

  async function writeMetaList(rows) {
    try {
      await LocalDB.setMeta(META_KEY, JSON.stringify(rows));
    } catch (_) {}
  }

  function normalizeRows(rows) {
    return (rows || [])
      .filter((r) => r && r.id && r.type && r.completedAt && r.pct != null)
      .sort((a, b) => String(a.completedAt).localeCompare(String(b.completedAt)));
  }

  async function listAll() {
    const byId = new Map();

    for (const r of readLocalStorage()) {
      if (r?.id) byId.set(r.id, r);
    }
    for (const r of await readMetaList()) {
      if (r?.id) byId.set(r.id, r);
    }

    try {
      const idbRows = await LocalDB.getAll('caregiverCheckins');
      for (const r of idbRows || []) {
        if (r?.id && r.completedAt) byId.set(r.id, r);
      }
    } catch (_) {}

    const rows = normalizeRows([...byId.values()]);
    // Keep all layers in sync
    writeLocalStorage(rows);
    await writeMetaList(rows);
    return rows;
  }

  async function save(checkin) {
    if (!checkin?.id) throw new Error('Invalid check-in');
    const rows = await listAll();
    const next = normalizeRows([...rows.filter((r) => r.id !== checkin.id), checkin]);
    writeLocalStorage(next);
    await writeMetaList(next);
    try {
      await LocalDB.put('caregiverCheckins', checkin);
    } catch (_) {}
    // Verify read-back
    const verified = await listAll();
    if (!verified.some((r) => r.id === checkin.id)) {
      writeLocalStorage(next);
      throw new Error('Check-in did not persist');
    }
    return checkin;
  }

  function latestByType(rows) {
    const out = {};
    for (const r of rows.slice().reverse()) {
      if (!out[r.type]) out[r.type] = r;
    }
    return out;
  }

  function series(rows, type, days = 30, now = new Date()) {
    const cutoff = now.getTime() - days * 86400000;
    return rows
      .filter((r) => r.type === type && new Date(r.completedAt).getTime() >= cutoff)
      .map((r) => ({
        at: r.completedAt,
        label: new Date(r.completedAt).toLocaleDateString([], { month: 'short', day: 'numeric' }),
        pct: r.pct,
        band: r.bandLabel,
      }));
  }

  function tipFromLatest(latest) {
    const stress = latest.stress?.pct;
    const anxiety = latest.anxiety?.pct;
    const mood = latest.mood?.pct;
    const worst = Math.max(stress ?? 0, anxiety ?? 0, mood ?? 0);

    if (stress == null && anxiety == null && mood == null) {
      return {
        kind: 'nudge',
        text: 'Start with a 1-minute Stress check-in. Your Wellness analytics will fill from your answers — not guesses.',
      };
    }
    if (worst >= 75) {
      return {
        kind: 'ease',
        text: 'Your check-ins show a heavy stretch. Tell one trusted person, shorten today’s care tasks if you can, and protect sleep tonight.',
      };
    }
    if ((anxiety ?? 0) >= 50) {
      return {
        kind: 'ease',
        text: 'Anxiety is elevated in your recent check-in. Try a 10-minute walk or breath pause before the next patient session.',
      };
    }
    if ((mood ?? 0) >= 50) {
      return {
        kind: 'ease',
        text: 'Mood load is up. One lighter care day this week is not failure — it’s how you stay sustainable.',
      };
    }
    if ((stress ?? 0) >= 50) {
      return {
        kind: 'protect',
        text: 'Stress is elevated. Keep showing up, but schedule one break day. Consistency beats perfection.',
      };
    }
    return {
      kind: 'protect',
      text: 'Your recent check-ins look manageable. Keep the weekly rhythm — and re-check if a hard week lands.',
    };
  }

  /**
   * Build wellness dashboard model from real check-ins (+ optional care effort from patient sessions).
   */
  function buildDashboard(checkins, careEffort = {}, now = new Date()) {
    const latest = latestByType(checkins);
    const stress = latest.stress;
    const anxiety = latest.anxiety;
    const mood = latest.mood;

    const meter = {
      stress: stress
        ? { ...bandFromPct(stress.pct), score: stress.pct, source: 'check-in', at: stress.completedAt }
        : { ...bandFromPct(null), score: 0, source: 'none' },
      anxiety: anxiety
        ? { ...bandFromPct(anxiety.pct), score: anxiety.pct, source: 'check-in', at: anxiety.completedAt }
        : { ...bandFromPct(null), score: 0, source: 'none' },
      mood: mood
        ? { ...bandFromPct(mood.pct), score: mood.pct, source: 'check-in', at: mood.completedAt }
        : { ...bandFromPct(null), score: 0, source: 'none' },
    };

    // Sustainability / engagement from check-ins (inverse of load) + care showing-up
    const loadAvg = [stress?.pct, anxiety?.pct, mood?.pct].filter((n) => n != null);
    const avgLoad = loadAvg.length ? loadAvg.reduce((a, b) => a + b, 0) / loadAvg.length : null;
    const engagementScore =
      avgLoad == null
        ? null
        : Math.max(0, Math.min(100, Math.round(100 - avgLoad * 0.55 + (careEffort.paceOk ? 12 : 0))));
    const sustainabilityScore =
      avgLoad == null
        ? null
        : Math.max(0, Math.min(100, Math.round(100 - avgLoad * 0.7 + (careEffort.consistencyPct || 0) * 0.15)));

    meter.engagement =
      engagementScore == null
        ? { ...bandFromPct(null), score: 0, source: 'none', invert: true }
        : {
            ...bandFromPct(100 - engagementScore), // display band for "strain" inverted for label?
            label:
              engagementScore >= 70 ? 'High' : engagementScore >= 45 ? 'Steady' : 'Low',
            detail: engagementScore >= 70 ? 'you’re present' : engagementScore >= 45 ? 'holding on' : 'depleted',
            tone: engagementScore >= 70 ? 'up' : engagementScore >= 45 ? 'flat' : 'down',
            score: engagementScore,
            source: 'derived',
          };

    meter.sustainability =
      sustainabilityScore == null
        ? { ...bandFromPct(null), score: 0, source: 'none' }
        : {
            label:
              sustainabilityScore >= 70
                ? 'Good'
                : sustainabilityScore >= 45
                  ? 'Fair'
                  : 'Fragile',
            detail:
              sustainabilityScore >= 70
                ? 'keep pace'
                : sustainabilityScore >= 45
                  ? 'protect rest'
                  : 'add recovery',
            tone: sustainabilityScore >= 70 ? 'up' : sustainabilityScore >= 45 ? 'flat' : 'down',
            score: sustainabilityScore,
            source: 'derived',
          };

    const tip = tipFromLatest(latest);
    const hasData = checkins.length > 0;
    const completedTypes = Object.keys(latest).length;

    const charts = {
      stress: series(checkins, 'stress', 45, now),
      anxiety: series(checkins, 'anxiety', 45, now),
      mood: series(checkins, 'mood', 45, now),
    };

    const history = checkins
      .slice()
      .reverse()
      .slice(0, 12)
      .map((r) => ({
        id: r.id,
        type: r.type,
        title: PACKS[r.type]?.title || r.type,
        pct: r.pct,
        band: r.bandLabel,
        at: r.completedAt,
        label: new Date(r.completedAt).toLocaleString([], {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        }),
      }));

    let headline = 'Your wellness';
    if (!hasData) headline = 'Check in with yourself';
    else if (avgLoad != null && avgLoad >= 60) headline = 'Heavy stretch — be gentle';
    else if (avgLoad != null && avgLoad < 30) headline = 'You’re pacing well';
    else headline = 'Your check-ins, at a glance';

    const recognition = !hasData
      ? 'Take a 1-minute check-in to unlock your personal stress, anxiety, and mood trends.'
      : `Updated from ${checkins.length} check-in${checkins.length === 1 ? '' : 's'}. Re-check daily when the day feels different.`;

    const packs = Object.values(PACKS).map((p) => {
      const last = latest[p.id] || null;
      let status = 'Not checked in yet';
      if (last) {
        const when = isSameLocalDay(last.completedAt, now)
          ? 'Today'
          : new Date(last.completedAt).toLocaleDateString([], { month: 'short', day: 'numeric' });
        status = `${when} · ${last.bandLabel} · ${last.pct}%`;
        if (!isSameLocalDay(last.completedAt, now)) {
          status = `Due today · last ${when}: ${last.bandLabel} ${last.pct}%`;
        }
      }
      return {
        id: p.id,
        title: p.title,
        subtitle: p.subtitle,
        status,
        dueToday: !last || !isSameLocalDay(last.completedAt, now),
        last: last
          ? {
              pct: last.pct,
              band: last.bandLabel,
              at: last.completedAt,
              today: isSameLocalDay(last.completedAt, now),
            }
          : null,
      };
    });

    return {
      hasData,
      completedTypes,
      headline,
      recognition,
      meter,
      tip,
      charts,
      history,
      latest,
      packs,
      careEffort: {
        weekSessions: careEffort.weekSessions || '—',
        timeInvested: careEffort.timeInvested || '—',
        consistencyLabel: careEffort.consistencyLabel || '—',
      },
      shareText: [
        'MindCare — My wellness check-ins',
        stress ? `Stress: ${stress.pct}% (${stress.bandLabel})` : 'Stress: not checked in yet',
        anxiety ? `Anxiety: ${anxiety.pct}% (${anxiety.bandLabel})` : 'Anxiety: not checked in yet',
        mood ? `Mood: ${mood.pct}% (${mood.bandLabel})` : 'Mood: not checked in yet',
        '',
        `Recommendation: ${tip.text}`,
        '',
        'Self-report only — not a medical diagnosis.',
      ].join('\n'),
    };
  }

  function createDraft(type) {
    const pack = PACKS[type];
    if (!pack) return null;
    return {
      type,
      pack,
      index: 0,
      answers: {},
    };
  }

  function finalize(draft) {
    const pack = draft.pack;
    const scored = scoreAnswers(draft.answers, pack.questions.length);
    return {
      id: crypto.randomUUID(),
      type: pack.id,
      answers: { ...draft.answers },
      sum: scored.sum,
      max: scored.max,
      pct: scored.pct,
      bandId: scored.band.id,
      bandLabel: scored.band.label,
      completedAt: new Date().toISOString(),
    };
  }

  return {
    PACKS,
    SCALE,
    listAll,
    save,
    buildDashboard,
    createDraft,
    finalize,
    scoreAnswers,
    bandFromPct,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = WellnessCheckins;
}
