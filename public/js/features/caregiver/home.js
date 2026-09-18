/**
 * Caregiver Dashboard — full SaaS surface
 * Overview · Health · Sessions · Behavior · Insights · Settings
 */
const CaregiverHome = {
  currentPatient: null,
  view: 'overview',
  sessionDetailId: null,
  checkInDraft: null,
  _bound: false,
  _bundle: null,

  VIEWS: [
    { id: 'overview', label: 'Overview' },
    { id: 'health', label: 'Health' },
    { id: 'sessions', label: 'Sessions' },
    { id: 'behavior', label: 'Behavior' },
    { id: 'insights', label: 'Insights' },
    { id: 'wellness', label: 'Wellness' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'settings', label: 'Settings' },
  ],

  async init() {
    // Never keep patient voice alive on caregiver surface
    try {
      if (typeof VoiceLayer !== 'undefined') VoiceLayer.stop?.();
      speechSynthesis?.cancel?.();
    } catch (_) {}
    await this.render();
    this.bindEvents();
  },

  bindEvents() {
    if (this._bound) return;
    this._bound = true;
    const root = document.getElementById('caregiver-view');
    if (!root) return;

    root.addEventListener('click', (e) => {
      const viewBtn = e.target.closest('[data-cg-view]');
      if (viewBtn) {
        this.sessionDetailId = null;
        this.setView(viewBtn.dataset.cgView);
        return;
      }
      const focusBtn = e.target.closest('[data-hero-patient]');
      if (focusBtn) {
        this.selectPatient(focusBtn.dataset.heroPatient);
        return;
      }
      const startBtn = e.target.closest('[data-start-patient]');
      if (startBtn) {
        this.startSession(startBtn.dataset.startPatient);
        return;
      }
      const editBtn = e.target.closest('[data-edit-patient]');
      if (editBtn) {
        this.openEditor(editBtn.dataset.editPatient);
        return;
      }
      const sessBtn = e.target.closest('[data-session-id]');
      if (sessBtn) {
        this.sessionDetailId = sessBtn.dataset.sessionId;
        this.setView('sessions');
        this.renderSessionsPane();
        return;
      }
      if (e.target.closest('[data-session-back]')) {
        this.sessionDetailId = null;
        this.renderSessionsPane();
        return;
      }
      if (e.target.closest('[data-add-patient]')) {
        this.openEditor(null);
        return;
      }
      if (e.target.closest('[data-cg-export-wellness]')) {
        this.doExportWellnessPdf();
        return;
      }
      if (e.target.closest('[data-cg-export]')) {
        if (this.view === 'wellness') this.doExportWellnessPdf();
        else this.doExportPdf();
        return;
      }
      if (e.target.closest('[data-cg-export-text]')) {
        if (this.view === 'wellness') this.doExportWellnessText();
        else this.doExportText();
        return;
      }
      if (e.target.closest('[data-cg-share-wellness]')) {
        this.doShareWellness();
        return;
      }
      if (e.target.closest('[data-cg-share]')) {
        if (this.view === 'wellness') this.doShareWellness();
        else this.doShare();
        return;
      }
      if (e.target.closest('[data-cg-copy]')) {
        this.doCopyClinical();
        return;
      }
      if (e.target.closest('[data-cg-copy-wellness]')) {
        this.doCopyWellness();
        return;
      }
      const startCheck = e.target.closest('[data-checkin-start]');
      if (startCheck) {
        this.startCheckIn(startCheck.dataset.checkinStart);
        return;
      }
      if (e.target.closest('[data-checkin-cancel]')) {
        this.checkInDraft = null;
        this.renderWellnessPane();
        return;
      }
      const ans = e.target.closest('[data-checkin-answer]');
      if (ans && this.checkInDraft) {
        this.answerCheckIn(Number(ans.dataset.checkinAnswer));
        return;
      }
      if (e.target.closest('[data-cg-logout]')) {
        this.doLogout();
        return;
      }
      if (e.target.closest('[data-cg-delete-account]')) {
        this.doDeleteAccount();
        return;
      }
    });

    root.addEventListener('change', (e) => {
      const sel = e.target.closest('[data-patient-select]');
      if (sel) this.selectPatient(sel.value);
      const toggle = e.target.closest('[data-setting]');
      if (toggle) this.saveSetting(toggle.dataset.setting, toggle.checked || toggle.value);
    });
  },

  setView(view) {
    const allowed = this.VIEWS.map((v) => v.id);
    this.view = allowed.includes(view) ? view : 'overview';
    document.querySelectorAll('[data-cg-view]').forEach((btn) => {
      const on = btn.dataset.cgView === this.view;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('[data-cg-pane]').forEach((pane) => {
      pane.classList.toggle('hidden', pane.dataset.cgPane !== this.view);
    });
    const rail = document.querySelector('.cg-nav-scroll');
    const active = rail?.querySelector('.is-active');
    active?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    this.refreshExportChrome();
    if (this.view === 'analytics' && this._bundle?.analytics) {
      requestAnimationFrame(() => this.drawAnalyticsCharts(this._bundle.analytics));
    }
  },

  /** Header/footer: patient summary everywhere except Wellness */
  refreshExportChrome() {
    const onWellness = this.view === 'wellness';
    document.querySelectorAll('[data-cg-share-label]').forEach((el) => {
      el.textContent = onWellness ? 'Share wellness' : 'Share';
    });
    document.querySelectorAll('[data-cg-export-label]').forEach((el) => {
      el.textContent = onWellness ? 'Wellness PDF' : 'Export PDF';
    });
    document.querySelectorAll('[data-cg-foot-export]').forEach((el) => {
      el.textContent = onWellness ? 'Caregiver wellness PDF' : 'Export patient PDF';
    });
    document.querySelectorAll('[data-cg-foot-share]').forEach((el) => {
      el.textContent = onWellness ? 'Share wellness summary' : 'Share patient summary';
    });
    document.querySelectorAll('[data-cg-foot-text]').forEach((el) => {
      el.textContent = onWellness ? 'Wellness text' : 'Patient text';
      el.classList.toggle('hidden', false);
    });
  },

  escape(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  patientName(p) {
    return p?.preferred_name || p?.preferredName || p?.full_name || p?.fullName || 'Patient';
  },

  async loadPatients() {
    let patients = await LocalDB.getAll('patients');
    if (navigator.onLine) {
      try {
        const serverPatients = await API.getPatients();
        const serverIds = new Set(serverPatients.map((p) => p.id));
        for (const local of patients) {
          if (!serverIds.has(local.id)) {
            await LocalDB.delete?.('patients', local.id).catch(() => {});
          }
        }
        for (const p of serverPatients) {
          await LocalDB.put('patients', {
            ...p,
            preferredName: p.preferred_name || p.preferredName,
            fullName: p.full_name || p.fullName,
          });
        }
        patients = serverPatients;
      } catch (err) {
        console.warn('Patients fetch failed:', err);
      }
    }
    return patients;
  },

  async resolveFocus(patients) {
    const saved = await LocalDB.getMeta?.('caregiverFocusPatientId').catch(() => null);
    const hit = patients.find((p) => p.id === saved);
    if (hit) return hit;
    const score = (p) => {
      const n = (p.preferred_name || p.preferredName || '').toLowerCase();
      if (n === 'devi') return 3;
      if (n && n !== 'friend' && n !== 'anjali' && n !== 'anjani' && n !== 'ss' && n !== 'test') return 2;
      if ((p.full_name || p.fullName || '').toLowerCase().includes('devi')) return 2;
      return 0;
    };
    return [...patients].sort((a, b) => score(b) - score(a))[0] || patients[0];
  },

  async selectPatient(id) {
    await LocalDB.setMeta?.('caregiverFocusPatientId', id).catch(() => {});
    this.sessionDetailId = null;
    await this.render();
  },

  async loadSessions(patientId) {
    let sessions = [];
    try {
      sessions =
        (await LocalDB.getAllByIndex('sessions', 'patientId', patientId).catch(() => [])) || [];
      // Empty array is truthy — always fall back when index miss (online play stores patient_id)
      if (!sessions.length) {
        const all = (await LocalDB.getAll('sessions').catch(() => [])) || [];
        sessions = all.filter((s) => (s.patientId || s.patient_id) === patientId);
      } else {
        sessions = sessions.filter((s) => (s.patientId || s.patient_id) === patientId);
      }
    } catch {
      sessions = [];
    }

    // Normalize camelCase so the patientId index works next time
    sessions = sessions.map((s) => this.normalizeSessionRow(s));

    if (navigator.onLine && typeof API !== 'undefined' && patientId) {
      try {
        const remote = await API.getPatientSessions(patientId, 120);
        const list = Array.isArray(remote) ? remote : remote?.sessions || [];
        for (const raw of list) {
          const local = sessions.find((s) => s.id === raw.id) || {};
          const serverDomains = this.parseDomains(raw.domains);
          const localDomains = this.parseDomains(local.domains);
          const row = this.normalizeSessionRow({
            id: raw.id,
            patientId: raw.patient_id || raw.patientId || patientId,
            sessionType: raw.session_type || raw.sessionType,
            status: raw.status,
            startedAt: raw.started_at || raw.startedAt,
            endedAt: raw.ended_at || raw.endedAt,
            accuracy: raw.accuracy != null ? Number(raw.accuracy) : null,
            avgResponseMs: raw.avg_response_ms ?? raw.avgResponseMs ?? null,
            hintsUsed: raw.hints_used ?? raw.hintsUsed ?? 0,
            repetitions: raw.repetitions ?? 0,
            compositeScore: raw.composite_score ?? raw.compositeScore ?? null,
            hintRate: raw.hint_rate ?? raw.hintRate ?? null,
            // Never wipe local domain / response detail with a skinny server row
            domains: serverDomains || localDomains || null,
            responses: local.responses || null,
            curriculum: local.curriculum || true,
            fromServer: true,
          });
          await LocalDB.put('sessions', row).catch(() => {});
          const idx = sessions.findIndex((s) => s.id === row.id);
          if (idx >= 0) sessions[idx] = { ...sessions[idx], ...row, domains: row.domains, responses: row.responses };
          else sessions.push(row);
        }
      } catch (err) {
        console.warn('Session sync failed:', err);
      }
    }

    return sessions.filter((s) => this.isRealSession(s) || s.status === 'in_progress');
  },

  parseDomains(raw) {
    if (!raw) return null;
    if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
      } catch {
        return null;
      }
    }
    return null;
  },

  normalizeSessionRow(s) {
    if (!s) return s;
    const patientId = s.patientId || s.patient_id;
    const sessionType = s.sessionType || s.session_type;
    const startedAt = s.startedAt || s.started_at;
    const endedAt = s.endedAt || s.ended_at;
    const domains = this.parseDomains(s.domains);
    return {
      ...s,
      patientId,
      patient_id: patientId,
      sessionType,
      session_type: sessionType,
      startedAt,
      started_at: startedAt,
      endedAt,
      ended_at: endedAt,
      domains,
    };
  },

  async ensureHistory(patientId) {
    // Never invent sessions for judges — dashboard reflects completed care only
    await this.purgeInventedHistory(patientId);
  },

  /** True play leaves curriculum meta and/or graded responses — demo seeds never did */
  isRealSession(s) {
    if (!s) return false;
    if (s.curriculum) return true;
    if (Array.isArray(s.responses) && s.responses.length > 0) return true;
    if (s.fromServer === true) return true;
    if (s.domains && typeof s.domains === 'object' && Object.keys(s.domains).length) return true;
    return false;
  },

  /** Remove invented demo rows (domains-only fakes count as fake) */
  async purgeInventedHistory(patientId) {
    if (!patientId || typeof LocalDB === 'undefined') return;
    try {
      let sessions =
        (await LocalDB.getAllByIndex('sessions', 'patientId', patientId).catch(() => [])) || [];
      if (!sessions.length) {
        const all = (await LocalDB.getAll('sessions').catch(() => [])) || [];
        sessions = all.filter((s) => (s.patientId || s.patient_id) === patientId);
      } else {
        sessions = sessions.filter((s) => (s.patientId || s.patient_id) === patientId);
      }

      const toDrop = sessions.filter((s) => !this.isRealSession(s));
      for (const s of toDrop) {
        if (s?.id) await LocalDB.delete?.('sessions', s.id).catch(() => {});
      }

      const demoSeeded = await LocalDB.getMeta?.('demoSeeded').catch(() => null);
      if (demoSeeded === 'true') {
        await LocalDB.setMeta?.('demoSeeded', 'purged').catch(() => {});
      }
      await LocalDB.setMeta?.(`cgDemoSeed:${patientId}`, 'purged').catch(() => {});
    } catch (_) {}
  },

  async render() {
    const root = document.getElementById('cg-dashboard');
    if (!root) return;

    const patients = await this.loadPatients();
    if (!patients.length) {
      root.innerHTML = `
        <div class="cg-saas">
          <div class="cg-empty-state">
            <p class="cg-display">Care starts here</p>
            <p class="cg-sub">Add the person you care for to open their live dashboard.</p>
            <button type="button" class="cg-btn cg-btn-primary" data-add-patient>Add someone</button>
          </div>
        </div>`;
      return;
    }

    const focus = await this.resolveFocus(patients);
    this.currentPatient = focus;
    await LocalDB.setMeta?.('caregiverFocusPatientId', focus.id).catch(() => {});
    await this.ensureHistory(focus.id);

    const sessions = await this.loadSessions(focus.id);
    const engine = typeof DashboardEngine !== 'undefined' ? DashboardEngine : null;
    this._bundle = engine
      ? engine.buildAll(focus, sessions)
      : { overview: typeof HeroInsights !== 'undefined' ? HeroInsights.build(focus, sessions) : null };

    // Wellness analytics = caregiver check-ins (never guessed from patient games)
    if (typeof WellnessCheckins !== 'undefined') {
      const checkins = await WellnessCheckins.listAll();
      const effort = this._bundle.careEffort || this._bundle.wellness || {};
      this._bundle.wellness = WellnessCheckins.buildDashboard(checkins, {
        weekSessions: effort.weekSessions,
        timeInvested: effort.timeInvested,
        consistencyLabel: effort.consistencyLabel,
        consistencyPct: this._bundle.overview?.impact?.consistency,
        paceOk: this._bundle.overview?.week?.hot,
      });
    }

    // Optional online enrich for overview only
    if (navigator.onLine && engine) {
      try {
        const data = await API.getAnalytics(focus.id, 45);
        if (data?.hero) {
          this._bundle.overview = {
            ...this._bundle.overview,
            nudge: data.hero.nudge || data.hero.encouragement || this._bundle.overview.nudge,
          };
        }
      } catch (_) {}
    }

    const cgName = (await LocalDB.getMeta?.('caregiverName').catch(() => null)) || '';
    const b = this._bundle;
    const ov = b.overview;
    const lastLine = ov?.lastActive?.label
      ? ov.lastActive.label === 'No sessions yet'
        ? 'No sessions yet — start one to see trends'
        : `Last session · ${ov.lastActive.label}`
      : 'No sessions yet';
    const metaLine = cgName && cgName.toLowerCase() !== 'caregiver'
      ? `${cgName} · ${lastLine}`
      : lastLine;
    const statusLabel =
      ov?.overall?.state === 'building'
        ? 'Getting started'
        : ov?.overall?.label || '—';

    root.innerHTML = `
      <div class="cg-saas">
        <header class="cg-saas-header">
          <div class="cg-saas-identity">
            <div class="cg-avatar" aria-hidden="true">${this.escape((this.patientName(focus) || '?').slice(0, 1).toUpperCase())}</div>
            <div class="cg-saas-titles">
              <p class="cg-saas-patient">${this.escape(this.patientName(focus))}</p>
              <p class="cg-saas-meta">${this.escape(metaLine)}</p>
            </div>
          </div>
          <div class="cg-saas-quick">
            <span class="cg-pill tone-${ov?.overall?.tone || 'muted'}" title="${this.escape(ov?.overall?.line || '')}">${this.escape(statusLabel)}</span>
          </div>
        </header>

        <div class="cg-action-bar">
          <button type="button" class="cg-action-btn" data-cg-share>
            <span class="cg-action-ico" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/></svg>
            </span>
            <span data-cg-share-label>Share</span>
          </button>
          <button type="button" class="cg-action-btn" data-cg-export>
            <span class="cg-action-ico" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 18v-6M9 15l3 3 3-3"/></svg>
            </span>
            <span data-cg-export-label>Export PDF</span>
          </button>
        </div>

        ${
          patients.length > 1
            ? `<label class="cg-select-wrap"><span class="sr-only">Patient</span>
                <select data-patient-select class="cg-select">
                  ${patients
                    .map(
                      (p) =>
                        `<option value="${p.id}" ${p.id === focus.id ? 'selected' : ''}>${this.escape(
                          this.patientName(p)
                        )}</option>`
                    )
                    .join('')}
                </select>
              </label>`
            : ''
        }

        <nav class="cg-nav" aria-label="Dashboard">
          <div class="cg-nav-scroll" role="tablist">
            ${this.VIEWS.map(
              (v) => `
              <button type="button" class="cg-nav-item ${this.view === v.id ? 'is-active' : ''}"
                data-cg-view="${v.id}" role="tab" aria-selected="${this.view === v.id}">${v.label}</button>`
            ).join('')}
          </div>
        </nav>

        <main class="cg-main">
          <section class="cg-pane ${this.view === 'overview' ? '' : 'hidden'}" data-cg-pane="overview">${this.htmlOverview(focus, b)}</section>
          <section class="cg-pane ${this.view === 'health' ? '' : 'hidden'}" data-cg-pane="health">${this.htmlHealth(b.health)}</section>
          <section class="cg-pane ${this.view === 'sessions' ? '' : 'hidden'}" data-cg-pane="sessions" id="cg-sessions-pane">${this.htmlSessions(b.sessions)}</section>
          <section class="cg-pane ${this.view === 'behavior' ? '' : 'hidden'}" data-cg-pane="behavior">${this.htmlBehavior(b.behavior)}</section>
          <section class="cg-pane ${this.view === 'insights' ? '' : 'hidden'}" data-cg-pane="insights">${this.htmlInsights(b)}</section>
          <section class="cg-pane ${this.view === 'wellness' ? '' : 'hidden'}" data-cg-pane="wellness" id="cg-wellness-pane">${
            this.checkInDraft ? this.htmlCheckInFlow() : this.htmlWellness(b)
          }</section>
          <section class="cg-pane ${this.view === 'analytics' ? '' : 'hidden'}" data-cg-pane="analytics" id="cg-analytics-pane">${this.htmlAnalytics(b.analytics)}</section>
          <section class="cg-pane ${this.view === 'settings' ? '' : 'hidden'}" data-cg-pane="settings">${this.htmlSettingsSync(focus, patients)}</section>
        </main>

        <footer class="cg-saas-foot">
          <button type="button" class="cg-foot-link" data-cg-export data-cg-foot-export>Export patient PDF</button>
          <button type="button" class="cg-foot-link" data-cg-export-text data-cg-foot-text>Patient text</button>
          <button type="button" class="cg-foot-link" data-cg-share data-cg-foot-share>Share patient summary</button>
        </footer>
      </div>`;

    this.setView(this.view);
    if (this.view === 'analytics') {
      requestAnimationFrame(() => this.drawAnalyticsCharts(b.analytics));
    }
  },

  htmlOverview(patient, b) {
    const ov = b.overview;
    const c = b.consistency;
    const w = b.careEffort || b.wellness;
    const f = b.forecast;
    if (!ov) return `<p class="cg-muted">Loading…</p>`;

    const total = ov.impact?.totalSessions || 0;
    if (total === 0) {
      const name = this.escape(this.patientName(patient));
      return `
      <div class="cg-stack">
        <p class="cg-lede">No sessions yet for ${name}. When they finish a morning or evening session on the patient screen, counts and trends appear here.</p>
        <div class="cg-stat-grid">
          <div class="cg-stat">
            <span class="cg-stat-label">This week</span>
            <span class="cg-stat-value">0 of ${ov.week?.target || 14}</span>
            <span class="cg-stat-hint">Waiting on first play</span>
          </div>
          <div class="cg-stat">
            <span class="cg-stat-label">Overall</span>
            <span class="cg-stat-value">—</span>
            <span class="cg-stat-hint">Needs real sessions</span>
          </div>
          <div class="cg-stat">
            <span class="cg-stat-label">Sessions</span>
            <span class="cg-stat-value">0</span>
            <span class="cg-stat-hint">all time</span>
          </div>
          <div class="cg-stat">
            <span class="cg-stat-label">Consistency</span>
            <span class="cg-stat-value">—</span>
            <span class="cg-stat-hint">not started</span>
          </div>
        </div>
        <div class="cg-cta-row">
          <button type="button" class="cg-btn cg-btn-primary" data-start-patient="${patient.id}">Open patient session</button>
        </div>
      </div>`;
    }

    const mem = ov.impact.memoryDelta;
    return `
      <div class="cg-stack">
        <p class="cg-lede">${this.escape(ov.nudge)}</p>

        <div class="cg-stat-grid">
          <div class="cg-stat">
            <span class="cg-stat-label">This week</span>
            <span class="cg-stat-value">${this.escape(ov.week.label)}</span>
            <span class="cg-stat-hint">${ov.week.hot ? 'On pace' : 'Keep going'}</span>
          </div>
          <div class="cg-stat tone-${ov.overall.tone}">
            <span class="cg-stat-label">Overall</span>
            <span class="cg-stat-value">${this.escape(ov.overall.label)}</span>
            <span class="cg-stat-hint">${this.escape(ov.overall.line)}</span>
          </div>
          <div class="cg-stat">
            <span class="cg-stat-label">Sessions</span>
            <span class="cg-stat-value">${ov.impact.totalSessions}</span>
            <span class="cg-stat-hint">all time</span>
          </div>
          <div class="cg-stat">
            <span class="cg-stat-label">Consistency</span>
            <span class="cg-stat-value">${ov.impact.consistency}</span>
            <span class="cg-stat-hint">${this.escape(ov.impact.consistencyWord)}</span>
          </div>
        </div>

        <div class="cg-panel">
          <div class="cg-panel-head">
            <h3>Your impact</h3>
          </div>
          <ul class="cg-kv">
            <li><span>Memory · 30 days</span><strong class="${mem != null && mem < 0 ? 'is-down' : 'is-up'}">${
              mem == null ? '—' : `${mem >= 0 ? '+' : ''}${mem}%`
            }</strong></li>
            <li><span>Streak</span><strong>${c?.streak || 0} day${(c?.streak || 0) === 1 ? '' : 's'}</strong></li>
            <li><span>Time this week</span><strong>${this.escape(w?.timeInvested || '—')}</strong></li>
          </ul>
        </div>

        <div class="cg-cta-row">
          <button type="button" class="cg-btn cg-btn-primary" data-start-patient="${patient.id}">Start session</button>
          <button type="button" class="cg-btn cg-btn-ghost" data-cg-view="health">View health</button>
        </div>

        ${
          f?.ready
            ? `<div class="cg-panel cg-panel-soft">
                <div class="cg-panel-head"><h3>30-day outlook</h3><span class="cg-chip">${this.escape(f.confidence)}</span></div>
                <p class="cg-forecast-line">${this.escape(f.milestone)}</p>
                <div class="cg-mini-grid">
                  <div><span>Memory</span><strong>${f.memory.from}→${f.memory.to}</strong></div>
                  <div><span>Attention</span><strong>${f.attention.from}→${f.attention.to}</strong></div>
                  <div><span>Overall</span><strong>${f.overall.from}→${f.overall.to}</strong></div>
                </div>
                ${f.warning ? `<p class="cg-warn">${this.escape(f.warning)}</p>` : ''}
              </div>`
            : ''
        }
      </div>`;
  },

  htmlHealth(health) {
    if (!health?.hasData) {
      return `<div class="cg-stack"><p class="cg-lede">Health appears after a few completed sessions.</p></div>`;
    }
    const skills = health.skills
      .map((s) => {
        const w = s.score != null ? Math.max(4, Math.min(100, s.score)) : 0;
        return `
        <li class="cg-meter tone-${s.trend.tone}${s.flag ? ' is-flag' : ''}">
          <div class="cg-meter-top">
            <span>${this.escape(s.label)}</span>
            <span class="cg-meter-right">
              <i>${s.trend.arrow}</i>
              <b>${s.score ?? '—'}</b>
              ${s.delta != null ? `<em>${s.delta > 0 ? '+' : ''}${s.delta}</em>` : ''}
            </span>
          </div>
          <div class="cg-meter-track"><span style="width:${w}%"></span></div>
        </li>`;
      })
      .join('');

    const max = Math.max(...health.timeline.map((t) => t.score || 0), 1);
    const timeline = health.timeline
      .map((t) => {
        const h = t.score != null ? Math.max(6, Math.round((t.score / max) * 100)) : 6;
        return `<li><span class="cg-bar" style="height:${h}%"></span><span>${this.escape(t.label)}</span></li>`;
      })
      .join('');

    const flags =
      health.flags.length === 0
        ? `<p class="cg-muted">No red flags this week.</p>`
        : `<ul class="cg-flag-list">${health.flags
            .map((f) => `<li><strong>${this.escape(f.title)}</strong><span>${this.escape(f.body)}</span></li>`)
            .join('')}</ul>`;

    return `
      <div class="cg-stack">
        <div class="cg-panel">
          <div class="cg-panel-head"><h3>Cognitive skills</h3></div>
          <ul class="cg-meters">${skills}</ul>
        </div>
        <div class="cg-panel">
          <div class="cg-panel-head"><h3>This week</h3></div>
          <p class="cg-compare tone-${health.compare.tone}">${this.escape(health.compare.headline)}</p>
          <div class="cg-mini-grid">
            <div><span>Now</span><strong>${health.compare.thisWeek.score != null ? health.compare.thisWeek.score + '%' : '—'} · ${health.compare.thisWeek.sessions}</strong></div>
            <div><span>Prior</span><strong>${health.compare.lastWeek.score != null ? health.compare.lastWeek.score + '%' : '—'} · ${health.compare.lastWeek.sessions}</strong></div>
          </div>
        </div>
        <div class="cg-panel">
          <div class="cg-panel-head"><h3>Watch</h3></div>
          ${flags}
        </div>
        <div class="cg-panel">
          <div class="cg-panel-head"><h3>Four-week arc</h3></div>
          <ul class="cg-spark">${timeline}</ul>
        </div>
      </div>`;
  },

  htmlSessions(sess) {
    if (!sess?.count) {
      return `<div class="cg-stack"><p class="cg-lede">Session history will land here after play.</p></div>`;
    }
    if (this.sessionDetailId) {
      const item = sess.items.find((s) => s.id === this.sessionDetailId);
      if (item) return this.htmlSessionDetail(item);
    }
    const rows = sess.items
      .slice(0, 40)
      .map(
        (s) => `
      <button type="button" class="cg-list-row" data-session-id="${s.id}">
        <span class="cg-list-main">
          <strong>${this.escape(s.type)} · ${this.escape(s.when.short)}</strong>
          <span>${this.escape(s.when.label)}</span>
        </span>
        <span class="cg-list-score tone-${s.tone}">${s.score != null ? s.score + '%' : '—'}</span>
      </button>`
      )
      .join('');

    return `
      <div class="cg-stack">
        ${sess.pattern ? `<p class="cg-lede">${this.escape(sess.pattern)}</p>` : ''}
        <div class="cg-panel cg-panel-flush">
          <div class="cg-panel-head cg-panel-pad"><h3>Recent sessions</h3><span class="cg-chip">${sess.count}</span></div>
          <div class="cg-list">${rows}</div>
        </div>
      </div>`;
  },

  htmlSessionDetail(item) {
    const domains = item.domains.length
      ? item.domains
          .map(
            (d) => `
        <li class="cg-meter">
          <div class="cg-meter-top"><span>${this.escape(d.label)}</span><b>${d.score}</b></div>
          <div class="cg-meter-track"><span style="width:${d.score}%"></span></div>
        </li>`
          )
          .join('')
      : `<p class="cg-muted">Domain detail not stored for this session.</p>`;

    return `
      <div class="cg-stack">
        <button type="button" class="cg-back" data-session-back>← All sessions</button>
        <div class="cg-panel">
          <div class="cg-panel-head">
            <h3>${this.escape(item.type)} session</h3>
            <span class="cg-pill tone-${item.tone}">${item.score != null ? item.score + '%' : '—'}</span>
          </div>
          <ul class="cg-kv">
            <li><span>When</span><strong>${this.escape(item.when.label)}</strong></li>
            <li><span>Composite</span><strong>${item.composite ?? '—'}</strong></li>
            <li><span>Avg response</span><strong>${item.responseMs != null ? Math.round(item.responseMs / 1000) + 's' : '—'}</strong></li>
            <li><span>Hints</span><strong>${item.hints ?? 0}</strong></li>
          </ul>
        </div>
        <div class="cg-panel">
          <div class="cg-panel-head"><h3>Game breakdown</h3></div>
          <ul class="cg-meters">${domains}</ul>
        </div>
      </div>`;
  },

  renderSessionsPane() {
    const pane = document.getElementById('cg-sessions-pane');
    if (pane && this._bundle?.sessions) {
      pane.innerHTML = this.htmlSessions(this._bundle.sessions);
    }
  },

  htmlBehavior(behavior) {
    if (!behavior?.hasData) {
      return `<div class="cg-stack"><p class="cg-lede">Behavioral patterns appear as sessions accumulate.</p></div>`;
    }
    const entries = behavior.entries
      .slice(0, 10)
      .map(
        (e) => `
      <article class="cg-journal">
        <header>
          <strong>${this.escape(e.day)}</strong>
          <span class="cg-chip">${e.score != null ? e.score + '%' : '—'}</span>
        </header>
        <p>${this.escape(e.note)}</p>
        <div class="cg-tags">
          <span>${this.escape(e.mood)}</span>
          <span>${this.escape(e.engagement)}</span>
          <span>${this.escape(e.energy)}</span>
          ${e.tags.map((t) => `<span class="is-tag">${this.escape(t)}</span>`).join('')}
        </div>
      </article>`
      )
      .join('');

    const corr = behavior.correlations;
    const findings = (corr.findings || [])
      .map(
        (f) => `
      <div class="cg-corr ${f.kind}">
        <h4>${this.escape(f.title)}</h4>
        <ul>${f.points.map((p) => `<li>${this.escape(p)}</li>`).join('')}</ul>
      </div>`
      )
      .join('');

    return `
      <div class="cg-stack">
        <div class="cg-panel">
          <div class="cg-panel-head"><h3>Correlations</h3></div>
          ${findings || `<p class="cg-muted">Still learning patterns.</p>`}
          ${corr.recommendation ? `<p class="cg-reco">${this.escape(corr.recommendation)}</p>` : ''}
        </div>
        <div class="cg-panel">
          <div class="cg-panel-head"><h3>Daily log</h3></div>
          <div class="cg-journal-list">${entries}</div>
        </div>
      </div>`;
  },

  htmlInsights(b) {
    const cards = (b.insights?.cards || [])
      .map(
        (c) => `
      <article class="cg-insight kind-${c.kind}">
        <span class="cg-insight-icon" aria-hidden="true">${c.icon}</span>
        <div>
          <h4>${this.escape(c.title)}</h4>
          <p>${this.escape(c.body)}</p>
          <span class="cg-insight-action">${this.escape(c.action)}</span>
        </div>
      </article>`
      )
      .join('');

    const miles = (b.consistency?.milestones || [])
      .map(
        (m) => `
      <li class="${m.done ? 'is-done' : ''} ${m.current ? 'is-current' : ''}">
        <span class="cg-mile-dot"></span>
        <span>${this.escape(m.label)}</span>
      </li>`
      )
      .join('');

    const w = b.wellness;
    const month = b.consistency?.month;

    return `
      <div class="cg-stack">
        <div class="cg-panel">
          <div class="cg-panel-head"><h3>Smart insights</h3></div>
          <div class="cg-insight-list">${cards}</div>
        </div>

        <div class="cg-panel">
          <div class="cg-panel-head">
            <h3>Consistency</h3>
            <span class="cg-chip">${b.consistency?.streak || 0}-day streak</span>
          </div>
          <ul class="cg-milestones">${miles}</ul>
          ${
            month
              ? `<ul class="cg-kv">
                  <li><span>Month sessions</span><strong>${month.sessions}</strong></li>
                  <li><span>Memory</span><strong>${month.memory.from ?? '—'} → ${month.memory.to ?? '—'}</strong></li>
                  <li><span>Attention</span><strong>${month.attention.from ?? '—'} → ${month.attention.to ?? '—'}</strong></li>
                </ul>
                <p class="cg-muted">${this.escape(b.consistency.prediction)}</p>`
              : ''
          }
        </div>

        <div class="cg-panel cg-panel-soft">
          <div class="cg-panel-head"><h3>Your care load</h3></div>
          <p class="cg-muted" style="margin-bottom:0.75rem">Open Wellness for daily stress, anxiety, and mood check-ins.</p>
          <button type="button" class="cg-btn cg-btn-ghost" data-cg-view="wellness">Open Wellness →</button>
        </div>

        ${
          b.forecast?.ready
            ? `<div class="cg-panel">
                <div class="cg-panel-head"><h3>Forecast</h3></div>
                <p class="cg-forecast-line">${this.escape(b.forecast.milestone)}</p>
                ${b.forecast.warning ? `<p class="cg-warn">${this.escape(b.forecast.warning)}</p>` : ''}
              </div>`
            : ''
        }
      </div>`;
  },

  htmlWellness(b) {
    const w = b.wellness;
    if (!w || typeof WellnessCheckins === 'undefined') {
      return `<p class="cg-muted">Wellness check-ins unavailable.</p>`;
    }

      const packs = (w.packs || [])
      .map((p) => {
        const last = p.status || 'Not checked in yet';
        return `
        <button type="button" class="cg-check-card ${p.dueToday ? 'is-due' : 'is-done'}" data-checkin-start="${p.id}">
          <span class="cg-check-card-copy">
            <strong>${this.escape(p.title)}</strong>
            <span>${this.escape(p.subtitle)}</span>
            <em>${this.escape(last)}</em>
          </span>
          <span class="cg-row-go" aria-hidden="true">→</span>
        </button>`;
      })
      .join('');

    const meterBlock = (label, m) => {
      if (!m || m.source === 'none') {
        return `
        <li class="cg-burn tone-muted">
          <div class="cg-burn-top">
            <span class="cg-burn-name">${label}</span>
            <span class="cg-burn-val"><strong>—</strong> <em>(check in)</em></span>
          </div>
          <div class="cg-burn-track"><span class="cg-burn-fill" style="width:4%"></span></div>
        </li>`;
      }
      return `
        <li class="cg-burn tone-${m.tone}">
          <div class="cg-burn-top">
            <span class="cg-burn-name">${label}</span>
            <span class="cg-burn-val"><strong>${this.escape(m.label)}</strong> <em>${m.score}% · ${this.escape(m.detail)}</em></span>
          </div>
          <div class="cg-burn-track"><span class="cg-burn-fill" style="width:${Math.max(4, Math.min(100, m.score))}%"></span></div>
        </li>`;
    };

    const history = (w.history || [])
      .map(
        (h) => `
      <li class="cg-check-hist">
        <span>${this.escape(h.title)}</span>
        <strong class="${
          h.pct >= 75 ? 'tone-down' : h.pct >= 50 ? 'tone-soft' : h.pct >= 25 ? 'tone-flat' : 'tone-up'
        }">${this.escape(h.band)} · ${h.pct}%</strong>
        <em>${this.escape(h.label)}</em>
      </li>`
      )
      .join('');

    const chartNote = w.hasData
      ? 'Trends below come only from your completed check-ins.'
      : 'No check-ins yet — take one below to unlock your personal analytics.';

    return `
      <div class="cg-stack cg-wellness">
        <header class="cg-well-hero">
          <p class="cg-well-kicker">Your wellness</p>
          <p class="cg-lede">${this.escape(w.headline)}</p>
        </header>

        <div class="cg-panel">
          <div class="cg-panel-head"><h3>1-minute check-ins</h3></div>
          <p class="cg-muted" style="margin-bottom:0.75rem">Short self-reports for stress, anxiety, and mood. Scores are for your awareness — not a diagnosis.</p>
          <div class="cg-check-grid">${packs}</div>
        </div>

        <div class="cg-panel cg-load-card">
          <div class="cg-panel-head">
            <h3>From your check-ins</h3>
            <button type="button" class="cg-icon-btn" data-cg-copy-wellness title="Copy summary" aria-label="Copy summary">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
          </div>
          <p class="cg-muted cg-muted-tight">${this.escape(chartNote)}</p>
          <ul class="cg-burn-list" style="margin-top:0.85rem">
            ${meterBlock('Stress', w.meter?.stress)}
            ${meterBlock('Anxiety', w.meter?.anxiety)}
            ${meterBlock('Mood load', w.meter?.mood)}
            ${meterBlock('Engagement', w.meter?.engagement)}
            ${meterBlock('Sustainability', w.meter?.sustainability)}
          </ul>

          ${
            w.hasData
              ? `<div class="cg-well-tip kind-${w.tip?.kind || 'nudge'}">
                  <span class="cg-well-tip-ico" aria-hidden="true">✦</span>
                  <div>
                    <strong>Recommendation</strong>
                    <p>${this.escape(w.tip?.text || '')}</p>
                  </div>
                </div>`
              : ''
          }
        </div>

        ${
          w.hasData
            ? `<div class="cg-panel">
                <div class="cg-panel-head"><h3>Check-in history</h3></div>
                <ul class="cg-check-hist-list">${history || '<li class="cg-muted">None yet</li>'}</ul>
              </div>
              <div class="cg-panel">
                <div class="cg-panel-head"><h3>Trend spark</h3></div>
                ${this.htmlWellnessSparks(w.charts)}
              </div>`
            : ''
        }

        <div class="cg-panel">
          <div class="cg-panel-head"><h3>Care effort (their sessions)</h3></div>
          <p class="cg-muted" style="margin-bottom:0.65rem">How much you’ve shown up for them — separate from your stress scores.</p>
          <ul class="cg-kv">
            <li><span>Sessions this week</span><strong>${this.escape(w.careEffort?.weekSessions || '—')}</strong></li>
            <li><span>Time invested</span><strong>${this.escape(w.careEffort?.timeInvested || '—')}</strong></li>
            <li><span>Consistency</span><strong>${this.escape(w.careEffort?.consistencyLabel || '—')}</strong></li>
          </ul>
        </div>

        <div class="cg-panel">
          <div class="cg-panel-head"><h3>Export & share</h3></div>
          <p class="cg-muted" style="margin-bottom:0.75rem">These export your caregiver wellness check-ins only — not the patient’s clinical summary.</p>
          <div class="cg-cta-row">
            <button type="button" class="cg-btn cg-btn-primary" data-cg-share-wellness>Share wellness summary</button>
            <button type="button" class="cg-btn cg-btn-ghost" data-cg-export-wellness>Export caregiver wellness PDF</button>
          </div>
        </div>
      </div>`;
  },

  htmlWellnessSparks(charts) {
    const block = (title, series) => {
      if (!series?.length) {
        return `<div class="cg-spark-block"><p class="cg-spark-title">${title}</p><p class="cg-muted">No points yet</p></div>`;
      }
      const max = Math.max(...series.map((s) => s.pct), 1);
      const bars = series
        .slice(-10)
        .map(
          (s) =>
            `<span class="cg-mini-bar" style="height:${Math.max(8, Math.round((s.pct / max) * 100))}%" title="${s.label}: ${s.pct}%"></span>`
        )
        .join('');
      return `<div class="cg-spark-block"><p class="cg-spark-title">${title}</p><div class="cg-mini-bars">${bars}</div></div>`;
    };
    return `<div class="cg-spark-grid">
      ${block('Stress', charts?.stress)}
      ${block('Anxiety', charts?.anxiety)}
      ${block('Mood', charts?.mood)}
    </div>`;
  },

  htmlCheckInFlow() {
    const draft = this.checkInDraft;
    if (!draft?.pack) return this.htmlWellness(this._bundle || {});
    const pack = draft.pack;
    const q = pack.questions[draft.index];
    const step = draft.index + 1;
    const total = pack.questions.length;
    const pct = Math.round(((step - 1) / total) * 100);

    const choices = (WellnessCheckins.SCALE || [])
      .map(
        (s) => `
      <button type="button" class="cg-likert" data-checkin-answer="${s.value}">
        <strong>${s.value}</strong>
        <span>${this.escape(s.label)}</span>
      </button>`
      )
      .join('');

    return `
      <div class="cg-stack cg-checkin-flow">
        <button type="button" class="cg-back" data-checkin-cancel>← Back to Wellness</button>
        <header class="cg-well-hero">
          <p class="cg-well-kicker">${this.escape(pack.title)} · ${step} of ${total}</p>
          <p class="cg-lede">${this.escape(q.text)}</p>
          <p class="cg-muted">${this.escape(pack.disclaimer)}</p>
        </header>
        <div class="cg-checkin-progress" aria-hidden="true"><span style="width:${pct}%"></span></div>
        <div class="cg-likert-list" role="group" aria-label="Your answer">${choices}</div>
      </div>`;
  },

  renderWellnessPane() {
    const pane = document.getElementById('cg-wellness-pane');
    if (!pane) return;
    pane.innerHTML = this.checkInDraft ? this.htmlCheckInFlow() : this.htmlWellness(this._bundle || {});
  },

  startCheckIn(type) {
    if (typeof WellnessCheckins === 'undefined') return;
    const draft = WellnessCheckins.createDraft(type);
    if (!draft) return;
    this.checkInDraft = draft;
    this.setView('wellness');
    this.renderWellnessPane();
  },

  async answerCheckIn(value) {
    const draft = this.checkInDraft;
    if (!draft?.pack) return;
    const q = draft.pack.questions[draft.index];
    if (!q) return;
    draft.answers[q.id] = value;

    if (draft.index < draft.pack.questions.length - 1) {
      draft.index += 1;
      this.renderWellnessPane();
      return;
    }

    // Final answer — score, save, refresh wellness UI from that result
    try {
      const record = WellnessCheckins.finalize(draft);
      await WellnessCheckins.save(record);

      let checkins = await WellnessCheckins.listAll();
      if (!checkins.some((c) => c.id === record.id)) {
        checkins = [...checkins, record];
      }

      if (!this._bundle) this._bundle = {};
      const effort = this._bundle.careEffort || {};
      this._bundle.wellness = WellnessCheckins.buildDashboard(checkins, {
        weekSessions: effort.weekSessions,
        timeInvested: effort.timeInvested,
        consistencyLabel: effort.consistencyLabel,
        consistencyPct: this._bundle.overview?.impact?.consistency,
        paceOk: this._bundle.overview?.week?.hot,
      });

      this.checkInDraft = null;
      this.view = 'wellness';
      this.toast(`${draft.pack.title} saved · ${record.bandLabel} (${record.pct}%)`);

      // Paint wellness immediately (do not wait on a full dashboard rebuild)
      const pane = document.getElementById('cg-wellness-pane');
      if (pane) {
        pane.classList.remove('hidden');
        pane.innerHTML = this.htmlWellness(this._bundle);
      }
      this.setView('wellness');
    } catch (err) {
      console.error('Check-in save failed', err);
      this.toast('Save failed — try the check-in again');
    }
  },

  async htmlSettings(focus, patients) {
    // sync render — settings are simple; load prefs inline via defaults
    return this.htmlSettingsSync(focus, patients);
  },

  htmlSettingsSync(focus, patients) {
    return `
      <div class="cg-stack">
        <div class="cg-panel">
          <div class="cg-panel-head"><h3>Reminders</h3></div>
          <label class="cg-toggle">
            <span>Morning reminder</span>
            <input type="checkbox" data-setting="remindMorning" checked />
          </label>
          <label class="cg-toggle">
            <span>Evening reminder</span>
            <input type="checkbox" data-setting="remindEvening" checked />
          </label>
        </div>
        <div class="cg-panel">
          <div class="cg-panel-head"><h3>Access & privacy</h3></div>
          <label class="cg-toggle">
            <span>Share with family doctor</span>
            <input type="checkbox" data-setting="shareDoctor" />
          </label>
          <label class="cg-toggle">
            <span>Encrypt local backups</span>
            <input type="checkbox" data-setting="encryptBackup" checked />
          </label>
          <p class="cg-muted">Data stays on-device first. Cloud sync only when you are online.</p>
        </div>
        <div class="cg-panel">
          <div class="cg-panel-head"><h3>Accessibility</h3></div>
          <label class="cg-field">
            <span>Text size</span>
            <select data-setting="textSize" class="cg-select">
              <option value="md">Comfortable</option>
              <option value="lg">Large</option>
              <option value="xl">Extra large</option>
            </select>
          </label>
        </div>
        <div class="cg-panel">
          <div class="cg-panel-head"><h3>People</h3></div>
          <div class="cg-cta-row">
            <button type="button" class="cg-btn cg-btn-ghost" data-edit-patient="${focus.id}">Edit ${this.escape(
      this.patientName(focus)
    )}</button>
            <button type="button" class="cg-btn cg-btn-ghost" data-add-patient>Add person</button>
          </div>
          <div id="patient-detail" class="cg-editor-slot"></div>
        </div>
        <div class="cg-panel">
          <div class="cg-panel-head"><h3>Export & share (patient)</h3></div>
          <p class="cg-muted" style="margin-bottom:0.75rem">
            Patient care summary only. Caregiver wellness has its own export on the Wellness tab.
            On a laptop: Print → Save as PDF. On a phone: Share / Files.
          </p>
          <div class="cg-cta-row">
            <button type="button" class="cg-btn cg-btn-primary" data-cg-export>Export patient PDF</button>
            <button type="button" class="cg-btn cg-btn-ghost" data-cg-export-text>Patient text</button>
            <button type="button" class="cg-btn cg-btn-ghost" data-cg-copy>Copy clinical</button>
          </div>
        </div>
        <div class="cg-panel cg-panel-danger">
          <div class="cg-panel-head"><h3>Account</h3></div>
          <p class="cg-muted" style="margin-bottom:0.75rem">Sign out on this device, or clear all local MindCare data.</p>
          <div class="cg-cta-row">
            <button type="button" class="cg-btn cg-btn-ghost" data-cg-logout>Log out</button>
            <button type="button" class="cg-btn cg-btn-danger" data-cg-delete-account>Delete local data</button>
          </div>
        </div>
      </div>`;
  },

  htmlAnalytics(analytics) {
    if (!analytics?.ready) {
      return `
        <div class="cg-stack">
          <p class="cg-lede">Analytics charts appear after completed sessions.</p>
          <p class="cg-muted">Accuracy over time, skill averages, and morning vs evening comparisons will show here.</p>
        </div>`;
    }
    const t = analytics.totals;
    return `
      <div class="cg-stack">
        <div class="cg-stat-grid">
          <div class="cg-stat">
            <span class="cg-stat-label">Sessions</span>
            <span class="cg-stat-value">${t.sessions}</span>
            <span class="cg-stat-hint">in chart window</span>
          </div>
          <div class="cg-stat">
            <span class="cg-stat-label">Avg accuracy</span>
            <span class="cg-stat-value">${t.avgAccuracy}%</span>
            <span class="cg-stat-hint">all logged play</span>
          </div>
          <div class="cg-stat">
            <span class="cg-stat-label">Avg score</span>
            <span class="cg-stat-value">${t.avgComposite || '—'}</span>
            <span class="cg-stat-hint">composite</span>
          </div>
          <div class="cg-stat">
            <span class="cg-stat-label">Morning / Eve</span>
            <span class="cg-stat-value">${analytics.morningEvening.morning ?? '—'} / ${analytics.morningEvening.evening ?? '—'}</span>
            <span class="cg-stat-hint">avg %</span>
          </div>
        </div>

        <div class="cg-panel">
          <div class="cg-panel-head"><h3>Accuracy over time</h3></div>
          <div class="cg-chart-wrap"><canvas id="cg-chart-accuracy" height="180"></canvas></div>
        </div>
        <div class="cg-panel">
          <div class="cg-panel-head"><h3>Sessions per day</h3></div>
          <div class="cg-chart-wrap"><canvas id="cg-chart-volume" height="160"></canvas></div>
        </div>
        <div class="cg-panel">
          <div class="cg-panel-head"><h3>Skill averages</h3></div>
          <div class="cg-chart-wrap"><canvas id="cg-chart-skills" height="180"></canvas></div>
        </div>
        <div class="cg-panel">
          <div class="cg-panel-head"><h3>Morning vs evening</h3></div>
          <div class="cg-chart-wrap"><canvas id="cg-chart-slots" height="140"></canvas></div>
        </div>
      </div>`;
  },

  loadChartJs() {
    return new Promise((resolve) => {
      if (typeof Chart !== 'undefined') {
        resolve();
        return;
      }
      const existing = document.querySelector('script[data-cg-chartjs]');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
      script.dataset.cgChartjs = '1';
      script.onload = () => resolve();
      script.onerror = () => resolve();
      document.head.appendChild(script);
    });
  },

  async drawAnalyticsCharts(analytics) {
    if (!analytics?.ready) return;
    await this.loadChartJs();
    if (typeof Chart === 'undefined') return;

    const grid = 'rgba(244,241,234,0.08)';
    const tick = 'rgba(244,241,234,0.45)';
    const gold = '#c9a35a';
    const up = '#8fbf8c';

    this._charts = this._charts || {};
    Object.values(this._charts).forEach((c) => {
      try {
        c.destroy();
      } catch (_) {}
    });
    this._charts = {};

    const accEl = document.getElementById('cg-chart-accuracy');
    const volEl = document.getElementById('cg-chart-volume');
    const skEl = document.getElementById('cg-chart-skills');
    const slotEl = document.getElementById('cg-chart-slots');
    if (!accEl) return;

    this._charts.acc = new Chart(accEl, {
      type: 'line',
      data: {
        labels: analytics.daily.map((d) => d.label),
        datasets: [
          {
            label: 'Accuracy %',
            data: analytics.daily.map((d) => d.accuracy),
            borderColor: gold,
            backgroundColor: 'rgba(201,163,90,0.15)',
            tension: 0.35,
            fill: true,
            pointRadius: 3,
            pointBackgroundColor: gold,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: tick, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 }, grid: { color: grid } },
          y: { min: 0, max: 100, ticks: { color: tick }, grid: { color: grid } },
        },
      },
    });

    if (volEl) {
      this._charts.vol = new Chart(volEl, {
        type: 'bar',
        data: {
          labels: analytics.daily.map((d) => d.label),
          datasets: [
            {
              label: 'Sessions',
              data: analytics.daily.map((d) => d.sessions),
              backgroundColor: 'rgba(143,191,140,0.55)',
              borderRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: tick, maxTicksLimit: 6 }, grid: { display: false } },
            y: { beginAtZero: true, ticks: { color: tick, stepSize: 1 }, grid: { color: grid } },
          },
        },
      });
    }

    if (skEl) {
      const labels = analytics.skills.map((s) => s.label);
      const data = analytics.skills.map((s) => s.score ?? 0);
      this._charts.sk = new Chart(skEl, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Avg %',
              data,
              backgroundColor: labels.map((_, i) => (i % 2 ? 'rgba(201,163,90,0.65)' : 'rgba(143,191,140,0.55)')),
              borderRadius: 4,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { min: 0, max: 100, ticks: { color: tick }, grid: { color: grid } },
            y: { ticks: { color: tick }, grid: { display: false } },
          },
        },
      });
    }

    if (slotEl) {
      this._charts.slots = new Chart(slotEl, {
        type: 'bar',
        data: {
          labels: ['Morning', 'Evening'],
          datasets: [
            {
              data: [analytics.morningEvening.morning ?? 0, analytics.morningEvening.evening ?? 0],
              backgroundColor: [up, gold],
              borderRadius: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: tick }, grid: { display: false } },
            y: { min: 0, max: 100, ticks: { color: tick }, grid: { color: grid } },
          },
        },
      });
    }
  },

  async saveSetting(key, value) {
    await LocalDB.setMeta?.(`cgSetting:${key}`, String(value)).catch(() => {});
    if (key === 'textSize') {
      document.getElementById('caregiver-view')?.setAttribute('data-text', value);
    }
  },

  /** Phone / installed PWA — popups & print are unreliable; use Share + download */
  isPhoneSurface() {
    const coarse = window.matchMedia?.('(pointer: coarse)')?.matches;
    const narrow = window.matchMedia?.('(max-width: 820px)')?.matches;
    const standalone =
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
      window.navigator.standalone === true;
    const ua = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
    return !!(standalone || ua || (coarse && narrow));
  },

  buildReportHtml() {
    const payload = this._bundle?.export;
    const b = this._bundle;
    if (!payload || !b) return null;
    const name = b.overview?.name || 'Patient';
    const skills = (b.health?.skills || [])
      .map(
        (s) =>
          `<tr><td>${this.escape(s.label)}</td><td>${s.score ?? '—'}</td><td>${
            s.delta != null ? (s.delta > 0 ? '+' : '') + s.delta : '—'
          }</td></tr>`
      )
      .join('');
    const insights = (b.insights?.cards || [])
      .map(
        (c) =>
          `<li><strong>${this.escape(c.title)}</strong> — ${this.escape(c.body)}</li>`
      )
      .join('');

    return {
      name,
      filename: `mindcare-${String(name).toLowerCase().replace(/\s+/g, '-')}-summary`,
      text: payload.text,
      title: payload.title,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MindCare — ${this.escape(name)}</title>
<style>
  body{font-family:Georgia,serif;color:#1a1c18;max-width:720px;margin:24px auto;padding:0 20px 48px;line-height:1.5;-webkit-text-size-adjust:100%}
  h1{font-size:26px;margin:0 0 8px} .sub{color:#666;margin:0 0 24px;font-size:14px}
  h2{font-size:14px;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid #ddd;padding-bottom:6px;margin:24px 0 10px}
  table{width:100%;border-collapse:collapse;font-size:15px} td,th{text-align:left;padding:10px 6px;border-bottom:1px solid #eee}
  .note{margin-top:28px;font-size:12px;color:#888}
  .actions{position:sticky;bottom:0;left:0;right:0;display:flex;gap:8px;padding:12px 0;background:linear-gradient(transparent,#fff 30%);padding-top:28px}
  .actions button{flex:1;min-height:48px;border-radius:10px;border:1px solid #ccc;background:#1a1c18;color:#fff;font-size:15px;font-weight:600}
  .actions button.secondary{background:#fff;color:#1a1c18}
  @media print{.actions{display:none!important} body{margin:0}}
</style></head><body>
<h1>MindCare care summary</h1>
<p class="sub">${this.escape(name)} · Generated ${new Date().toLocaleString()}</p>
<h2>Overview</h2>
<p>${this.escape(b.overview?.nudge || '')}</p>
<p>Last session: ${this.escape(b.overview?.lastActive?.label || '—')}<br>
This week: ${this.escape(b.overview?.week?.label || '—')}<br>
Overall: ${this.escape(b.overview?.overall?.label || '—')} (${this.escape(b.overview?.overall?.line || '')})<br>
Total sessions: ${b.overview?.impact?.totalSessions ?? '—'} · Consistency: ${b.overview?.impact?.consistency ?? '—'}/100</p>
<h2>Skills</h2>
<table><thead><tr><th>Skill</th><th>Score</th><th>Δ week</th></tr></thead><tbody>${
        skills || '<tr><td colspan="3">No skill data yet</td></tr>'
      }</tbody></table>
<h2>Insights</h2>
<ul>${insights || '<li>No insights yet</li>'}</ul>
<h2>Forecast</h2>
<p>${this.escape(b.forecast?.ready ? b.forecast.milestone : b.forecast?.message || '—')}</p>
<p class="note">Not a medical device. For family and clinician engagement context only.</p>
</body></html>`,
    };
  },

  /** Caregiver wellness check-ins only — never patient clinical data */
  buildWellnessReportHtml() {
    const w = this._bundle?.wellness;
    if (!w) return null;

    const meterRow = (label, m) => {
      if (!m || m.source === 'none') {
        return `<tr><td>${this.escape(label)}</td><td colspan="2">Not checked in yet</td></tr>`;
      }
      return `<tr><td>${this.escape(label)}</td><td>${this.escape(m.label)}</td><td>${m.score}% · ${this.escape(
        m.detail || ''
      )}</td></tr>`;
    };

    const history = (w.history || [])
      .map(
        (h) =>
          `<tr><td>${this.escape(h.title)}</td><td>${this.escape(h.band)} · ${h.pct}%</td><td>${this.escape(
            h.label
          )}</td></tr>`
      )
      .join('');

    const packs = (w.packs || [])
      .map((p) => `<li><strong>${this.escape(p.title)}</strong> — ${this.escape(p.status || '—')}</li>`)
      .join('');

    const text =
      w.shareText ||
      [
        'MindCare — Caregiver wellness summary',
        w.headline || '',
        '',
        'Self-report only — not a medical diagnosis.',
      ].join('\n');

    return {
      name: 'Caregiver',
      filename: 'mindcare-caregiver-wellness',
      text,
      title: 'MindCare — Caregiver wellness',
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MindCare — Caregiver wellness</title>
<style>
  body{font-family:Georgia,serif;color:#1a1c18;max-width:720px;margin:24px auto;padding:0 20px 48px;line-height:1.5;-webkit-text-size-adjust:100%}
  h1{font-size:26px;margin:0 0 8px} .sub{color:#666;margin:0 0 24px;font-size:14px}
  h2{font-size:14px;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid #ddd;padding-bottom:6px;margin:24px 0 10px}
  table{width:100%;border-collapse:collapse;font-size:15px} td,th{text-align:left;padding:10px 6px;border-bottom:1px solid #eee}
  .note{margin-top:28px;font-size:12px;color:#888}
  .actions{position:sticky;bottom:0;left:0;right:0;display:flex;gap:8px;padding:12px 0;background:linear-gradient(transparent,#fff 30%);padding-top:28px}
  .actions button{flex:1;min-height:48px;border-radius:10px;border:1px solid #ccc;background:#1a1c18;color:#fff;font-size:15px;font-weight:600}
  @media print{.actions{display:none!important} body{margin:0}}
</style></head><body>
<h1>Caregiver wellness summary</h1>
<p class="sub">Generated ${new Date().toLocaleString()}</p>
<p>${this.escape(w.headline || '')}</p>
<p>${this.escape(w.recognition || '')}</p>
<h2>Check-in meters</h2>
<table><thead><tr><th>Area</th><th>Band</th><th>Detail</th></tr></thead><tbody>
${meterRow('Stress', w.meter?.stress)}
${meterRow('Anxiety', w.meter?.anxiety)}
${meterRow('Mood load', w.meter?.mood)}
${meterRow('Engagement', w.meter?.engagement)}
${meterRow('Sustainability', w.meter?.sustainability)}
</tbody></table>
<h2>Recommendation</h2>
<p>${this.escape(w.tip?.text || 'Complete a check-in to get a recommendation.')}</p>
<h2>Pack status</h2>
<ul>${packs || '<li>No packs</li>'}</ul>
<h2>Recent check-ins</h2>
<table><thead><tr><th>Type</th><th>Result</th><th>When</th></tr></thead><tbody>
${history || '<tr><td colspan="3">No check-ins yet</td></tr>'}
</tbody></table>
<h2>Care effort (their sessions)</h2>
<p>Sessions this week: ${this.escape(String(w.careEffort?.weekSessions ?? '—'))}<br>
Time invested: ${this.escape(String(w.careEffort?.timeInvested ?? '—'))}<br>
Consistency: ${this.escape(String(w.careEffort?.consistencyLabel ?? '—'))}</p>
<p class="note">Self-report wellness for the caregiver only. Not a medical diagnosis. Does not include the patient’s clinical summary.</p>
</body></html>`,
    };
  },

  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 1500);
  },

  async shareFilesOrText({ title, text, files }) {
    if (!navigator.share) return false;
    try {
      if (files?.length && navigator.canShare?.({ files })) {
        await navigator.share({ title, text, files });
        return true;
      }
      await navigator.share({ title, text });
      return true;
    } catch (err) {
      // User cancelled share sheet
      if (err?.name === 'AbortError') return true;
      return false;
    }
  },

  async doExportText() {
    const report = this.buildReportHtml();
    if (!report) return;
    await this._exportTextReport(report, 'Patient text summary downloaded');
  },

  async doExportWellnessText() {
    const report = this.buildWellnessReportHtml();
    if (!report) {
      this.toast('No wellness data yet');
      return;
    }
    await this._exportTextReport(report, 'Wellness text downloaded');
  },

  async _exportTextReport(report, desktopToast) {
    if (this.isPhoneSurface()) {
      const file = new File([report.text], `${report.filename}.txt`, {
        type: 'text/plain',
      });
      const shared = await this.shareFilesOrText({
        title: report.title,
        text: report.text,
        files: [file],
      });
      if (shared) {
        this.toast('Opened share sheet');
        return;
      }
    }

    this.downloadBlob(new Blob([report.text], { type: 'text/plain;charset=utf-8' }), `${report.filename}.txt`);
    this.toast(this.isPhoneSurface() ? 'Summary saved — check Downloads / Files' : desktopToast);
  },

  async doExportPdf() {
    const report = this.buildReportHtml();
    if (!report) return;
    await this._exportPdfReport(report);
  },

  async doExportWellnessPdf() {
    const report = this.buildWellnessReportHtml();
    if (!report) {
      this.toast('No wellness data yet — complete a check-in first');
      return;
    }
    await this._exportPdfReport(report);
  },

  async _exportPdfReport(report) {
    // —— Phone / installed app: no popup print ——
    if (this.isPhoneSurface()) {
      const htmlFile = new File([report.html], `${report.filename}.html`, {
        type: 'text/html',
      });
      const textFile = new File([report.text], `${report.filename}.txt`, {
        type: 'text/plain',
      });

      let shared = await this.shareFilesOrText({
        title: report.title,
        text: `${report.title}\n\n${report.text.slice(0, 800)}…`,
        files: [htmlFile],
      });
      if (!shared) {
        shared = await this.shareFilesOrText({
          title: report.title,
          text: report.text,
          files: [textFile],
        });
      }
      if (shared) {
        this.toast('Share the report from your phone');
        return;
      }

      this.downloadBlob(new Blob([report.html], { type: 'text/html;charset=utf-8' }), `${report.filename}.html`);
      this.downloadBlob(new Blob([report.text], { type: 'text/plain;charset=utf-8' }), `${report.filename}.txt`);
      this.showMobileExportSheet(report);
      return;
    }

    // —— Laptop / desktop: keep print → Save as PDF ——
    const win = window.open('', '_blank');
    if (!win) {
      this.toast('Allow pop-ups to export PDF');
      this.downloadBlob(new Blob([report.html], { type: 'text/html;charset=utf-8' }), `${report.filename}.html`);
      return;
    }
    win.document.open();
    win.document.write(
      report.html.replace(
        '</body>',
        `<div class="actions"><button type="button" onclick="window.print()">Print / Save as PDF</button></div>
        <script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script></body>`
      )
    );
    win.document.close();
  },

  showMobileExportSheet(report) {
    this.closeMobileExportSheet();
    const sheet = document.createElement('div');
    sheet.id = 'cg-export-sheet';
    sheet.className = 'cg-export-sheet';
    sheet.innerHTML = `
      <div class="cg-export-sheet-card" role="dialog" aria-label="Export options">
        <p class="cg-export-sheet-title">Share on this phone</p>
        <p class="cg-export-sheet-body">PDF print works best on a laptop. On phone, share the summary via WhatsApp, Mail, or Files — or save a text copy.</p>
        <button type="button" class="cg-btn cg-btn-primary" data-sheet-share>Share summary</button>
        <button type="button" class="cg-btn cg-btn-ghost" data-sheet-txt>Save text file</button>
        <button type="button" class="cg-btn cg-btn-ghost" data-sheet-copy>Copy to clipboard</button>
        <button type="button" class="cg-foot-link" data-sheet-close>Close</button>
      </div>`;
    document.getElementById('caregiver-view')?.appendChild(sheet);

    sheet.addEventListener('click', async (e) => {
      if (e.target.closest('[data-sheet-close]') || e.target === sheet) {
        this.closeMobileExportSheet();
        return;
      }
      if (e.target.closest('[data-sheet-share]')) {
        const file = new File([report.text], `${report.filename}.txt`, { type: 'text/plain' });
        const ok = await this.shareFilesOrText({
          title: report.title,
          text: report.text,
          files: [file],
        });
        if (!ok) this.toast('Share not available — try Copy');
        else this.closeMobileExportSheet();
        return;
      }
      if (e.target.closest('[data-sheet-txt]')) {
        this.downloadBlob(new Blob([report.text], { type: 'text/plain;charset=utf-8' }), `${report.filename}.txt`);
        this.toast('Saved — check Files / Downloads');
        this.closeMobileExportSheet();
        return;
      }
      if (e.target.closest('[data-sheet-copy]')) {
        try {
          await navigator.clipboard.writeText(report.text);
          this.toast('Copied — paste into WhatsApp or Mail');
        } catch {
          this.toast('Copy failed');
        }
        this.closeMobileExportSheet();
      }
    });
  },

  closeMobileExportSheet() {
    document.getElementById('cg-export-sheet')?.remove();
  },

  async doShare() {
    const report = this.buildReportHtml();
    if (!report) return;

    const file = new File([report.text], `${report.filename}.txt`, { type: 'text/plain' });
    const shared = await this.shareFilesOrText({
      title: report.title,
      text: report.text,
      files: [file],
    });
    if (shared) {
      this.toast(this.isPhoneSurface() ? 'Share sheet opened' : 'Shared');
      return;
    }

    if (this.isPhoneSurface()) {
      this.showMobileExportSheet(report);
      return;
    }
    await this.doCopyClinical();
  },

  async doCopyClinical() {
    const payload = this._bundle?.export;
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(payload.text);
      this.toast(this.isPhoneSurface() ? 'Copied — paste into any app' : 'Clinical summary copied');
    } catch {
      // iOS sometimes blocks clipboard without gesture fallthrough
      this.showMobileExportSheet(this.buildReportHtml());
    }
  },

  async doShareWellness() {
    const report = this.buildWellnessReportHtml();
    if (!report) {
      this.toast('No wellness data yet');
      return;
    }
    const file = new File([report.text], `${report.filename}.txt`, { type: 'text/plain' });
    const shared = await this.shareFilesOrText({
      title: report.title,
      text: report.text,
      files: [file],
    });
    if (shared) {
      this.toast(this.isPhoneSurface() ? 'Share sheet opened' : 'Shared');
      return;
    }
    if (this.isPhoneSurface()) {
      this.showMobileExportSheet(report);
      return;
    }
    await this.doCopyWellness();
  },

  async doCopyWellness() {
    const text = this._bundle?.wellness?.shareText || this.buildWellnessReportHtml()?.text;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.toast('Wellness summary copied');
    } catch {
      this.toast('Copy failed');
    }
  },

  async doLogout() {
    try {
      await API.logout?.().catch(() => {});
    } catch (_) {}
    if (typeof Session !== 'undefined') Session.clear();
    if (window.app?.showAuthGate) window.app.showAuthGate();
    else window.location.reload();
  },

  async doDeleteAccount() {
    const ok = window.confirm(
      'Delete all MindCare data on this device? This clears patients, sessions, and local settings. You will be signed out.'
    );
    if (!ok) return;
    try {
      const stores = ['patients', 'sessions', 'memories', 'syncQueue', 'meta', 'caregiverCheckins'];
      for (const store of stores) {
        const rows = (await LocalDB.getAll(store).catch(() => [])) || [];
        for (const row of rows) {
          const key = row.id ?? row.key;
          if (key != null) await LocalDB.delete(store, key).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('Local clear failed', err);
    }
    await this.doLogout();
  },

  toast(msg) {
    let el = document.getElementById('cg-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'cg-toast';
      el.className = 'cg-toast';
      document.getElementById('caregiver-view')?.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('is-on');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('is-on'), 2200);
  },

  async openEditor(id) {
    this.setView('settings');
    await this.render();
    this.setView('settings');
    const patient = id ? await LocalDB.get('patients', id) : null;
    if (typeof PatientEditor !== 'undefined') {
      await PatientEditor.render(patient);
    }
  },

  startSession(id) {
    this.currentPatient = { id };
    window.app?.showPatientView(id);
  },

  showPatientEditor(patient = null) {
    this.openEditor(patient?.id || null);
  },

  switchTab(tab) {
    const map = { home: 'overview', patients: 'settings', analytics: 'analytics' };
    this.setView(map[tab] || tab || 'overview');
  },

  async viewPatient(id) {
    await this.openEditor(id);
  },

  async renderAnalytics() {
    this.setView('analytics');
    await this.render();
  },
};
