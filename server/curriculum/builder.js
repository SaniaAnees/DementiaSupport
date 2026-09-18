const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { resolveRegion } = require('./geo');
const { applySpokenLocale } = require('./i18n/spoken');

const PACKS_ROOT = path.join(__dirname, 'packs');

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function chips(correct, pool) {
  const c = String(correct);
  const distractors = shuffle(
    pool.filter((p) => String(p).toLowerCase() !== c.toLowerCase())
  ).slice(0, 3);
  return shuffle([c, ...distractors]);
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function packExists(stateCode) {
  return fs.existsSync(path.join(PACKS_ROOT, stateCode, 'bank.json'));
}

function availableDays(stateCode, sessionType) {
  const dir = path.join(PACKS_ROOT, stateCode, 'days');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(`.${sessionType}.json`))
    .map((f) => Number(f.match(/day(\d+)/)?.[1]))
    .filter(Boolean)
    .sort((a, b) => a - b);
}

function curriculumDayIndex(patient, available) {
  if (!available.length) return 1;
  const startRaw = patient.curriculum_started_at || patient.created_at;
  const start = startRaw ? new Date(startRaw) : new Date();
  const today = new Date();
  const diff = Math.max(0, Math.floor((today - start) / 86400000));
  return available[diff % available.length];
}

function weekdayLabel(bank, date = new Date()) {
  const names = bank.weekdayNames?.en || [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
  ];
  return names[date.getDay()];
}

function fillTemplate(str, ctx) {
  if (!str) return str;
  return String(str).replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const k = key.trim();
    if (k === 'preferredName') return ctx.preferredName || 'friend';
    if (k === 'hometown') return ctx.hometown || 'home';
    if (k === 'weekday') return ctx.weekday;
    if (k === 'family0.label') return ctx.family[0]?.label || 'your family';
    if (k === 'family1.label') return ctx.family[1]?.label || 'your family';
    return '';
  });
}

function itemImageUrl(bank, item) {
  if (!item?.image) return null;
  const base = (bank.imageBase || '/assets/curriculum/as').replace(/\/$/, '');
  return `${base}/${item.image}`;
}

function bankMedia(bank, itemId) {
  const item = bank.items[itemId];
  if (!item) return { kind: 'image', uri: null, caption: '' };
  const uri = itemImageUrl(bank, item);
  return {
    kind: 'image',
    uri,
    caption: item.caption || item.label,
    label: item.label,
  };
}

function resolveAnswers(step, ctx, bank) {
  if (step.expectedAnswers?.length) {
    return step.expectedAnswers.map((a) => fillTemplate(a, ctx));
  }
  if (step.bankItem && bank.items[step.bankItem]) {
    const item = bank.items[step.bankItem];
    return [item.label, ...(item.aliases || [])];
  }
  if (step.answerFrom === 'weekday') return [ctx.weekday, ctx.weekday.toLowerCase()];
  if (step.answerFrom === 'hometown') {
    return [ctx.hometown, `from ${ctx.hometown}`].filter(Boolean);
  }
  if (step.answerFrom === 'family0' && ctx.family[0]) {
    return ctx.family[0].expected;
  }
  if (step.answerFrom === 'family1' && ctx.family[1]) {
    return ctx.family[1].expected;
  }
  return [];
}

function resolveChips(step, answers, ctx, bank, registrationIds) {
  if (step.chipOptions?.length) {
    return shuffle(step.chipOptions.map((c) => fillTemplate(c, ctx)));
  }
  const correct = answers[0];
  if (!correct) return null;

  if (step.chipPool === 'weekdays') {
    return chips(correct, bank.weekdayNames?.en || []);
  }
  if (step.chipPool === 'hometownDistractors') {
    return chips(correct, [ctx.hometown, ...(bank.distractHometowns || [])].filter(Boolean));
  }
  if (step.chipPool === 'familyLabels') {
    const labels = ctx.family.map((f) => f.label);
    while (labels.length < 4) {
      labels.push(['Neighbour', 'Friend', 'Cousin', 'Teacher'][labels.length]);
    }
    return chips(correct, labels);
  }
  if (step.chipPool === 'registrationSet') {
    const labels = registrationIds.map((id) => bank.items[id]?.label).filter(Boolean);
    return chips(correct, labels);
  }
  return chips(correct, [correct]);
}

function resolveMedia(step, ctx, bank) {
  if (step.bankItem) return bankMedia(bank, step.bankItem);
  if (!step.media) return null;
  if (step.media.kind === 'family') {
    const f = ctx.family[step.media.index || 0];
    if (f?.uri) {
      return { kind: 'image', uri: f.uri, caption: f.label };
    }
    return { kind: 'image', uri: null, caption: f?.label || 'Family' };
  }
  if (step.media.bankItem || step.media.kind === 'bank') {
    return bankMedia(bank, step.media.bankItem || step.media.id);
  }
  if (step.media.image) {
    const base = (bank.imageBase || '/assets/curriculum/as').replace(/\/$/, '');
    return {
      kind: 'image',
      uri: step.media.image.startsWith('/') ? step.media.image : `${base}/${step.media.image}`,
      caption: fillTemplate(step.media.caption, ctx),
    };
  }
  return {
    kind: 'image',
    uri: step.media.uri || null,
    caption: fillTemplate(step.media.caption, ctx),
  };
}

function sceneObjects(ids, bank) {
  return (ids || []).map((id) => {
    const item = bank.items[id] || { label: id };
    return {
      id,
      label: item.label || id,
      image: itemImageUrl(bank, item),
    };
  });
}

/**
 * Build personalized curriculum items for a patient.
 * Returns null if no pack available (caller should use legacy builder).
 */
function buildCurriculumSession(patient, memories, sessionType) {
  const region =
    resolveRegion(patient.hometown, patient.region_state || patient.regionState) ||
    resolveRegion(patient.hometown) ||
    { code: 'as', name: 'Assam', languageHint: 'as-IN', matchedAlias: null };

  let packCode = region.code;
  if (!packExists(packCode)) {
    // Until other state packs ship, use Assam structure with patient's hometown still personalized
    if (!packExists('as')) return null;
    packCode = 'as';
  }

  const bank = loadJson(path.join(PACKS_ROOT, packCode, 'bank.json'));
  const days = availableDays(packCode, sessionType);
  if (!days.length) return null;

  const day = curriculumDayIndex(patient, days);
  const dayPath = path.join(PACKS_ROOT, packCode, 'days', `day${day}.${sessionType}.json`);
  if (!fs.existsSync(dayPath)) return null;

  const plan = loadJson(dayPath);
  const family = (memories || []).slice(0, 4).map((m) => {
    const label = m.shortLabel || m.short_label || m.caption || 'Family';
    const rel = m.relation && m.relation !== 'custom' ? m.relation : null;
    const aliases = Array.isArray(m.aliases)
      ? m.aliases
      : (() => {
          try {
            return JSON.parse(m.aliases || '[]');
          } catch {
            return [];
          }
        })();
    return {
      id: m.id,
      label,
      uri: m.localUri || m.image_url || m.imageUrl,
      expected: [label, ...aliases, rel].filter(Boolean),
    };
  });

  // Ensure at least 2 family slots for story casting
  while (family.length < 2) {
    family.push({
      id: null,
      label: family.length === 0 ? 'your loved one' : 'your family',
      uri: null,
      expected: family.length === 0 ? ['loved one', 'family'] : ['family'],
    });
  }

  const ctx = {
    preferredName: patient.preferred_name || patient.preferredName || patient.full_name || patient.fullName || 'friend',
    hometown: patient.hometown || region.name,
    weekday: weekdayLabel(bank),
    family,
    region,
  };

  const registrationIds = plan.registrationIds || [];
  const items = [];

  for (const rawStep of plan.steps) {
    const step = applySpokenLocale(rawStep, patient.language_code || patient.languageCode);
    // Skip family-photo questions if no real memories
    if (
      (step.answerFrom === 'family0' || step.media?.kind === 'family') &&
      !memories?.length &&
      step.itemType !== 'story_beat'
    ) {
      if (step.answerFrom?.startsWith('family') || step.media?.kind === 'family') {
        // Still allow with placeholder expected answers
      }
    }

    const answers = resolveAnswers(step, ctx, bank);
    const chipOptions =
      step.itemType === 'story_beat' || step.itemType === 'registration_teach'
        ? null
        : resolveChips(step, answers, ctx, bank, registrationIds);
    const media = resolveMedia(step, ctx, bank);

    const item = {
      id: randomUUID(),
      templateId: step.id,
      itemType: step.itemType,
      domain: step.domain || null,
      memoryId:
        step.answerFrom === 'family0'
          ? family[0]?.id
          : step.answerFrom === 'family1'
            ? family[1]?.id
            : null,
      promptText: fillTemplate(step.promptText, ctx),
      spokenPrompt: fillTemplate(step.spokenPrompt || step.promptText, ctx),
      expectedAnswers: answers,
      hintText: fillTemplate(step.hintText, ctx),
      chipOptions,
      continueLabel: step.continueLabel || 'Next',
      autoCorrect: !!step.autoCorrect,
      lookMs: step.lookMs || 3000,
      localUri: media?.uri || null,
      caption: media?.caption || '',
      media,
      sceneBefore: step.sceneBefore ? sceneObjects(step.sceneBefore, bank) : null,
      sceneAfter: step.sceneAfter ? sceneObjects(step.sceneAfter, bank) : null,
      regionCode: region.code,
      packCode,
      curriculumDay: day,
      sessionTheme: plan.theme,
    };

    items.push(item);
  }

  return {
    items,
    meta: {
      regionCode: region.code,
      regionName: region.name,
      packCode,
      day,
      theme: plan.theme,
      title: plan.title,
      sessionType,
    },
  };
}

module.exports = {
  buildCurriculumSession,
  packExists,
  availableDays,
  resolveRegion,
};
