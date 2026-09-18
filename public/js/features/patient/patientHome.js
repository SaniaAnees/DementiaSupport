/**
 * Patient home — greeting + Morning/Evening CTAs + always-on voice.
 * Buttons stay visible for judges / caregivers; patients can also speak
 * in any NER / Hindi / English pack to start a session.
 */
const PatientHome = {
  patientId: null,
  patient: null,
  _starting: false,
  _armed: false,

  async render(patientId) {
    this.patientId = patientId || window.app?.currentPatient?.id || null;
    const content = document.getElementById('session-container');
    if (!content) return;

    this.teardown();
    this._starting = false;
    this._armed = false;
    document.getElementById('main-app')?.classList.remove('is-session-active');
    try {
      SessionPlay?.leaveSessionChrome?.();
    } catch (_) {}

    content.innerHTML = `
      <div class="ph-home">
        <header class="ph-hello">
          <p class="ph-greeting">Just a moment…</p>
        </header>
      </div>`;

    try {
      const patient = await this.resolvePatient(this.patientId);
      this.patient = patient;
      this.patientId = patient?.id || this.patientId;
      if (patient && window.app) window.app.currentPatient = patient;

      const patientLang = patient?.language_code || patient?.languageCode || 'en-IN';
      // Home voice UI: Hindi for Assam / Hindi patients (not bare English)
      const speakLang = this.homeSpeakLang(patientLang, patient);
      if (window.app) {
        window.app.sessionSpeakLang = speakLang;
        if (String(speakLang).toLowerCase().startsWith('hi')) {
          window.app.sessionSpeakLangLocked = 'hi-IN';
        }
      }
      const L =
        typeof PatientLocales !== 'undefined' ? PatientLocales.forLang(speakLang) : null;
      const name = await this.resolveName(patient);
      const progress = await this.getTodayProgress(this.patientId);
      const copy = this.buildDailyCopy(name, L);
      const listenHint = L?.listening || 'Listening… say morning or evening';
      this._helloNudged = false;

      if (typeof VoiceLayer !== 'undefined') {
        VoiceLayer.warmMic().catch(() => {});
      }

      content.innerHTML = `
        <div class="ph-home">
          <header class="ph-hello">
            <p class="ph-greeting">${this.escape(copy.headline)}</p>
            <p class="ph-nudge">${this.escape(copy.nudge)}</p>
          </header>

          <div class="ph-actions" role="group" aria-label="Sessions">
            <button type="button" class="ph-session" id="ph-btn-morning" data-slot="morning">
              <span class="ph-session-copy">
                <span class="ph-session-title">Morning session</span>
                <span class="ph-session-sub">Orientation, memory, and family story</span>
              </span>
              <span class="ph-session-go" aria-hidden="true">→</span>
            </button>
            <button type="button" class="ph-session" id="ph-btn-evening" data-slot="evening">
              <span class="ph-session-copy">
                <span class="ph-session-title">Evening session</span>
                <span class="ph-session-sub">Recall the day, then family story</span>
              </span>
              <span class="ph-session-go" aria-hidden="true">→</span>
            </button>
          </div>

          <p class="ph-status" aria-label="Today's progress">
            <span>Morning <em class="${progress.morning ? 'is-done' : ''}">${
              progress.morning ? 'done' : 'ready'
            }</em></span>
            <span class="ph-status-dot" aria-hidden="true">·</span>
            <span>Evening <em class="${progress.evening ? 'is-done' : ''}">${
              progress.evening ? 'done' : 'ready'
            }</em></span>
            ${
              progress.streak > 0
                ? `<span class="ph-status-dot" aria-hidden="true">·</span><span class="ph-streak">${progress.streak}-day streak</span>`
                : ''
            }
          </p>

          <div class="ph-mic-btn ph-mic-status" id="ph-mic-btn" aria-live="polite" aria-label="Voice status">
            <span class="ph-mic-ring" aria-hidden="true"></span>
            <span class="ph-mic-label" id="ph-mic-label">Greeting…</span>
          </div>
        </div>
      `;

      document.getElementById('ph-btn-morning')?.addEventListener('click', () => {
        this.beginSession('morning');
      });
      document.getElementById('ph-btn-evening')?.addEventListener('click', () => {
        this.beginSession('evening');
      });
      const armMic = () => {
        if (this._armed || this._starting) return;
        this._armed = true;
        if (!this.patientId) {
          const label = document.getElementById('ph-mic-label');
          if (label) label.textContent = 'Ask caregiver to finish setup first';
          return;
        }
        const label = document.getElementById('ph-mic-label');
        if (label) label.textContent = listenHint;
        this.startAlwaysListening(speakLang, L, progress);
      };

      // Always-on mic: open listen channel immediately (call-app style)
      this._greetQuietUntil = Date.now() + 4500;
      if (typeof VoiceLayer !== 'undefined') {
        VoiceLayer.warmMic()
          .catch(() => {})
          .finally(() => armMic());

        const spoken = `${copy.headline}. ${L?.voiceNudge || copy.nudge}`;
        const label = document.getElementById('ph-mic-label');
        if (label) label.textContent = listenHint;
        VoiceLayer.speak(spoken, {
          lang: speakLang,
          rate: 0.9,
          preserveListen: true,
        });
      } else {
        const label = document.getElementById('ph-mic-label');
        if (label) label.textContent = 'Tap a session to begin';
      }
    } catch (err) {
      console.error('PatientHome.render failed:', err);
      content.innerHTML = `
        <div class="ph-home">
          <header class="ph-hello">
            <p class="ph-greeting">Welcome</p>
            <p class="ph-nudge">Ask your caregiver to finish setup.</p>
          </header>
        </div>`;
    }
  },

  startAlwaysListening(lang, L, progress) {
    if (typeof VoiceLayer === 'undefined' || this._starting) return;
    const label = document.getElementById('ph-mic-label');
    const micBtn = document.getElementById('ph-mic-btn');

    if (label) label.textContent = L?.listening || 'Listening… say “morning” or “evening”';
    micBtn?.classList.add('is-listening');
    micBtn?.classList.remove('is-denied');

    /** Hard rules: explicit morning/evening beats vague "start session" / time-of-day */
    const pickSlot = (transcript, result) => {
      const candidates = [transcript, ...(result?.alternatives || [])]
        .map((c) => String(c || '').trim())
        .filter(Boolean);
      for (const c of candidates) {
        const low = c.toLowerCase();
        if (
          /^(hello|hi+|hey|namaste|namaskar)[\s!,.]*$/i.test(low) ||
          (/^good (morning|evening|afternoon)\b/.test(low) &&
            !/\b(session|shuru|start|begin|karo|subah|shaam)\b/.test(low))
        ) {
          continue;
        }
        const intent = VoiceLayer.matchIntentAnyLanguage(c);
        if (intent === 'start_evening') return 'evening';
        if (intent === 'start_morning') return 'morning';
        if (/\b(evening|shaam|sham|शाम|gadholi|sondhya|night)\b/.test(low)) return 'evening';
        if (/\b(morning|subah|सुबह|sopuah|sokal)\b/.test(low)) return 'morning';
        if (intent === 'start_generic' || intent === 'yes') {
          return this.resolveSlotFromIntent(intent, progress);
        }
      }
      return null;
    };

    const onHeard = async (transcript, result) => {
      if (!transcript || this._starting) return false;
      if (Date.now() < (this._greetQuietUntil || 0)) return false;
      if (VoiceLayer.isLikelyEcho?.(transcript)) return false;

      if (typeof SessionI18n !== 'undefined') {
        for (const c of [transcript, ...(result?.alternatives || [])]) {
          const detected = SessionI18n.detectFromSpeech?.(c);
          if (detected && !String(detected).startsWith('as')) SessionI18n.lockLang(detected);
        }
      }

      if (label) label.textContent = `Heard “${String(transcript).slice(0, 40)}”`;
      const slot = pickSlot(transcript, result);
      if (!slot) {
        if (label) label.textContent = L?.listening || 'Listening… say morning or evening';
        return false;
      }

      if (label) {
        label.textContent =
          slot === 'morning' ? 'Starting morning…' : 'Starting evening…';
      }
      micBtn?.classList.remove('is-listening', 'is-hearing');
      this.beginSession(slot);
      return true;
    };

    const openWebSpeech = () => {
      if (label) label.textContent = L?.listening || 'Listening… say “morning” or “evening”';
      VoiceLayer.startCallChannel({
        lang,
        onStatus: (s) => {
          micBtn?.classList.toggle('is-listening', s === 'listening' || s === 'hearing');
          micBtn?.classList.toggle('is-hearing', s === 'hearing');
          if (!label) return;
          if (s === 'denied') {
            micBtn?.classList.add('is-denied');
            label.textContent = 'Mic blocked — allow microphone, then refresh';
          } else if (s === 'unavailable') {
            label.textContent = 'Voice unavailable — tap Morning or Evening';
          } else if (s === 'hearing') {
            label.textContent = 'Hearing you…';
          } else if (s === 'listening') {
            label.textContent = L?.listening || 'Listening… say “morning” or “evening”';
          }
        },
        onPartial: (live) => {
          if (!label || this._starting) return;
          const clip = String(live).trim().slice(0, 42);
          if (clip) label.textContent = `Hearing: “${clip}”`;
        },
        onHeard,
      });
    };

    // Native home voice: continuous Web Speech + big Morning/Evening buttons (chips).
    openWebSpeech();
  },

  /** Mic tap — re-arm native listening (no cloud STT) */
  async cloudPushToTalk(lang, L, progress) {
    if (this._starting) return;
    const label = document.getElementById('ph-mic-label');
    if (label) label.textContent = L?.listening || 'Listening… say morning or evening';
    this._armed = false;
    this.startAlwaysListening(lang, L, progress);
  },

  /** Home / session speak lang — Assam / default demos use Hindi greetings */
  homeSpeakLang(patientLang, patient) {
    const code = String(patientLang || patient?.language_code || patient?.languageCode || '').toLowerCase();
    const region = `${patient?.region_state || patient?.regionState || ''} ${
      patient?.hometown || ''
    }`.toLowerCase();
    const assam =
      code.startsWith('as') ||
      /assam|guwahati|dispur|jorhat|dibrugarh|tezpur|silchar|as-in/.test(region);

    if (code.startsWith('bn')) return 'bn-IN';
    if (code.startsWith('hi') || code.startsWith('as') || assam) return 'hi-IN';
    // MindCare NER default: Hindi voice (not bare English Good morning)
    if (!code || code.startsWith('en')) return 'hi-IN';
    const pack =
      typeof VoicePhrases !== 'undefined' ? VoicePhrases.resolvePack?.(code) : 'en';
    if (pack === 'bn') return 'bn-IN';
    return 'hi-IN';
  },

  resolveSlotFromIntent(intent, progress) {
    const hour = new Date().getHours();
    const p = progress || {};

    // Explicit slot — never swap evening↔morning
    if (intent === 'start_morning') return 'morning';
    if (intent === 'start_evening') return 'evening';

    if (intent === 'start_generic' || intent === 'yes') {
      if (hour < 15 && !p.morning) return 'morning';
      if (!p.evening) return 'evening';
      if (!p.morning) return 'morning';
      return hour < 15 ? 'morning' : 'evening';
    }
    return null;
  },

  teardown() {
    this._armed = false;
    if (typeof VoiceLayer !== 'undefined') VoiceLayer.stop();
  },

  buildDailyCopy(name, L) {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();

    const tod = L
      ? hour < 12
        ? L.todMorning
        : hour < 17
          ? L.todAfternoon
          : L.todEvening
      : hour < 12
        ? 'Good morning'
        : hour < 17
          ? 'Good afternoon'
          : 'Good evening';

    const headline = L?.greeting?.(name, tod) || `${tod}, ${name}`;
    if (L?.voiceNudge) {
      return { headline, nudge: L.voiceNudge };
    }
    const nudges = [
      'Let’s ease into the day.',
      'Let’s get you ready.',
      'Shall we begin your routine?',
      'Let’s get started.',
      'A quiet moment for memory.',
      'Ready when you are.',
      'Let’s make today gentle.',
    ];

    return { headline, nudge: nudges[day] || 'Let’s get started.' };
  },

  beginSession(sessionType) {
    if (!this.patientId || !sessionType) return;
    if (this._starting) return;
    this._starting = true;
    this._armed = false;
    this.teardown();
    document.getElementById('main-app')?.classList.add('is-session-active');

    const lang = this.homeSpeakLang(
      this.patient?.language_code || this.patient?.languageCode,
      this.patient
    );
    if (window.app) {
      window.app.sessionSpeakLang = lang;
      if (String(lang).toLowerCase().startsWith('hi')) {
        window.app.sessionSpeakLangLocked = 'hi-IN';
      }
    }
    const L = typeof PatientLocales !== 'undefined' ? PatientLocales.forLang(lang) : null;
    const msg =
      sessionType === 'morning'
        ? L?.startingMorning || 'Starting morning session'
        : L?.startingEvening || 'Starting evening session';

    const go = () => {
      this._starting = false;
      SessionStart.startSession(this.patientId, sessionType);
    };
    this._pendingSessionType = sessionType;

    if (typeof VoiceLayer !== 'undefined') {
      VoiceLayer.speak(msg, { lang, onEnd: go });
      window.setTimeout(() => {
        if (this._starting) go();
      }, 4500);
    } else {
      go();
    }
  },

  async resolvePatient(patientId) {
    let patient = null;
    if (patientId) patient = await LocalDB.get('patients', patientId).catch(() => null);
    if (!patient && window.app?.currentPatient?.id) {
      patient = window.app.currentPatient;
      if (!patient.fullName && !patient.full_name && !patient.preferredName) {
        patient = (await LocalDB.get('patients', patient.id).catch(() => null)) || patient;
      }
    }
    if (!patient) {
      const all = (await LocalDB.getAll('patients').catch(() => [])) || [];
      patient = all[0] || null;
    }
    if (!patient && navigator.onLine) {
      try {
        const server = await API.getPatients();
        if (server?.length) {
          for (const p of server) {
            await LocalDB.put('patients', {
              id: p.id,
              caregiverId: p.caregiver_id || p.caregiverId,
              fullName: p.full_name || p.fullName,
              preferredName: p.preferred_name || p.preferredName,
              hometown: p.hometown,
              languageCode: p.language_code || p.languageCode,
              ...p,
            });
          }
          patient = {
            id: server[0].id,
            fullName: server[0].full_name,
            preferredName: server[0].preferred_name,
            hometown: server[0].hometown,
            languageCode: server[0].language_code,
            ...server[0],
          };
        }
      } catch (_) {}
    }
    if (patient && window.app) window.app.currentPatient = patient;
    return patient;
  },

  async resolveName(patient) {
    const fromPatient =
      patient?.preferred_name ||
      patient?.preferredName ||
      (patient?.full_name || patient?.fullName || '').split(/\s+/).filter(Boolean)[0] ||
      '';
    const title = (s) => {
      const t = String(s || '').trim();
      if (!t) return '';
      return t.charAt(0).toUpperCase() + t.slice(1);
    };
    if (fromPatient) {
      const cleaned = title(fromPatient);
      const bad = /^(anjali|anjani|friend|demo)$/i.test(cleaned);
      if (!bad) {
        await LocalDB.setMeta?.('patientPreferredName', cleaned).catch(() => {});
        return cleaned;
      }
    }
    const meta = await LocalDB.getMeta?.('patientPreferredName').catch(() => null);
    if (meta && !/^(anjali|anjani|friend|demo)$/i.test(String(meta))) {
      return title(meta);
    }
    return title(fromPatient) || 'friend';
  },

  escape(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  async getTodayProgress(patientId) {
    const empty = {
      morning: false,
      evening: false,
      morningScore: null,
      eveningScore: null,
      streak: 0,
    };
    if (!patientId) return empty;
    let sessions = [];
    try {
      sessions =
        (await LocalDB.getAllByIndex('sessions', 'patientId', patientId).catch(() => [])) || [];
      if (!sessions.length) {
        const all = (await LocalDB.getAll('sessions').catch(() => [])) || [];
        sessions = all.filter((s) => (s.patientId || s.patient_id) === patientId);
      } else {
        sessions = sessions.filter((s) => (s.patientId || s.patient_id) === patientId);
      }
    } catch (_) {
      return empty;
    }

    const today = new Date().toISOString().slice(0, 10);
    let morning = false;
    let evening = false;
    let morningScore = null;
    let eveningScore = null;

    for (const s of sessions) {
      const started = s.startedAt || s.started_at || '';
      const type = s.sessionType || s.session_type;
      const status = s.status;
      if (!String(started).startsWith(today)) continue;
      if (status !== 'completed' && status !== 'complete') continue;
      const score = s.compositeScore ?? s.composite_score;
      if (type === 'morning') {
        morning = true;
        morningScore = score != null ? `${Math.round(Number(score))}%` : null;
      }
      if (type === 'evening') {
        evening = true;
        eveningScore = score != null ? `${Math.round(Number(score))}%` : null;
      }
    }

    const daysWithSession = new Set();
    for (const s of sessions) {
      const started = s.startedAt || s.started_at || '';
      if (s.status !== 'completed' && s.status !== 'complete') continue;
      if (started.length >= 10) daysWithSession.add(started.slice(0, 10));
    }
    let streak = 0;
    const cursor = new Date();
    for (let i = 0; i < 30; i++) {
      const key = cursor.toISOString().slice(0, 10);
      if (daysWithSession.has(key)) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else if (i === 0) {
        cursor.setDate(cursor.getDate() - 1);
      } else break;
    }

    return { morning, evening, morningScore, eveningScore, streak };
  },
};
