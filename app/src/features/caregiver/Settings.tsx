import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrandMark, BackLink, Button, Field, PageHeader, Panel } from '../../shared/ui';
import { db, hashPin } from '../../shared/db';
import { wipeAllUserData } from '../../shared/onboarding';
import { usePatientLock } from '../patient-mode/lockStore';

export function SettingsPage() {
  const nav = useNavigate();
  const unlock = usePatientLock((s) => s.unlock);
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [consent, setConsent] = useState(false);
  const [caregiverName, setCaregiverName] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    db.meta.get('cloud_consent').then((r) => setConsent(r?.value === '1'));
    db.caregivers.toCollection().first().then((c) => setCaregiverName(c?.name || ''));
  }, []);

  async function savePin() {
    if (!/^\d{4}$/.test(pin)) {
      setMsg('PIN must be 4 digits.');
      return;
    }
    if (pin !== pinConfirm) {
      setMsg('PINs do not match.');
      return;
    }
    const caregiver = await db.caregivers.toCollection().first();
    if (!caregiver) {
      setMsg('No caregiver account found.');
      return;
    }
    await db.caregivers.put({
      ...caregiver,
      pinHash: await hashPin(pin),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    });
    setMsg('PIN updated.');
    setPin('');
    setPinConfirm('');
  }

  return (
    <div className="app-shell page-pad">
      <BackLink onClick={() => nav('/')} label="Home" />
      <BrandMark />
      <div style={{ height: 18 }} />
      <PageHeader title="Settings" lede={caregiverName ? `Signed in as ${caregiverName}` : undefined} />

      <Panel>
        <h3 style={{ marginTop: 0 }}>Caregiver PIN</h3>
        <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>
          Required to exit patient lock mode. Keep it private from the person in care.
        </p>
        <Field
          label="New 4-digit PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          inputMode="numeric"
        />
        <Field
          label="Confirm PIN"
          value={pinConfirm}
          onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
          inputMode="numeric"
        />
        <Button onClick={savePin}>Update PIN</Button>
      </Panel>

      <Panel style={{ marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>Cloud sync consent</h3>
        <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>
          Sessions always work offline. Sync only queues data when you opt in.
        </p>
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <input
            type="checkbox"
            checked={consent}
            onChange={async (e) => {
              const v = e.target.checked;
              setConsent(v);
              await db.meta.put({ key: 'cloud_consent', value: v ? '1' : '0' });
            }}
          />
          <span>I consent to queueing profile and session data for sync when connectivity returns.</span>
        </label>
      </Panel>

      <Panel style={{ marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>Erase this device</h3>
        <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>
          Deletes caregiver account, patients, photos, and scores on this phone. Cannot be undone.
        </p>
        <Button
          variant="secondary"
          style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
          onClick={async () => {
            if (!window.confirm('Erase all DementiaSupport data on this device? This cannot be undone.')) return;
            unlock();
            await wipeAllUserData();
            nav('/disclaimer', { replace: true });
          }}
        >
          Erase all local data
        </Button>
        {msg && <p style={{ color: 'var(--ink-soft)' }}>{msg}</p>}
      </Panel>
    </div>
  );
}
