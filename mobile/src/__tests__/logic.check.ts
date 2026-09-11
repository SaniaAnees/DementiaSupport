import { fuzzyMatch, normalizeAnswer } from '../utils/fuzzyMatch';
import { computeSessionScores } from '../sessions/engine';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(normalizeAnswer(' Meera! ') === 'meera', 'normalize');
assert(fuzzyMatch('my daughter Meera', ['Meera', 'daughter']).isCorrect, 'fuzzy contains');
assert(!fuzzyMatch('xyz', ['Meera']).isCorrect, 'fuzzy miss');

const scores = computeSessionScores({
  results: [
    { isCorrect: true, responseMs: 4000, hintsUsed: 0, repetitions: 0 },
    { isCorrect: false, responseMs: 12000, hintsUsed: 2, repetitions: 1 },
  ],
});
assert(scores.accuracy === 0.5, 'accuracy');
assert(scores.composite_score >= 0 && scores.composite_score <= 100, 'composite range');

console.log('All logic checks passed.');
