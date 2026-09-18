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

  start(session, items) {
    this.session = session;
    this.items = items;
    this.currentIndex = 0;
    this.responses = [];
    this.itemStartTime = Date.now();
    this.hintsUsedThisItem = 0;
    this.attentionPhase = null;
    this.render();
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
    ].includes(item.itemType);
  },

  async render() {
    const content = document.getElementById('session-container');
    if (!content) return;

    const item = this.currentItem();
    if (!item) {
      this.complete();
      return;
    }

    const progress = ((this.currentIndex + 1) / this.items.length) * 100;
    const theme = this.session?.curriculum?.theme || this.session?.curriculum?.title || '';
    const domain = item.domain ? `<div class="session-domain">${this.domainLabel(item.domain)}</div>` : '';

    let ui;
    if (item.itemType === 'attention_change') {
      ui = this.renderAttention(item);
    } else if (this.isContinueType(item)) {
      ui = this.renderContinue(item);
    } else {
      ui = this.renderQuiz(item);
    }

    content.innerHTML = `
      <div class="patient-mode">
        <div class="progress-bar"><div class="progress-fill" style="width: ${progress}%"></div></div>
        ${theme ? `<div class="session-theme">${theme}</div>` : ''}
        ${domain}
        ${ui}
        <div class="session-controls">
          ${(this.isQuizType(item) && item.itemType !== 'attention_change') ||
            (item.itemType === 'attention_change' && this.attentionPhase === 'ask')
            ? `<button class="control-btn listen" type="button" onclick="SessionPlay.startListeningManual()">Listen</button>`
            : ''}
          ${!this.isContinueType(item)
            ? `<button class="control-btn repeat" type="button" onclick="SessionPlay.repeatPrompt()">Repeat</button>`
            : ''}
        </div>
      </div>
    `;

    this.afterRenderVoice(item);
  },

  /** Manual Listen button — same as auto-listen path */
  startListeningManual() {
    const lang = this.patientLang();
    try { VoiceLayer?.stop?.(); } catch (_) {}
    this.listening = false;
    this.autoListen(lang);
  },

  patientLang() {
    return (
      window.app?.currentPatient?.language_code ||
      window.app?.currentPatient?.languageCode ||
      'en-IN'
    );
  },

  afterRenderVoice(item) {
    const lang = this.patientLang();
    const hint = document.getElementById('session-listen-hint');
    const L = typeof PatientLocales !== 'undefined' ? PatientLocales.forLang(lang) : null;
    if (hint && L) hint.textContent = L.sayAnything || '';

    if (item.itemType === 'attention_change') {
      if (this.attentionPhase === 'ask') {
        this.speakThenListen(item.promptText || item.spokenPrompt, lang);
      }
      return;
    }

    if (this.isContinueType(item)) {
      const text = item.spokenPrompt || item.promptText;
      if (typeof VoiceLayer !== 'undefined') {
        VoiceLayer.speak(text, {
          lang,
          onEnd: () => {
            // Auto-advance teach/story beats; also accept any speech to continue
            this._continueTimer = window.setTimeout(() => this.continueItem(), 1600);
            this.listenForContinue(lang);
          },
        });
      } else {
        this._continueTimer = window.setTimeout(() => this.continueItem(), 2800);
      }
      return;
    }

    // Quiz types: speak prompt then auto-listen (no Listen button)
    this.speakThenListen(item.spokenPrompt || item.promptText, lang);
  },

  speakThenListen(text, lang) {
    if (typeof VoiceLayer === 'undefined') {
      this.autoListen(lang);
      return;
    }
    VoiceLayer.speak(text, {
      lang,
      onEnd: () => this.autoListen(lang),
    });
  },

  async autoListen(lang) {
    if (this.listening) return;
    this.listening = true;
    const hint = document.getElementById('session-listen-hint');
    const L = typeof PatientLocales !== 'undefined' ? PatientLocales.forLang(lang) : null;
    if (hint) hint.textContent = L?.listening || 'Listening…';

    try {
      const result = await VoiceLayer.listenOnce({ lang, timeoutMs: 10000 });
      this.listening = false;
      if (result?.transcript) {
        this.handleVoiceAnswer(result.transcript);
      } else {
        // Re-arm once if nothing heard — chips still available
        if (hint) hint.textContent = L?.sayAnything || 'Say your answer';
        window.setTimeout(() => {
          if (this.currentItem() && this.isQuizType(this.currentItem())) {
            this.autoListen(lang);
          }
        }, 800);
      }
    } catch (_) {
      this.listening = false;
    }
  },

  async listenForContinue(lang) {
    try {
      const result = await VoiceLayer.listenOnce({ lang, timeoutMs: 5000 });
      if (result?.transcript) {
        if (this._continueTimer) window.clearTimeout(this._continueTimer);
        this.continueItem();
      }
    } catch (_) {}
  },

  domainLabel(domain) {
    const map = {
      orientation: 'Orientation',
      registration: 'Learning',
      attention: 'Attention',
      recall: 'Recall',
      language: 'Language',
      reasoning: 'Reasoning',
      story: 'Family Story',
    };
    return map[domain] || domain;
  },

  renderMedia(item) {
    const uri = item.localUri || item.media?.uri || null;
    const caption = item.media?.caption || item.caption || '';
    if (uri) {
      return `
        <div class="photo-container">
          <img src="${uri}" alt="${caption.replace(/"/g, '&quot;')}">
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
        ? `<img class="scene-thumb" src="${o.image}" alt="${o.label}">`
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
    const label = item.continueLabel || 'Next';
    return `
      <div class="session-screen">
        ${this.renderMedia(item)}
        <div class="prompt-text">${item.promptText}</div>
        <div class="caption-text">${item.caption || ''}</div>
        <button type="button" class="btn btn-primary btn-block btn-large" onclick="SessionPlay.continueItem()">${label}</button>
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
    if (!this.attentionPhase) {
      this.attentionPhase = 'look';
      const lang = this.patientLang();
      if (typeof VoiceLayer !== 'undefined') {
        VoiceLayer.speak(item.spokenPrompt || 'Look carefully.', { lang });
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
        }, 900);
      }, item.lookMs || 3500);
    }

    if (this.attentionPhase === 'look') {
      return `
        <div class="session-screen">
          ${this.renderScene(item.sceneBefore, 'Look carefully…')}
          <div class="prompt-text">Remember this table</div>
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
        ${this.renderScene(item.sceneAfter, 'Now look again')}
        <div class="prompt-text">${item.promptText}</div>
        <div class="chip-options">${chips}</div>
      </div>`;
  },

  continueItem() {
    if (this._continueTimer) {
      window.clearTimeout(this._continueTimer);
      this._continueTimer = null;
    }
    try { VoiceLayer?.stop?.(); } catch (_) {}
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
    try { VoiceLayer?.stop?.(); } catch (_) {}
    this.listening = false;
    this.recordAnswer(answer);
  },

  handleVoiceAnswer(transcript) {
    this.recordAnswer(transcript);
  },

  recordAnswer(answer) {
    const item = this.currentItem();
    if (!item) return;
    const grading = gradeAnswer(answer, item.expectedAnswers || []);
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
      isCorrect: grading.match,
      responseMs,
      hintsUsed: this.hintsUsedThisItem,
      repetitions: 0,
      matchScore: grading.score,
    });

    this.showResultFeedback(grading.match, item);
  },

  showResultFeedback(isCorrect, item) {
    const content = document.getElementById('session-container');
    if (!content) return;
    const lang = this.patientLang();
    const pack = VoicePhrases?.resolvePack?.(lang) || 'en';
    const okWord = { en: 'Correct!', hi: 'Sahi!', as: 'Thik!', bn: 'Thik!', mni: 'Kariga!', mz: 'Dik dik!', kha: 'Bha!', nag: 'Thik ase!', brx: 'Thik!' }[pack] || 'Correct!';

    const feedback = isCorrect
      ? `<div class="feedback-ok">${okWord}</div>`
      : `<div class="feedback-no">…</div><p class="feedback-hint">${item.hintText || ''}</p>`;

    content.innerHTML = `
      <div class="session-screen">
        ${item.sceneAfter ? this.renderScene(item.sceneAfter, '') : this.renderMedia(item)}
        <div class="prompt-text">${item.promptText}</div>
        ${feedback}
      </div>`;

    const speak = isCorrect ? okWord : (item.hintText || okWord);
    if (typeof VoiceLayer !== 'undefined') {
      VoiceLayer.speak(speak, { lang, onEnd: () => this.nextAfterDelay() });
    } else {
      this.nextAfterDelay();
    }
  },

  nextAfterDelay() {
    setTimeout(() => this.nextItem(), 1200);
  },

  nextItem() {
    this.listening = false;
    this.itemStartTime = Date.now();
    this.hintsUsedThisItem = 0;
    this.attentionPhase = null;
    this.currentIndex++;
    this.render();
  },

  useHint() {
    this.hintsUsedThisItem += 1;
    const item = this.currentItem();
    if (item?.hintText && typeof VoiceLayer !== 'undefined') {
      VoiceLayer.speak(item.hintText, { lang: this.patientLang() });
    }
  },

  repeatPrompt() {
    const item = this.currentItem();
    if (typeof VoiceLayer !== 'undefined') {
      VoiceLayer.speak(item.spokenPrompt || item.promptText, { lang: this.patientLang() });
    }
  },

  domainScores() {
    const by = {};
    for (const r of this.responses) {
      if (!r.domain || r.domain === 'story' || r.transcript === '(continue)') continue;
      if (!by[r.domain]) by[r.domain] = { correct: 0, total: 0 };
      by[r.domain].total += 1;
      if (r.isCorrect) by[r.domain].correct += 1;
    }
    const out = {};
    for (const [k, v] of Object.entries(by)) {
      out[k] = v.total ? Math.round((v.correct / v.total) * 100) : null;
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
        }));
        await API.completeSession(this.session.id, serverResponses);
      } catch (err) {
        console.warn('Server sync failed, saving locally:', err);
      }
    }

    const localSession = {
      ...this.session,
      status: 'completed',
      endedAt: new Date().toISOString(),
      ...scores,
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
  },
};
