import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../shared/ui';
import { db, enqueueSync, nid, now, todayKey } from '../../shared/db';
import { parseSoftConstraints } from '../../shared/constraints';
import { adaptFromRecent } from '../insights/flags';
import { buildEveningSession, buildMorningSession } from './engine';
import { useSessionStore } from './store';

export function SessionStart() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const setSession = useSessionStore((s) => s.setSession);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const type = params.get('type') === 'evening' ? 'evening' : 'morning';
      const patientId = params.get('patientId');
      if (!patientId) {
        setError('No patient selected.');
        return;
      }
      const patient = await db.patients.get(patientId);
      if (!patient) {
        setError('Patient missing.');
        return;
      }
      const memories = await db.memories.where('patientId').equals(patientId).toArray();
      if (!memories.length) {
        setError('Add family photos in the caregiver library before starting. Nothing generic is shown here.');
        return;
      }

      const history = await db.sessions.where('patientId').equals(patientId).toArray();
      const base = parseSoftConstraints(patient.medicalRecommendations);
      const constraints = adaptFromRecent(history, base);

      // Prefer today's scheduled row; else create a completed-bound session id
      const day = todayKey();
      let slot = (await db.sessions.where('patientId').equals(patientId).toArray()).find(
        (s) => s.scheduledFor === day && s.sessionType === type
      );
      const sessionId = slot?.id || nid();
      const startedAt = now();
      if (!slot) {
        slot = {
          id: sessionId,
          patientId,
          sessionType: type,
          status: 'in_progress',
          scheduledFor: day,
          startedAt,
          hintsUsed: 0,
          repetitions: 0,
          createdAt: startedAt,
          updatedAt: startedAt,
          syncStatus: 'pending',
        };
      } else {
        slot = {
          ...slot,
          status: 'in_progress',
          startedAt,
          updatedAt: startedAt,
          syncStatus: 'pending',
        };
      }
      await db.sessions.put(slot);
      await enqueueSync('session', sessionId, slot);

      const items =
        type === 'morning'
          ? buildMorningSession(memories, sessionId, constraints)
          : buildEveningSession(patient, memories, sessionId, constraints);

      if (!items.length) {
        setError('Could not build session from the library.');
        return;
      }

      await db.sessionItems.bulkPut(items);
      setSession({
        patientId,
        sessionId,
        sessionType: type,
        languageCode: patient.languageCode || 'en',
        items,
        maxMinutes: constraints.maxMinutes,
        pauseBeforeHintMs: constraints.pauseBeforeHintMs,
      });
      nav('/session/play', { replace: true });
    })();
  }, [params, setSession, nav]);

  if (error) {
    return (
      <div className="patient-shell" style={{ padding: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 36 }}>Almost ready</h1>
        <p style={{ color: 'var(--patient-muted)', marginBottom: 24 }}>{error}</p>
        <Button variant="patient" onClick={() => nav('/patient-mode')}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="patient-shell" style={{ display: 'grid', placeItems: 'center', padding: 24 }}>
      <p style={{ color: 'var(--patient-muted)' }}>Preparing your session…</p>
    </div>
  );
}
