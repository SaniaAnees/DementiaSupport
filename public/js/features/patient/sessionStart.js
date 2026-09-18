// Session launcher — UI lives in PatientHome; this starts morning/evening engines
const SessionStart = {
  async render(patientId) {
    if (typeof PatientHome !== 'undefined') {
      return PatientHome.render(patientId);
    }
    const content = document.getElementById('session-container');
    if (content) content.innerHTML = '<p>Patient home unavailable.</p>';
  },

  async startSession(patientId, sessionType) {
    const slot =
      sessionType ||
      PatientHome?._pendingSessionType ||
      (typeof PatientHome !== 'undefined' && PatientHome._pendingSessionType);
    if (!slot || (slot !== 'morning' && slot !== 'evening')) {
      console.warn('SessionStart: invalid sessionType', sessionType);
      return;
    }

    const content = document.getElementById('session-container');
    content.innerHTML = '<div class="session-screen"><p style="font-size: var(--font-size-lg);">Preparing your session...</p></div>';
    document.getElementById('main-app')?.classList.add('is-session-active');

    try {
      let sessionData;

      if (navigator.onLine) {
        sessionData = await API.startSession(patientId, slot);
      } else {
        const patient = await LocalDB.get('patients', patientId);
        const memories = await LocalDB.getAllByIndex('memories', 'patientId', patientId);
        const sessionId = crypto.randomUUID();

        let curriculum = null;
        if (typeof CurriculumClient !== 'undefined') {
          try {
            curriculum = await CurriculumClient.buildOfflineCurriculum(patient, memories, slot);
          } catch (e) {
            console.warn('Offline curriculum unavailable', e);
          }
        }

        const items = curriculum
          ? curriculum.items.map((it) => ({ ...it, sessionId }))
          : (slot === 'morning' ? buildMorningSession : buildEveningSession)(patient, memories, sessionId);

        const session = {
          id: sessionId,
          patientId,
          sessionType: slot,
          status: 'in_progress',
          startedAt: new Date().toISOString(),
          curriculum: curriculum?.meta || null,
        };
        await LocalDB.put('sessions', session);
        sessionData = { session, items };
      }

      SessionPlay.start(sessionData.session, sessionData.items);
    } catch (err) {
      console.error('Session start failed:', err);
      document.getElementById('main-app')?.classList.remove('is-session-active');
      content.innerHTML = '<p style="color: var(--color-error);">Failed to start session.</p>';
    }
  },
};
