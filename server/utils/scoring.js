// Ported from app/src/features/patient-session/engine.ts
// Pure scoring functions — no I/O

/**
 * @param {string[]} arr
 * @returns {string[]}
 */
function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * @param {string} correct
 * @param {string[]} pool
 * @returns {string[]}
 */
function chips(correct, pool) {
  const distractors = shuffle(pool.filter((p) => p.toLowerCase() !== correct.toLowerCase())).slice(0, 3);
  return shuffle([correct, ...distractors]);
}

/**
 * Map item domains → caregiver skill scores (0–100).
 * @param {{ domain?: string, itemType?: string, transcript?: string, isCorrect?: boolean }[]} responses
 * @returns {Record<string, number>}
 */
function domainScoresFromResponses(responses) {
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
    story: null,
  };
  for (const r of responses || []) {
    if (!r?.domain || r.domain === 'story' || r.transcript === '(continue)') continue;
    if (['story_beat', 'registration_teach', 'memory_teach'].includes(r.itemType)) continue;
    const key = alias[r.domain] !== undefined ? alias[r.domain] : r.domain;
    if (!key) continue;
    if (!by[key]) by[key] = { correct: 0, total: 0 };
    by[key].total += 1;
    if (r.isCorrect) by[key].correct += 1;
  }
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

/**
 * @param {{ shortLabel: string, aliases?: string[], relation?: string }} memory
 * @returns {string[]}
 */
function expected(memory) {
  const rel = memory.relation && memory.relation !== 'custom' ? [memory.relation] : [];
  return [memory.shortLabel, ...(memory.aliases || []), ...rel].filter(Boolean);
}

/**
 * @param {{ caption?: string, shortLabel: string, relation?: string }} memory
 * @param {'teach' | 'quiz'} kind
 * @returns {{ shown: string, spoken: string }}
 */
function variedPrompt(memory, kind) {
  const name = memory.shortLabel;
  const rel = !memory.relation || memory.relation === 'custom' ? name : memory.relation;
  if (kind === 'teach') {
    const options = [
      memory.caption,
      `Look carefully — this is ${name}.`,
      `Remember: ${name}, your ${rel}.`,
      `This photo is ${name}.`,
    ];
    const spoken = options[Math.floor(Math.random() * options.length)];
    return { shown: memory.caption, spoken };
  }
  const quiz = [
    'Who is this?',
    'Can you tell me who this is?',
    'Do you recognise this person or place?',
    'Who do you see here?',
  ];
  const spoken = quiz[Math.floor(Math.random() * quiz.length)];
  return { shown: spoken, spoken };
}

/**
 * @param {string} transcript
 * @param {string[]} expectedAnswers
 * @returns {{ match: boolean, score: number }}
 */
function gradeAnswer(transcript, expectedAnswers) {
  if (!transcript) return { match: false, score: 0 };
  const t = transcript.toLowerCase().trim();
  for (const exp of expectedAnswers) {
    const e = exp.toLowerCase().trim();
    if (t.includes(e) || e.includes(t)) {
      return { match: true, score: 1 };
    }
    // Partial match: check if significant overlap
    const words = e.split(/\s+/);
    const matched = words.filter((w) => t.includes(w)).length;
    if (words.length > 0 && matched / words.length >= 0.6) {
      return { match: true, score: matched / words.length };
    }
  }
  return { match: false, score: 0 };
}

/**
 * @param {{ outcome: 'correct'|'wrong'|'skipped', responseMs: number, hintsUsed: number, repetitions: number }[]} results
 * @returns {{ accuracy: number, avgResponseMs: number, hintsUsed: number, repetitions: number, hintRate: number, compositeScore: number }}
 */
function computeSessionScores(results) {
  const answered = results.length || 1;
  const correct = results.filter((r) => r.outcome === 'correct').length;
  const accuracy = correct / answered;
  const avgResponseMs = Math.round(results.reduce((s, r) => s + r.responseMs, 0) / answered);
  const hintsUsed = results.reduce((s, r) => s + r.hintsUsed, 0);
  const repetitions = results.reduce((s, r) => s + r.repetitions, 0);
  const hintRate = hintsUsed / answered;

  const speed =
    avgResponseMs <= 5000 ? 1 : avgResponseMs >= 30000 ? 0 : 1 - (avgResponseMs - 5000) / 25000;
  const hintPenalty = Math.min(1, hintRate / 2);
  const compositeScore =
    Math.round(Math.max(0, Math.min(100, accuracy * 70 + speed * 20 + (1 - hintPenalty) * 10)) * 10) / 10;

  return { accuracy, avgResponseMs, hintsUsed, repetitions, hintRate, compositeScore };
}

module.exports = {
  shuffle,
  chips,
  expected,
  variedPrompt,
  gradeAnswer,
  computeSessionScores,
  domainScoresFromResponses,
};
