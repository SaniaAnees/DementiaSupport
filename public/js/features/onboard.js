// First-time onboarding after OTP — landscape UI, not dashboard forms
window.OnboardFlow = {
  patientId: null,
  role: null,
  severity: null,
  relation: null,
  pendingImage: null,
  faces: [],
  stream: null,
  WELCOME_MS: 2800,

  async needsOnboarding() {
    try {
      const done = await LocalDB.getMeta?.('onboardingComplete');
      if (done === 'true') return false;
      const patients = await LocalDB.getAll?.('patients') || [];
      if (patients.length > 0) return false;
      if (navigator.onLine) {
        const server = await API.getPatients().catch(() => []);
        if (server?.length) {
          for (const p of server) await LocalDB.put('patients', this.normalizePatient(p));
          return false;
        }
      }
      return true;
    } catch {
      return true;
    }
  },

  normalizePatient(p) {
    return {
      id: p.id,
      caregiverId: p.caregiver_id || p.caregiverId,
      fullName: p.full_name || p.fullName,
      preferredName: p.preferred_name || p.preferredName,
      age: p.age,
      hometown: p.hometown,
      languageCode: p.language_code || p.languageCode,
      language_code: p.language_code || p.languageCode,
      languageLabel: p.language_label || p.languageLabel,
      dementiaNotes: p.dementia_notes || p.dementiaNotes,
      ...p,
    };
  },

  prepare() {
    this.clearWelcomeTimer();
    const gate = document.getElementById('onboard-gate');
    gate?.classList.remove('hidden', 'onboard-exit');
    this.showStep('onboard-welcome');
  },

  /** Prefer Continue button — timer kept only as unused fallback */
  armWelcomeTimer() {
    this.armWelcomeContinue();
  },

  armWelcomeContinue() {
    this.clearWelcomeTimer();
    const btn = document.getElementById('ob-welcome-continue');
    if (!btn) {
      // Legacy markup: soft auto-advance after a long pause
      this._welcomeTimer = window.setTimeout(() => this.showProfiles(), 6000);
      return;
    }
    const next = () => {
      btn.removeEventListener('click', next);
      this.showProfiles();
    };
    btn.addEventListener('click', next, { once: true });
  },

  clearWelcomeTimer() {
    if (this._welcomeTimer) {
      window.clearTimeout(this._welcomeTimer);
      this._welcomeTimer = null;
    }
  },

  /** Direct start (no overlay). Prefer app.crossfadeToOnboard when coming from splash/OTP. */
  start() {
    this.prepare();
    const gate = document.getElementById('onboard-gate');
    gate?.classList.remove('is-visible');
    void gate?.offsetWidth;
    requestAnimationFrame(() => gate?.classList.add('is-visible'));
    this.armWelcomeContinue();
  },

  hide() {
    this.clearWelcomeTimer();
    const gate = document.getElementById('onboard-gate');
    gate?.classList.add('onboard-exit');
    gate?.classList.remove('is-visible');
    window.setTimeout(() => {
      gate?.classList.add('hidden');
      gate?.classList.remove('onboard-exit');
    }, 480);
  },

  showStep(id) {
    ['onboard-welcome', 'onboard-profiles', 'onboard-place', 'onboard-family'].forEach((sid) => {
      const el = document.getElementById(sid);
      if (!el) return;
      const show = sid === id;
      if (show) {
        el.classList.remove('hidden');
        el.classList.remove('ob-step-enter');
        void el.offsetWidth;
        el.classList.add('ob-step-enter');
      } else {
        el.classList.add('hidden');
        el.classList.remove('ob-step-enter');
      }
    });
  },

  showProfiles() {
    this.clearWelcomeTimer();
    this.showStep('onboard-profiles');
    document.getElementById('ob-profiles-continue')?.addEventListener(
      'click',
      () => this.saveProfilesStep(),
      { once: true }
    );
  },

  bindChips() {
    /* chips removed — free text only */
  },

  /** Step 1: caregiver + patient name → language & place */
  saveProfilesStep() {
    const status = document.getElementById('ob-profiles-status');
    const cgName = document.getElementById('ob-caregiver-name')?.value?.trim();
    const role = document.getElementById('ob-caregiver-role')?.value?.trim();
    const pName = document.getElementById('ob-patient-name')?.value?.trim();

    if (!cgName) {
      status.textContent = 'Please enter your name';
      status.className = 'onboard-status is-error';
      document.getElementById('ob-profiles-continue')?.addEventListener(
        'click',
        () => this.saveProfilesStep(),
        { once: true }
      );
      return;
    }
    if (!role) {
      status.textContent = 'Please enter your role';
      status.className = 'onboard-status is-error';
      document.getElementById('ob-profiles-continue')?.addEventListener(
        'click',
        () => this.saveProfilesStep(),
        { once: true }
      );
      return;
    }
    if (!pName) {
      status.textContent = 'Please enter their name';
      status.className = 'onboard-status is-error';
      document.getElementById('ob-profiles-continue')?.addEventListener(
        'click',
        () => this.saveProfilesStep(),
        { once: true }
      );
      return;
    }

    this.role = role;
    this._draft = {
      caregiverName: cgName,
      caregiverRole: role,
      patientName: pName,
    };
    status.textContent = '';
    status.className = 'onboard-status';
    this.showPlace();
  },

  showPlace() {
    this.showStep('onboard-place');
    const langSelect = document.getElementById('ob-patient-language');
    const otherWrap = document.getElementById('ob-language-other-wrap');

    if (langSelect && !langSelect.dataset.bound) {
      langSelect.dataset.bound = '1';
      langSelect.addEventListener('change', () => {
        const isOther = langSelect.value === 'other';
        otherWrap?.classList.toggle('hidden', !isOther);
        if (isOther) document.getElementById('ob-patient-language-other')?.focus();
      });
    }

    if (!this._placeBound) {
      this._placeBound = true;
      document.getElementById('ob-place-continue')?.addEventListener('click', () => {
        this.savePlaceStep();
      });
      document.getElementById('ob-place-back')?.addEventListener('click', () => {
        this.showStep('onboard-profiles');
        document.getElementById('ob-profiles-continue')?.addEventListener(
          'click',
          () => this.saveProfilesStep(),
          { once: true }
        );
      });
    }
  },

  resolveLanguage() {
    const code = document.getElementById('ob-patient-language')?.value || '';
    if (!code) return { languageCode: null, languageLabel: null };
    if (code === 'other') {
      const other = document.getElementById('ob-patient-language-other')?.value?.trim() || '';
      return {
        languageCode: other ? 'other' : null,
        languageLabel: other || null,
      };
    }
    const labels = {
      'en-IN': 'English',
      'as-IN': 'Assamese',
      'bn-IN': 'Bengali',
      'hi-IN': 'Hindi',
      'mni-IN': 'Manipuri',
      'mz-IN': 'Mizo',
      'kha-IN': 'Khasi',
      'nag-IN': 'Nagamese',
      'brx-IN': 'Bodo',
    };
    return { languageCode: code, languageLabel: labels[code] || code };
  },

  /** Step 2: language + hometown → create patient → family photos */
  async savePlaceStep() {
    const status = document.getElementById('ob-place-status');
    const draft = this._draft || {};
    const hometown = document.getElementById('ob-patient-hometown')?.value?.trim() || '';
    const { languageCode, languageLabel } = this.resolveLanguage();

    if (!languageCode) {
      status.textContent = 'Please choose their language';
      status.className = 'onboard-status is-error';
      return;
    }
    if (languageCode === 'other' && !languageLabel) {
      status.textContent = 'Please type the language they speak';
      status.className = 'onboard-status is-error';
      return;
    }
    if (!hometown) {
      status.textContent = 'Please enter where they live';
      status.className = 'onboard-status is-error';
      return;
    }

    const cgName = draft.caregiverName;
    const role = draft.caregiverRole || this.role;
    const pName = draft.patientName;
    if (!cgName || !pName) {
      status.textContent = 'Missing name details — go back one step';
      status.className = 'onboard-status is-error';
      return;
    }

    status.textContent = 'Saving…';
    status.className = 'onboard-status';

    const dementiaNotes = languageLabel
      ? `Primary language: ${languageLabel}`
      : '';

    try {
      await API.updateMe({ name: cgName, role }).catch(() => {});
      await LocalDB.setMeta?.('caregiverName', cgName);
      await LocalDB.setMeta?.('caregiverRole', role);

      let patient;
      try {
        patient = await API.createPatient({
          fullName: pName,
          preferredName: pName.split(/\s+/)[0],
          hometown,
          languageCode: languageCode === 'other' ? 'en-IN' : languageCode,
          dementiaNotes,
        });
      } catch {
        patient = {
          id: crypto.randomUUID?.() || `local-${Date.now()}`,
          full_name: pName,
          preferred_name: pName.split(/\s+/)[0],
          hometown,
          language_code: languageCode === 'other' ? 'en-IN' : languageCode,
          language_label: languageLabel,
          dementia_notes: dementiaNotes,
        };
      }

      const local = this.normalizePatient({
        ...patient,
        hometown: patient.hometown || hometown,
        languageCode: patient.language_code || patient.languageCode || languageCode,
        language_label: languageLabel,
      });
      // Guarantee an id even if the API payload was incomplete
      if (!local.id) {
        local.id = crypto.randomUUID?.() || `local-${Date.now()}`;
      }
      local.hometown = hometown;
      local.languageCode = languageCode === 'other' ? 'en-IN' : languageCode;
      local.language_code = local.languageCode;
      local.languageLabel = languageLabel;

      await LocalDB.put('patients', local);
      await LocalDB.setMeta?.('patientLanguage', languageLabel || languageCode);
      await LocalDB.setMeta?.('patientHometown', hometown);
      await LocalDB.setMeta?.(
        'patientPreferredName',
        local.preferredName || local.preferred_name || pName.split(/\s+/)[0]
      );
      this.patientId = local.id;
      window.app.currentPatient = local;
      await LocalDB.setMeta?.('onboardingPatientId', local.id);

      this.openFamily();
    } catch (err) {
      status.textContent = err.message || 'Could not save';
      status.className = 'onboard-status is-error';
    }
  },

  /** @deprecated kept as alias if anything still calls saveProfiles */
  async saveProfiles() {
    return this.saveProfilesStep();
  },

  openFamily() {
    // Re-hydrate patient id if memory was cleared mid-flow
    if (!this.patientId) {
      this.ensurePatientId().catch(() => {});
    }
    this.showStep('onboard-family');
    this.showFamilyPane('ob-family-home');
    this.renderFamilyList();
    this.bindFamilyOnce();
  },

  showFamilyPane(id) {
    ['ob-family-home', 'ob-family-pick', 'ob-family-camera', 'ob-family-detail', 'ob-ready'].forEach(
      (pid) => {
        document.getElementById(pid)?.classList.toggle('hidden', pid !== id);
      }
    );
  },

  bindFamilyOnce() {
    if (this._familyBound) return;
    this._familyBound = true;

    document.getElementById('ob-add-face-btn')?.addEventListener('click', () => {
      this.stopCamera();
      this.showFamilyPane('ob-family-pick');
    });

    document.getElementById('ob-pick-back')?.addEventListener('click', () => {
      this.showFamilyPane('ob-family-home');
    });

    document.getElementById('ob-pick-gallery')?.addEventListener('click', () => {
      document.getElementById('ob-gallery-input')?.click();
    });

    document.getElementById('ob-gallery-input')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) this.ingestImageFile(file);
      e.target.value = '';
    });

    document.getElementById('ob-pick-camera')?.addEventListener('click', () => this.openCamera());

    document.getElementById('ob-camera-cancel')?.addEventListener('click', () => {
      this.stopCamera();
      this.showFamilyPane('ob-family-pick');
    });

    document.getElementById('ob-camera-shutter')?.addEventListener('click', () => this.captureCamera());

    document.getElementById('ob-face-save')?.addEventListener('click', () => this.saveFace());

    document.getElementById('ob-face-retake')?.addEventListener('click', () => {
      // Keep previous pendingImage until a new capture succeeds
      this.openCamera();
    });

    document.getElementById('ob-face-gallery-again')?.addEventListener('click', () => {
      // Do not clear pendingImage here — cancelling the file picker would
      // leave the form looking fine but Confirm would fail with "Missing photo"
      document.getElementById('ob-gallery-input')?.click();
    });

    document.getElementById('ob-face-cancel')?.addEventListener('click', () => {
      this.pendingImage = null;
      this.stopCamera();
      this.showFamilyPane('ob-family-home');
      this.renderFamilyList();
    });

    document.getElementById('ob-family-done')?.addEventListener('click', () => this.showReady());

    document.getElementById('ob-family-list')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-delete-face]');
      if (!btn) return;
      const id = btn.getAttribute('data-delete-face');
      if (id) this.deleteFace(id);
    });
  },

  async openCamera() {
    this.showFamilyPane('ob-family-camera');
    const video = document.getElementById('ob-camera-video');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      if (video) {
        video.srcObject = this.stream;
        await video.play();
      }
    } catch (err) {
      this.stopCamera();
      this.showFamilyPane('ob-family-pick');
      alert('Camera unavailable. Try Gallery instead.');
    }
  },

  stopCamera() {
    this.stream?.getTracks?.().forEach((t) => t.stop());
    this.stream = null;
    const video = document.getElementById('ob-camera-video');
    if (video) video.srcObject = null;
  },

  captureCamera(retries = 0) {
    const video = document.getElementById('ob-camera-video');
    const canvas = document.getElementById('ob-camera-canvas');
    if (!video || !canvas) return;
    if (!video.videoWidth) {
      if (retries < 10) {
        window.setTimeout(() => this.captureCamera(retries + 1), 200);
      } else {
        alert('Camera is still starting — try Capture again in a moment.');
      }
      return;
    }
    const w = video.videoWidth;
    const h = video.videoHeight;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, w, h);
    this.stopCamera();
    this.pendingImage = canvas.toDataURL('image/jpeg', 0.85);
    this.showFaceDetail();
  },

  ingestImageFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      this.pendingImage = reader.result;
      this.showFaceDetail();
    };
    reader.readAsDataURL(file);
  },

  async showFaceDetail() {
    this.showFamilyPane('ob-family-detail');
    const img = document.getElementById('ob-face-preview');
    const detect = document.getElementById('ob-face-detect');
    if (img) img.src = this.pendingImage || '';
    document.getElementById('ob-face-name').value = '';
    document.getElementById('ob-face-hint').value = '';
    document.getElementById('ob-face-relation').value = '';
    document.getElementById('ob-face-status').textContent = '';
    this.relation = null;

    detect.textContent = 'Looking at the photo…';
    detect.className = 'onboard-status';
    const ok = await this.detectFace(this.pendingImage);
    detect.textContent = ok ? '✓ Face looks clear' : 'Photo ready — use a clear face if you can';
    detect.className = 'onboard-status is-ok';
  },

  async detectFace(dataUrl) {
    try {
      if ('FaceDetector' in window) {
        const detector = new FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
        const blob = await (await fetch(dataUrl)).blob();
        const bmp = await createImageBitmap(blob);
        const faces = await detector.detect(bmp);
        return faces.length > 0;
      }
    } catch (_) {}
    // Soft pass when FaceDetector unavailable (most phones/browsers)
    return true;
  },

  async ensurePatientId() {
    if (this.patientId) return this.patientId;

    const fromApp = window.app?.currentPatient?.id || null;
    if (fromApp) {
      this.patientId = fromApp;
      return fromApp;
    }

    const fromMeta = await LocalDB.getMeta?.('onboardingPatientId').catch(() => null);
    if (fromMeta) {
      this.patientId = String(fromMeta);
      return this.patientId;
    }

    const patients = (await LocalDB.getAll?.('patients').catch(() => [])) || [];
    if (patients[0]?.id) {
      this.patientId = patients[0].id;
      window.app.currentPatient = patients[0];
      return this.patientId;
    }

    return null;
  },

  ensurePendingImage() {
    if (this.pendingImage) return this.pendingImage;
    const img = document.getElementById('ob-face-preview');
    const src = img?.currentSrc || img?.src || '';
    if (src.startsWith('data:image')) {
      this.pendingImage = src;
      return src;
    }
    return null;
  },

  async saveFace() {
    const status = document.getElementById('ob-face-status');
    const name = document.getElementById('ob-face-name')?.value?.trim();
    const hint = document.getElementById('ob-face-hint')?.value?.trim();
    const relation = document.getElementById('ob-face-relation')?.value?.trim();
    if (!relation) {
      status.textContent = 'Please say who they are to your loved one';
      status.className = 'onboard-status is-error';
      return;
    }
    if (!name) {
      status.textContent = 'Enter a name';
      status.className = 'onboard-status is-error';
      return;
    }

    const photo = this.ensurePendingImage();
    const patientId = await this.ensurePatientId();

    if (!photo) {
      status.textContent = 'Photo missing — retake or choose another photo';
      status.className = 'onboard-status is-error';
      return;
    }
    if (!patientId) {
      status.textContent = 'Patient missing — go back and save language & hometown first';
      status.className = 'onboard-status is-error';
      return;
    }

    this.relation = relation;

    status.textContent = 'Saving…';
    status.className = 'onboard-status';

    const caption = hint || `This is your ${relation.toLowerCase()}, ${name}`;
    const payload = {
      caption,
      shortLabel: name,
      relation,
      category: 'family',
      imageUrl: photo,
      aliases: [name, relation],
      sortOrder: this.faces.length,
    };

    let mem;
    try {
      mem = await API.addMemory(patientId, payload);
    } catch (err) {
      console.warn('addMemory online failed, saving locally:', err);
      mem = {
        id: crypto.randomUUID?.() || `mem-${Date.now()}`,
        patientId,
        ...payload,
        image_url: photo,
        short_label: name,
      };
    }

    const local = {
      id: mem.id,
      patientId,
      caption: mem.caption || caption,
      shortLabel: mem.short_label || mem.shortLabel || name,
      relation: mem.relation || this.relation,
      imageUrl: mem.image_url || mem.imageUrl || photo,
      localUri: photo,
      aliases: payload.aliases,
      category: 'family',
      sortOrder: this.faces.length,
    };
    await LocalDB.put('memories', local);
    this.faces.push(local);
    this.pendingImage = null;

    status.textContent = `✓ ${this.relation} added`;
    status.className = 'onboard-status is-ok';

    window.setTimeout(() => {
      this.showFamilyPane('ob-family-home');
      this.renderFamilyList();
      const addBtn = document.getElementById('ob-add-face-btn');
      if (addBtn) {
        addBtn.textContent =
          this.faces.length < 3 ? 'Add another familiar face' : 'Add one more (optional)';
      }
    }, 700);
  },

  renderFamilyList() {
    const list = document.getElementById('ob-family-list');
    const done = document.getElementById('ob-family-done');
    if (!list) return;
    list.innerHTML = this.faces
      .map(
        (f) => `
      <div class="ob-family-item" data-face-id="${f.id}">
        <img src="${f.imageUrl || f.localUri}" alt="">
        <span class="ob-family-meta">${this.escapeHtml(f.relation)} · ${this.escapeHtml(f.shortLabel)}</span>
        <button type="button" class="ob-face-delete" data-delete-face="${f.id}" aria-label="Remove ${this.escapeHtml(f.shortLabel)}">
          Remove
        </button>
      </div>`
      )
      .join('');
    done?.classList.toggle('hidden', this.faces.length === 0);
  },

  escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  async deleteFace(id) {
    const face = this.faces.find((f) => f.id === id);
    if (!face) return;
    const label = face.shortLabel || face.relation || 'this person';
    if (!window.confirm(`Remove ${label} from the list? You can add someone else after.`)) {
      return;
    }

    this.faces = this.faces.filter((f) => f.id !== id);
    try {
      await LocalDB.delete('memories', id);
    } catch (_) {}
    try {
      if (this.patientId && navigator.onLine) {
        await API.deleteMemory(this.patientId, id);
      }
    } catch (_) {}

    this.renderFamilyList();
    const addBtn = document.getElementById('ob-add-face-btn');
    if (addBtn) {
      addBtn.textContent =
        this.faces.length === 0
          ? 'Add a familiar face'
          : this.faces.length < 3
            ? 'Add another familiar face'
            : 'Add one more (optional)';
    }
  },

  showReady() {
    this.showFamilyPane('ob-ready');
    // Hold “You’re all set up”, then soft crossfade into patient dashboard
    window.setTimeout(() => this.finish(), 2400);
  },

  async finish() {
    await LocalDB.setMeta?.('onboardingComplete', 'true');
    this.stopCamera();
    if (typeof window.app?.crossfadeToDashboard === 'function') {
      await window.app.crossfadeToDashboard({ from: 'onboard' });
      return;
    }
    window.app?.showDashboard({ fadeIn: true });
  },
};
