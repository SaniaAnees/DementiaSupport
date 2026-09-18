// Main application controller
window.app = {
  state: 'loading',
  currentView: 'auth',
  caregiver: null,
  currentPatient: null,
  _booted: false,

  async init() {
    OTPAuth.bindUi?.();
    showScreen('splash-screen');
    const bootStarted = performance.now();

    // Light boot only — register the service worker AFTER the welcome route so
    // skipWaiting/claim cannot reload the tab mid-splash.
    try {
      await LocalDB.openDB?.();
    } catch (err) {
      console.warn('LocalDB open failed:', err);
    }
    try {
      await LocalDB.seedDemo?.();
    } catch (_) {}
    SyncManager.init?.();

    // Welcome must stay on screen for a full beat AFTER boot finishes
    const elapsed = performance.now() - bootStarted;
    const minWelcomeMs = 2400;
    if (elapsed < minWelcomeMs) await this.wait(minWelcomeMs - elapsed);

    this._booted = true;
    await this.continueAfterSplash();

    // Offline support after first paint — never force a hard reload on activate
    this.registerServiceWorkerQuiet();
  },

  registerServiceWorkerQuiet() {
    if (!('serviceWorker' in navigator)) return;
    window.setTimeout(async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        reg.update?.().catch(() => {});
        // Intentionally no location.reload() on controllerchange — that was
        // skipping the welcome splash and dumping users onto the intro collage.
      } catch (err) {
        console.warn('Service Worker registration failed:', err);
      }
    }, 1500);
  },

  holdSplash(durationMs = 2000) {
    showScreen('splash-screen');
    return new Promise((resolve) => {
      window.setTimeout(resolve, durationMs);
    });
  },

  fadeOutSplash(ms = 850) {
    return new Promise((resolve) => {
      const splash = document.getElementById('splash-screen');
      splash?.classList.add('splash-exit');
      window.setTimeout(() => {
        showScreen('splash-screen', false);
        splash?.classList.remove('splash-exit');
        resolve();
      }, ms);
    });
  },

  wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  },

  /** Logged-out users stay on the welcome splash until they tap (no auto-jump to intro). */
  waitForWelcomeContinue() {
    return new Promise((resolve) => {
      const splash = document.getElementById('splash-screen');
      if (!splash) {
        resolve();
        return;
      }
      splash.classList.add('is-ready');
      splash.setAttribute('role', 'button');
      splash.setAttribute('tabindex', '0');
      splash.setAttribute('aria-label', 'Continue into MindCare');

      const finish = () => {
        splash.classList.remove('is-ready');
        splash.removeAttribute('role');
        splash.removeAttribute('tabindex');
        splash.removeAttribute('aria-label');
        splash.removeEventListener('click', onClick);
        splash.removeEventListener('keydown', onKey);
        resolve();
      };
      const onClick = () => finish();
      const onKey = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          finish();
        }
      };
      splash.addEventListener('click', onClick);
      splash.addEventListener('keydown', onKey);
    });
  },

  async continueAfterSplash() {
    // Returning user with valid session
    if (Session.isValid()) {
      const needsOnboard = await OnboardFlow.needsOnboarding?.();
      if (needsOnboard && typeof OnboardFlow !== 'undefined') {
        await this.crossfadeToOnboard({ from: 'splash' });
      } else {
        await this.crossfadeToDashboard({ from: 'splash' });
      }
      return;
    }

    // First-time / logged out — keep welcome until tap, then collage intro → OTP
    await this.waitForWelcomeContinue();
    await this.crossfadeToIntro();
  },

  crossfadeToIntro() {
    return new Promise((resolve) => {
      if (typeof IntroPage === 'undefined') {
        console.error('IntroPage missing — falling through to OTP');
        this.fadeOutSplash().then(() => {
          this.showOtpPage();
          resolve();
        });
        return;
      }

      const splash = document.getElementById('splash-screen');
      const intro = document.getElementById('intro-screen');

      intro.classList.remove('hidden', 'intro-exit', 'is-visible', 'is-active');
      void intro.offsetWidth;

      IntroPage.start(() => {
        this.showOtpPage();
        resolve();
      });

      window.requestAnimationFrame(() => {
        intro.classList.add('is-visible', 'is-active');
        splash?.classList.add('splash-exit');
      });

      window.setTimeout(() => {
        showScreen('splash-screen', false);
        splash?.classList.remove('splash-exit');
      }, 900);
    });
  },

  showIntro() {
    return this.crossfadeToIntro();
  },

  showOtpPage() {
    this.state = 'auth';
    showScreen('intro-screen', false);
    document.getElementById('intro-screen')?.classList.remove('is-visible', 'is-active');
    OTPAuth.showAuthPage();
  },

  showAuthGate() {
    Session.clear();
    this.state = 'auth';
    const main = document.getElementById('main-app');
    main?.classList.add('hidden');
    main?.classList.remove('is-visible');
    document.getElementById('onboard-gate')?.classList.add('hidden');
    document.getElementById('onboard-gate')?.classList.remove('is-visible');
    OnboardFlow?.stopCamera?.();
    this.showOtpPage();
  },

  /**
   * Smooth entry to onboarding (“Let’s set up care”).
   * from: 'splash' | 'auth' | 'none'
   */
  async crossfadeToOnboard({ from = 'none' } = {}) {
    if (typeof OnboardFlow === 'undefined') return;

    const gate = document.getElementById('onboard-gate');
    const splash = document.getElementById('splash-screen');
    const auth = document.getElementById('auth-gate');
    const intro = document.getElementById('intro-screen');
    const main = document.getElementById('main-app');

    main?.classList.add('hidden');
    main?.classList.remove('is-visible');
    showScreen('intro-screen', false);
    intro?.classList.remove('is-visible', 'is-active');

    OnboardFlow.prepare();

    gate?.classList.remove('hidden', 'onboard-exit');
    if (from === 'none') {
      gate?.classList.remove('is-visible');
      void gate?.offsetWidth;
      requestAnimationFrame(() => gate?.classList.add('is-visible'));
      await this.wait(560);
    } else {
      // Fully paint under splash/auth, then fade the overlay away
      gate?.classList.add('is-visible');
      void gate?.offsetWidth;
      await this.wait(40);

      if (from === 'splash') {
        splash?.classList.add('splash-exit');
        await this.wait(900);
        showScreen('splash-screen', false);
        splash?.classList.remove('splash-exit');
      } else if (from === 'auth') {
        auth?.classList.add('auth-exit');
        auth?.classList.remove('is-visible');
        await this.wait(580);
        auth?.classList.add('hidden');
        auth?.classList.remove('auth-exit');
      }
    }

    if (from !== 'splash') {
      showScreen('splash-screen', false);
      splash?.classList.remove('splash-exit');
    }
    if (from !== 'auth') {
      auth?.classList.add('hidden');
      auth?.classList.remove('is-visible', 'auth-exit');
    }

    // Welcome step waits for Continue — no auto-skip to profiles
    OnboardFlow.armWelcomeContinue?.();
  },

  /**
   * Smooth entry to patient dashboard.
   * from: 'splash' | 'onboard' | 'auth' | 'none'
   * Overlay fades out over a fully painted dashboard underneath.
   */
  async crossfadeToDashboard({ from = 'none', mode = 'patient' } = {}) {
    this.bindModeToggle();
    await this.loadDefaultPatient();

    const main = document.getElementById('main-app');
    const splash = document.getElementById('splash-screen');
    const onboard = document.getElementById('onboard-gate');
    const auth = document.getElementById('auth-gate');
    const intro = document.getElementById('intro-screen');

    main?.classList.remove('hidden');
    // Paint dashboard under the current overlay so the reveal is one clean fade
    if (from === 'none') {
      main?.classList.remove('is-visible');
    } else {
      main?.classList.add('is-visible');
    }

    this.setMode(mode);
    this.updateSyncStatus();
    void main?.offsetWidth;
    await this.wait(40);

    if (from === 'splash') {
      splash?.classList.add('splash-exit');
      await this.wait(900);
      showScreen('splash-screen', false);
      splash?.classList.remove('splash-exit');
    } else if (from === 'onboard') {
      onboard?.classList.add('onboard-exit');
      onboard?.classList.remove('is-visible');
      await this.wait(580);
      onboard?.classList.add('hidden');
      onboard?.classList.remove('onboard-exit');
    } else if (from === 'auth') {
      auth?.classList.add('auth-exit');
      auth?.classList.remove('is-visible');
      await this.wait(580);
      auth?.classList.add('hidden');
      auth?.classList.remove('auth-exit');
    } else {
      requestAnimationFrame(() => main?.classList.add('is-visible'));
      await this.wait(560);
    }

    // Clear leftover gates
    showScreen('intro-screen', false);
    intro?.classList.remove('is-visible', 'is-active');
    if (from !== 'auth') {
      auth?.classList.add('hidden');
      auth?.classList.remove('is-visible', 'auth-exit');
    }
    if (from !== 'onboard') {
      onboard?.classList.add('hidden');
      onboard?.classList.remove('is-visible', 'onboard-exit');
    }
    if (from !== 'splash') {
      showScreen('splash-screen', false);
      splash?.classList.remove('splash-exit');
    }
  },

  showDashboard(opts = {}) {
    return this.crossfadeToDashboard({
      from: opts.from || (opts.fadeIn ? 'none' : 'none'),
      mode: opts.mode || 'patient',
    });
  },

  bindModeToggle() {
    if (this._modeToggleBound) return;
    this._modeToggleBound = true;
    document.getElementById('mode-patient-btn')?.addEventListener('click', () => {
      this.setMode('patient');
    });
    document.getElementById('mode-caregiver-btn')?.addEventListener('click', () => {
      this.setMode('caregiver');
    });
  },

  setMode(mode) {
    const isPatient = mode === 'patient';
    this.state = isPatient ? 'patient' : 'dashboard';
    this.currentView = mode;

    const patientBtn = document.getElementById('mode-patient-btn');
    const caregiverBtn = document.getElementById('mode-caregiver-btn');
    patientBtn?.classList.toggle('is-active', isPatient);
    caregiverBtn?.classList.toggle('is-active', !isPatient);
    patientBtn?.setAttribute('aria-selected', String(isPatient));
    caregiverBtn?.setAttribute('aria-selected', String(!isPatient));

    if (isPatient) {
      showScreen('caregiver-view', false);
      document.getElementById('caregiver-view')?.classList.add('hidden');
      showScreen('patient-view');
      document.getElementById('patient-view')?.classList.remove('hidden');
      const pid = this.currentPatient?.id || null;
      if (typeof PatientHome !== 'undefined') {
        PatientHome.render(pid);
      } else if (typeof SessionStart !== 'undefined') {
        SessionStart.render(pid);
      } else {
        const box = document.getElementById('session-container');
        if (box) {
          box.innerHTML =
            '<div class="ph-home"><p class="ph-empty">Patient home failed to load. Refresh once.</p></div>';
        }
      }
    } else {
      // Voice is patient-only — hard cut when entering caregiver
      try {
        if (typeof PatientHome !== 'undefined') PatientHome.teardown?.();
      } catch (_) {}
      try {
        if (typeof SessionPlay !== 'undefined') {
          SessionPlay._quizListenActive = false;
          SessionPlay.listening = false;
        }
      } catch (_) {}
      try {
        if (typeof VoiceLayer !== 'undefined') {
          VoiceLayer.stop?.();
          VoiceLayer.stopSpeaking?.();
          VoiceLayer.stopListening?.();
        }
      } catch (_) {}
      try {
        speechSynthesis?.cancel?.();
      } catch (_) {}
      document.getElementById('main-app')?.classList.remove('is-session-active');
      showScreen('patient-view', false);
      document.getElementById('patient-view')?.classList.add('hidden');
      showScreen('caregiver-view');
      document.getElementById('caregiver-view')?.classList.remove('hidden');
      if (typeof CaregiverHome !== 'undefined') {
        CaregiverHome.init();
      }
    }
  },

  async loadDefaultPatient() {
    let patients = await LocalDB.getAll('patients');
    if (navigator.onLine) {
      const server = await API.getPatients().catch(() => null);
      if (Array.isArray(server) && server.length) {
        const serverIds = new Set(server.map((p) => p.id));
        for (const local of patients) {
          if (!serverIds.has(local.id)) {
            await LocalDB.delete?.('patients', local.id).catch(() => {});
          }
        }
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
        patients = server;
      }
    }
    if (patients.length > 0) {
      const pick =
        patients.find((p) => {
          const n = (p.preferred_name || p.preferredName || '').toLowerCase();
          return n && !/^(anjali|anjani|friend|demo)$/.test(n);
        }) || patients[0];
      this.currentPatient = {
        id: pick.id,
        fullName: pick.full_name || pick.fullName,
        preferredName: pick.preferred_name || pick.preferredName,
        hometown: pick.hometown,
        languageCode: pick.language_code || pick.languageCode,
        ...pick,
      };
      const name =
        this.currentPatient.preferredName ||
        this.currentPatient.preferred_name ||
        (this.currentPatient.fullName || this.currentPatient.full_name || '').split(/\s+/)[0];
      if (name && !/^(anjali|anjani|friend|demo)$/i.test(name)) {
        await LocalDB.setMeta?.('patientPreferredName', name).catch(() => {});
      }
    }
  },

  showPatientView(patientId) {
    if (patientId) {
      this.currentPatient = this.currentPatient?.id === patientId
        ? this.currentPatient
        : { ...(this.currentPatient || {}), id: patientId };
      // Prefer full record when available
      LocalDB.get('patients', patientId).then((p) => {
        if (p) this.currentPatient = p;
      }).catch(() => {});
    }
    const main = document.getElementById('main-app');
    main?.classList.remove('hidden');
    main?.classList.add('is-visible');
    this.bindModeToggle();
    this.setMode('patient');
  },

  updateSyncStatus() {
    const status = SyncManager.getSyncStatus();
    const syncBtn = document.getElementById('sync-btn');
    if (syncBtn) {
      syncBtn.textContent = status === 'online' ? '🟢' : '🔴';
      syncBtn.title = `Connection: ${status}`;
    }
  },
};

function showScreen(id, show = true) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('hidden', !show);
}

document.addEventListener('DOMContentLoaded', () => {
  // Logout lives in Caregiver → Settings (data-cg-logout)
  app.init();
});

window.addEventListener('load', () => {
  if (navigator.onLine) {
    SyncManager.flush?.();
  }
});
