/**
 * Spoken prompt overlays by language pack for Assam Day 1 (Latin / native mix).
 * English JSON remains source; these replace spokenPrompt (+ optional promptText).
 */
const DAY1 = {
  'm1-orient-day': {
    hi: 'Aaj kaun sa din hai?',
    as: 'Aaji ki baar?',
    bn: 'Aj ke din?',
  },
  'm1-orient-place': {
    hi: 'Aap kahan se hain?',
    as: 'Aapuni koi pora?',
    bn: 'Apni kotha theke?',
  },
  'm1-orient-person': {
    hi: 'Yeh kaun hai?',
    as: 'Eiyon kun?',
    bn: 'E ke?',
  },
  'm1-reg-intro': {
    hi: 'Namaskar. Teen Assam cheez yaad rakhte hain.',
    as: 'Namaskar. Tini ta Assamor bostu monot rakhok.',
    bn: 'Namaskar. Tin te Assamer jinish mone rekho.',
  },
  'm1-reg-1': {
    hi: 'Yeh Pitha hai. Pitha boliye.',
    as: 'Ei Pitha. Pitha kowa.',
    bn: 'E Pitha. Pitha bolo.',
  },
  'm1-reg-2': {
    hi: 'Yeh Brahmaputra nadi hai. Brahmaputra boliye.',
    as: 'Ei Brahmaputra nodi. Brahmaputra kowa.',
    bn: 'E Brahmaputra nodi. Brahmaputra bolo.',
  },
  'm1-reg-3': {
    hi: 'Yeh Bihu tyohar hai. Bihu boliye.',
    as: 'Ei Bihu. Bihu kowa.',
    bn: 'E Bihu. Bihu bolo.',
  },
  'm1-attn': {
    hi: 'Mez dekho. Ab phir dekho. Kya gayab ho gaya?',
    as: 'Tebloloi sowa. Etiya abar sowa. Ki herale?',
    bn: 'Table dekho. Abar dekho. Ki hariye gelo?',
  },
  'm1-recall-1': {
    hi: 'Kaun sa rice cake sikha tha?',
    as: 'Kun pitha xikilu?',
    bn: 'Kon rice cake shikhechile?',
  },
  'm1-recall-2': {
    hi: 'Kaun si nadi ka naam liya tha?',
    as: 'Kun nodir naam loisu?',
    bn: 'Kon nodir naam niyechile?',
  },
  'm1-recall-3': {
    hi: 'Kaun sa tyohar yaad kiya?',
    as: 'Kun utxob monot asin?',
    bn: 'Kon utshob mone ache?',
  },
  'm1-lang': {
    hi: 'Is subah ke khane ko kya kehte hain?',
    as: 'Ei sopuahar khadoxok ki koi?',
    bn: 'Ei sokaler khabarke ki bole?',
  },
  'm1-reason': {
    hi: 'Jolpan ke liye kaun sa nahi chalega?',
    as: 'Jolpanor babe kunto nuhoy?',
    bn: 'Jolpaner jonno konota noy?',
  },
  'm1-story-setup': {
    hi: 'Ab parivar ki kahani. Subah hai, ghar par.',
    as: 'Etiya poribaror kahini. Sopuah, ghorot.',
    bn: 'Ekhon poribarer golpo. Sokal, barite.',
  },
  'm1-finale': {
    hi: 'Bahut badhiya kiya aaj!',
    as: 'Aaji bohut bhal kori!',
    bn: 'Aj khub bhalo korecho!',
  },
  'e1-orient-day': {
    hi: 'Aaj kaun sa din hai?',
    as: 'Aaji ki baar?',
    bn: 'Aj ke din?',
  },
  'e1-orient-tod': {
    hi: 'Ab subah hai ya shaam?',
    as: 'Etiya sopuah ne gadholi?',
    bn: 'Ekhon sokal naki sondhya?',
  },
  'e1-finale': {
    hi: 'Aaram se soiyye. Kal milte hain.',
    as: 'Bhaldore bisram kora. Kali log pam.',
    bn: 'Bhalo kore rest korun. Kal dekha hobe.',
  },
};

function applySpokenLocale(step, langCode) {
  const pack = String(langCode || 'en').toLowerCase();
  let key = 'en';
  if (pack.startsWith('hi')) key = 'hi';
  else if (pack.startsWith('as')) key = 'as';
  else if (pack.startsWith('bn')) key = 'bn';
  else return step;

  const id = step.id || step.templateId;
  const overlay = DAY1[id]?.[key];
  if (!overlay) return step;
  return {
    ...step,
    spokenPrompt: overlay,
    promptText: step.promptText, // keep on-screen English/simple; voice in local language
  };
}

module.exports = { applySpokenLocale, DAY1 };
