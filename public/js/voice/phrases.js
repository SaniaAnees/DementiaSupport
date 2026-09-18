/**
 * Hard-coded voice languages for MindCare pilot:
 * English + Hindi + 7 NER languages (Assamese, Bengali, Manipuri, Mizo, Khasi, Nagamese, Bodo).
 * Intent phrases use Latin transliteration where native script STT is unreliable.
 */
window.VoicePhrases = {
  en: {
    start_morning: [
      'start morning', 'start morning session', 'morning session', 'begin morning',
      'morning', 'start the morning',
      'morning session shuru', 'morning session shuru karo', 'morning shuru karo',
      'courses start morning', 'course start morning',
    ],
    start_evening: [
      'start evening', 'start evening session', 'evening session', 'begin evening',
      'evening', 'start the evening', 'night session',
      'evening session shuru', 'evening session shuru karo', 'evening shuru karo',
      'courses start evening', 'course start evening', 'start evening session',
    ],
    start_generic: [
      'lets start', "let's start", 'begin', 'start',
      'start the session', 'begin session', 'start session', 'session start',
      'ready', "i'm ready", 'i am ready', 'im ready',
    ],
    repeat: [
      'repeat', 'say again', 'again', 'repeat please', 'repeat the question',
      'repeat karo', 'please repeat', 'one more time',
    ],
    yes: ['yes', 'yeah', 'yep', 'ok', 'okay', 'ready'],
    no: ['no', 'nope'],
  },
  hi: {
    start_morning: [
      'subah shuru', 'subah session', 'subah shuru karo', 'subah shuru karut',
      'morning shuru', 'morning session shuru', 'start morning',
      'subah', 'subah ka session',
      'subah ka session shuru', 'morning session shuru karo',
      'सुबह शुरू', 'सुबह का सेशन', 'सुबह', 'सुबह सेशन',
    ],
    start_evening: [
      'shaam shuru', 'sham shuru', 'shaam shuru karo', 'shaam shuru karut',
      'shaam session', 'evening shuru', 'evening session shuru', 'start evening',
      'shaam', 'sham', 'shaam ka session', 'shaam ka session shuru',
      'शाम शुरू', 'शाम का सेशन', 'शाम', 'शाम सेशन',
    ],
    start_generic: [
      'shuru karo', 'shuru karut', 'shuru', 'सेशन शुरू', 'शुरू करो',
      'ready', 'taiyar', 'main taiyar', 'tayyar', 'तैयार',
    ],
    repeat: [
      'dobara', 'phir se', 'repeat', 'dobara bolo', 'repeat karo', 'phir se bolo',
      'dobara sunao', 'ek baar aur', 'दोबारा', 'फिर से', 'रिपीट करो', 'दोबारा बोलो',
    ],
    yes: ['haan', 'han', 'ji', 'yes', 'theek', 'ready', 'हाँ', 'हां', 'जी'],
    no: ['nahin', 'nahi', 'no', 'नहीं'],
  },
  as: {
    start_morning: [
      'sopuah arambha', 'sopuahar session', 'sopuah', 'morning', 'start morning',
      'arambha', 'arombho', 'sopuah shuru', 'ৰাতিপুৱা', 'সকাল', 'আৰম্ভ',
    ],
    start_evening: [
      'gadholi arambha', 'gadholir session', 'gadholi', 'evening', 'start evening',
      'গধূলি', 'সন্ধ্যা',
    ],
    repeat: ['abar kowa', 'abar', 'repeat', 'repeat karo', 'আকৌ'],
    yes: ['hoy', 'hoi', 'yes', 'হয়'],
    no: ['nuhoy', 'no', 'নহয়'],
  },
  bn: {
    start_morning: [
      'sokal shuru', 'sokaler session', 'sokal', 'morning', 'start morning', 'shuru',
      'সকাল শুরু', 'সকাল', 'সকালের সেশন', 'শুরু করো',
    ],
    start_evening: [
      'sondhya shuru', 'sondhyar session', 'sondhya', 'evening', 'start evening',
      'সন্ধ্যা শুরু', 'সন্ধ্যা', 'সন্ধ্যার সেশন',
    ],
    repeat: ['abar bolo', 'abar', 'repeat', 'repeat karo', 'আবার'],
    yes: ['hya', 'ha', 'yes', 'হ্যাঁ'],
    no: ['na', 'no', 'না'],
  },
  mni: {
    start_morning: [
      'ayingba houba', 'ayingba', 'morning hou', 'start morning', 'morning', 'houba',
      'ayingba session',
    ],
    start_evening: [
      'numit thaba', 'numitta', 'evening hou', 'start evening', 'evening', 'numit session',
    ],
    repeat: ['amuk hang', 'amuk', 'repeat'],
    yes: ['hoi', 'yes'],
    no: ['natte', 'no'],
  },
  mz: {
    start_morning: [
      'zing session', 'zing tan', 'start morning', 'morning', 'tan rawh', 'zing',
    ],
    start_evening: ['tlai session', 'tlai tan', 'start evening', 'evening', 'tlai'],
    repeat: ['sawni leh', 'repeat'],
    yes: ['aw', 'yes'],
    no: ['ay', 'no'],
  },
  kha: {
    start_morning: ['step session', 'step nang', 'start morning', 'morning', 'step'],
    start_evening: ['siong session', 'siong nang', 'start evening', 'evening', 'siong'],
    repeat: ['ai biang', 'repeat'],
    yes: ['hooid', 'yes'],
    no: ['em', 'no'],
  },
  nag: {
    start_morning: [
      'bihane start', 'bihane session', 'start morning', 'morning', 'start kor', 'bihane',
    ],
    start_evening: [
      'bikhal start', 'bikhal session', 'start evening', 'evening', 'bikhal',
    ],
    repeat: ['phire kowa', 'repeat'],
    yes: ['hoi', 'yes'],
    no: ['nohoi', 'no'],
  },
  brx: {
    start_morning: ['phwrbw start', 'phwrbw', 'start morning', 'morning', 'phwrbw session'],
    start_evening: ['bilanai start', 'bilanai', 'start evening', 'evening', 'bilanai session'],
    repeat: ['phirnanwi', 'repeat'],
    yes: ['ou', 'yes'],
    no: ['nonga', 'no'],
  },

  /** BCP-47 / app codes → pack key */
  resolvePack(lang) {
    const l = String(lang || 'en').toLowerCase();
    if (l.startsWith('hi') || l.includes('hindi')) return 'hi';
    if (l.startsWith('as') || l.includes('assamese')) return 'as';
    if (l.startsWith('bn') || l.includes('bengali')) return 'bn';
    if (l.startsWith('mni') || l.includes('manipuri') || l.includes('meitei')) return 'mni';
    if (l.startsWith('mz') || l.includes('mizo') || l.includes('lus')) return 'mz';
    if (l.startsWith('kha') || l.includes('khasi')) return 'kha';
    if (l.startsWith('nag') || l.includes('nagamese')) return 'nag';
    if (l.startsWith('brx') || l.includes('bodo')) return 'brx';
    if (l.startsWith('en') || l.includes('english')) return 'en';
    return 'en';
  },

  /** Best Web Speech / TTS BCP-47 tag (device may fall back) */
  speechTag(lang) {
    const pack = this.resolvePack(lang);
    const map = {
      en: 'en-IN',
      hi: 'hi-IN',
      as: 'as-IN',
      bn: 'bn-IN',
      mni: 'en-IN', // rare native TTS — Indian English voice
      mz: 'en-IN',
      kha: 'en-IN',
      nag: 'en-IN',
      brx: 'hi-IN',
    };
    return map[pack] || 'en-IN';
  },

  listForUi() {
    return [
      { code: 'en-IN', label: 'English', pack: 'en' },
      { code: 'hi-IN', label: 'Hindi', pack: 'hi' },
      { code: 'as-IN', label: 'Assamese', pack: 'as' },
      { code: 'bn-IN', label: 'Bengali', pack: 'bn' },
      { code: 'mni-IN', label: 'Manipuri (Meitei)', pack: 'mni' },
      { code: 'mz-IN', label: 'Mizo', pack: 'mz' },
      { code: 'kha-IN', label: 'Khasi', pack: 'kha' },
      { code: 'nag-IN', label: 'Nagamese', pack: 'nag' },
      { code: 'brx-IN', label: 'Bodo', pack: 'brx' },
    ];
  },
};

/** Patient-facing UI / greeting copy by pack */
window.PatientLocales = {
  en: {
    listening: 'Listening… speak anytime',
    startingMorning: 'Starting your morning session',
    startingEvening: 'Starting your evening session',
    bothDone: 'You finished today’s sessions. Rest well.',
    morningDone: 'Morning is done. We will do evening later.',
    eveningDone: 'Evening is done. See you tomorrow.',
    readyMorning: 'We will begin your morning practice now.',
    readyEvening: 'We will begin your evening practice now.',
    sayAnything: 'Just speak — I am listening',
    voiceNudge: 'Say morning session, or evening session.',
    greeting: (name, tod) => `${tod}, ${name}`,
    todMorning: 'Good morning',
    todAfternoon: 'Good afternoon',
    todEvening: 'Good evening',
  },
  hi: {
    listening: 'Sun raha hoon… kabhi bhi boliye',
    startingMorning: 'Subah ka session shuru kar rahe hain',
    startingEvening: 'Shaam ka session shuru kar rahe hain',
    bothDone: 'Aaj ke session poore ho gaye. Aaram kijiye.',
    morningDone: 'Subah ho gayi. Shaam baad mein karenge.',
    eveningDone: 'Shaam ho gayi. Kal milte hain.',
    readyMorning: 'Ab subah ka abhyas shuru karte hain.',
    readyEvening: 'Ab shaam ka abhyas shuru karte hain.',
    sayAnything: 'Bas boliye — main sun raha hoon',
    voiceNudge: 'Subah session shuru karo, ya shaam session boliye.',
    greeting: (name, tod) => `${tod}, ${name}`,
    todMorning: 'Suprabhat',
    todAfternoon: 'Namaste',
    todEvening: 'Shubh sandhya',
  },
  as: {
    listening: 'Sun raha hoon… kabhi bhi boliye',
    startingMorning: 'Subah ka session shuru kar rahe hain',
    startingEvening: 'Shaam ka session shuru kar rahe hain',
    bothDone: 'Aaj ke session poore ho gaye. Aaram kijiye.',
    morningDone: 'Subah ho gayi. Shaam baad mein karenge.',
    eveningDone: 'Shaam ho gayi. Kal milte hain.',
    readyMorning: 'Ab subah ka abhyas shuru karte hain.',
    readyEvening: 'Ab shaam ka abhyas shuru karte hain.',
    sayAnything: 'Bas boliye — main sun raha hoon',
    voiceNudge: 'Subah session shuru karo, ya shaam session boliye.',
    greeting: (name, tod) => `${tod}, ${name}`,
    todMorning: 'Namaskar',
    todAfternoon: 'Namaskar',
    todEvening: 'Namaskar',
  },
  bn: {
    listening: 'Shunchi… jokhon icche bolun',
    startingMorning: 'Sokaler session shuru korchi',
    startingEvening: 'Sondhyar session shuru korchi',
    bothDone: 'Aajker session shesh. Ektu rest korun.',
    morningDone: 'Sokal shesh. Sondhya pore korbo.',
    eveningDone: 'Sondhya shesh. Kal dekha hobe.',
    readyMorning: 'Ekhon sokaler abhyas shuru korbo.',
    readyEvening: 'Ekhon sondhyar abhyas shuru korbo.',
    sayAnything: 'Shudhu bolun — ami shunchi',
    voiceNudge: 'Sokal session shuru korun, ba sondhya session bolun.',
    greeting: (name, tod) => `${tod}, ${name}`,
    todMorning: 'Suprobhat',
    todAfternoon: 'Namaskar',
    todEvening: 'Shubho sundhya',
  },
  mni: {
    listening: 'Tadare… hairadi',
    startingMorning: 'Ayingba session houjare',
    startingEvening: 'Numit session houjare',
    bothDone: 'Ngasi session loire. Thadok-u.',
    morningDone: 'Ayingba loire. Numit matamda.',
    eveningDone: 'Numit loire. Hayeng u-si.',
    readyMorning: 'Ayingba practice hou-si.',
    readyEvening: 'Numit practice hou-si.',
    sayAnything: 'Hai-o — ei tarammi',
    greeting: (name, tod) => `${tod}, ${name}`,
    todMorning: 'Good morning',
    todAfternoon: 'Khurumjari',
    todEvening: 'Good evening',
  },
  mz: {
    listening: 'Ka ngaithla… saw rawh',
    startingMorning: 'Zing session kan tan dawn',
    startingEvening: 'Tlai session kan tan dawn',
    bothDone: 'Vawiin session a zo tawh. Chawl rawh.',
    morningDone: 'Zing a zo. Tlai zelah.',
    eveningDone: 'Tlai a zo. Naktukah.',
    readyMorning: 'Zing practice kan tan dawn.',
    readyEvening: 'Tlai practice kan tan dawn.',
    sayAnything: 'Saw rawh — ka ngaithla',
    greeting: (name, tod) => `${tod}, ${name}`,
    todMorning: 'Chibai',
    todAfternoon: 'Chibai',
    todEvening: 'Chibai',
  },
  kha: {
    listening: 'Nga sngap… kren noh',
    startingMorning: 'Step session nang sdang',
    startingEvening: 'Siong session nang sdang',
    bothDone: 'Session mynta la dep. Thoh noh.',
    morningDone: 'Step la dep. Siong hadien.',
    eveningDone: 'Siong la dep. Lashai.',
    readyMorning: 'Ngin sdang step practice.',
    readyEvening: 'Ngin sdang siong practice.',
    sayAnything: 'Kren noh — nga sngap',
    greeting: (name, tod) => `${tod}, ${name}`,
    todMorning: 'Khublei',
    todAfternoon: 'Khublei',
    todEvening: 'Khublei',
  },
  nag: {
    listening: 'Suni ase… kobiye',
    startingMorning: 'Bihane session start korise',
    startingEvening: 'Bikhal session start korise',
    bothDone: 'Aaji session khatam. Rest kora.',
    morningDone: 'Bihane khatam. Bikhal pore.',
    eveningDone: 'Bikhal khatam. Kailai milibo.',
    readyMorning: 'Etiya bihane practice start.',
    readyEvening: 'Etiya bikhal practice start.',
    sayAnything: 'Kobiye — moi suni ase',
    greeting: (name, tod) => `${tod}, ${name}`,
    todMorning: 'Good morning',
    todAfternoon: 'Namaskar',
    todEvening: 'Good evening',
  },
  brx: {
    listening: 'Khannayw… sung',
    startingMorning: 'Phwrbw session jao',
    startingEvening: 'Bilanai session jao',
    bothDone: 'Dinwi session jabai. Thadung.',
    morningDone: 'Phwrbw jabai. Bilanai ungkha.',
    eveningDone: 'Bilanai jabai. Gabwn.',
    readyMorning: 'Da phwrbw practice jao.',
    readyEvening: 'Da bilanai practice jao.',
    sayAnything: 'Sung — ang khannayw',
    greeting: (name, tod) => `${tod}, ${name}`,
    todMorning: 'Gwjwn fungani',
    todAfternoon: 'Gwjwn',
    todEvening: 'Gwjwn belase',
  },

  forLang(lang) {
    const pack = VoicePhrases.resolvePack(lang);
    return this[pack] || this.en;
  },
};
