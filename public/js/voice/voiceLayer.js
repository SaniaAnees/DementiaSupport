/**
 * VoiceLayer — web/PWA voice UX.
 *
 * Offline ladder on web: Web Speech → chips (always).
 * Full offline STT (Sherpa ONNX) lives in apps/flutter VoiceEngine —
 * browsers cannot run native Sherpa; use Flutter for patient devices.
 * When online + GEMINI/OPENAI key on server: cloud STT via /api/speech/stt.
 */
window.VoiceLayer = {
  _listening: false,
  _recognition: null,
  _loopActive: false,
  _langIndex: 0,
  _micReady: false,
  _voicesReady: null,

  patientLang() {
    const p = window.app?.currentPatient;
    return p?.language_code || p?.languageCode || 'en-IN';
  },

  async warmMic() {
    if (this._micReady) return true;
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        this._micReady = true;
        return true;
      }
    } catch (_) {}
    return false;
  },

  /** Wait until browser has loaded TTS voice list (often empty on first call). */
  ensureVoices() {
    if (this._voicesReady) return this._voicesReady;
    this._voicesReady = new Promise((resolve) => {
      const have = () => speechSynthesis?.getVoices?.() || [];
      if (have().length) {
        resolve(have());
        return;
      }
      const done = () => resolve(have());
      try {
        speechSynthesis.addEventListener('voiceschanged', done, { once: true });
      } catch (_) {}
      window.setTimeout(done, 600);
    });
    return this._voicesReady;
  },

  /**
   * Prefer Indian English (en-IN) / Hindi (hi-IN) over US/UK accents.
   */
  pickIndianVoice(lang) {
    const voices = speechSynthesis?.getVoices?.() || [];
    if (!voices.length) return null;
    const pack = VoicePhrases?.resolvePack?.(lang) || 'en';
    const tag = (this._speechLang(lang) || 'en-IN').toLowerCase();

    const indiaName = (v) =>
      /india|indian|ravi|neerja|hemant|hindi|हिन्द|bengali|bangla/i.test(v.name || '');
    const langOf = (v) => String(v.lang || '').toLowerCase();
    const byPrefix = (p) => voices.filter((v) => langOf(v).startsWith(p));

    if (pack === 'hi') {
      return (
        byPrefix('hi-in').find(indiaName) ||
        byPrefix('hi-in')[0] ||
        byPrefix('hi').find(indiaName) ||
        byPrefix('hi')[0] ||
        null
      );
    }
    if (pack === 'bn' || pack === 'as') {
      return byPrefix('bn-in')[0] || byPrefix('bn')[0] || byPrefix('hi-in')[0] || null;
    }

    // English + NER Latin prompts → Indian English
    return (
      byPrefix('en-in').find(indiaName) ||
      byPrefix('en-in')[0] ||
      voices.find((v) => indiaName(v) && langOf(v).startsWith('en')) ||
      voices.find(indiaName) ||
      byPrefix(tag.slice(0, 2))[0] ||
      null
    );
  },

  stopListening() {
    this._loopActive = false;
    try {
      this._recognition?.abort?.();
    } catch (_) {}
    this._recognition = null;
    this._listening = false;
  },

  stopSpeaking() {
    try {
      speechSynthesis?.cancel?.();
    } catch (_) {}
    this._speaking = false;
  },

  stop() {
    this._cloudLoopId = (this._cloudLoopId || 0) + 1;
    this.stopListening();
    this.stopSpeaking();
    try {
      if (typeof Voice !== 'undefined') Voice.stopSpeaking?.();
    } catch (_) {}
  },

  _cloudStatus: null,
  /** Cloud STT off — product uses Sherpa (phone) / Web Speech + chips (PWA) */
  async cloudSttAvailable() {
    return false;
  },

  preferCloudStt() {
    return false;
  },

  invalidateCloudStatus() {
    this._cloudStatus = null;
  },

  /**
   * Record mic for durationMs → cloud STT (Gemini / Whisper).
   * Reliable online path; use when Web Speech fails or for quizzes.
   */
  async recordAndTranscribe({ durationMs = 4500, languageHint } = {}) {
    if (!(await this.cloudSttAvailable())) {
      return { transcript: null, alternatives: [], error: 'cloud_unavailable' };
    }
    await this.warmMic();

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
      });
    } catch (_) {
      return { transcript: null, alternatives: [], error: 'mic_denied' };
    }

    const mime =
      MediaRecorder.isTypeSupported?.('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported?.('audio/webm')
          ? 'audio/webm'
          : '';

    const chunks = [];
    let recorder;
    try {
      recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
    } catch (_) {
      stream.getTracks().forEach((t) => t.stop());
      return { transcript: null, alternatives: [], error: 'recorder_unavailable' };
    }

    const blob = await new Promise((resolve) => {
      recorder.ondataavailable = (e) => {
        if (e.data?.size) chunks.push(e.data);
      };
      recorder.onstop = () => {
        resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
      };
      recorder.start(200);
      window.setTimeout(() => {
        try {
          if (recorder.state !== 'inactive') recorder.stop();
        } catch (_) {
          resolve(new Blob(chunks, { type: 'audio/webm' }));
        }
      }, durationMs);
    });

    stream.getTracks().forEach((t) => t.stop());

    if (!blob || blob.size < 800) {
      return { transcript: null, alternatives: [], error: 'too_short' };
    }

    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        resolve(dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    try {
      const res = await API.speechStt({
        audioBase64: base64,
        mimeType: blob.type || 'audio/webm',
        languageHint: languageHint || this.patientLang(),
      });
      const text = String(res?.transcript || '').trim();
      return {
        transcript: text || null,
        alternatives: text ? [text, ...(res?.alternatives || [])] : [],
        error: text ? null : 'empty',
        provider: res?.provider || null,
      };
    } catch (err) {
      return {
        transcript: null,
        alternatives: [],
        error: err?.message || 'stt_failed',
      };
    }
  },

  /**
   * Prefer cloud STT when configured; else browser Web Speech.
   */
  async listenSmart({ lang, timeoutMs = 5000, earlyCommit = true } = {}) {
    if (navigator.onLine && (await this.cloudSttAvailable())) {
      const cloud = await this.recordAndTranscribe({
        durationMs: Math.min(7000, Math.max(3200, timeoutMs)),
        languageHint: lang || this.patientLang(),
      });
      if (cloud.transcript) return cloud;
      // fall through to webspeech if cloud empty
    }
    return this.listenOnce({ lang, timeoutMs, earlyCommit, ignoreSpeaking: false });
  },

  speak(text, opts = {}) {
    if (window.app?.currentView === 'caregiver' || window.app?.state === 'dashboard') {
      opts.onEnd?.();
      return Promise.resolve();
    }
    const lang = this._speechLang(opts.lang || this.patientLang());
    if (!text) {
      if (opts.onEnd) opts.onEnd();
      return false;
    }
    if (!('speechSynthesis' in window)) {
      if (opts.onEnd) opts.onEnd();
      return false;
    }

    this._speaking = true;
    this._lastSpoken = String(text);
    this._lastSpokenAt = Date.now();
    // Home greeting keeps the call channel open; quiz prompts pause STT briefly.
    if (!opts.preserveListen) {
      this.stopListening();
    } else {
      this._loopActive = true;
    }

    const run = (voicesLoaded) => {
      try {
        speechSynthesis.cancel();
      } catch (_) {}
      this._speaking = true;
      const u = new SpeechSynthesisUtterance(String(text));
      const pack = VoicePhrases?.resolvePack?.(lang) || 'en';
      u.lang = pack === 'hi' ? 'hi-IN' : pack === 'bn' || pack === 'as' ? 'bn-IN' : 'en-IN';
      u.rate = opts.rate ?? 0.88;
      u.pitch = opts.pitch ?? 1;
      const finish = () => {
        this._speaking = false;
        this._lastSpokenAt = Date.now();
        if (opts.onEnd) opts.onEnd();
      };
      u.onend = finish;
      u.onerror = finish;
      const preferred = this.pickIndianVoice(lang);
      if (preferred) u.voice = preferred;
      else if (voicesLoaded?.length) {
        const fallback =
          voicesLoaded.find((v) => /en-IN/i.test(v.lang)) ||
          voicesLoaded.find((v) => /hi-IN/i.test(v.lang));
        if (fallback) u.voice = fallback;
      }
      speechSynthesis.speak(u);
    };

    const ready = speechSynthesis.getVoices?.() || [];
    if (ready.length) run(ready);
    else this.ensureVoices().then((v) => run(v));
    return true;
  },

  isSpeaking() {
    // Chrome can leave speechSynthesis.speaking true after cancel/onend.
    // Trust our flag after a short grace; don't block mic forever.
    if (this._speaking) return true;
    try {
      if (speechSynthesis?.speaking || speechSynthesis?.pending) {
        const since = this._lastSpokenAt ? Date.now() - this._lastSpokenAt : 99999;
        // Only treat browser flag as speaking within 2.5s of last TTS activity
        if (since < 2500) return true;
      }
    } catch (_) {}
    return false;
  },

  /**
   * Echo guard — ONLY block near-copies of what we just spoke.
   * Short answers (“Friday”, “Shukravar”) are NEVER echo.
   * Phrases that add new words (“today is Friday”) are NEVER echo.
   */
  isLikelyEcho(transcript) {
    const scrub = (s) =>
      String(s || '')
        .toLowerCase()
        .replace(/[^\w\u0900-\u097F\u0980-\u09FF\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const t = scrub(transcript);
    if (!t) return true;
    // Do NOT blanket-reject while TTS plays — home listens during greeting.
    // Compare against lastSpoken text only (below).

    const tWords = t.split(' ').filter((w) => w.length > 1);

    // Patient short answers — ALWAYS keep (names, Bihu, Pitha, next, Friday…)
    if (tWords.length <= 4) return false;

    if (this._lastSpokenAt && Date.now() - this._lastSpokenAt < 600) {
      if (tWords.length <= 6) return false;
    }

    const spoken = scrub(this._lastSpoken);
    if (!spoken) return false;
    if (t === spoken) return true;

    const sWords = new Set(spoken.split(' ').filter((w) => w.length > 1));
    const novel = tWords.filter((w) => !sWords.has(w));
    if (novel.length >= 1) return false;

    // No new words and long → almost certainly our TTS bouncing back
    return tWords.length >= 5;
  },

  _speechLang(lang) {
    return VoicePhrases?.speechTag?.(lang) || 'en-IN';
  },

  buildLangRotation(primary) {
    const locked =
      (typeof SessionI18n !== 'undefined' && SessionI18n.interactiveLang(primary)) || primary;
    const pack = VoicePhrases?.resolvePack?.(locked) || 'en';
    // Keep rotation short — long rotation missed the user's speech window
    if (pack === 'hi') return ['hi-IN', 'en-IN'];
    if (pack === 'as') return ['hi-IN', 'en-IN', 'as-IN'];
    if (pack === 'bn') return ['bn-IN', 'hi-IN', 'en-IN'];
    return ['en-IN', 'hi-IN'];
  },

  /**
   * Fast STT pass. Default 4.5s — fail quick and retry instead of 12s dead air.
   * Commits early on strong interim (morning / Friday / subah / etc.).
   */
  listenOnce({ lang, timeoutMs = 4500, earlyCommit = true, ignoreSpeaking = false } = {}) {
    // Home must hear "morning shuru" even while soft greeting TTS plays
    if (!ignoreSpeaking && this.isSpeaking()) {
      return Promise.resolve({ transcript: null, alternatives: [], error: 'speaking' });
    }
    const useLang = lang || this.patientLang();
    this._listening = true;

    return new Promise((resolve) => {
      let settled = false;
      let interim = '';
      const alts = [];

      const finish = (payload) => {
        if (settled) return;
        settled = true;
        this._listening = false;
        try {
          this._recognition?.stop?.();
        } catch (_) {}
        resolve(payload);
      };

      const timer = window.setTimeout(() => {
        const text = (alts[0] || interim || '').trim();
        finish({
          transcript: text || null,
          alternatives: alts,
          error: text ? null : 'timeout',
        });
      }, timeoutMs);

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        window.clearTimeout(timer);
        finish({ transcript: null, alternatives: [], error: 'unavailable' });
        return;
      }

      const looksStrong = (text) => {
        if (!text || text.trim().length < 2) return false;
        const t = text.toLowerCase();
        return (
          /\b(morning|evening|friday|monday|tuesday|wednesday|thursday|saturday|sunday|subah|shaam|sham|shukravar|shukr|session|start|begin|shuru|karo|karut|repeat|dobara|pitha|bihu|brahmaputra|yes|haan|han|ready|next|continue|jaapi|gamusa|aage|theek|okay|ok)\b/i.test(
            t
          ) ||
          /[\u0900-\u097F]{3,}/.test(text) ||
          text.trim().split(/\s+/).length >= 2
        );
      };

      try {
        const rec = new SpeechRecognition();
        this._recognition = rec;
        rec.continuous = false;
        rec.interimResults = true;
        rec.maxAlternatives = 5;
        const tag = this._speechLang(useLang);
        rec.lang = tag.startsWith('en') ? 'en-IN' : tag;

        rec.onresult = (event) => {
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const res = event.results[i];
            for (let a = 0; a < res.length; a++) {
              const piece = (res[a]?.transcript || '').trim();
              if (piece && !alts.includes(piece)) alts.push(piece);
            }
            const top = (res[0]?.transcript || '').trim();
            if (!top) continue;
            if (res.isFinal) {
              if (!alts.includes(top)) alts.unshift(top);
              window.clearTimeout(timer);
              finish({ transcript: top, alternatives: alts, error: null });
              return;
            }
            interim = top;
            // Don't wait for "final" — commit as soon as we hear a clear command/answer
            if (earlyCommit && looksStrong(top)) {
              window.clearTimeout(timer);
              finish({ transcript: top, alternatives: alts, error: null });
            }
          }
        };
        rec.onerror = (ev) => {
          window.clearTimeout(timer);
          const best = (alts[0] || interim || '').trim();
          finish({
            transcript: best || null,
            alternatives: alts,
            error: best ? null : ev?.error || 'stt_failed',
          });
        };
        rec.onend = () => {
          if (!settled) {
            window.clearTimeout(timer);
            const best = (alts[0] || interim || '').trim();
            finish({
              transcript: best || null,
              alternatives: alts,
              error: best ? null : 'ended',
            });
          }
        };
        rec.start();
      } catch (_) {
        window.clearTimeout(timer);
        finish({ transcript: null, alternatives: [], error: 'unavailable' });
      }
    });
  },

  /** Home / dashboard: sticky Indian English (mixed Hindi+English commands) */
  buildHomeLangRotation() {
    return ['en-IN'];
  },

  /** Quiz: stick to ONE language so speech isn't missed mid-rotation */
  buildQuizLang(primary) {
    const locked =
      (typeof SessionI18n !== 'undefined' && SessionI18n.interactiveLang(primary)) || primary;
    const pack = VoicePhrases?.resolvePack?.(locked) || 'en';
    if (pack === 'hi') return 'hi-IN';
    if (pack === 'bn') return 'bn-IN';
    if (pack === 'as') return 'hi-IN'; // Hindi STT covers Latin Assamese + Hindi patients
    return 'en-IN';
  },

  /**
   * Native Wi‑Fi voice loop: speak → Gemini hears → callback.
   * Surfaces errors; never silent-fails on retired models / empty audio.
   */
  async startCloudTurnLoop({
    lang,
    onHeard,
    onStatus,
    onPartial,
    durationMs = 3800,
    gapMs = 400,
    stillActive,
  } = {}) {
    if (window.app?.currentView === 'caregiver' || window.app?.state === 'dashboard') {
      onStatus?.('blocked');
      return;
    }
    this.stopListening();
    this._loopActive = true;
    this._listening = true;
    this._cloudLoopId = (this._cloudLoopId || 0) + 1;
    const myId = this._cloudLoopId;
    onStatus?.('listening');

    while (
      this._loopActive &&
      this._cloudLoopId === myId &&
      (typeof stillActive !== 'function' || stillActive())
    ) {
      if (!navigator.onLine) {
        onStatus?.('offline');
        break;
      }
      if (!(await this.cloudSttAvailable())) {
        onStatus?.('unavailable');
        break;
      }
      for (let i = 0; i < 50 && this.isSpeaking?.() && this._loopActive; i++) {
        await new Promise((r) => setTimeout(r, 200));
      }
      if (!this._loopActive || this._cloudLoopId !== myId) break;

      onStatus?.('listening');
      onPartial?.('Speak now…');
      document.querySelector('.ctrl-orb.listen')?.classList.add('is-live');

      const result = await this.recordAndTranscribe({
        durationMs,
        languageHint: lang || this.patientLang(),
      });

      if (!this._loopActive || this._cloudLoopId !== myId) break;

      if (result.error && !result.transcript) {
        const msg =
          result.error === 'mic_denied'
            ? 'Mic blocked — allow microphone'
            : result.error === 'too_short'
              ? 'Didn’t catch speech — speak louder'
              : result.error === 'empty'
                ? 'No words heard — try again'
                : `Gemini: ${String(result.error).slice(0, 80)}`;
        onStatus?.('error');
        onPartial?.(msg);
        // Free-tier quota / high demand → stop burning requests; let caller fall back
        if (/quota|rate|exceeded|high demand|billing|429/i.test(String(result.error))) {
          this._cloudStatus = false;
          this._loopActive = false;
          this._listening = false;
          onStatus?.('unavailable');
          return;
        }
        await new Promise((r) => setTimeout(r, 900));
        continue;
      }

      const text = String(result?.transcript || '').trim();
      if (text) {
        onPartial?.(text.slice(0, 48));
        onStatus?.('hearing');
        try {
          const done = await onHeard?.(text, {
            transcript: text,
            alternatives: result.alternatives || [text],
            provider: result.provider || 'gemini',
          });
          if (done) {
            this._loopActive = false;
            this._listening = false;
            onStatus?.('idle');
            return;
          }
        } catch (err) {
          onPartial?.(`Error: ${String(err?.message || err).slice(0, 60)}`);
        }
      }
      await new Promise((r) => setTimeout(r, gapMs));
    }
    this._listening = false;
    this._loopActive = false;
    document.querySelector('.ctrl-orb.listen')?.classList.remove('is-live');
  },

  /**
   * Call-style always-on mic channel (Meet / WhatsApp pattern):
   * continuous recognition, live partials, auto-reopen on end, one sticky language.
   * Offline / no-Gemini path. Online uses startCloudTurnLoop.
   * mode: 'home' | 'session' — session early-commits ready/start/names, not only slot words.
   * Guardrail: voice never runs on caregiver dashboard.
   */
  startCallChannel({ lang, onPartial, onHeard, onStatus, mode = 'home' } = {}) {
    if (window.app?.currentView === 'caregiver' || window.app?.state === 'dashboard') {
      onStatus?.('blocked');
      return;
    }
    this.stopListening();
    this._loopActive = true;
    this._listening = true;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      onStatus?.('unavailable');
      return;
    }

    const sticky = this.buildQuizLang(lang || this.patientLang()) || 'en-IN';
    // Mixed "morning shuru" → en-IN hears English; Hindi pack keeps hi-IN
    const useLang = sticky.startsWith('hi') ? 'hi-IN' : sticky.startsWith('bn') ? 'bn-IN' : 'en-IN';

    const looksHomeCommand = (text) => {
      const t = this._normalizeTranscript(text);
      if (!t || t.length < 2) return false;
      if (
        /^good (morning|evening|afternoon)\b/.test(t) &&
        !/\b(shuru|session|start|subah|shaam|karo|karut)\b/.test(t)
      ) {
        return false;
      }
      return (
        /\b(morning|evening|subah|shaam|sham|shuru|karo|karut|session|start|begin|sopuah|gadholi)\b/i.test(
          t
        ) ||
        /\bmorning\s+session\b/i.test(t) ||
        /\bevening\s+session\b/i.test(t) ||
        /[\u0900-\u097F]{2,}/.test(text)
      );
    };

    /** Session: ready/start/next + short answers (names, days) — do not wait forever for isFinal */
    const looksSessionUtterance = (text) => {
      const t = this._normalizeTranscript(text);
      if (!t || t.length < 2) return false;
      if (
        /\b(ready|start|begin|next|continue|yes|yeah|haan|han|ok|okay|theek|shuru|karo|karut|aage|chaliye|done)\b/i.test(
          t
        )
      ) {
        return true;
      }
      const words = t.split(/\s+/).filter(Boolean);
      if (words.length >= 2 && t.length >= 4) return true;
      if (words.length === 1 && words[0].length >= 3) return true;
      if (/[\u0900-\u097F\u0980-\u09FF]{2,}/.test(text)) return true;
      return false;
    };

    const looksCandidate = mode === 'session' ? looksSessionUtterance : looksHomeCommand;

    const open = () => {
      if (!this._loopActive) return;
      let rec;
      try {
        rec = new SpeechRecognition();
      } catch (_) {
        onStatus?.('unavailable');
        return;
      }
      this._recognition = rec;
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 5;
      rec.lang = useLang;

      let lastPartial = '';
      let busy = false;

      rec.onstart = () => {
        this._listening = true;
        onStatus?.('listening');
      };
      rec.onspeechstart = () => onStatus?.('hearing');
      rec.onsoundstart = () => onStatus?.('hearing');

      rec.onresult = async (event) => {
        if (!this._loopActive || busy) return;
        let interim = '';
        let finalText = '';
        const alts = [];
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const top = (res[0]?.transcript || '').trim();
          for (let a = 0; a < res.length; a++) {
            const piece = (res[a]?.transcript || '').trim();
            if (piece && !alts.includes(piece)) alts.push(piece);
          }
          if (res.isFinal) finalText = top;
          else interim = top;
        }
        const live = interim || finalText;
        if (live && live !== lastPartial) {
          lastPartial = live;
          onPartial?.(live);
        }

        const candidate = finalText || (looksCandidate(interim) ? interim : '');
        if (!candidate) return;

        busy = true;
        try {
          const done = await onHeard?.(candidate, {
            transcript: candidate,
            alternatives: alts.length ? alts : [candidate],
          });
          if (done) {
            this._loopActive = false;
            this._listening = false;
            try {
              rec.stop();
            } catch (_) {}
            onStatus?.('idle');
          }
        } finally {
          busy = false;
        }
      };

      rec.onerror = (ev) => {
        const err = ev?.error || '';
        if (err === 'not-allowed' || err === 'service-not-allowed') {
          this._loopActive = false;
          this._listening = false;
          onStatus?.('denied');
          return;
        }
        // no-speech / network / aborted → onend reopens
        onStatus?.('listening');
      };

      rec.onend = () => {
        this._listening = false;
        if (!this._loopActive) {
          onStatus?.('idle');
          return;
        }
        window.setTimeout(() => {
          if (!this._loopActive) return;
          try {
            rec.start();
            this._listening = true;
            onStatus?.('listening');
          } catch (_) {
            window.setTimeout(open, 350);
          }
        }, 100);
      };

      try {
        rec.start();
        this._listening = true;
        onStatus?.('listening');
      } catch (_) {
        window.setTimeout(open, 400);
      }
    };

    this.warmMic()
      .catch(() => {})
      .finally(() => open());
  },

  async listenLoop({
    lang,
    langRotation,
    onHeard,
    onStatus,
    timeoutMs = 4000,
    ignoreSpeaking = false,
  } = {}) {
    // Prefer call-channel for home-style always-on listen
    if (ignoreSpeaking) {
      this.startCallChannel({ lang, onHeard, onStatus });
      return;
    }
    this.stopListening();
    this._loopActive = true;
    this._langIndex = 0;
    await this.warmMic();
    const rotation = langRotation?.length ? langRotation : this.buildHomeLangRotation();

    const tick = async () => {
      while (this._loopActive) {
        if (!ignoreSpeaking && this.isSpeaking()) {
          await new Promise((r) => setTimeout(r, 200));
          continue;
        }
        onStatus?.('listening');
        const useLang = rotation[this._langIndex % rotation.length];
        this._langIndex += 1;
        const result = await this.listenOnce({
          lang: useLang,
          timeoutMs,
          earlyCommit: true,
          ignoreSpeaking,
        });
        if (!this._loopActive) break;
        if (result?.transcript) {
          const done = await onHeard?.(result.transcript, result);
          if (done) {
            this._loopActive = false;
            break;
          }
        }
        await new Promise((r) => setTimeout(r, 60));
      }
      onStatus?.('idle');
    };
    tick();
  },

  matchIntentAnyLanguage(transcript) {
    if (!transcript || typeof VoicePhrases === 'undefined') return null;
    const t = this._normalizeTranscript(transcript);

    if (/^good (morning|evening|afternoon)\.?$/.test(t)) return null;
    if (/^ready when you are/.test(t)) return null;
    if (
      /^good (morning|evening|afternoon)\b/.test(t) &&
      !/\b(shuru|karo|karut|start|begin|session|subah|shaam)\b/.test(t)
    ) {
      return null;
    }

    // HARD priority: explicit slot words beat vague "start" / "session"
    const hasEvening = /\b(evening|shaam|sham|शाम|gadholi|sondhya|night)\b/.test(t);
    const hasMorning = /\b(morning|subah|सुबह|sopuah|sokal)\b/.test(t);
    if (hasEvening && !hasMorning) return 'start_evening';
    if (hasMorning && !hasEvening) return 'start_morning';
    if (hasEvening && hasMorning) {
      // "good morning … evening session" unlikely; prefer the last slot word
      const ei = Math.max(t.lastIndexOf('evening'), t.lastIndexOf('shaam'), t.lastIndexOf('sham'));
      const mi = Math.max(t.lastIndexOf('morning'), t.lastIndexOf('subah'));
      return ei >= mi ? 'start_evening' : 'start_morning';
    }

    const packKeys = ['en', 'hi', 'as', 'bn', 'mni', 'mz', 'kha', 'nag', 'brx'];
    let best = { intent: null, score: 0, len: 0 };

    for (const key of packKeys) {
      const pack = VoicePhrases[key];
      if (!pack || typeof pack !== 'object') continue;
      for (const [intent, phrases] of Object.entries(pack)) {
        if (!Array.isArray(phrases)) continue;
        for (const phrase of phrases) {
          const s = this._scorePhrase(t, phrase);
          const plen = this._normalizeTranscript(phrase).split(/\s+/).filter(Boolean).length;
          // Prefer longer phrase matches so "start" loses to "start evening session"
          if (s > best.score || (s === best.score && s >= 0.5 && plen > best.len)) {
            best = { intent, score: s, len: plen };
          }
        }
      }
    }

    if (best.score >= 0.55) return best.intent;

    if (/(repeat|dobara|phir se|again|दोबारा|फिर से)/i.test(t)) {
      return 'repeat';
    }
    if (
      /\b(start|begin|shuru|karo|karut|arambha|शुरू|course|courses)\b/i.test(t) &&
      /\b(session|subah|shaam|morning|evening|सुबह|शाम)\b/i.test(t)
    ) {
      return 'start_generic';
    }
    if (/\b(shuru\s*karo|shuru\s*karut|session\s*shuru|start\s*session|begin\s*session)\b/i.test(t)) {
      return 'start_generic';
    }
    return best.score >= 0.5 ? best.intent : null;
  },

  matchIntent(transcript) {
    return this.matchIntentAnyLanguage(transcript);
  },

  _normalizeTranscript(str) {
    return String(str || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[.,/#!$%^&*;:{}=\-_`~()?"']/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  },

  _scorePhrase(transcript, phrase) {
    const p = this._normalizeTranscript(phrase);
    if (!p) return 0;
    if (transcript === p) return 1;
    if (transcript.includes(p) || p.includes(transcript)) return 0.95;
    const words = p.split(/\s+/).filter((w) => w.length > 1);
    if (!words.length) return 0;
    const hit = words.filter((w) => transcript.includes(w)).length;
    return hit / words.length;
  },
};

// Prefetch Indian voices early
if ('speechSynthesis' in window) {
  try {
    speechSynthesis.getVoices();
    speechSynthesis.addEventListener?.('voiceschanged', () => {
      VoiceLayer._voicesReady = Promise.resolve(speechSynthesis.getVoices());
    });
  } catch (_) {}
}

// Keep online/offline paths separate — re-probe Gemini when Wi‑Fi returns
try {
  window.addEventListener('online', () => VoiceLayer.invalidateCloudStatus?.());
  window.addEventListener('offline', () => {
    VoiceLayer._cloudStatus = false;
  });
} catch (_) {}

if (typeof Voice !== 'undefined') {
  Voice.speak = function (text, callback) {
    const lang = VoiceLayer.patientLang();
    if (callback) return VoiceLayer.speak(text, { lang, onEnd: callback });
    return VoiceLayer.speak(text, { lang });
  };
  Voice.startRecognition = function (onResult, onEnd) {
    VoiceLayer.listenOnce({ lang: VoiceLayer.patientLang(), timeoutMs: 10000 }).then((r) => {
      if (r?.transcript) onResult?.(r.transcript);
      else onEnd?.(false);
    });
    return true;
  };
  Voice.stopSpeaking = function () {
    VoiceLayer.stopSpeaking();
  };
}
