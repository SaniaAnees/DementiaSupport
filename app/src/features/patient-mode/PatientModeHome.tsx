import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../shared/ui';
import { db, hashPin } from '../../shared/db';
import { getActivePatient } from '../../shared/sessionsToday';
import { usePatientLock } from './lockStore';
import type { Patient } from '../../shared/types';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function PatientModeHome() {
  const nav = useNavigate();
  const unlock = usePatientLock((s) => s.unlock);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [showPin, setShowPin] = useState(false);
  const [pin, setPin] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getActivePatient().then(setPatient);
  }, []);

  async function tryUnlock() {
    const caregiver = await db.caregivers.toCollection().first();
    if (!caregiver) return;
    const h = await hashPin(pin);
    if (h !== caregiver.pinHash) {
      setErr('Incorrect PIN');
      return;
    }
    unlock();
    nav('/');
  }

  const name = patient ? patient.preferredName || patient.fullName : '…';

  return (
    <div className="patient-shell page-pad" style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--patient-vital)',
            marginBottom: 14,
          }}
        >
          {greeting()}
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 'clamp(36px, 10vw, 48px)',
            letterSpacing: '-0.04em',
            lineHeight: 1.02,
            margin: '0 0 12px',
          }}
        >
          Ready, {name}
        </h1>
        <p style={{ color: 'var(--patient-mute)', fontSize: 17, lineHeight: 1.5, margin: '0 0 28px', fontWeight: 500 }}>
          One photo. One question. No menus — just the daily ritual.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            marginBottom: 8,
          }}
        >
          {[
            { label: 'Morning', sub: 'Memories' },
            { label: 'Evening', sub: 'Orientation' },
          ].map((c) => (
            <div
              key={c.label}
              style={{
                padding: '18px 16px',
                borderRadius: 20,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--patient-mute)', marginBottom: 8 }}>
                {c.label}
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, letterSpacing: '-0.03em' }}>
                {c.sub}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      <div style={{ display: 'grid', gap: 12, marginTop: 'auto' }}>
        <Button
          variant="patient"
          large
          disabled={!patient}
          onClick={() => patient && nav(`/session/start?type=morning&patientId=${patient.id}`)}
        >
          Start morning memories
        </Button>
        <Button
          large
          disabled={!patient}
          style={{
            background: 'rgba(255,255,255,0.06)',
            color: 'var(--patient-ink)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: 'none',
          }}
          onClick={() => patient && nav(`/session/start?type=evening&patientId=${patient.id}`)}
        >
          Start evening orientation
        </Button>
        <button
          onClick={() => setShowPin(true)}
          style={{
            marginTop: 4,
            background: 'none',
            border: 'none',
            color: 'var(--patient-mute)',
            fontWeight: 650,
            cursor: 'pointer',
            padding: '14px 0',
            fontSize: 14,
          }}
        >
          Caregiver exit
        </button>
      </div>

      {showPin && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.78)',
            backdropFilter: 'blur(8px)',
            display: 'grid',
            placeItems: 'end center',
            padding: 16,
            zIndex: 50,
          }}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            style={{
              width: 'min(430px, 100%)',
              background: 'linear-gradient(180deg, #1a222e 0%, #121821 100%)',
              borderRadius: '28px 28px 22px 22px',
              padding: 24,
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 -20px 60px rgba(0,0,0,0.4)',
            }}
          >
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, marginBottom: 6, letterSpacing: '-0.03em' }}>
              Caregiver PIN
            </div>
            <p style={{ color: 'var(--patient-mute)', marginTop: 0, marginBottom: 18, fontSize: 14 }}>
              Enter your PIN to leave session mode.
            </p>
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              inputMode="numeric"
              placeholder="••••"
              style={{
                width: '100%',
                fontSize: 36,
                letterSpacing: 14,
                textAlign: 'center',
                padding: 18,
                borderRadius: 18,
                border: '1px solid rgba(255,255,255,0.1)',
                background: '#0a0e14',
                color: 'var(--patient-ink)',
                marginBottom: 14,
                fontFamily: 'var(--font-display)',
              }}
            />
            {err && <p style={{ color: '#ff8e8e', fontWeight: 650 }}>{err}</p>}
            <Button variant="patient" onClick={tryUnlock}>
              Unlock
            </Button>
            <Button
              variant="ghost"
              style={{ color: 'var(--patient-mute)', marginTop: 8 }}
              onClick={() => setShowPin(false)}
            >
              Cancel
            </Button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
