// Browser NER geo resolve + offline curriculum loader (Assam Day 1+)
(function () {
  const STATE_META = {
    as: { code: 'as', name: 'Assam', languageHint: 'as-IN' },
    ml: { code: 'ml', name: 'Meghalaya', languageHint: 'en-IN' },
    mn: { code: 'mn', name: 'Manipur', languageHint: 'mni-IN' },
    nl: { code: 'nl', name: 'Nagaland', languageHint: 'en-IN' },
    mz: { code: 'mz', name: 'Mizoram', languageHint: 'en-IN' },
    tr: { code: 'tr', name: 'Tripura', languageHint: 'bn-IN' },
    ar: { code: 'ar', name: 'Arunachal Pradesh', languageHint: 'en-IN' },
  };

  const ALIASES = [
    ['guwahati', 'as'], ['gauhati', 'as'], ['dispur', 'as'], ['jorhat', 'as'],
    ['dibrugarh', 'as'], ['tezpur', 'as'], ['silchar', 'as'], ['nagaon', 'as'],
    ['sivasagar', 'as'], ['tinsukia', 'as'], ['majuli', 'as'], ['assam', 'as'],
    ['shillong', 'ml'], ['cherrapunji', 'ml'], ['sohra', 'ml'], ['tura', 'ml'],
    ['meghalaya', 'ml'],
    ['imphal', 'mn'], ['thoubal', 'mn'], ['manipur', 'mn'],
    ['kohima', 'nl'], ['dimapur', 'nl'], ['nagaland', 'nl'],
    ['aizawl', 'mz'], ['mizoram', 'mz'],
    ['agartala', 'tr'], ['tripura', 'tr'],
    ['itanagar', 'ar'], ['tawang', 'ar'], ['ziro', 'ar'], ['arunachal', 'ar'],
  ];

  function normalizePlace(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function resolveRegion(hometown, explicitState) {
    if (explicitState) {
      const key = normalizePlace(explicitState);
      if (STATE_META[key]) return { ...STATE_META[key], matchedAlias: key };
      for (const meta of Object.values(STATE_META)) {
        if (normalizePlace(meta.name) === key) return { ...meta, matchedAlias: key };
      }
    }
    const place = normalizePlace(hometown);
    if (!place) return null;
    const sorted = [...ALIASES].sort((a, b) => b[0].length - a[0].length);
    for (const [alias, code] of sorted) {
      if (place === alias || place.includes(alias) || alias.includes(place)) {
        return { ...STATE_META[code], matchedAlias: alias };
      }
    }
    return null;
  }

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
    const distractors = shuffle(pool.filter((p) => String(p).toLowerCase() !== c.toLowerCase())).slice(0, 3);
    return shuffle([c, ...distractors]);
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

  async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Missing ' + url);
    return res.json();
  }

  async function buildOfflineCurriculum(patient, memories, sessionType) {
    const region =
      resolveRegion(patient.hometown, patient.region_state || patient.regionState) ||
      { code: 'as', name: 'Assam' };

    const bank = await fetchJson(`/curriculum/packs/${region.code}/bank.json`);
    let day = 1;
    let plan;
    try {
      plan = await fetchJson(`/curriculum/packs/${region.code}/days/day${day}.${sessionType}.json`);
    } catch {
      return null;
    }

    const family = (memories || [])
      .filter((m) => m.localUri || m.image_url || m.imageUrl)
      .slice(0, 4)
      .map((m) => {
        const label = m.shortLabel || m.short_label || 'Family';
        const rel = m.relation && m.relation !== 'custom' ? m.relation : null;
        const aliases = Array.isArray(m.aliases) ? m.aliases : [];
        return {
          id: m.id,
          label,
          uri: m.localUri || m.image_url || m.imageUrl,
          expected: [label, ...aliases, rel].filter(Boolean),
        };
      });

    const weekday = (bank.weekdayNames?.en || [])[new Date().getDay()] || 'Today';
    const ctx = {
      preferredName: patient.preferredName || patient.preferred_name || patient.fullName || 'friend',
      hometown: patient.hometown || region.name,
      weekday,
      family,
    };
    const registrationIds = plan.registrationIds || [];
    const base = (bank.imageBase || '/assets/curriculum/as').replace(/\/$/, '');
    const culturalUri = `${base}/${sessionType === 'evening' ? 'evening' : 'morning'}.jpg`;
    const culturalCaption = `${region.name} ${sessionType === 'evening' ? 'evening' : 'morning'}`;

    function familyPhotoAt(index) {
      const f = family[index || 0];
      return !!(f && f.uri && f.id);
    }

    function shouldSkip(step) {
      if (step.media?.kind === 'family' && step.itemType !== 'story_beat') {
        if (!familyPhotoAt(step.media.index || 0)) return true;
      }
      if (step.answerFrom === 'family0' && !familyPhotoAt(0)) return true;
      if (step.answerFrom === 'family1' && !familyPhotoAt(1)) return true;
      return false;
    }

    function answersFor(step) {
      if (step.expectedAnswers?.length) return step.expectedAnswers.map((a) => fillTemplate(a, ctx));
      if (step.bankItem && bank.items[step.bankItem]) {
        const item = bank.items[step.bankItem];
        return [item.label, ...(item.aliases || [])];
      }
      if (step.answerFrom === 'weekday') {
        const w = ctx.weekday;
        const aliases = bank.weekdayAliases?.[w] || [];
        const dayIdx = (bank.weekdayNames?.en || []).indexOf(w);
        const extra = [];
        if (dayIdx >= 0) {
          const hi = bank.weekdayNames?.hi?.[dayIdx];
          const as = bank.weekdayNames?.as?.[dayIdx];
          if (hi) extra.push(hi);
          if (as) extra.push(as);
        }
        return [w, String(w).toLowerCase(), ...aliases, ...extra];
      }
      if (step.answerFrom === 'hometown') return [ctx.hometown, `from ${ctx.hometown}`];
      if (step.answerFrom === 'family0') return family[0]?.expected || [];
      if (step.answerFrom === 'family1') return family[1]?.expected || [];
      return [];
    }

    function chipsFor(step, answers) {
      if (step.chipOptions) return shuffle(step.chipOptions.map((c) => fillTemplate(c, ctx)));
      const correct = answers[0];
      if (!correct) return null;
      if (step.chipPool === 'weekdays') return chips(correct, bank.weekdayNames.en);
      if (step.chipPool === 'hometownDistractors') {
        return chips(correct, [ctx.hometown, ...(bank.distractHometowns || [])]);
      }
      if (step.chipPool === 'familyLabels') {
        const labels = family.map((f) => f.label);
        while (labels.length < 4) labels.push(['Neighbour', 'Friend', 'Cousin', 'Teacher'][labels.length]);
        return chips(correct, labels);
      }
      if (step.chipPool === 'registrationSet') {
        return chips(correct, registrationIds.map((id) => bank.items[id]?.label).filter(Boolean));
      }
      return null;
    }

    function mediaFor(step) {
      if (step.bankItem) {
        const item = bank.items[step.bankItem];
        return {
          kind: 'image',
          uri: item?.image ? `${base}/${item.image}` : null,
          caption: item?.caption || item?.label || '',
        };
      }
      if (step.media?.kind === 'family') {
        const f = family[step.media.index || 0];
        if (f?.uri) return { kind: 'image', uri: f.uri, caption: f.label };
        if (step.itemType === 'story_beat') {
          return { kind: 'image', uri: culturalUri, caption: culturalCaption };
        }
        return null;
      }
      if (step.media?.image) {
        const img = step.media.image.startsWith('/') ? step.media.image : `${base}/${step.media.image}`;
        return { kind: 'image', uri: img, caption: fillTemplate(step.media.caption, ctx) };
      }
      if (step.media) {
        return { kind: 'image', uri: step.media.uri || null, caption: fillTemplate(step.media.caption, ctx) };
      }
      return null;
    }

    function scene(ids) {
      return (ids || []).map((id) => {
        const item = bank.items[id] || { label: id };
        return {
          id,
          label: item.label || id,
          image: item.image ? `${base}/${item.image}` : null,
        };
      });
    }

    const items = [];
    plan.steps.forEach((step, i) => {
      if (shouldSkip(step)) return;
      const answers = answersFor(step);
      const media = mediaFor(step);
      items.push({
        id: crypto.randomUUID(),
        templateId: step.id,
        itemType: step.itemType,
        domain: step.domain,
        memoryId: step.answerFrom === 'family0' ? family[0]?.id : step.answerFrom === 'family1' ? family[1]?.id : null,
        promptText: fillTemplate(step.promptText, ctx),
        spokenPrompt: fillTemplate(step.spokenPrompt || step.promptText, ctx),
        expectedAnswers: answers,
        hintText: fillTemplate(step.hintText, ctx),
        chipOptions: step.itemType === 'story_beat' || step.itemType === 'registration_teach' ? null : chipsFor(step, answers),
        continueLabel: step.continueLabel || 'Next',
        continueKicker: step.continueKicker || null,
        autoCorrect: !!step.autoCorrect,
        lookMs: step.lookMs || 8000,
        localUri: media?.uri || null,
        caption: media?.caption || '',
        media,
        sceneBefore: step.sceneBefore ? scene(step.sceneBefore) : null,
        sceneAfter: step.sceneAfter ? scene(step.sceneAfter) : null,
        sequenceSteps: step.sequenceSteps || null,
        sortOrder: i,
        regionCode: region.code,
        curriculumDay: day,
        sessionTheme: `${ctx.preferredName || 'friend'}'s ${sessionType} with family`,
      });
    });

    return {
      items,
      meta: {
        regionCode: region.code,
        regionName: region.name,
        day,
        theme: `${ctx.preferredName || 'friend'}'s ${sessionType === 'evening' ? 'evening' : 'morning'} with family`,
        title: fillTemplate(plan.title || '', ctx),
        sessionType,
        imageBase: bank.imageBase || `/assets/curriculum/${region.code}`,
      },
    };
  }

  window.CurriculumClient = { resolveRegion, buildOfflineCurriculum, STATE_META };
})();
