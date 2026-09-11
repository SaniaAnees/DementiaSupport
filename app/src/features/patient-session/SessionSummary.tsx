import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button, ScoreRing } from '../../shared/ui';
import { db, enqueueSync, nid, now } from '../../shared/db';
import { computeSessionScores } from './engine';
import { useSessionStore } from './store';
import { usePatientLock } from '../patient-mode/lockStore';

export function SessionSummary() {
  const nav = useNavigate();
  const locked = usePatientLock((s) => s.patientLocked);
  const { sessionId, patientId, sessionType, results, reset } = useSessionStore();
  const [scores, setScores] = useState<ReturnType<typeof computeSessionScores> | null>(null);

  useEffect(() => {
    (async () => {
      if (!sessionId || !patientId) return;
      const computed = computeSessionScores(results);
      setScores(computed);
      const existing = await db.sessions.get(sessionId);
      if (existing) {
        const updated = {
          ...existing,
          status: 'completed' as const,
          endedAt: now(),
          accuracy: computed.accuracy,
          avgResponseMs: computed.avgResponseMs,
          hintsUsed: computed.hintsUsed,
          repetitions: computed.repetitions,
          hintRate: computed.hintRate,
          compositeScore: computed.compositeScore,
          updatedAt: now(),
          syncStatus: 'pending' as const,
        };
        await db.sessions.put(updated);
        await enqueueSync('session', sessionId, updated);
      }
      for (const r of results) {
        const log = {
          id: nid(),
          sessionId,
          sessionItemId: r.itemId,
          patientId,
          sessionType: sessionType || 'morning',
          memoryId: r.memoryId,
          outcome: r.outcome,
          responseMs: r.responseMs,
          repetitions: r.repetitions,
          hintsUsed: r.hintsUsed,
          transcript: r.transcript,
          createdAt: now(),
          syncStatus: 'pending' as const,
        };
        await db.answerLogs.put(log);
        await enqueueSync('answerLog', log.id, log);
      }
    })();
  }, [sessionId, patientId, results, sessionType]);

  return (
    <div className="patient-shell page-pad" style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <p
        style={{
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--patient-vital)',
          marginBottom: 12,
        }}
      >
        Session complete
      </p>
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: 'clamp(34px, 9vw, 44px)',
          letterSpacing: '-0.04em',
          lineHeight: 1.05,
          margin: '0 0 10px',
        }}
      >
        Beautifully done
      </h1>
      <p style={{ color: 'var(--patient-mute)', marginBottom: 28, fontSize: 16, lineHeight: 1.5 }}>
        Saved on this device. Network was never required.
      </p>

      {scores ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 22,
            padding: '28px 20px',
            borderRadius: 28,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            marginBottom: 28,
          }}
        >
          <ScoreRing
            value={Math.round(scores.accuracy * 100)}
            label="Acc"
            size={140}
            color="var(--patient-vital)"
            track="rgba(255,255,255,0.1)"
            ink="var(--patient-ink)"
            mute="var(--patient-mute)"
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, width: '100%' }}>
            <div style={{ textAlign: 'center', padding: '14px 10px', borderRadius: 16, background: 'rgba(0,0,0,0.25)' }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--patient-mute)', marginBottom: 6 }}>
                Score
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 600 }}>{scores.compositeScore}</div>
            </div>
            <div style={{ textAlign: 'center', padding: '14px 10px', borderRadius: 16, background: 'rgba(0,0,0,0.25)' }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--patient-mute)', marginBottom: 6 }}>
                Hints
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 600 }}>{scores.hintsUsed}</div>
            </div>
          </div>
        </motion.div>
      ) : (
        <p style={{ color: 'var(--patient-mute)' }}>Saving…</p>
      )}

      <div style={{ marginTop: 'auto' }}>
        <Button
          variant="patient"
          large
          onClick={() => {
            reset();
            nav(locked ? '/patient-mode' : '/');
          }}
        >
          Done
        </Button>
      </div>
    </div>
  );
}
