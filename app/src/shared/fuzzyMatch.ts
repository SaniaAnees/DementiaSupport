export function normalizeAnswer(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
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

export function fuzzyMatch(transcript: string, expectedAnswers: string[], threshold = 0.72) {
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
