import type { BuiltSessionItem, Memory, Patient } from '../types/models';
import { fuzzyMatch } from '../utils/fuzzyMatch';
import { newId } from '../utils/ids';

function parseAliases(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function expectedForMemory(memory: Memory): string[] {
  return [memory.short_label, ...parseAliases(memory.aliases)].filter(Boolean);
}

function chipsFor(correct: string, pool: string[]): string[] {
  const distractors = shuffle(pool.filter((p) => p.toLowerCase() !== correct.toLowerCase())).slice(
    0,
    3
  );
  return shuffle([correct, ...distractors]);
}

export function buildMorningSession(memories: Memory[]): BuiltSessionItem[] {
  const selected = shuffle(memories).slice(0, Math.min(4, Math.max(memories.length, 0)));
  const labels = memories.map((m) => m.short_label);
  const items: BuiltSessionItem[] = [];

  selected.forEach((memory, index) => {
    items.push({
      id: newId(),
      item_type: 'memory_teach',
      memory_id: memory.id,
      prompt_text: memory.caption,
      expected_answers: expectedForMemory(memory),
      local_uri: memory.local_uri,
      caption: memory.caption,
      hint_text: memory.short_label.slice(0, Math.max(1, Math.ceil(memory.short_label.length / 2))),
    });
    items.push({
      id: newId(),
      item_type: 'memory_quiz',
      memory_id: memory.id,
      prompt_text: 'Who is this?',
      expected_answers: expectedForMemory(memory),
      local_uri: memory.local_uri,
      caption: memory.caption,
      hint_text: `It starts with "${memory.short_label.slice(0, 1).toUpperCase()}…"`,
      chip_options: chipsFor(memory.short_label, labels),
    });
    // keep teach immediately before its quiz visually ordered by sort later
    void index;
  });

  // Reorder: all teach first, then quiz (better for dementia pacing)
  const teach = items.filter((i) => i.item_type === 'memory_teach');
  const quiz = shuffle(items.filter((i) => i.item_type === 'memory_quiz'));
  return [...teach, ...quiz];
}

export function buildEveningSession(patient: Patient, memories: Memory[]): BuiltSessionItem[] {
  const items: BuiltSessionItem[] = [];
  const nameAnswers = [patient.preferred_name, patient.full_name].filter(Boolean) as string[];
  if (nameAnswers.length) {
    items.push({
      id: newId(),
      item_type: 'orientation',
      memory_id: null,
      prompt_text: 'What is your name?',
      expected_answers: nameAnswers,
      hint_text: `Your name starts with "${nameAnswers[0].slice(0, 1)}"`,
      chip_options: chipsFor(nameAnswers[0], [
        nameAnswers[0],
        'Meera',
        'Ramesh',
        'Anjali',
        'Priya',
      ]),
    });
  }
  if (patient.hometown) {
    items.push({
      id: newId(),
      item_type: 'orientation',
      memory_id: null,
      prompt_text: 'Where are you from?',
      expected_answers: [patient.hometown, `from ${patient.hometown}`],
      hint_text: `You are from ${patient.hometown.slice(0, 2)}…`,
      chip_options: chipsFor(patient.hometown, [
        patient.hometown,
        'Guwahati',
        'Shillong',
        'Kohima',
        'Delhi',
      ]),
    });
  }
  if (patient.age != null) {
    items.push({
      id: newId(),
      item_type: 'orientation',
      memory_id: null,
      prompt_text: 'How old are you?',
      expected_answers: [String(patient.age), `${patient.age} years`],
      hint_text: 'Think of your age in years.',
      chip_options: chipsFor(String(patient.age), [
        String(patient.age),
        String(patient.age - 2),
        String(patient.age + 3),
        '65',
      ]),
    });
  }

  const memoryQuiz = shuffle(memories)
    .slice(0, Math.min(2, memories.length))
    .map((memory) => ({
      id: newId(),
      item_type: 'memory_quiz' as const,
      memory_id: memory.id,
      prompt_text: 'Who is this person?',
      expected_answers: expectedForMemory(memory),
      local_uri: memory.local_uri,
      caption: memory.caption,
      hint_text: memory.short_label.slice(0, 2),
      chip_options: chipsFor(
        memory.short_label,
        memories.map((m) => m.short_label)
      ),
    }));

  return [...items, ...memoryQuiz];
}

export function gradeAnswer(transcript: string, expectedAnswers: string[]) {
  return fuzzyMatch(transcript, expectedAnswers);
}

export function computeSessionScores(params: {
  results: { isCorrect: boolean; responseMs: number; hintsUsed: number; repetitions: number }[];
}) {
  const { results } = params;
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

  return {
    accuracy,
    avg_response_ms,
    hints_used,
    repetitions,
    composite_score: Math.round(composite_score * 10) / 10,
  };
}
