// Scoring engine — port of computeSessionScores from existing TS
// Pure functions, no I/O

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function chips(correct, pool) {
  const distractors = shuffle(pool.filter((p) => p.toLowerCase() !== correct.toLowerCase())).slice(0, 3);
  return shuffle([correct, ...distractors]);
}

function expected(memory) {
  const rel = memory.relation && memory.relation !== 'custom' ? [memory.relation] : [];
  return [memory.shortLabel, ...(memory.aliases || []), ...rel].filter(Boolean);
}

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

// Export for Node (server) and browser (client)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { shuffle, chips, expected, computeSessionScores };
}
