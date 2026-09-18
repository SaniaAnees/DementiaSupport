/**
 * Client session i18n — mirrors server overlays; adapts mid-session to spoken language.
 */
window.SessionI18n = {
  /** Detect language — Hindi wins easily; Assamese only on strong cues */
  detectFromSpeech(transcript) {
    const t = String(transcript || '').trim();
    if (!t) return null;

    if (/[\u0900-\u097F]/.test(t)) return 'hi-IN';
    if (/[ৰৱ]/.test(t)) return 'as-IN';
    if (/[\u0980-\u09FF]/.test(t)) return 'bn-IN';

    const low = t.toLowerCase();

    // Hindi / Hinglish — broad, intentional (user speaks Hindi)
    if (
      /\b(hindi|subah|shaam|shukr|shukravar|shukriya|namaste|namaskar|kya|kaun|kahan|hai|hain|haan|nahi|nahin|karo|bolo|dobara|phir|sahi|theek|aaj|mein|aap|yeh|woh|chaliye|aage|samajh|boliye|dhanyavad|shukriya|kitna|kab|kaise|accha|achha|bilkul|zaroor|ji)\b/.test(
        low
      ) ||
      /शुक्र|सुबह|शाम|नमस्ते|क्या|कौन/.test(t)
    ) {
      return 'hi-IN';
    }

    // Assamese — only distinctive forms (not "hoy" alone)
    if (
      /\b(aaji|aapuni|xuni|xikilu|sopuah|gadholi|nuhoy|monot|tebul|herale|aahok|aagot|utxob|xukurbar|xex|bhaldore)\b/.test(
        low
      )
    ) {
      return 'as-IN';
    }

    if (/\b(apni|kotha|sokal|sondhya|hariye)\b/.test(low)) return 'bn-IN';

    return null;
  },

  /** Once Hindi is heard this session, never flip to Assamese */
  lockLang(code) {
    if (!code || !window.app) return;
    window.app.sessionSpeakLang = code;
    if (String(code).toLowerCase().startsWith('hi')) {
      window.app.sessionSpeakLangLocked = 'hi-IN';
    }
  },

  interactiveLang(fallback) {
    if (window.app?.sessionSpeakLangLocked) return window.app.sessionSpeakLangLocked;
    if (window.app?.sessionSpeakLang) return window.app.sessionSpeakLang;
    return fallback || 'en-IN';
  },

  packKey(lang) {
    const l = String(lang || 'en').toLowerCase();
    if (l.startsWith('hi')) return 'hi';
    if (l.startsWith('as')) return 'as';
    if (l.startsWith('bn')) return 'bn';
    return 'en';
  },

  weekdaySpoken(englishDay, lang) {
    const map = {
      en: {
        Sunday: 'Sunday',
        Monday: 'Monday',
        Tuesday: 'Tuesday',
        Wednesday: 'Wednesday',
        Thursday: 'Thursday',
        Friday: 'Friday',
        Saturday: 'Saturday',
      },
      hi: {
        Sunday: 'Ravivar',
        Monday: 'Somvar',
        Tuesday: 'Mangalvar',
        Wednesday: 'Budhvar',
        Thursday: 'Guruvar',
        Friday: 'Shukravar',
        Saturday: 'Shanivar',
      },
      as: {
        Sunday: 'Robibar',
        Monday: 'Sombar',
        Tuesday: 'Mongolbar',
        Wednesday: 'Budhbar',
        Thursday: 'Brihospotibar',
        Friday: 'Xukurbar',
        Saturday: 'Xonibar',
      },
      bn: {
        Sunday: 'Robibar',
        Monday: 'Sombar',
        Tuesday: 'Mangalbar',
        Wednesday: 'Budhbar',
        Thursday: 'Brihospotibar',
        Friday: 'Shukrobar',
        Saturday: 'Shonibar',
      },
    };
    const pack = this.packKey(lang);
    return map[pack]?.[englishDay] || map.en[englishDay] || englishDay;
  },

  fillHint(template, item, lang) {
    if (!template) return '';
    const pool = [...(item.expectedAnswers || []), ...(item.chipOptions || [])];
    let weekdayEn = '';
    for (const a of pool) {
      const m = String(a).match(/^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/i);
      if (m) {
        weekdayEn = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
        break;
      }
    }
    // Server may have already filled "Today is Friday."
    let tpl = String(template);
    if (!/\{\{weekday\}\}/.test(tpl) && /today is\s+\w+/i.test(tpl) && weekdayEn) {
      const pack = this.packKey(lang);
      if (pack === 'hi') tpl = 'Aaj {{weekday}} hai.';
      else if (pack === 'as') tpl = 'Aaji {{weekday}}.';
      else if (pack === 'bn') tpl = 'Aj {{weekday}}.';
    }
    const spokenDay = weekdayEn ? this.weekdaySpoken(weekdayEn, lang) : '';
    return tpl
      .replace(/\{\{weekday\}\}/g, spokenDay || weekdayEn || '')
      .replace(/\{\{hometown\}\}/g, window.app?.currentPatient?.hometown || 'home')
      .replace(/\{\{family0\}\}/g, '')
      .replace(/\{\{family0\.label\}\}/g, '');
  },

  /** Same overlays as server (subset kept in sync) */
  overlays: null, // filled below

  localizeItem(item, lang) {
    if (!item) return item;
    const pack = this.packKey(lang);
    const id = item.templateId || item.curriculumStepId || item.id;
    const row = this.overlays?.[id]?.[pack] || this.overlays?.[id]?.en;
    if (!row) {
      if (pack === 'en' && this.overlays?.[id]?.en) {
        const en = this.overlays[id].en;
        return {
          ...item,
          continueLabel: en.continue || item.continueLabel,
          continueKicker: en.kicker || item.continueKicker,
          hintText: en.hint
            ? this.fillHint(en.hint, item, lang)
            : item.hintText,
        };
      }
      return item;
    }
    const hintRaw = row.hint || item.hintText;
    return {
      ...item,
      spokenPrompt: row.spoken || item.spokenPrompt,
      promptText: row.prompt || item.promptText,
      continueLabel: row.continue || item.continueLabel,
      continueKicker: row.kicker || item.continueKicker,
      hintText: hintRaw ? this.fillHint(hintRaw, item, lang) : item.hintText,
      lookLabel: row.look || item.lookLabel,
      againLabel: row.again || item.againLabel,
    };
  },

  speechTag(lang) {
    const pack = this.packKey(lang);
    return { hi: 'hi-IN', as: 'as-IN', bn: 'bn-IN', en: 'en-IN' }[pack] || 'en-IN';
  },
};

// Keep overlay table identical in spirit to server/curriculum/i18n/spoken.js
window.SessionI18n.overlays = {
  'm1-orient-day': {
    hi: {
      spoken: 'Suprabhat. Aaj kaun sa din hai?',
      prompt: 'Aaj kaun sa din hai?',
      hint: 'Aaj {{weekday}} hai.',
    },
    as: {
      spoken: 'Suprobhat. Aaji ki baar?',
      prompt: 'Aaji ki baar?',
      hint: 'Aaji {{weekday}}.',
    },
    bn: {
      spoken: 'Suprobhat. Aj ke din?',
      prompt: 'Aj ke din?',
      hint: 'Aj {{weekday}}.',
    },
    en: { hint: 'Today is {{weekday}}.' },
  },
  'm1-orient-place': {
    hi: {
      spoken: 'Aap kahan se hain?',
      prompt: 'Aap kahan se hain?',
      hint: 'Aap {{hometown}} se hain.',
    },
    as: {
      spoken: 'Aapuni koi pora?',
      prompt: 'Aapuni koi pora?',
      hint: 'Aapuni {{hometown}} pora.',
    },
    bn: {
      spoken: 'Apni kotha theke?',
      prompt: 'Apni kotha theke?',
      hint: 'Apni {{hometown}} theke.',
    },
    en: { hint: 'You are from {{hometown}}.' },
  },
  'm1-orient-person': {
    hi: {
      spoken: 'Is photo ko dekhiye. Yeh kaun hai?',
      prompt: 'Yeh kaun hai?',
      hint: 'Yeh {{family0}} hain.',
    },
    as: {
      spoken: 'Ei photo soa. Eiyon kun?',
      prompt: 'Eiyon kun?',
      hint: 'Eiyon {{family0}}.',
    },
    bn: {
      spoken: 'Ei photo dekho. E ke?',
      prompt: 'E ke?',
      hint: 'E {{family0}}.',
    },
    en: { hint: 'This is {{family0}}.' },
  },
  'm1-reg-intro': {
    hi: {
      spoken: 'Namaskar. Mann se chalte hain. Teen Assam cheezein yaad rakhte hain. Taiyar?',
      prompt: 'Teen Assam khazane yaad rakhte hain.',
      continue: 'Chaliye',
      kicker: 'Assam yaatra',
    },
    as: {
      spoken: 'Namaskar. Monere jao. Tini ta Assamor bostu monot rakhok. Ready?',
      prompt: 'Tini ta Assamor bostu monot rakhok.',
      continue: 'Aahok',
      kicker: 'Assamor path',
    },
    bn: {
      spoken: 'Namaskar. Mone mone choli. Tin te Assamer jinish mone rekho. Ready?',
      prompt: 'Tin te Assamer khazana mone rekho.',
      continue: 'Cholo',
      kicker: 'Assam path',
    },
    en: { continue: 'Begin the walk', kicker: 'Assam morning' },
  },
  'm1-reg-1': {
    hi: { spoken: 'Yeh Pitha hai. Pitha boliye.', prompt: 'Yeh Pitha hai.', continue: 'Aage', kicker: 'Pehla khazana' },
    as: { spoken: 'Ei Pitha. Pitha kowa.', prompt: 'Ei Pitha.', continue: 'Aagot', kicker: 'Prothom bostu' },
    bn: { spoken: 'E Pitha. Pitha bolo.', prompt: 'E Pitha.', continue: 'Age', kicker: 'Prothom' },
    en: { continue: 'Continue', kicker: 'First treasure' },
  },
  'm1-reg-2': {
    hi: { spoken: 'Yeh Brahmaputra nadi hai. Brahmaputra boliye.', prompt: 'Yeh Brahmaputra nadi hai.', continue: 'Aage', kicker: 'Doosra khazana' },
    as: { spoken: 'Ei Brahmaputra nodi. Brahmaputra kowa.', prompt: 'Ei Brahmaputra nodi.', continue: 'Aagot', kicker: 'Duitiye bostu' },
    bn: { spoken: 'E Brahmaputra nodi. Brahmaputra bolo.', prompt: 'E Brahmaputra nodi.', continue: 'Age', kicker: 'Ditiyo' },
    en: { continue: 'Continue', kicker: 'Second treasure' },
  },
  'm1-reg-3': {
    hi: { spoken: 'Yeh Bihu tyohar hai. Bihu boliye.', prompt: 'Yeh Bihu tyohar hai.', continue: 'Aage', kicker: 'Teesra khazana' },
    as: { spoken: 'Ei Bihu. Bihu kowa.', prompt: 'Ei Bihu.', continue: 'Aagot', kicker: 'Tritiye bostu' },
    bn: { spoken: 'E Bihu. Bihu bolo.', prompt: 'E Bihu.', continue: 'Age', kicker: 'Tritiyo' },
    en: { continue: 'Continue', kicker: 'Third treasure' },
  },
  'm1-attn': {
    hi: {
      spoken: 'Nashta ki mez dekho dheere. Ab phir dekho. Kya gayab ho gaya?',
      prompt: 'Mez se kya gayab ho gaya?',
      look: 'Is mez ko yaad rakhiye',
      again: 'Ab phir dekhiye',
    },
    as: {
      spoken: 'Jolpanor tebuloloi soowa. Etiya abar soowa. Ki herale?',
      prompt: 'Tebulor pora ki herale?',
      look: 'Ei tebul monot rakhok',
      again: 'Etiya abar soowa',
    },
    bn: {
      spoken: 'Nashtar table dekho. Abar dekho. Ki hariye gelo?',
      prompt: 'Table theke ki hariye gelo?',
      look: 'Ei table mone rekho',
      again: 'Abar dekho',
    },
  },
  'm1-recall-1': {
    hi: { spoken: 'Humne kaun sa rice cake seekha tha?', prompt: 'Kaun sa rice cake seekha tha?' },
    as: { spoken: 'Ami kun pitha xikilu?', prompt: 'Kun pitha xikilu?' },
    bn: { spoken: 'Amra kon rice cake shikhechi?', prompt: 'Kon rice cake shikhechile?' },
  },
  'm1-recall-2': {
    hi: { spoken: 'Kaun si nadi ka naam liya tha?', prompt: 'Kaun si nadi?' },
    as: { spoken: 'Kun nodir naam loisu?', prompt: 'Kun nodi?' },
    bn: { spoken: 'Kon nodir naam niyechile?', prompt: 'Kon nodi?' },
  },
  'm1-recall-3': {
    hi: { spoken: 'Kaun sa tyohar yaad kiya?', prompt: 'Kaun sa tyohar?' },
    as: { spoken: 'Kun utxob monot asin?', prompt: 'Kun utxob?' },
    bn: { spoken: 'Kon utshob mone ache?', prompt: 'Kon utshob?' },
  },
  'm1-lang': {
    hi: { spoken: 'Is Assamese subah ke khane ko kya kehte hain?', prompt: 'Is subah ke khane ko kya kehte hain?' },
    as: { spoken: 'Ei Assomor sopuahar khadoxok ki koi?', prompt: 'Ei khadoxok ki koi?' },
    bn: { spoken: 'Ei Assamer sokaler khabarke ki bole?', prompt: 'Ei khabarke ki bole?' },
  },
  'm1-reason': {
    hi: { spoken: 'Jolpan ke liye kaun sa nahi chalega?', prompt: 'Jolpan ke liye kaun sa nahi?' },
    as: { spoken: 'Jolpanor babe kunto nuhoy?', prompt: 'Jolpanor babe kunto nuhoy?' },
    bn: { spoken: 'Jolpaner jonno konota noy?', prompt: 'Jolpaner jonno konota noy?' },
  },
  'm1-story-setup': {
    hi: {
      spoken: 'Ab parivar ki kahani. Subah hai. Ghar par Assam mein. Shuru karein?',
      prompt: 'Parivar ki kahani — subah ka jolpan',
      continue: 'Kahani shuru',
      kicker: 'Family story',
    },
    as: {
      spoken: 'Etiya poribaror kahini. Sopuah. Assomor ghorot. Arambha korim?',
      prompt: 'Poribaror kahini — sopuahar jolpan',
      continue: 'Kahini arambha',
      kicker: 'Poribaror kahini',
    },
    bn: {
      spoken: 'Ekhon poribarer golpo. Sokal. Assamer barite. Shuru?',
      prompt: 'Poribarer golpo — sokaler jolpan',
      continue: 'Golpo shuru',
      kicker: 'Family story',
    },
    en: { continue: 'Enter the story', kicker: 'Family morning' },
  },
  'm1-story-orient': {
    hi: { spoken: 'Hamari kahani mein — subah hai ya shaam?', prompt: 'Subah hai ya shaam?' },
    as: { spoken: 'Amar kahinit — sopuah ne gadholi?', prompt: 'Sopuah ne gadholi?' },
    bn: { spoken: 'Amader golpe — sokal naki sondhya?', prompt: 'Sokal naki sondhya?' },
  },
  'm1-story-who': {
    hi: { spoken: 'Jolpan kisne banaya?', prompt: 'Jolpan kisne banaya?' },
    as: { spoken: 'Jolpan kie banale?', prompt: 'Jolpan kie banale?' },
    bn: { spoken: 'Jolpan ke banalo?', prompt: 'Jolpan ke banalo?' },
  },
  'm1-story-mem': {
    hi: { spoken: 'Bazaar kaun gaya?', prompt: 'Bazaar kaun gaya?' },
    as: { spoken: 'Bazaroloi kun golo?', prompt: 'Bazaroloi kun golo?' },
    bn: { spoken: 'Bazare ke gelo?', prompt: 'Bazare ke gelo?' },
  },
  'm1-story-attn': {
    hi: { spoken: 'Mez dekho dheere. Ab phir dekho. Kya badla?', prompt: 'Mez par kya badla?', look: 'Mez yaad rakhiye', again: 'Ab phir dekhiye' },
    as: { spoken: 'Tebul soowa. Abar soowa. Ki solile?', prompt: 'Ki solile?', look: 'Tebul monot rakhok', again: 'Abar soowa' },
    bn: { spoken: 'Table dekho. Abar dekho. Ki badleche?', prompt: 'Ki badleche?', look: 'Table mone rekho', again: 'Abar dekho' },
  },
  'm1-story-lang': {
    hi: { spoken: 'Mez par kaun sa rice cake hai?', prompt: 'Kaun sa rice cake hai?' },
    as: { spoken: 'Tebulot kun pitha ase?', prompt: 'Kun pitha ase?' },
    bn: { spoken: 'Table e kon rice cake ache?', prompt: 'Kon rice cake ache?' },
  },
  'm1-story-reason': {
    hi: { spoken: 'Jolpan mez par kaun sa nahi chalega?', prompt: 'Kaun sa nahi chalega?' },
    as: { spoken: 'Jolpan tebulot kunto nuhoy?', prompt: 'Kunto nuhoy?' },
    bn: { spoken: 'Jolpan table e konota noy?', prompt: 'Konota noy?' },
  },
  'm1-finale': {
    hi: {
      spoken: 'Aaj bahut badhiya kiya! Shaam milte hain.',
      prompt: 'Aaj bahut badhiya!',
      continue: 'Poora hua',
      kicker: 'Subah khatam',
    },
    as: {
      spoken: 'Aaji bohut bhal kori! Gadholi log pam.',
      prompt: 'Aaji bohut bhal!',
      continue: 'Xex',
      kicker: 'Sopuah xex',
    },
    bn: {
      spoken: 'Aj khub bhalo korecho! Sondhya dekha hobe.',
      prompt: 'Aj khub bhalo!',
      continue: 'Shesh',
      kicker: 'Sokal shesh',
    },
    en: { continue: 'Finish gently', kicker: 'Morning complete' },
  },
  'e1-reg-intro': {
    hi: {
      spoken: 'Subah teen Assam cheezein seekhi thin. Dheere se phir dekhein.',
      prompt: 'Subah ke teen khazane — phir se',
      continue: 'Dikhaiye',
      kicker: 'Shaam ki yaad',
    },
    as: {
      spoken: 'Sopuaha tini ta Assamor bostu xikisu. Dhireke abar soowa.',
      prompt: 'Sopuaha xikilu — abar',
      continue: 'Dekhuwa',
      kicker: 'Gadholir monot',
    },
    bn: {
      spoken: 'Sokale tin te Assamer jinish shikhechile. Abar dekhi.',
      prompt: 'Sokaler tin khazana — abar',
      continue: 'Dekhao',
      kicker: 'Sondhyar smriti',
    },
    en: { continue: 'Show me again', kicker: 'Evening recall' },
  },
  'e1-story-setup': {
    hi: {
      spoken: 'Shaam ki kahani. Assam chai. Shuru karein?',
      prompt: 'Parivar — shaam ki chai',
      continue: 'Kahani shuru',
      kicker: 'Family story',
    },
    as: {
      spoken: 'Gadholir kahini. Assomor sah. Arambha?',
      prompt: 'Poribar — gadholir sah',
      continue: 'Kahini arambha',
      kicker: 'Poribaror kahini',
    },
    bn: {
      spoken: 'Sondhyar golpo. Assamer cha. Shuru?',
      prompt: 'Poribar — sondhyar cha',
      continue: 'Golpo shuru',
      kicker: 'Family story',
    },
    en: { continue: 'Enter the story', kicker: 'Evening together' },
  },
  'e1-finale': {
    hi: {
      spoken: 'Aaram se soiyye. Kal milte hain.',
      prompt: 'Shubh ratri',
      continue: 'Ratri shubh',
      kicker: 'Shaam poori',
    },
    as: {
      spoken: 'Bhaldore bisram kora. Kali log pam.',
      prompt: 'Subho rati',
      continue: 'Rati bhal',
      kicker: 'Gadholi xex',
    },
    bn: {
      spoken: 'Bhalo kore rest korun. Kal dekha hobe.',
      prompt: 'Shubho ratri',
      continue: 'Ratri shubho',
      kicker: 'Sondhya shesh',
    },
    en: { continue: 'Good night', kicker: 'Rest well' },
  },
};
