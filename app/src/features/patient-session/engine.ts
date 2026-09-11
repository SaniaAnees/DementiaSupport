import type { BuiltSessionItem, Memory, Patient, SoftConstraints } from '../../shared/types';
import { fuzzyMatch } from '../../shared/fuzzyMatch';
import { nid } from '../../shared/db';

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function chips(correct: string, pool: string[]) {
  const distractors = shuffle(pool.filter((p) => p.toLowerCase() !== correct.toLowerCase())).slice(
    0,
    3
  );
  return shuffle([correct, ...distractors]);
}

function expected(memory: Memory) {
  const rel = memory.relation !== 'custom' ? [memory.relation] : [];
  return [memory.shortLabel, ...memory.aliases, ...rel].filter(Boolean);
}

/** AI job (1): varied spoken prompts from caregiver labels — templates only in MVP. */
export function variedPrompt(memory: Memory, kind: 'teach' | 'quiz'): { shown: string; spoken: string } {
  const name = memory.shortLabel;
  const rel = memory.relation === 'custom' ? name : memory.relation;
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
    `Can you tell me who this is?`,
    `Do you recognise this person or place?`,
    `Who do you see here?`,
  ];
  const spoken = quiz[Math.floor(Math.random() * quiz.length)];
  return { shown: spoken, spoken };
}

function filterAvoid(memories: Memory[], avoid: string[]) {
  if (!avoid.length) return memories;
  return memories.filter((m) => {
    const blob = `${m.caption} ${m.shortLabel} ${m.aliases.join(' ')}`.toLowerCase();
    return !avoid.some((t) => blob.includes(t));
  });
}

export function buildMorningSession(
  memories: Memory[],
  sessionId: string,
  constraints: SoftConstraints
): BuiltSessionItem[] {
  const pool = filterAvoid(memories, constraints.avoidTopics);
  if (!pool.length) return [];
  const selected = shuffle(pool).slice(0, Math.min(constraints.quizCount, pool.length));
  const warmup = shuffle(pool).slice(0, Math.min(constraints.warmupCount, pool.length));
  const labels = pool.map((m) => m.shortLabel);
  const items: BuiltSessionItem[] = [];

  warmup.forEach((memory, i) => {
    const p = variedPrompt(memory, 'teach');
    items.push({
      id: nid(),
      sessionId,
      itemType: 'memory_teach',
      memoryId: memory.id,
      promptText: p.shown,
      spokenPrompt: p.spoken,
      expectedAnswers: expected(memory),
      sortOrder: i,
      localUri: memory.localUri,
      caption: memory.caption,
      hintText: memory.shortLabel,
    });
  });

  shuffle(selected).forEach((memory, i) => {
    const p = variedPrompt(memory, 'quiz');
    items.push({
      id: nid(),
      sessionId,
      itemType: 'memory_quiz',
      memoryId: memory.id,
      promptText: p.shown,
      spokenPrompt: p.spoken,
      expectedAnswers: expected(memory),
      sortOrder: items.length + i,
      localUri: memory.localUri,
      caption: memory.caption,
      hintText: `It is ${memory.shortLabel}.`,
      chipOptions: chips(memory.shortLabel, labels),
    });
  });

  return items;
}

export function buildEveningSession(
  patient: Patient,
  memories: Memory[],
  sessionId: string,
  constraints: SoftConstraints
): BuiltSessionItem[] {
  const pool = filterAvoid(memories, constraints.avoidTopics);
  const items: BuiltSessionItem[] = [];
  const names = [patient.preferredName, patient.fullName].filter(Boolean) as string[];

  if (names.length) {
    items.push({
      id: nid(),
      sessionId,
      itemType: 'orientation',
      promptText: 'What is your name?',
      spokenPrompt: 'What is your name?',
      expectedAnswers: names,
      sortOrder: items.length,
      hintText: `Your name is ${names[0]}.`,
      chipOptions: chips(names[0], [
        names[0],
        ...pool.filter((m) => m.category === 'person').map((m) => m.shortLabel).slice(0, 3),
      ]),
    });
  }
  if (patient.hometown) {
    items.push({
      id: nid(),
      sessionId,
      itemType: 'orientation',
      promptText: 'Where are you from?',
      spokenPrompt: 'Where are you from?',
      expectedAnswers: [patient.hometown, `from ${patient.hometown}`],
      sortOrder: items.length,
      hintText: `You are from ${patient.hometown}.`,
      chipOptions: chips(patient.hometown, [
        patient.hometown,
        'Guwahati',
        'Shillong',
        'Kohima',
        'Imphal',
      ]),
    });
  }

  const quizN = Math.min(2, Math.max(1, constraints.quizCount - 2), pool.length);
  for (const memory of shuffle(pool).slice(0, quizN)) {
    const p = variedPrompt(memory, 'quiz');
    items.push({
      id: nid(),
      sessionId,
      itemType: 'memory_quiz',
      memoryId: memory.id,
      promptText: p.shown,
      spokenPrompt: p.spoken,
      expectedAnswers: expected(memory),
      sortOrder: items.length,
      localUri: memory.localUri,
      caption: memory.caption,
      hintText: `This is ${memory.shortLabel}.`,
      chipOptions: chips(
        memory.shortLabel,
        pool.map((m) => m.shortLabel)
      ),
    });
  }
  return items;
}

export function gradeAnswer(transcript: string, expectedAnswers: string[]) {
  return fuzzyMatch(transcript, expectedAnswers);
}

export function computeSessionScores(
  results: { outcome: 'correct' | 'wrong' | 'skipped'; responseMs: number; hintsUsed: number; repetitions: number }[]
) {
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
    Math.round(Math.max(0, Math.min(100, accuracy * 70 + speed * 20 + (1 - hintPenalty) * 10)) * 10) /
    10;
  return { accuracy, avgResponseMs, hintsUsed, repetitions, hintRate, compositeScore };
}
