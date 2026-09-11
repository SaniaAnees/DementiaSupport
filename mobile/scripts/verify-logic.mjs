/** Standalone checks (no RN/Expo imports). Run: node scripts/verify-logic.mjs */

function normalizeAnswer(input) {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function fuzzyMatch(transcript, expectedAnswers, threshold = 0.72) {
  const spoken = normalizeAnswer(transcript);
  if (!spoken) return { isCorrect: false, matchScore: 0 };
  let best = 0;
  for (const raw of expectedAnswers) {
    const expected = normalizeAnswer(raw);
    if (!expected) continue;
    if (spoken === expected || spoken.includes(expected) || expected.includes(spoken)) {
      return { isCorrect: true, matchScore: 1 };
    }
    const maxLen = Math.max(spoken.length, expected.length);
    const score = maxLen === 0 ? 0 : 1 - levenshtein(spoken, expected) / maxLen;
    if (score > best) best = score;
  }
  return { isCorrect: best >= threshold, matchScore: best };
}

function computeSessionScores(results) {
  const answered = results.length || 1;
  const correct = results.filter((r) => r.isCorrect).length;
  const accuracy = correct / answered;
  const avg_response_ms = Math.round(
    results.reduce((sum, r) => sum + (r.responseMs || 0), 0) / answered
  );
  const hints_used = results.reduce((sum, r) => sum + r.hintsUsed, 0);
  const repetitions = results.reduce((sum, r) => sum + r.repetitions, 0);
  const speed =
    avg_response_ms <= 5000
      ? 1
      : avg_response_ms >= 30000
        ? 0
        : 1 - (avg_response_ms - 5000) / 25000;
  const hint_penalty = Math.min(1, hints_used / (answered * 2));
  const composite_score = Math.max(
    0,
    Math.min(100, accuracy * 70 + speed * 20 + (1 - hint_penalty) * 10)
  );
  return { accuracy, avg_response_ms, hints_used, repetitions, composite_score };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(normalizeAnswer(' Meera! ') === 'meera', 'normalize');
assert(fuzzyMatch('my daughter Meera', ['Meera', 'daughter']).isCorrect, 'fuzzy');
assert(!fuzzyMatch('xyz', ['Meera']).isCorrect, 'fuzzy miss');
const scores = computeSessionScores([
  { isCorrect: true, responseMs: 4000, hintsUsed: 0, repetitions: 0 },
  { isCorrect: false, responseMs: 12000, hintsUsed: 2, repetitions: 1 },
]);
assert(scores.accuracy === 0.5, 'accuracy');
console.log('All logic checks passed.');
