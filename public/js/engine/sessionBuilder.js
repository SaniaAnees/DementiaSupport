// Session builder — constructs morning/evening session items
// Port of buildMorningSession / buildEveningSession from existing engine.ts

function buildMorningSession(patient, memories, sessionId) {
  const labels = memories.map((m) => m.shortLabel);
  const items = [];

  // Shuffle and select 3-5 memories
  const shuffled = [...memories].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(4, memories.length));

  let order = 0;

  // Teach phase
  selected.forEach((memory) => {
    const p = variedPrompt(memory, 'teach');
    items.push({
      id: crypto.randomUUID(),
      sessionId,
      itemType: 'memory_teach',
      memoryId: memory.id,
      promptText: p.shown,
      spokenPrompt: p.spoken,
      expectedAnswers: expected(memory),
      localUri: memory.localUri,
      caption: memory.caption,
      hintText: memory.shortLabel,
      chipOptions: null,
      sortOrder: order++,
    });
  });

  // Quiz phase
  [...selected].sort(() => Math.random() - 0.5).forEach((memory) => {
    const p = variedPrompt(memory, 'quiz');
    items.push({
      id: crypto.randomUUID(),
      sessionId,
      itemType: 'memory_quiz',
      memoryId: memory.id,
      promptText: p.shown,
      spokenPrompt: p.spoken,
      expectedAnswers: expected(memory),
      localUri: memory.localUri,
      caption: memory.caption,
      hintText: `It is ${memory.shortLabel}.`,
      chipOptions: chips(memory.shortLabel, labels),
      sortOrder: order++,
    });
  });

  return items;
}

function buildEveningSession(patient, memories, sessionId) {
  const labels = memories.map((m) => m.shortLabel);
  const items = [];
  let order = 0;

  const names = [patient.preferredName, patient.fullName].filter(Boolean);

  // Orientation: name
  if (names.length) {
    items.push({
      id: crypto.randomUUID(),
      sessionId,
      itemType: 'orientation',
      memoryId: null,
      promptText: 'What is your name?',
      spokenPrompt: 'What is your name?',
      expectedAnswers: names,
      hintText: `Your name is ${names[0]}.`,
      chipOptions: chips(names[0], [...names, ...labels.filter((l) => l !== names[0]).slice(0, 3)]),
      sortOrder: order++,
    });
  }

  // Orientation: hometown
  if (patient.hometown) {
    items.push({
      id: crypto.randomUUID(),
      sessionId,
      itemType: 'orientation',
      memoryId: null,
      promptText: 'Where are you from?',
      spokenPrompt: 'Where are you from?',
      expectedAnswers: [patient.hometown, `from ${patient.hometown}`],
      hintText: `You are from ${patient.hometown}.`,
      chipOptions: chips(patient.hometown, [patient.hometown, 'Guwahati', 'Shillong', 'Kohima', 'Imphal']),
      sortOrder: order++,
    });
  }

  // Memory quizzes
  const quizMemories = [...memories].sort(() => Math.random() - 0.5).slice(0, Math.min(2, memories.length));
  quizMemories.forEach((memory) => {
    const p = variedPrompt(memory, 'quiz');
    items.push({
      id: crypto.randomUUID(),
      sessionId,
      itemType: 'memory_quiz',
      memoryId: memory.id,
      promptText: p.shown,
      spokenPrompt: p.spoken,
      expectedAnswers: expected(memory),
      localUri: memory.localUri,
      caption: memory.caption,
      hintText: `This is ${memory.shortLabel}.`,
      chipOptions: chips(memory.shortLabel, labels),
      sortOrder: order++,
    });
  });

  return items;
}

// Helper functions
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
  const quiz = ['Who is this?', 'Can you tell me who this is?', 'Do you recognise this?', 'Who do you see?'];
  const spoken = quiz[Math.floor(Math.random() * quiz.length)];
  return { shown: spoken, spoken };
}
