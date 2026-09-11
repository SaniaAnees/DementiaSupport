import type { SoftConstraints } from './types';

/** Rule-based soft constraints from free-text doctor notes (MVP — no LLM required). */
export function parseSoftConstraints(notes?: string): SoftConstraints {
  const text = (notes || '').toLowerCase();
  const shorter =
    /short|brief|fatigue|tired|10\s*min|fewer|reduce/.test(text) ||
    /shorter session/.test(text);
  const moreHints = /hint|prompt|support|encourage|confusion|anxious|anxiety/.test(text);
  const avoidTopics: string[] = [];
  for (const topic of ['death', 'funeral', 'hospital', 'money', 'war', 'politics']) {
    if (text.includes(topic) || text.includes(`avoid ${topic}`)) avoidTopics.push(topic);
  }
  return {
    shorterSessions: shorter,
    moreHints,
    avoidTopics,
    maxMinutes: shorter ? 7 : 10,
    warmupCount: moreHints || shorter ? 3 : 2,
    quizCount: shorter ? 3 : 5,
    pauseBeforeHintMs: moreHints ? 8000 : 5000,
  };
}
