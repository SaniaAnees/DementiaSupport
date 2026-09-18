/**
 * VoiceLayer — patient voice UX.
 * - TTS: device speechSynthesis (works offline if voice installed)
 * - STT: Web Speech (usually needs network on Chrome) → optional cloud later
 * - Chips always work offline
 */
window.VoiceLayer = {
  _listening: false,
  _recognition: null,
  _loopActive: false,

  patientLang() {
    const p = window.app?.currentPatient;
    return p?.language_code || p?.languageCode || 'en-IN';
  },

  stop() {
    this._loopActive = false;
    try {
      if (typeof Voice !== 'undefined') Voice.stopSpeaking?.();
    } catch (_) {}
    try {
      speechSynthesis?.cancel?.();
    } catch (_) {}
    try {
      this._recognition?.abort?.();
    } catch (_) {}
    this._listening = false;
  },

  speak(text, opts = {}) {
    const lang = this._speechLang(opts.lang || this.patientLang());
    if (!text) return false;
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text));
      u.lang = lang;
      u.rate = opts.rate ?? 0.88;
      if (opts.onEnd) u.onend = opts.onEnd;
      // Prefer a matching voice when the OS has one installed
      try {
        const voices = speechSynthesis.getVoices?.() || [];
        const pack = VoicePhrases?.resolvePack?.(lang) || 'en';
        const preferred = voices.find((v) => v.lang?.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()))
          || (pack === 'hi' && voices.find((v) => v.lang?.toLowerCase().startsWith('hi')))
          || null;
        if (preferred) u.voice = preferred;
      } catch (_) {}
      speechSynthesis.speak(u);
      return true;
    }
    return false;
  },

  _speechLang(lang) {
    return VoicePhrases?.speechTag?.(lang) || 'en-IN';
  },

  /**
   * One-shot listen. Resolves { transcript, source }.
   */
  listenOnce({ lang, timeoutMs = 8000 } = {}) {
    const useLang = lang || this.patientLang();
    this._listening = true;

    return new Promise(async (resolve) => {
      const finish = (payload) => {
        this._listening = false;
        resolve(payload);
      };

      const timer = window.setTimeout(() => {
        try {
          this._recognition?.stop?.();
        } catch (_) {}
        finish({ transcript: null, source: null, error: 'timeout' });
      }, timeoutMs);

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const rec = new SpeechRecognition();
          this._recognition = rec;
          rec.continuous = false;
          rec.interimResults = false;
          rec.lang = this._speechLang(useLang);

          rec.onresult = (event) => {
            window.clearTimeout(timer);
            const transcript = event.results?.[0]?.[0]?.transcript || '';
            finish({ transcript, source: 'webspeech' });
          };
          rec.onerror = async () => {
            window.clearTimeout(timer);
            const cloud = await this._tryCloudStt(useLang).catch(() => null);
            finish(cloud || { transcript: null, source: null, error: 'stt_failed' });
          };
          rec.onend = () => {};
          rec.start();
          return;
        } catch (_) {}
      }

      const cloud = await this._tryCloudStt(useLang).catch(() => null);
      window.clearTimeout(timer);
      finish(cloud || { transcript: null, source: null, error: 'unavailable' });
    });
  },

  /**
   * Keep listening in a loop until stop() or onHeard returns true (consume).
   * Used on patient home — patient speaks anytime, no mic tap.
   */
  async listenLoop({ lang, onHeard, onStatus } = {}) {
    this.stop();
    this._loopActive = true;
    const useLang = lang || this.patientLang();

    const tick = async () => {
      while (this._loopActive) {
        onStatus?.('listening');
        const result = await this.listenOnce({ lang: useLang, timeoutMs: 10000 });
        if (!this._loopActive) break;
        if (result?.transcript) {
          const done = await onHeard?.(result.transcript, result);
          if (done) {
            this._loopActive = false;
            break;
          }
        }
        // brief pause before re-arming mic
        await new Promise((r) => setTimeout(r, 400));
      }
      onStatus?.('idle');
    };
    tick();
  },

  async _tryCloudStt(lang) {
    if (!navigator.onLine) return null;
    try {
      const res = await fetch('/api/speech/stt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('mc_token') || ''}`,
        },
        body: JSON.stringify({ lang: this._speechLang(lang), mode: 'unavailable_client_mic_blob' }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data?.transcript) return { transcript: data.transcript, source: 'cloud' };
    } catch (_) {}
    return null;
  },

  matchIntent(transcript, lang) {
    if (!transcript) return null;
    const packKey = VoicePhrases?.resolvePack?.(lang || this.patientLang()) || 'en';
    const packs = [VoicePhrases[packKey], VoicePhrases.hi, VoicePhrases.en].filter(Boolean);
    const t = String(transcript).toLowerCase().trim();

    const scorePhrase = (phrase) => {
      const p = phrase.toLowerCase();
      if (t.includes(p) || p.includes(t)) return 1;
      const words = p.split(/\s+/).filter(Boolean);
      if (!words.length) return 0;
      const hit = words.filter((w) => t.includes(w)).length;
      return hit / words.length;
    };

    let best = { intent: null, score: 0 };
    for (const pack of packs) {
      for (const [intent, phrases] of Object.entries(pack)) {
        if (!Array.isArray(phrases)) continue;
        for (const phrase of phrases) {
          const s = scorePhrase(phrase);
          if (s > best.score) best = { intent, score: s };
        }
      }
    }
    // Any speech during morning window can mean "start" if score low but words like start/shuru/arambha
    if (best.score < 0.55) {
      if (/\b(start|begin|shuru|arambha|hou|tan|sdang|jao)\b/i.test(t)) {
        return 'start_generic';
      }
    }
    return best.score >= 0.45 ? best.intent : null;
  },
};

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
    VoiceLayer.stop();
  };
}
