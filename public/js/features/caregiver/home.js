// Caregiver Dashboard
const CaregiverHome = {
  currentPatient: null,

  async init() {
    await this.render();
    this.bindEvents();
  },

  bindEvents() {
    document.getElementById('add-patient-btn')?.addEventListener('click', () => {
      this.showPatientEditor();
    });

    document.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        this.switchTab(tab);
      });
    });
  },

  switchTab(tab) {
    document.querySelectorAll('.tab-pane').forEach((pane) => {
      pane.classList.toggle('hidden', pane.id !== `tab-${tab}`);
    });
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    if (tab === 'analytics' && this.currentPatient) {
      this.renderAnalytics(this.currentPatient.id);
    }
  },

  async render() {
    const content = document.getElementById('patient-list');
    if (!content) return;

    let patients = await LocalDB.getAll('patients');

    // If online, sync with server
    if (navigator.onLine) {
      try {
        const serverPatients = await API.getPatients();
        for (const p of serverPatients) {
          await LocalDB.put('patients', p);
        }
        patients = serverPatients;
      } catch (err) {
        console.warn('Server fetch failed, using local:', err);
      }
    }

    if (patients.length === 0) {
      content.innerHTML = `
        <div class="card">
          <p style="text-align: center; color: var(--color-text-muted);">No patients yet. Add one to get started!</p>
        </div>
      `;
      return;
    }

    content.innerHTML = patients.map((p) => `
      <div class="card patient-card" data-id="${p.id}">
        <div>
          <h3>${p.preferred_name || p.full_name}</h3>
          <p>${p.hometown || 'No hometown set'} • Age ${p.age || '?'}</p>
        </div>
        <div class="patient-actions">
          <button class="btn btn-secondary" style="min-height: 48px" onclick="CaregiverHome.startSession('${p.id}')">▶ Start</button>
          <button class="btn btn-secondary" style="min-height: 48px" onclick="CaregiverHome.viewPatient('${p.id}')">Edit</button>
        </div>
      </div>
    `).join('');
  },

  async viewPatient(id) {
    const patient = await LocalDB.get('patients', id);
    this.currentPatient = patient;
    this.switchTab('patients');
    await PatientEditor.render(patient);
  },

  startSession(id) {
    this.currentPatient = { id };
    window.app?.showPatientView(id);
  },

  showPatientEditor(patient = null) {
    this.currentPatient = patient;
    this.switchTab('patients');
    PatientEditor.render(this.currentPatient);
  },

  async renderAnalytics(patientId) {
    const content = document.getElementById('analytics-view');
    if (!content) return;

    content.innerHTML = '<p>Loading analytics...</p>';

    try {
      let data;
      if (navigator.onLine) {
        data = await API.getAnalytics(patientId);
      } else {
        // Build from local data
        data = await this.getLocalAnalytics(patientId);
      }

      const trend = data.trend || { state: 'insufficient_data', message: 'No data yet' };
      const summary = data.summary || { totalSessions: 0, avgAccuracy: 0, avgComposite: 0 };

      const trendClass = `trend-${trend.state}`.replace(/_/g, '-');

      content.innerHTML = `
        <div class="card">
          <h2>Patient Analytics</h2>
          <div class="analytics-summary">
            <div class="stat-card">
              <div class="stat-value">${summary.totalSessions}</div>
              <div class="stat-label">Total Sessions</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${Math.round((summary.avgAccuracy || 0) * 100)}%</div>
              <div class="stat-label">Avg Accuracy</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${Math.round(summary.avgComposite || 0)}</div>
              <div class="stat-label">Avg Score</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${summary.avgResponseMs || 0}ms</div>
              <div class="stat-label">Avg Response</div>
            </div>
          </div>
          <div class="card">
            <span class="trend-badge ${trendClass}">${trend.state.replace('_', ' ')}</span>
            <p>${trend.message}</p>
          </div>
        </div>
        <div class="card">
          <h3>Recent Sessions</h3>
          ${data.recentSessions?.length ? this.renderSessionList(data.recentSessions) : '<p>No sessions completed yet.</p>'}
        </div>
        ${data.alerts?.length ? `<div class="card">${this.renderAlerts(data.alerts)}</div>` : ''}
      `;
    } catch (err) {
      content.innerHTML = '<p>Failed to load analytics.</p>';
    }
  },

async getLocalAnalytics(patientId) {
    const sessions = await LocalDB.getAllByIndex('sessions', 'patientId', patientId);
    const completed = sessions.filter((s) => s.status === 'completed');
    const avgAcc = sessions.length ? completed.reduce((s, x) => s + (x.accuracy || 0), 0) / sessions.length : 0;
    const avgComp = sessions.length ? completed.reduce((s, x) => s + (x.compositeScore || 0), 0) / sessions.length : 0;

    return {
      summary: { totalSessions: sessions.length, avgAccuracy: avgAcc, avgComposite: avgComp },
      trend: { state: 'insufficient_data', message: 'Need more sessions' },
      recentSessions: completed.slice(-10),
      alerts: [],
    };
  },

  renderSessionList(sessions) {
    return `<div class="session-list">
      ${sessions.map((s) => `
        <div class="card" style="margin-bottom: var(--space-sm)">
          <div style="display: flex; justify-content: space-between;">
            <strong>${new Date(s.started_at || s.startedAt).toLocaleDateString()}</strong>
            <span>${s.session_type || s.sessionType} • ${Math.round((s.accuracy || 0) * 100)}%</span>
          </div>
        </div>
      `).join('')}
    </div>`;
  },

  renderAlerts(alerts) {
    return `<h3>Alerts</h3>
      ${alerts.map((a) => `
        <div class="alert-item" style="border-left-color: ${
          a.severity === 'attention' ? 'var(--color-error)' : 'var(--color-warning)'
        }">
          <h4>${a.title}</h4>
          <p>${a.body}</p>
        </div>
      `).join('')}
    `;
  },
};
