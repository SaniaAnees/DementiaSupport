/**
 * Hard-coded voice languages for MindCare pilot:
 * English + Hindi + 7 NER languages (Assamese, Bengali, Manipuri, Mizo, Khasi, Nagamese, Bodo).
 * Intent phrases use Latin transliteration where native script STT is unreliable.
 */
window.VoicePhrases = {
  en: {
    start_morning: ['start morning', 'start morning session', 'morning session', 'begin morning', 'morning', 'start the morning', 'lets start', "let's start", 'begin', 'start'],
    start_evening: ['start evening', 'start evening session', 'evening session', 'begin evening', 'evening', 'start the evening'],
    repeat: ['repeat', 'say again', 'again'],
    yes: ['yes', 'yeah', 'yep', 'ok', 'okay'],
    no: ['no', 'nope'],
  },
  hi: {
    start_morning: ['subah shuru', 'subah session', 'subah shuru karo', 'morning shuru', 'start morning', 'subah', 'shuru karo', 'shuru'],
    start_evening: ['shaam shuru', 'sham shuru', 'shaam session', 'evening shuru', 'start evening', 'shaam', 'sham'],
    repeat: ['dobara', 'phir se', 'repeat', 'dobara bolo'],
    yes: ['haan', 'han', 'ji', 'yes', 'theek'],
    no: ['nahin', 'nahi', 'no'],
  },
  as: {
    start_morning: ['sopuah arambha', 'sopuahar session', 'sopuah', 'morning', 'start morning', 'arambha', 'arombho'],
    start_evening: ['gadholi arambha', 'gadholir session', 'gadholi', 'evening', 'start evening'],
    repeat: ['abar kowa', 'abar', 'repeat'],
    yes: ['hoy', 'hoi', 'yes'],
    no: ['nuhoy', 'no'],
  },
  bn: {
    start_morning: ['sokal shuru', 'sokaler session', 'sokal', 'morning', 'start morning', 'shuru'],
    start_evening: ['sondhya shuru', 'sondhyar session', 'sondhya', 'evening', 'start evening'],
    repeat: ['abar bolo', 'abar', 'repeat'],
    yes: ['hya', 'ha', 'yes'],
    no: ['na', 'no'],
  },
  mni: {
    // Manipuri / Meiteilon (Latin)
    start_morning: ['ayingba houba', 'ayingba', 'morning hou', 'start morning', 'morning', 'houba'],
    start_evening: ['numit thaba', 'numitta', 'evening hou', 'start evening', 'evening'],
    repeat: ['amuk hang', 'amuk', 'repeat'],
    yes: ['hoi', 'yes'],
    no: ['natte', 'no'],
  },
  mz: {
    // Mizo (Latin)
    start_morning: ['zing session', 'zing tan', 'start morning', 'morning', 'tan rawh'],
    start_evening: ['tlai session', 'tlai tan', 'start evening', 'evening'],
    repeat: ['sawni leh', 'repeat'],
    yes: ['aw', 'yes'],
    no: ['ay', 'no'],
  },
  kha: {
    // Khasi (Latin)
    start_morning: ['step session', 'step nang', 'start morning', 'morning'],
    start_evening: ['siong session', 'siong nang', 'start evening', 'evening'],
    repeat: ['ai biang', 'repeat'],
    yes: ['hooid', 'yes'],
    no: ['em', 'no'],
  },
  nag: {
    // Nagamese (Latin)
    start_morning: ['bihane start', 'bihane session', 'start morning', 'morning', 'start kor'],
    start_evening: ['bikhal start', 'bikhal session', 'start evening', 'evening'],
    repeat: ['phire kowa', 'repeat'],
    yes: ['hoi', 'yes'],
    no: ['nohoi', 'no'],
  },
  brx: {
    // Bodo (Latin)
    start_morning: ['phwrbw start', 'phwrbw', 'start morning', 'morning'],
    start_evening: ['bilanai start', 'bilanai', 'start evening', 'evening'],
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
      mni: 'mni-IN',
      mz: 'en-IN', // rare native TTS — English voice, Mizo phrases
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
    greeting: (name, tod) => `${tod}, ${name}`,
    todMorning: 'Suprabhat',
    todAfternoon: 'Namaste',
    todEvening: 'Shubh sandhya',
  },
  as: {
    listening: 'Xuni asu… joteyai koba',
    startingMorning: 'Sopuahar session arambha korisu',
    startingEvening: 'Gadholir session arambha korisu',
    bothDone: 'Aaji session xex. Ekhon bisram kora.',
    morningDone: 'Sopuah xex. Gadholi pise korim.',
    eveningDone: 'Gadholi xex. Kali log pam.',
    readyMorning: 'Etiya sopuahar abhyas arambha korim.',
    readyEvening: 'Etiya gadholir abhyas arambha korim.',
    sayAnything: 'Koba — moi xuni asu',
    greeting: (name, tod) => `${tod}, ${name}`,
    todMorning: 'Suprobhat',
    todAfternoon: 'Namaskar',
    todEvening: 'Subho gadhuli',
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
