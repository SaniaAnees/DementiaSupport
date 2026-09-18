/**
 * Patient home — greeting + morning/evening buttons (tap) + optional voice.
 * Some patients use buttons; others can speak “start morning / evening”.
 */
const PatientHome = {
  patientId: null,
  patient: null,

  async render(patientId) {
    this.patientId = patientId || window.app?.currentPatient?.id || null;
    const content = document.getElementById('session-container');
    if (!content) return;

    this.teardown();

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

      const lang = patient?.language_code || patient?.languageCode || 'en-IN';
      const L = typeof PatientLocales !== 'undefined' ? PatientLocales.forLang(lang) : null;
      const name = await this.resolveName(patient);
      const progress = await this.getTodayProgress(this.patientId);
      const copy = this.buildDailyCopy(name, L);
      const micHint = L?.sayAnything
        ? `${L.sayAnything} — “start morning”`
        : 'Or say “start morning”';

      content.innerHTML = `
        <div class="ph-home">
          <header class="ph-hello">
            <p class="ph-greeting">${this.escape(copy.headline)}</p>
            <p class="ph-nudge">${this.escape(copy.nudge)}</p>
          </header>

          <div class="ph-actions">
            <button type="button" class="ph-session" id="ph-morning-btn" data-type="morning">
              <span class="ph-session-copy">
                <span class="ph-session-title">Morning session</span>
                <span class="ph-session-sub">Orientation, memory, and family story</span>
              </span>
              <span class="ph-session-go" aria-hidden="true">→</span>
            </button>
            <button type="button" class="ph-session" id="ph-evening-btn" data-type="evening">
              <span class="ph-session-copy">
                <span class="ph-session-title">Evening session</span>
                <span class="ph-session-sub">Recall the day, then family story</span>
              </span>
              <span class="ph-session-go" aria-hidden="true">→</span>
            </button>
          </div>

          <p class="ph-status" aria-label="Today's progress">
            <span>Morning <em class="${progress.morning ? 'is-done' : ''}">${progress.morning ? 'done' : 'ready'}</em></span>
            <span class="ph-status-dot" aria-hidden="true">·</span>
            <span>Evening <em class="${progress.evening ? 'is-done' : ''}">${progress.evening ? 'done' : 'ready'}</em></span>
            ${
              progress.streak > 0
                ? `<span class="ph-status-dot" aria-hidden="true">·</span><span class="ph-streak">${progress.streak}-day streak</span>`
                : ''
            }
          </p>

          <button type="button" class="ph-mic-btn" id="ph-mic-btn" aria-label="Speak to start">
            <span class="ph-mic-ring" aria-hidden="true"></span>
            <span class="ph-mic-label" id="ph-mic-label">${this.escape(micHint)}</span>
          </button>
        </div>
      `;

      document.getElementById('ph-morning-btn')?.addEventListener('click', () => {
        if (!this.patientId) return;
        this.beginSession('morning');
      });
      document.getElementById('ph-evening-btn')?.addEventListener('click', () => {
        if (!this.patientId) return;
        this.beginSession('evening');
      });
      document.getElementById('ph-mic-btn')?.addEventListener('click', () => {
        this.onMicTap();
      });

      try {
        const line = `${copy.headline}. ${copy.nudge}`;
        if (typeof VoiceLayer !== 'undefined') {
          VoiceLayer.speak(line, { lang });
        } else if (typeof Voice !== 'undefined') {
          Voice.speak(line);
        }
      } catch (_) {}
    } catch (err) {
      console.error('PatientHome.render failed:', err);
      content.innerHTML = `
        <div class="ph-home">
          <header class="ph-hello">
            <p class="ph-greeting">Welcome</p>
            <p class="ph-nudge">Let’s get started.</p>
          </header>
          <div class="ph-actions">
            <button type="button" class="ph-session" id="ph-morning-btn">
              <span class="ph-session-copy">
                <span class="ph-session-title">Morning session</span>
                <span class="ph-session-sub">Tap to begin</span>
              </span>
              <span class="ph-session-go" aria-hidden="true">→</span>
            </button>
            <button type="button" class="ph-session" id="ph-evening-btn">
              <span class="ph-session-copy">
                <span class="ph-session-title">Evening session</span>
                <span class="ph-session-sub">Tap to begin</span>
              </span>
              <span class="ph-session-go" aria-hidden="true">→</span>
            </button>
          </div>
        </div>`;
      document.getElementById('ph-morning-btn')?.addEventListener('click', () => {
        if (this.patientId) this.beginSession('morning');
      });
      document.getElementById('ph-evening-btn')?.addEventListener('click', () => {
        if (this.patientId) this.beginSession('evening');
      });
    }
  },

  teardown() {
    if (typeof VoiceLayer !== 'undefined') VoiceLayer.stop();
  },

  buildDailyCopy(name, L) {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();

    const tod =
      L
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

    const nudges = [
      'Let’s ease into the day.',
      'Let’s get you ready.',
      'Shall we begin your routine?',
      'Let’s get started.',
      'A quiet moment for memory.',
      'Ready when you are.',
      'Let’s make today gentle.',
    ];

    return {
      headline,
      nudge: nudges[day] || 'Let’s get started.',
    };
  },

  beginSession(sessionType) {
    if (!this.patientId || !sessionType) return;
    if (this._starting) return;
    this._starting = true;
    this.teardown();

    const lang = this.patient?.language_code || this.patient?.languageCode || 'en-IN';
    const L = typeof PatientLocales !== 'undefined' ? PatientLocales.forLang(lang) : null;
    const msg =
      sessionType === 'morning'
        ? L?.startingMorning || 'Starting morning session'
        : L?.startingEvening || 'Starting evening session';

    const go = () => {
      this._starting = false;
      SessionStart.startSession(this.patientId, sessionType);
    };

    if (typeof VoiceLayer !== 'undefined') {
      VoiceLayer.speak(msg, { lang, onEnd: go });
      window.setTimeout(() => {
        if (this._starting) go();
      }, 4000);
    } else {
      go();
    }
  },

  async onMicTap() {
    const label = document.getElementById('ph-mic-label');
    const btn = document.getElementById('ph-mic-btn');
    if (!this.patientId) {
      if (label) label.textContent = 'Add a patient in Caregiver first';
      return;
    }

    if (typeof VoiceLayer === 'undefined') {
      if (label) label.textContent = 'Tap Morning or Evening to begin';
      return;
    }

    const lang = this.patient?.language_code || this.patient?.languageCode || 'en-IN';
    const L = typeof PatientLocales !== 'undefined' ? PatientLocales.forLang(lang) : null;

    btn?.classList.add('is-listening');
    if (label) label.textContent = L?.listening || 'Listening…';

    try {
      const result = await VoiceLayer.listenOnce({ lang, timeoutMs: 6000 });
      btn?.classList.remove('is-listening');

      if (!result?.transcript) {
        if (label) label.textContent = 'Didn’t catch that — tap a session';
        VoiceLayer.speak(L?.sayAnything || 'Please tap morning or evening.', { lang });
        return;
      }

      const intent = VoiceLayer.matchIntent(result.transcript, lang);
      if (intent === 'start_morning' || (intent === 'start_generic' && new Date().getHours() < 15)) {
        if (label) label.textContent = L?.startingMorning || 'Starting morning…';
        this.beginSession('morning');
        return;
      }
      if (intent === 'start_evening' || intent === 'start_generic') {
        if (label) label.textContent = L?.startingEvening || 'Starting evening…';
        this.beginSession('evening');
        return;
      }
      if (intent === 'repeat') {
        this.render(this.patientId);
        return;
      }

      if (label) label.textContent = 'Try “start morning” or tap above';
      VoiceLayer.speak('Please say start morning, or tap the button.', { lang });
    } catch (_) {
      btn?.classList.remove('is-listening');
      if (label) label.textContent = 'Mic unavailable — tap a session';
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
    if (fromPatient) {
      await LocalDB.setMeta?.('patientPreferredName', fromPatient).catch(() => {});
      return fromPatient;
    }
    const meta = await LocalDB.getMeta?.('patientPreferredName').catch(() => null);
    return meta ? String(meta) : 'friend';
  },

  escape(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  async getTodayProgress(patientId) {
    const empty = { morning: false, evening: false, morningScore: null, eveningScore: null, streak: 0 };
    if (!patientId) return empty;
    let sessions = [];
    try {
      sessions =
        (await LocalDB.getAllByIndex('sessions', 'patientId', patientId).catch(() => null)) ||
        (await LocalDB.getAll('sessions').catch(() => [])) ||
        [];
      sessions = sessions.filter((s) => (s.patientId || s.patient_id) === patientId);
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
