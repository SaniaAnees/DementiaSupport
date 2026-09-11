import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrandMark, Button, Field, PageHeader, Panel } from '../../shared/ui';
import { db, hashPin, nid, now } from '../../shared/db';

export function CaregiverOnboarding() {
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setErr(null);
    if (!name.trim()) {
      setErr('Enter your name.');
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      setErr('Choose a 4-digit PIN.');
      return;
    }
    if (pin !== confirm) {
      setErr('PINs do not match.');
      return;
    }
    setSaving(true);
    try {
      const ts = now();
      await db.caregivers.put({
        id: nid(),
        name: name.trim(),
        pinHash: await hashPin(pin),
        createdAt: ts,
        updatedAt: ts,
        syncStatus: 'pending',
      });
      await db.meta.put({ key: 'onboarding_caregiver_done', value: '1' });
      nav('/patient/new', { replace: true });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-shell page-pad">
      <BrandMark />
      <div style={{ height: 24 }} />
      <PageHeader
        eyebrow="Step 1 of 3 · Caregiver"
        title="Create your account"
        lede="Your PIN locks patient mode so the person in care cannot open settings or wander into setup."
      />
      <Panel>
        <Field label="Your name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        <Field
          label="4-digit PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          inputMode="numeric"
          autoComplete="new-password"
        />
        <Field
          label="Confirm PIN"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
          inputMode="numeric"
          autoComplete="new-password"
        />
        {err && (
          <p style={{ color: 'var(--danger)', fontWeight: 600, marginTop: 0 }}>{err}</p>
        )}
        <Button onClick={save} disabled={saving} large>
          {saving ? 'Saving…' : 'Continue'}
        </Button>
      </Panel>
    </div>
  );
}
