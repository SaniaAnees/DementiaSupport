// Session summary screen
const SessionSummary = {
  render(session, responses, scores) {
    const content = document.getElementById('session-container');
    if (!content) return;

    const accuracyPercent = Math.round(scores.accuracy * 100);
    const score = scores.compositeScore.toFixed(1);

    let message = '';
    if (scores.accuracy >= 0.8) message = 'Great job! Keep it up!';
    else if (scores.accuracy >= 0.5) message = 'Good effort. Keep practicing!';
    else message = 'Keep going — every session helps!';

    const graded = responses.filter(
      (r) => r.transcript !== '(continue)' &&
        !['story_beat', 'registration_teach', 'memory_teach'].includes(r.itemType)
    );
    const correctCount = graded.filter((r) => r.isCorrect).length;
    const totalCount = graded.length;

    const domains = scores.domains || {};
    const domainRows = Object.entries(domains)
      .filter(([, v]) => v != null)
      .map(([k, v]) => `<div class="stat-card"><div class="stat-value">${v}%</div><div class="stat-label">${k}</div></div>`)
      .join('');

    content.innerHTML = `
      <div class="session-screen" style="padding-top: var(--space-2xl);">
        <div class="photo-container media-card" style="max-width: 150px; margin: 0 auto;">
          <img src="/assets/curriculum/as/morning.jpg" alt="Well done" style="width:100%;height:100%;object-fit:cover;">
        </div>
        <div class="summary-score">${score}</div>
        <div class="summary-message">${message}</div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md); width: 100%; max-width: 400px; margin: 0 auto var(--space-xl);">
          <div class="stat-card"><div class="stat-value">${correctCount}/${totalCount}</div><div class="stat-label">Correct</div></div>
          <div class="stat-card"><div class="stat-value">${accuracyPercent}%</div><div class="stat-label">Accuracy</div></div>
          <div class="stat-card"><div class="stat-value">${scores.hintsUsed}</div><div class="stat-label">Hints</div></div>
          <div class="stat-card"><div class="stat-value">${scores.avgResponseMs}ms</div><div class="stat-label">Avg Response</div></div>
        </div>
        ${domainRows ? `<div class="domain-grid">${domainRows}</div>` : ''}

        <div style="display: flex; flex-direction: column; gap: var(--space-md); width: 100%; max-width: 400px; margin: 0 auto;">
          <button class="btn btn-primary btn-block btn-large" onclick="SessionSummary.returnHome()">
            Back to Home
          </button>
        </div>
      </div>
    `;

    this._lastSession = session;

    // Log event
    const evt = new CustomEvent('sessionCompleted', { detail: { session, scores } });
    window.dispatchEvent(evt);
  },

  returnHome() {
    const pid =
      window.app?.currentPatient?.id ||
      this._lastSession?.patientId ||
      this._lastSession?.patient_id ||
      null;

    // Stay inside the app shell — never reload (reload restarts the welcome splash)
    const main = document.getElementById('main-app');
    main?.classList.remove('hidden');
    main?.classList.add('is-visible');
    document.getElementById('splash-screen')?.classList.add('hidden');
    document.getElementById('intro-screen')?.classList.add('hidden');
    document.getElementById('auth-gate')?.classList.add('hidden');
    document.getElementById('onboard-gate')?.classList.add('hidden');

    if (pid && window.app) {
      window.app.currentPatient = window.app.currentPatient || { id: pid };
      if (!window.app.currentPatient.id) window.app.currentPatient.id = pid;
    }

    if (typeof window.app?.setMode === 'function') {
      window.app.setMode('patient');
      return;
    }
    if (typeof PatientHome !== 'undefined') {
      PatientHome.render(pid);
      return;
    }
    if (typeof SessionStart !== 'undefined') {
      SessionStart.render(pid);
    }
  },
};
