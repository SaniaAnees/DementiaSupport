// Session player — voice-first cognitive modules + Family Story
const SessionPlay = {
  session: null,
  items: [],
  currentIndex: 0,
  responses: [],
  itemStartTime: null,
  listening: false,
  hintsUsedThisItem: 0,
  attentionPhase: null,
  /** Follows patient speech mid-session (hi/as/bn/en) — not locked to hometown */
  activeLang: 'en-IN',

  start(session, items) {
    this.session = session;
    this.items = items;
    this.sessionMeta = session?.curriculum || session?.meta || {};
    this.regionCode =
      this.sessionMeta.regionCode ||
      items?.[0]?.regionCode ||
      items?.[0]?.packCode ||
      null;
    if (this.regionCode && !this.sessionMeta.imageBase) {
      this.sessionMeta.imageBase = `/assets/curriculum/${this.regionCode}`;
    }
    this.currentIndex = 0;
    this.responses = [];
    this.itemStartTime = Date.now();
    this.hintsUsedThisItem = 0;
    this.attentionPhase = null;
    this._seqPicked = [];
    this._seqShuffleKey = null;
    this._quizListenActive = false;
    this._continueListenActive = false;
    this.listening = false;
    this._unclearCount = 0;
    // Voice language = what they speak, NOT Assam content pack
    this.activeLang =
      (typeof SessionI18n !== 'undefined' && SessionI18n.interactiveLang()) ||
      window.app?.sessionSpeakLangLocked ||
      window.app?.sessionSpeakLang ||
      window.app?.currentPatient?.language_code ||
      window.app?.currentPatient?.languageCode ||
      'en-IN';
    try {
      PatientHome?.teardown?.();
      VoiceLayer?.stop?.();
    } catch (_) {}
    document.getElementById('main-app')?.classList.add('is-session-active');
    VoiceLayer?.ensureVoices?.();
    VoiceLayer?.warmMic?.().catch(() => {});
    this.render();
  },

  leaveSessionChrome() {
    document.getElementById('main-app')?.classList.remove('is-session-active');
  },

  /** Lock to Hindi (or other) from speech — never bounce Hindi → Assamese */
  adoptSpeechLang(transcript) {
    if (typeof SessionI18n === 'undefined') return this.activeLang;
    if (VoiceLayer?.isLikelyEcho?.(transcript)) return this.activeLang;

    if (window.app?.sessionSpeakLangLocked) {
      this.activeLang = window.app.sessionSpeakLangLocked;
      return this.activeLang;
    }

    const detected = SessionI18n.detectFromSpeech(transcript);
    if (detected) {
      SessionI18n.lockLang(detected);
      this.activeLang = detected;
    }
    return this.activeLang;
  },

  patientLang() {
    if (typeof SessionI18n !== 'undefined') {
      return SessionI18n.interactiveLang(
        this.activeLang ||
          window.app?.currentPatient?.language_code ||
          window.app?.currentPatient?.languageCode ||
          'en-IN'
      );
    }
    return (
      window.app?.sessionSpeakLangLocked ||
      window.app?.sessionSpeakLang ||
      this.activeLang ||
      'en-IN'
    );
  },

  localizedItem(raw) {
    if (!raw) return raw;
    let item =
      typeof SessionI18n !== 'undefined'
        ? SessionI18n.localizeItem(raw, this.patientLang())
        : { ...raw };
    // Always fill leftover {{preferredName}} / family tokens from live patient
    const fill = (s) => this.personalizeTheme(s);
    return {
      ...item,
      promptText: fill(item.promptText),
      spokenPrompt: fill(item.spokenPrompt),
      hintText: fill(item.hintText),
      continueLabel: fill(item.continueLabel),
      continueKicker: fill(item.continueKicker),
      caption: fill(item.caption),
    };
  },

  patientDisplayName() {
    const p = window.app?.currentPatient || {};
    return (
      p.preferredName ||
      p.preferred_name ||
      (p.fullName || p.full_name || '').split(/\s+/)[0] ||
      'friend'
    );
  },

  personalizeTheme(text) {
    if (!text) return '';
    const name = this.patientDisplayName();
    const fam0 =
      this.items?.find((i) => i.media?.kind === 'family' && (i.media.index || 0) === 0)
        ?.media?.caption ||
      this.items?.find((i) => i.answerFrom === 'family0')?.expectedAnswers?.[0] ||
      'your family';
    const fam1 =
      this.items?.find((i) => i.media?.kind === 'family' && i.media.index === 1)?.media
        ?.caption ||
      this.items?.find((i) => i.answerFrom === 'family1')?.expectedAnswers?.[0] ||
      'your family';
    return String(text)
      .replace(/\{\{\s*preferredName\s*\}\}/gi, name)
      .replace(/\{\{\s*preferred_name\s*\}\}/gi, name)
      .replace(/\{\{\s*name\s*\}\}/gi, name)
      .replace(/\{\{\s*family0\.label\s*\}\}/gi, fam0)
      .replace(/\{\{\s*family1\.label\s*\}\}/gi, fam1)
      .replace(/\{\{\s*family0\s*\}\}/gi, fam0)
      .replace(/\{\{\s*family1\s*\}\}/gi, fam1);
  },

  currentItem() {
    return this.items[this.currentIndex];
  },

  isContinueType(item) {
    return item.itemType === 'story_beat' || item.itemType === 'registration_teach' || item.itemType === 'memory_teach';
  },

  isQuizType(item) {
    return [
      'orientation', 'memory_quiz', 'recall', 'language', 'reasoning',
      'story_quiz', 'attention_change',
      'rhythm_count', 'pattern_match', 'emotion_quiz', 'sequence_order',
    ].includes(item.itemType);
  },

  async render() {
    const content = document.getElementById('session-container');
    if (!content) return;

    const raw = this.currentItem();
    if (!raw) {
      this.complete();
      return;
    }
    const item = this.localizedItem(raw);

    const progress = ((this.currentIndex + 1) / this.items.length) * 100;
    const domain = item.domain ? `<div class="session-domain">${this.domainLabel(item.domain)}</div>` : '';

    let ui;
    if (item.itemType === 'attention_change') {
      ui = this.renderAttention(item);
    } else if (item.itemType === 'sequence_order') {
      ui = this.renderSequence(item);
    } else if (this.isContinueType(item)) {
      ui = this.renderContinue(item);
    } else {
      ui = this.renderQuiz(item);
    }

    content.innerHTML = `
      <div class="patient-mode session-active">
        <div class="progress-bar"><div class="progress-fill" style="width: ${progress}%"></div></div>
        ${domain}
        ${ui}
        <div class="session-controls" role="group" aria-label="Voice controls">
          <button class="ctrl-orb repeat" type="button" onclick="SessionPlay.repeatPrompt()" aria-label="Repeat">
            <span class="ctrl-orb-ring" aria-hidden="true"></span>
            <span class="ctrl-orb-label">Repeat</span>
          </button>
        </div>
        <p class="session-listen-hint" id="session-listen-hint" aria-live="polite"></p>
      </div>
    `;

    this.afterRenderVoice(item);
  },

  startListeningManual() {
    const lang = this.patientLang();
    this._quizListenActive = false;
    this._continueListenActive = false;
    try {
      VoiceLayer?.stopSpeaking?.();
      VoiceLayer?.stopListening?.();
    } catch (_) {}
    this.listening = false;
    const hint = document.getElementById('session-listen-hint');
    if (hint) hint.textContent = 'Listening… speak anytime';
    const item = this.currentItem();
    if (item && this.isContinueType(item)) {
      this.listenForContinueLoop(lang);
      return;
    }
    this.startQuizListenLoop(lang);
  },

  afterRenderVoice(item) {
    const lang = this.patientLang();
    const hint = document.getElementById('session-listen-hint');
    const L = typeof PatientLocales !== 'undefined' ? PatientLocales.forLang(lang) : null;

    try { VoiceLayer?.stopListening?.(); } catch (_) {}
    this._quizListenActive = false;
    this._continueListenActive = false;
    this.listening = false;
    if (this._continueTimer) {
      window.clearTimeout(this._continueTimer);
      this._continueTimer = null;
    }
    if (this._armTimer) {
      window.clearTimeout(this._armTimer);
      this._armTimer = null;
    }

    if (item.itemType === 'attention_change') {
      if (hint) hint.textContent = L?.sayAnything || 'Say your answer when ready';
      if (this.attentionPhase === 'ask') {
        window.setTimeout(() => {
          this.speakThenListen(item.spokenPrompt || item.promptText, lang);
        }, 1200);
      }
      return;
    }

    if (this.isContinueType(item)) {
      if (hint) {
        hint.textContent =
          L?.sayAnything || 'Say the name aloud, or say Next — no need to tap';
      }
      const text = item.spokenPrompt || item.promptText;
      if (typeof VoiceLayer === 'undefined') return;

      let armed = false;
      const armContinue = (force = false) => {
        if (armed || this._starting) return;
        if (!force && VoiceLayer.isSpeaking?.()) {
          this._armTimer = window.setTimeout(() => armContinue(false), 300);
          return;
        }
        armed = true;
        try {
          if (VoiceLayer) VoiceLayer._speaking = false;
        } catch (_) {}
        this._armTimer = window.setTimeout(() => this.listenForContinueLoop(lang), 400);
      };

      VoiceLayer.speak(text, {
        lang,
        rate: 0.84,
        onEnd: () => armContinue(false),
      });
      const ms = Math.min(9000, Math.max(2800, String(text || '').length * 70 + 600));
      this._armTimer = window.setTimeout(() => armContinue(true), ms);
      return;
    }

    if (hint) hint.textContent = L?.sayAnything || 'Say your answer when ready';
    this.speakThenListen(item.spokenPrompt || item.promptText, lang);
  },

  speakThenListen(text, lang) {
    let armed = false;
    const arm = (force = false) => {
      if (armed) return;
      if (!force && VoiceLayer?.isSpeaking?.()) {
        this._armTimer = window.setTimeout(() => arm(false), 280);
        return;
      }
      armed = true;
      try {
        // Clear stuck TTS flag so Web Speech can open
        if (VoiceLayer) VoiceLayer._speaking = false;
      } catch (_) {}
      this._armTimer = window.setTimeout(() => {
        this.startQuizListenLoop(lang);
      }, 400);
    };

    if (typeof VoiceLayer === 'undefined') {
      arm(true);
      return;
    }
    try {
      VoiceLayer.stopListening?.();
    } catch (_) {}
    VoiceLayer.speak(text, {
      lang,
      rate: 0.86,
      onEnd: () => arm(false),
    });
    const ms = Math.min(9000, Math.max(2600, String(text || '').length * 65 + 600));
    this._armTimer = window.setTimeout(() => arm(true), ms);
  },

  /** Try every STT alternative — Chrome often puts the right word 2nd */
  pickHeardAnswer(result, item) {
    const list = [];
    if (result?.transcript) list.push(String(result.transcript).trim());
    for (const a of result?.alternatives || []) {
      const s = String(a || '').trim();
      if (s && !list.includes(s)) list.push(s);
    }
    if (!list.length) return null;

    let best = null;
    let bestScore = -1;
    for (const t of list) {
      if (VoiceLayer.isLikelyEcho?.(t)) continue;
      const g = gradeAnswer(t, [
        ...(item?.expectedAnswers || []),
        ...(item?.chipOptions || []),
      ]);
      if (g.score > bestScore) {
        bestScore = g.score;
        best = t;
      }
    }
    if (bestScore >= 0.35) return best;
    for (const t of list) {
      if (!VoiceLayer.isLikelyEcho?.(t)) return t;
    }
    return null;
  },

  async startQuizListenLoop(lang) {
    if (typeof VoiceLayer === 'undefined') return;
    if (this._quizListenActive) return;

    // Wait out any leftover TTS before arming mic
    for (let i = 0; i < 40 && VoiceLayer.isSpeaking?.(); i++) {
      await new Promise((r) => setTimeout(r, 200));
    }
    // Brief gap so TTS audio tail doesn't hit STT
    await new Promise((r) => setTimeout(r, 350));

    this._quizListenActive = true;
    this.listening = true;
    await VoiceLayer.warmMic();

    const hint = document.getElementById('session-listen-hint');
    const L = typeof PatientLocales !== 'undefined' ? PatientLocales.forLang(this.patientLang()) : null;
    const stickyLang = VoiceLayer.buildQuizLang?.(this.patientLang() || lang) || 'en-IN';

    const markListening = (extra) => {
      const liveL =
        typeof PatientLocales !== 'undefined' ? PatientLocales.forLang(this.patientLang()) : null;
      const base = liveL?.listening || L?.listening || 'Listening… speak anytime';
      if (hint) {
        hint.textContent = extra ? `${base} · ${extra}` : base;
        hint.classList.add('is-live');
      }
    };
    markListening();

    const clearLive = () => {
      this.listening = false;
      hint?.classList.remove('is-live');
    };

    const armChannel = () => {
      if (!this._quizListenActive || !this.currentItem() || !this.isQuizType(this.currentItem())) {
        this._quizListenActive = false;
        clearLive();
        return;
      }
      if (VoiceLayer.isSpeaking?.()) {
        window.setTimeout(armChannel, 280);
        return;
      }
      markListening();

      const handleQuizHeard = async (transcript, result) => {
          if (!this._quizListenActive) return true;
          if (VoiceLayer.isSpeaking?.()) return false;

          const item = this.currentItem();
          if (!item || !this.isQuizType(item)) {
            this._quizListenActive = false;
            clearLive();
            return true;
          }

          const heard = this.pickHeardAnswer(result, item) || String(transcript || '').trim();
          if (!heard) return false;

          // Short answers are never TTS echo (Bihu, Pitha, Friday, next…)
          const wordCount = heard.trim().split(/\s+/).filter(Boolean).length;
          if (wordCount > 4 && VoiceLayer.isLikelyEcho?.(heard)) return false;

          markListening(`“${heard.slice(0, 48)}”`);
          this.adoptSpeechLang(heard);

          const intent = VoiceLayer.matchIntentAnyLanguage(heard);
          if (intent === 'repeat') {
            await this.repeatPromptAsync(this.patientLang());
            window.setTimeout(armChannel, 200);
            return true;
          }

          if (item.itemType === 'sequence_order') {
            const step = (item.sequenceSteps || []).find((s) => {
              const label = String(s.label || '').toLowerCase();
              const id = String(s.id || '').toLowerCase();
              const t = heard.toLowerCase();
              return (
                t.includes(id) ||
                t.includes(label.replace(/^\d+\.\s*/, '')) ||
                gradeAnswer(t, [s.label, s.id]).match
              );
            });
            if (step) {
              this.selectSequenceStep(step.id);
              if (this._quizListenActive && this.isQuizType(this.currentItem())) {
                window.setTimeout(armChannel, 200);
              } else {
                clearLive();
              }
              return true;
            }
            return false;
          }

          if (!this.isPlausibleAnswer(heard, item)) {
            this._unclearCount = (this._unclearCount || 0) + 1;
            if (this._unclearCount < 2) {
              await this.rejectUnclearAndListen();
              window.setTimeout(armChannel, 200);
              return true;
            }
            this._quizListenActive = false;
            clearLive();
            this.handleVoiceAnswer(heard);
            return true;
          }

          this._quizListenActive = false;
          clearLive();
          this.handleVoiceAnswer(heard);
          return true;
      };

      VoiceLayer.startCallChannel({
        lang: stickyLang,
        mode: 'session',
        onStatus: (s) => {
          if (s === 'denied') {
            if (hint) hint.textContent = 'Mic blocked — allow microphone, then tap Listen';
            clearLive();
          } else if (s === 'unavailable') {
            if (hint) hint.textContent = 'Voice unavailable — tap an answer chip';
            clearLive();
          } else if (s === 'hearing') {
            if (hint) hint.textContent = 'Hearing you…';
          } else if (s === 'listening') {
            markListening();
          }
        },
        onPartial: (live) => {
          const clip = String(live || '').trim().slice(0, 42);
          if (clip && hint) hint.textContent = `Hearing: “${clip}”`;
        },
        onHeard: handleQuizHeard,
      });
    };

    armChannel();
  },

  async listenForContinueLoop(lang) {
    if (typeof VoiceLayer === 'undefined') return;
    if (this._continueListenActive) return;

    for (let i = 0; i < 40 && VoiceLayer.isSpeaking?.(); i++) {
      await new Promise((r) => setTimeout(r, 200));
    }
    await new Promise((r) => setTimeout(r, 350));

    this._continueListenActive = true;
    this.listening = true;
    await VoiceLayer.warmMic();

    const stickyLang = VoiceLayer.buildQuizLang?.(this.patientLang() || lang) || 'en-IN';
    const hint = document.getElementById('session-listen-hint');
    const L = typeof PatientLocales !== 'undefined' ? PatientLocales.forLang(this.patientLang()) : null;

    const mark = (extra) => {
      const base = L?.sayAnything || 'Say the name, ready, or next — listening';
      if (hint) {
        hint.textContent = extra ? `${base} · “${extra}”` : base;
        hint.classList.add('is-live');
      }
    };
    mark();

    const clearLive = () => {
      this.listening = false;
      hint?.classList.remove('is-live');
    };

    const armChannel = () => {
      if (
        !this._continueListenActive ||
        !this.currentItem() ||
        !this.isContinueType(this.currentItem())
      ) {
        this._continueListenActive = false;
        clearLive();
        return;
      }
      if (VoiceLayer.isSpeaking?.()) {
        window.setTimeout(armChannel, 280);
        return;
      }
      mark();

      const handleContinueHeard = async (transcript, result) => {
          if (!this._continueListenActive) return true;
          if (VoiceLayer.isSpeaking?.()) return false;

          const item = this.currentItem();
          if (!item || !this.isContinueType(item)) {
            this._continueListenActive = false;
            clearLive();
            return true;
          }

          const candidates = [];
          if (transcript) candidates.push(String(transcript).trim());
          for (const a of result?.alternatives || []) {
            const s = String(a || '').trim();
            if (s && !candidates.includes(s)) candidates.push(s);
          }
          if (!candidates.length) return false;

          for (const cand of candidates) {
            if (VoiceLayer.isLikelyEcho?.(cand)) continue;
            this.adoptSpeechLang(cand);
            mark(cand.slice(0, 40));

            const intent = VoiceLayer.matchIntentAnyLanguage(cand);
            if (intent === 'repeat') {
              await this.repeatPromptAsync(this.patientLang());
              window.setTimeout(armChannel, 200);
              return true;
            }

            if (this.isTeachAdvance(cand, item)) {
              this._continueListenActive = false;
              clearLive();
              this.continueItem();
              return true;
            }
          }
          return false;
      };

      VoiceLayer.startCallChannel({
        lang: stickyLang,
        mode: 'session',
        onStatus: (s) => {
          if (s === 'denied') {
            if (hint) hint.textContent = 'Mic blocked — allow microphone, then tap Listen';
            clearLive();
          } else if (s === 'unavailable') {
            if (hint) hint.textContent = 'Voice unavailable — tap Continue';
            clearLive();
          } else if (s === 'hearing') {
            if (hint) hint.textContent = 'Hearing you…';
          } else if (s === 'listening') {
            mark();
          }
        },
        onPartial: (live) => {
          const clip = String(live || '').trim().slice(0, 42);
          if (clip && hint) hint.textContent = `Hearing: “${clip}”`;
        },
        onHeard: handleContinueHeard,
      });
    };

    armChannel();
  },

  /** Teach / story beat — advance on spoken name, taught word, or Next */
  isTeachAdvance(transcript, item) {
    const t = String(transcript || '')
      .toLowerCase()
      .replace(/[^\w\u0900-\u097F\u0980-\u09FF\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!t || t.length < 2) return false;

    if (this.isExplicitContinue(t)) return true;

    const intent =
      typeof VoiceLayer !== 'undefined' ? VoiceLayer.matchIntentAnyLanguage(transcript) : null;
    if (intent === 'yes') return true;

    // Patient name (e.g. “Sania Anees”)
    const p = window.app?.currentPatient || {};
    const nameBits = [
      p.preferredName,
      p.preferred_name,
      p.fullName,
      p.full_name,
    ]
      .filter(Boolean)
      .flatMap((n) => String(n).toLowerCase().split(/\s+/))
      .filter((w) => w.length >= 2); // allow “Ma”, “Pa”
    if (nameBits.length) {
      const hit = nameBits.filter((w) => t.includes(w)).length;
      if (hit >= 1 && (nameBits.length === 1 || hit >= 2 || t.split(' ').length <= 4)) {
        return true;
      }
    }

    // Taught label / family name / bank word (incl. Devanagari STT like “ब्रह्मा”)
    const targets = this.teachTargets(item).filter(
      (x) => !/^(next|continue|aage|chaliye|aahok)$/i.test(String(x).trim())
    );
    if (targets.length && typeof gradeAnswer === 'function') {
      const g = gradeAnswer(transcript, targets);
      if (g.match || g.score >= 0.4) return true;
    }
    for (const target of targets) {
      const tok = String(target)
        .toLowerCase()
        .replace(/[^\w\u0900-\u097F\u0980-\u09FF\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (tok.length < 2) continue;
      if (t === tok || t.includes(tok) || tok.includes(t)) return true;
      // Clipped speech: “brahma” / “ब्रह्मा” while learning Brahmaputra
      if (tok.length >= 6 && t.length >= 3 && tok.startsWith(t)) return true;
      if (t.length >= 6 && tok.length >= 3 && t.startsWith(tok)) return true;
    }

    return false;
  },

  teachTargets(item) {
    if (!item) return [];
    const out = [];
    const push = (v) => {
      const s = String(v || '').trim();
      if (s && !out.includes(s)) out.push(s);
    };
    for (const a of item.expectedAnswers || []) push(a);
    push(item.bankItem);
    push(item.caption);
    push(item.lookLabel);
    push(item.shortLabel);
    push(item.media?.caption);
    push(item.media?.label);
    // “Brahmaputra — the great river…”
    const lead = String(item.promptText || '').match(
      /^([A-Za-z\u0900-\u09FF][\w\u0900-\u09FF'-]*)\s*[—–-]/
    );
    if (lead?.[1]) push(lead[1]);
    // “This is Pitha …” / “This is Ma …”
    const m = String(item.promptText || '').match(
      /(?:this is|meet|look[, ]+this is)\s+([^.!?,]+)/i
    );
    if (m?.[1]) {
      push(m[1].replace(/\s+—.*$/, '').trim());
      const first = m[1].split(/[—.–]/)[0].trim();
      push(first);
      first.split(/\s+/).forEach((w) => {
        if (w.length >= 2 && !/^(the|an|a|our|assamese)$/i.test(w)) push(w);
      });
    }
    const spoken = String(item.spokenPrompt || item.promptText || '');
    // “Say Pitha with me” / Hindi “Pitha boliye” / Assamese “Pitha kowa”
    const say = spoken.match(
      /say\s+([a-zA-Z\u0900-\u097F][\w\u0900-\u097F'-]*)/i
    );
    if (say?.[1]) push(say[1]);
    const hiSay = spoken.match(
      /([a-zA-Z\u0900-\u097F][\w\u0900-\u097F'-]*)\s+(boliye|bolo|kowa|ko'wa|kowa|bolok)/i
    );
    if (hiSay?.[1] && hiSay[1].length >= 2) push(hiSay[1]);
    return out;
  },

  /** Strong continue only — ignore TTS scraps like “ready?” inside the prompt */
  isExplicitContinue(transcript) {
    const t = String(transcript || '').toLowerCase().trim();
    if (t.length < 2) return false;
    if (t.split(/\s+/).length > 8) return false;
    return /\b(yes|yeah|yep|haan|han|ji|okay|ok|theek|theek hai|i('|\s)?m ready|ready|next|continue|chaliye|aahok|aage|aage badho|shuru|shuru karo|start|begin|done|ho gaya|hogaya|sahi|thik|thik ase|next please|go on|carry on)\b/i.test(
      t
    );
  },

  async repeatPromptAsync(lang) {
    const item = this.localizedItem(this.currentItem());
    if (!item || typeof VoiceLayer === 'undefined') return;
    VoiceLayer.stopListening();
    await new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };
      VoiceLayer.speak(item.spokenPrompt || item.promptText, {
        lang: lang || this.patientLang(),
        rate: 0.84,
        onEnd: finish,
      });
      window.setTimeout(finish, 10000);
    });
    await new Promise((r) => setTimeout(r, 900));
  },

  domainLabel(domain) {
    const map = {
      orientation: 'Orientation',
      registration: 'Learning & Memory',
      learning_memory: 'Learning & Memory',
      attention: 'Complex Attention',
      complex_attention: 'Complex Attention',
      recall: 'Learning & Memory',
      language: 'Language',
      reasoning: 'Executive Function',
      executive_function: 'Executive Function',
      perceptual_motor: 'Perceptual-Motor',
      social_cognition: 'Social Cognition',
      story: 'Family Story',
    };
    return map[domain] || domain;
  },

  renderMedia(item) {
    const caption = String(item.media?.caption || item.caption || '')
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
      .trim();
    const uri = item.localUri || item.media?.uri || null;
    const asksFace = /remember their face|who is this|look carefully\. remember/i.test(
      `${item.promptText || ''} ${item.spokenPrompt || ''}`
    );
    // Never show a landscape (or any non-portrait) for face questions
    if (asksFace && !uri) {
      return `
        <div class="photo-container media-card">
          <div class="media-caption">Ask your caregiver to add a family photo</div>
        </div>`;
    }
    if (uri) {
      const safeCap = caption.replace(/"/g, '&quot;');
      const safeUri = String(uri).replace(/"/g, '');
      return `
        <div class="photo-container">
          <img src="${safeUri}" alt="${safeCap}">
        </div>`;
    }
    return `
      <div class="photo-container media-card">
        <div class="media-caption">${caption || 'Look carefully'}</div>
      </div>`;
  },

  renderScene(objects, label) {
    const cells = (objects || []).map((o) => {
      const img = o.image
        ? `<img class="scene-thumb" src="${String(o.image).replace(/"/g, '')}" alt="${String(o.label || '').replace(/"/g, '&quot;')}">`
        : `<div class="scene-thumb scene-thumb-empty"></div>`;
      return `<div class="scene-object" data-id="${o.id}">${img}<span class="scene-label">${o.label}</span></div>`;
    }).join('');
    return `
      <div class="scene-board">
        <div class="scene-title">${label}</div>
        <div class="scene-grid">${cells}</div>
      </div>`;
  },

  renderContinue(item) {
    const label = item.continueLabel || 'Continue';
    const kicker = item.continueKicker || item.caption || item.sessionTheme || 'MindCare';
    const isStory =
      item.itemType === 'story_beat' ||
      (item.domain === 'story') ||
      /story|kahani|kahini|golpo|walk|treasure|yaatra|path/i.test(
        `${label} ${kicker} ${item.promptText || ''}`
      );

    const cap = item.caption || '';
    const showCaption =
      cap && !String(item.promptText || '').toLowerCase().includes(String(cap).toLowerCase());

    return `
      <div class="session-screen">
        ${this.renderMedia(item)}
        <div class="prompt-text">${item.promptText}</div>
        ${showCaption ? `<div class="caption-text">${cap}</div>` : ''}
        <button type="button" class="story-cta ${isStory ? 'story-cta--featured' : ''}" onclick="SessionPlay.continueItem()">
          <span class="story-cta-kicker">${kicker}</span>
          <span class="story-cta-row">
            <span class="story-cta-label">${label}</span>
            <span class="story-cta-arrow" aria-hidden="true">→</span>
          </span>
        </button>
      </div>`;
  },

  renderQuiz(item) {
    const lang = this.patientLang();
    const L = typeof PatientLocales !== 'undefined' ? PatientLocales.forLang(lang) : null;
    const chips = (item.chipOptions || []).map((chip) => {
      const safe = String(chip).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      return `<button class="chip-btn" onclick="SessionPlay.selectAnswer('${safe}')">${chip}</button>`;
    }).join('');

    return `
      <div class="session-screen">
        ${this.renderMedia(item)}
        <div class="prompt-text">${item.promptText}</div>
        <div class="caption-text">${L?.sayAnything || 'Say your answer'}</div>
        <div class="chip-options">${chips}</div>
      </div>`;
  },

  renderAttention(item) {
    const lookMs = Math.max(item.lookMs || 8000, 8000);
    if (!this.attentionPhase) {
      this.attentionPhase = 'look';
      const lang = this.patientLang();
      if (typeof VoiceLayer !== 'undefined') {
        VoiceLayer.speak(item.spokenPrompt || item.lookLabel || 'Look carefully.', {
          lang,
          rate: 0.84,
        });
      }
      setTimeout(() => {
        if (this.currentItem()?.templateId !== item.templateId && this.currentItem()?.id !== item.id) return;
        this.attentionPhase = 'blank';
        this.render();
        setTimeout(() => {
          if (this.currentItem()?.templateId !== item.templateId && this.currentItem()?.id !== item.id) return;
          this.attentionPhase = 'ask';
          this.itemStartTime = Date.now();
          this.render();
        }, 1800);
      }, lookMs);
    }

    const lookLabel = item.lookLabel || 'Look carefully… remember this';
    const againLabel = item.againLabel || 'Now look again';

    if (this.attentionPhase === 'look') {
      return `
        <div class="session-screen">
          ${this.renderScene(item.sceneBefore, lookLabel)}
          <div class="prompt-text">${lookLabel}</div>
          <p class="session-pace-hint">Take your time</p>
        </div>`;
    }
    if (this.attentionPhase === 'blank') {
      return `
        <div class="session-screen">
          <div class="photo-container media-card"><div class="media-caption">…</div></div>
          <div class="prompt-text">…</div>
        </div>`;
    }

    const chips = (item.chipOptions || []).map((chip) => {
      const safe = String(chip).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      return `<button class="chip-btn" onclick="SessionPlay.selectAnswer('${safe}')">${chip}</button>`;
    }).join('');

    return `
      <div class="session-screen">
        ${this.renderScene(item.sceneAfter, againLabel)}
        <div class="prompt-text">${item.promptText}</div>
        <div class="chip-options">${chips}</div>
      </div>`;
  },

  renderSequence(item) {
    const steps = item.sequenceSteps || [];
    if (!this._seqPicked) this._seqPicked = [];
    // Stable shuffle per item id
    if (this._seqShuffleKey !== item.id) {
      this._seqShuffleKey = item.id;
      this._seqPicked = [];
      const copy = steps.slice();
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      this._seqShuffled = copy;
    }
    const picked = this._seqPicked;
    const nextIdx = picked.length;
    const progress = picked
      .map((id) => steps.find((s) => s.id === id)?.label || id)
      .join(' → ');

    const chips = (this._seqShuffled || steps)
      .map((step) => {
        const done = picked.includes(step.id);
        const safe = String(step.id).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        return `<button type="button" class="chip-btn ${done ? 'is-done' : ''}" ${
          done ? 'disabled' : ''
        } onclick="SessionPlay.selectSequenceStep('${safe}')">${step.label}</button>`;
      })
      .join('');

    return `
      <div class="session-screen">
        ${this.renderMedia(item)}
        <div class="prompt-text">${item.promptText}</div>
        <div class="caption-text">${
          progress
            ? `So far: ${progress}`
            : `Tap step ${nextIdx + 1} of ${steps.length}`
        }</div>
        <div class="chip-options">${chips}</div>
      </div>`;
  },

  selectSequenceStep(stepId) {
    const item = this.currentItem();
    if (!item || item.itemType !== 'sequence_order') return;
    const steps = item.sequenceSteps || [];
    const expected = steps[this._seqPicked.length];
    if (!expected) return;

    if (expected.id !== stepId) {
      this._seqPicked = [];
      this.render();
      const lang = this.patientLang();
      const tip = item.hintText || 'Try the steps in order again.';
      try {
        VoiceLayer?.speak?.(tip, { lang, rate: 0.88, preserveListen: true });
      } catch (_) {}
      return;
    }

    this._seqPicked.push(stepId);
    if (this._seqPicked.length >= steps.length) {
      const transcript = this._seqPicked.join(' ');
      this._seqPicked = [];
      this._seqShuffleKey = null;
      this.recordAnswer(transcript);
      return;
    }
    this.render();
  },

  continueItem() {
    if (this._continueTimer) {
      window.clearTimeout(this._continueTimer);
      this._continueTimer = null;
    }
    this._quizListenActive = false;
    this._continueListenActive = false;
    try { VoiceLayer?.stopListening?.(); } catch (_) {}
    const item = this.currentItem();
    if (!item) return;
    const responseMs = Date.now() - this.itemStartTime;
    this.responses.push({
      sessionId: this.session.id,
      sessionItemId: item.id,
      itemType: item.itemType,
      domain: item.domain,
      memoryId: item.memoryId,
      promptText: item.promptText,
      expectedAnswers: item.expectedAnswers || [],
      transcript: '(continue)',
      isCorrect: true,
      responseMs,
      hintsUsed: 0,
      repetitions: 0,
      matchScore: 1,
    });
    this.nextItem();
  },

  selectAnswer(answer) {
    this._quizListenActive = false;
    this._continueListenActive = false;
    try { VoiceLayer?.stopListening?.(); } catch (_) {}
    this.listening = false;
    this.recordAnswer(answer);
  },

  /**
   * True if speech looks like an attempt at THIS answer (fuzzy STT OK).
   * "Shukravar" / "fryday" count for Friday — not only exact English.
   */
  isPlausibleAnswer(transcript, item) {
    if (!item || !transcript) return false;
    const raw = this.currentItem() || item;
    if (typeof isAnswerAttempt === 'function') {
      return isAnswerAttempt(transcript, raw.expectedAnswers || [], raw.chipOptions || []);
    }
    const grading = gradeAnswer(transcript, [
      ...(raw.expectedAnswers || []),
      ...(raw.chipOptions || []),
    ]);
    return grading.match || grading.score >= 0.35;
  },

  async rejectUnclearAndListen() {
    const lang = this.patientLang();
    const pack = VoicePhrases?.resolvePack?.(lang) || 'en';
    const msg =
      {
        hi: 'Samajh nahi aaya. Jawab phir se boliye.',
        as: 'Bujhia nupalu. Uttar abar kowa.',
        bn: 'Bujhte parlam na. Uttar abar bolo.',
        en: 'I did not catch that. Please say your answer again.',
      }[pack] || 'Please say your answer again.';

    const hint = document.getElementById('session-listen-hint');
    if (hint) hint.textContent = msg;

    // Stay on same question — do NOT advance. Caller re-arms call channel after.
    await new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };
      if (typeof VoiceLayer !== 'undefined') {
        VoiceLayer.speak(msg, { lang, rate: 0.88, onEnd: finish });
        window.setTimeout(finish, 5000);
      } else finish();
    });
    await new Promise((r) => setTimeout(r, 500));
  },

  handleVoiceAnswer(transcript) {
    this._unclearCount = 0;
    this.recordAnswer(transcript);
  },

  recordAnswer(answer) {
    const item = this.currentItem();
    if (!item) return;
    const pool = [...(item.expectedAnswers || []), ...(item.chipOptions || [])];
    const grading = gradeAnswer(answer, item.expectedAnswers || []);
    // Saying the correct chip counts
    let isCorrect = grading.match;
    if (!isCorrect) {
      for (const c of item.chipOptions || []) {
        if (gradeAnswer(answer, [c]).match && gradeAnswer(String(c), item.expectedAnswers || []).match) {
          isCorrect = true;
          break;
        }
      }
    }
    const responseMs = Date.now() - this.itemStartTime;

    this.responses.push({
      sessionId: this.session.id,
      sessionItemId: item.id,
      itemType: item.itemType,
      domain: item.domain,
      memoryId: item.memoryId,
      promptText: item.promptText,
      expectedAnswers: item.expectedAnswers,
      transcript: answer,
      isCorrect,
      responseMs,
      hintsUsed: this.hintsUsedThisItem,
      repetitions: 0,
      matchScore: grading.score || (isCorrect ? 1 : 0),
    });

    this.showResultFeedback(isCorrect, item);
  },

  showResultFeedback(isCorrect, item) {
    this._quizListenActive = false;
    try { VoiceLayer?.stopListening?.(); } catch (_) {}

    const content = document.getElementById('session-container');
    if (!content) return;
    const lang = this.patientLang();
    const localized = this.localizedItem(item);
    const pack = VoicePhrases?.resolvePack?.(lang) || 'en';
    const okWord =
      { en: 'Sahi — badhiya.', hi: 'Sahi hai.', as: 'Thik ase.', bn: 'Thik ache.', mni: 'Kariga!', mz: 'Dik dik!', kha: 'Bha!', nag: 'Thik ase!', brx: 'Thik!' }[
        pack
      ] || 'Sahi.';

    // Localized gentle correction — never force English "Today is Friday"
    let hintLine = localized.hintText || '';
    if (!hintLine && item.hintText) {
      hintLine =
        typeof SessionI18n !== 'undefined'
          ? SessionI18n.fillHint(item.hintText, item, lang)
          : item.hintText;
    }
    // If template still has English weekday leftover, rewrite for Hindi
    if (pack === 'hi' && /today is/i.test(hintLine)) {
      const day =
        (item.expectedAnswers || []).find((a) =>
          /friday|monday|tuesday|wednesday|thursday|saturday|sunday/i.test(String(a))
        ) || '';
      const hiDay = SessionI18n?.weekdaySpoken?.(
        String(day).replace(/^\w/, (c) => c.toUpperCase()),
        'hi-IN'
      );
      if (hiDay) hintLine = `Aaj ${hiDay} hai.`;
    }

    const feedback = isCorrect
      ? `<div class="feedback-ok">${okWord}</div>`
      : `<div class="feedback-no">${
          pack === 'hi' ? 'Phir se try karein' : pack === 'as' ? 'Abar try korok' : 'Almost'
        }</div><p class="feedback-hint">${hintLine || ''}</p>`;

    content.innerHTML = `
      <div class="session-screen">
        ${item.sceneAfter ? this.renderScene(item.sceneAfter, '') : this.renderMedia(item)}
        <div class="prompt-text">${localized.promptText || item.promptText}</div>
        ${feedback}
      </div>`;

    const speak = isCorrect ? okWord : hintLine || okWord;
    if (typeof VoiceLayer !== 'undefined') {
      VoiceLayer.speak(speak, { lang, rate: 0.84, onEnd: () => this.nextAfterDelay() });
    } else {
      this.nextAfterDelay();
    }
  },

  nextAfterDelay() {
    setTimeout(() => this.nextItem(), 2400);
  },

  nextItem() {
    this._quizListenActive = false;
    this._continueListenActive = false;
    this.listening = false;
    try { VoiceLayer?.stopListening?.(); } catch (_) {}
    this.itemStartTime = Date.now();
    this.hintsUsedThisItem = 0;
    this.attentionPhase = null;
    this._seqPicked = [];
    this._seqShuffleKey = null;
    this.currentIndex++;
    this.render();
  },

  useHint() {
    this.hintsUsedThisItem += 1;
    const item = this.localizedItem(this.currentItem());
    if (item?.hintText && typeof VoiceLayer !== 'undefined') {
      VoiceLayer.speak(item.hintText, { lang: this.patientLang(), rate: 0.84 });
    }
  },

  repeatPrompt() {
    const lang = this.patientLang();
    const item = this.localizedItem(this.currentItem());
    if (!item || typeof VoiceLayer === 'undefined') return;

    this._quizListenActive = false;
    this._continueListenActive = false;
    try {
      VoiceLayer.stopSpeaking?.();
      VoiceLayer.stopListening();
    } catch (_) {}
    this.listening = false;

    const rearm = () => {
      const cur = this.currentItem();
      if (!cur) return;
      if (this.isContinueType(cur)) this.listenForContinueLoop(lang);
      else if (this.isQuizType(cur)) this.startQuizListenLoop(lang);
    };

    VoiceLayer.speak(item.spokenPrompt || item.promptText, {
      lang,
      rate: 0.84,
      onEnd: () => window.setTimeout(rearm, 400),
    });
    window.setTimeout(() => {
      if (!this._quizListenActive && !this._continueListenActive) rearm();
    }, 9000);
  },

  domainScores() {
    const by = {};
    // Map curriculum DSM domains → caregiver dashboard skill ids
    const alias = {
      orientation: 'orientation',
      registration: 'recall',
      recall: 'recall',
      learning_memory: 'recall',
      attention: 'attention',
      complex_attention: 'attention',
      reasoning: 'reasoning',
      executive_function: 'reasoning',
      language: 'language',
      perceptual_motor: 'attention',
      social_cognition: 'language',
    };
    for (const r of this.responses) {
      if (!r.domain || r.domain === 'story' || r.transcript === '(continue)') continue;
      if (['story_beat', 'registration_teach', 'memory_teach'].includes(r.itemType)) continue;
      const key = alias[r.domain] || r.domain;
      if (!by[key]) by[key] = { correct: 0, total: 0 };
      by[key].total += 1;
      if (r.isCorrect) by[key].correct += 1;
    }
    const out = {};
    for (const [k, v] of Object.entries(by)) {
      out[k] = v.total ? Math.round((v.correct / v.total) * 100) : null;
    }
    // Also keep DSM keys for analytics that expect them
    if (out.recall != null) out.learning_memory = out.recall;
    if (out.attention != null) out.complex_attention = out.attention;
    if (out.reasoning != null) out.executive_function = out.reasoning;
    if (out.orientation == null && out.learning_memory != null) {
      out.orientation = out.learning_memory;
    }
    return out;
  },

  async complete() {
    const content = document.getElementById('session-container');
    if (!content) return;

    const graded = this.responses.filter(
      (r) => r.transcript !== '(continue)' &&
        !['story_beat', 'registration_teach', 'memory_teach'].includes(r.itemType)
    );
    const results = graded.map((r) => ({
      outcome: r.isCorrect ? 'correct' : 'wrong',
      responseMs: r.responseMs,
      hintsUsed: r.hintsUsed,
      repetitions: r.repetitions,
    }));
    const scores = computeSessionScores(results);
    scores.domains = this.domainScores();

    if (navigator.onLine) {
      try {
        const serverResponses = this.responses.map((r) => ({
          itemType: r.itemType,
          memoryId: r.memoryId,
          promptText: r.promptText,
          expectedAnswers: r.expectedAnswers,
          transcript: r.transcript,
          isCorrect: r.isCorrect,
          responseMs: r.responseMs,
          hintsUsed: r.hintsUsed,
          matchScore: r.matchScore,
          domain: r.domain || null,
        }));
        await API.completeSession(this.session.id, serverResponses, scores.domains);
      } catch (err) {
        console.warn('Server sync failed, saving locally:', err);
      }
    }

    const patientId = this.session.patientId || this.session.patient_id;
    const sessionType = this.session.sessionType || this.session.session_type;
    const startedAt = this.session.startedAt || this.session.started_at;
    const localSession = {
      ...this.session,
      id: this.session.id,
      patientId,
      patient_id: patientId,
      sessionType,
      session_type: sessionType,
      startedAt,
      started_at: startedAt,
      status: 'completed',
      endedAt: new Date().toISOString(),
      ...scores,
      domains: scores.domains,
      responses: this.responses,
      curriculum: this.session?.curriculum || this.curriculumMeta || true,
    };
    await LocalDB.put('sessions', localSession);

    if (!navigator.onLine) {
      await SyncManager.queue('session_complete', this.session.id, {
        session: localSession,
        responses: this.responses,
        scores,
      });
    }

    SessionSummary.render(this.session, this.responses, scores);
    this.leaveSessionChrome();
  },
};
