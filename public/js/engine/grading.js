/**
 * Fuzzy grading for patient voice answers (STT noise, Hindi / Assamese / English).
 * Accepts near-misses — not only the exact English chip label.
 */
function normalizeAnswer(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Edit distance — tolerate STT garble (e.g. shukravar ↔ sukravar) */
function editDistance(a, b) {
  const s = String(a);
  const t = String(b);
  const m = s.length;
  const n = t.length;
  if (!m) return n;
  if (!n) return m;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = s[i - 1] === t[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

function similarEnough(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const longer = Math.max(a.length, b.length);
  if (longer < 3) return false;
  const dist = editDistance(a, b);
  // Allow ~30% character errors for short STT words
  return dist <= Math.max(1, Math.floor(longer * 0.34));
}

/** Canonical weekday → spoken variants patients actually say */
const WEEKDAY_VARIANTS = {
  sunday: ['sunday', 'ravivar', 'robi', 'robibar', 'रविवार'],
  monday: ['monday', 'somvar', 'sombar', 'सोमवार'],
  tuesday: ['tuesday', 'mangalvar', 'mongolbar', 'मंगलवार'],
  wednesday: ['wednesday', 'budhvar', 'budhbar', 'बुधवार'],
  thursday: ['thursday', 'guruvar', 'brihospoti', 'गुरुवार'],
  friday: [
    'friday',
    'fridays',
    'fryday',
    'fridey',
    'shukravar',
    'shukravaar',
    'sukravar',
    'shukkar',
    'xukurbar',
    'shukrabar',
    'शुक्रवार',
    'shukra',
  ],
  saturday: ['saturday', 'shanivar', 'xonibar', 'शनिवार'],
};

/** Assam teach/quiz words — hi-IN STT often returns Devanagari or clipped forms */
const CONTENT_ALIASES = {
  brahmaputra: [
    'brahmaputra',
    'bramhaputra',
    'brahmaputr',
    'brahma putra',
    'bramha',
    'brahma',
    'ब्रह्मपुत्र',
    'ब्रह्मापुत्र',
    'ब्रह্মাপুত্র',
    'ब्रह्मा',
    'ब्रह्म',
    'ব্রহ্মপুত্র',
  ],
  pitha: ['pitha', 'pita', 'पिठा', 'पीठा', 'পিঠা'],
  bihu: ['bihu', 'बिहू', 'বিহু'],
  jaapi: ['jaapi', 'japi', 'japee', 'जापी', 'জাপি'],
  gamusa: ['gamusa', 'gamosa', 'gamucha', 'गामुसा', 'গামুচা', 'গামোচা'],
  jolpan: ['jolpan', 'jalpan', 'जोलपान', 'জলপান'],
};

function expandExpected(expectedAnswers) {
  const out = [];
  for (const exp of expectedAnswers || []) {
    const e = normalizeAnswer(exp);
    if (!e) continue;
    out.push(e);
    for (const [canon, variants] of Object.entries(WEEKDAY_VARIANTS)) {
      if (e === canon || variants.some((v) => normalizeAnswer(v) === e)) {
        for (const v of variants) out.push(normalizeAnswer(v));
        out.push(canon);
      }
    }
    for (const [canon, variants] of Object.entries(CONTENT_ALIASES)) {
      const norms = variants.map(normalizeAnswer);
      if (e === canon || norms.includes(e) || norms.some((v) => e.includes(v) || v.includes(e))) {
        out.push(canon);
        for (const v of norms) out.push(v);
      }
    }
  }
  return [...new Set(out)];
}

function gradeAnswer(transcript, expectedAnswers) {
  if (!transcript) return { match: false, score: 0 };

  const t = normalizeAnswer(transcript);
  const expected = expandExpected(expectedAnswers);
  let best = 0;

  for (const e of expected) {
    if (!e) continue;

    if (t === e) return { match: true, score: 1 };
    if (t.includes(e) || e.includes(t)) {
      best = Math.max(best, 0.95);
      continue;
    }

    // Word-level: any transcript word close to expected token
    const tWords = t.split(' ').filter(Boolean);
    const eWords = e.split(' ').filter(Boolean);
    for (const tw of tWords) {
      if (similarEnough(tw, e)) best = Math.max(best, 0.9);
      for (const ew of eWords) {
        if (similarEnough(tw, ew)) best = Math.max(best, 0.85);
      }
    }

    if (eWords.length > 1) {
      const hit = eWords.filter((w) => tWords.some((tw) => similarEnough(tw, w))).length;
      best = Math.max(best, hit / eWords.length);
    }
  }

  // Whole-string similarity for short answers
  for (const e of expected) {
    if (e.length >= 4 && similarEnough(t.replace(/\s/g, ''), e.replace(/\s/g, ''))) {
      best = Math.max(best, 0.88);
    }
  }

  return { match: best >= 0.72, score: best };
}

/** Softer check — was this even an attempt at the answer? */
function isAnswerAttempt(transcript, expectedAnswers, chipOptions) {
  const pool = [...(expectedAnswers || []), ...(chipOptions || [])];
  const g = gradeAnswer(transcript, pool);
  if (g.score >= 0.4) return true;
  const t = normalizeAnswer(transcript);
  // Any weekday word mentioned on a weekday question
  for (const variants of Object.values(WEEKDAY_VARIANTS)) {
    for (const v of variants) {
      const n = normalizeAnswer(v);
      if (n.length >= 4 && (t.includes(n) || similarEnough(t, n))) {
        // Only if expected is also a weekday
        const expNorm = expandExpected(expectedAnswers);
        if (expNorm.some((e) => WEEKDAY_VARIANTS[e] || Object.keys(WEEKDAY_VARIANTS).includes(e))) {
          return true;
        }
        if (expNorm.some((e) => variants.map(normalizeAnswer).includes(e))) return true;
      }
    }
  }
  return false;
}

window.gradeAnswer = gradeAnswer;
window.isAnswerAttempt = isAnswerAttempt;
window.expandExpected = expandExpected;
