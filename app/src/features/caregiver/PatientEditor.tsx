import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BrandMark, BackLink, Button, Field, PageHeader, Panel } from '../../shared/ui';
import { db, enqueueSync, nid, now } from '../../shared/db';
import { LANG_LABELS, type LangCode, type Patient } from '../../shared/types';
import { scheduleSessionAlarms } from '../../shared/alarms';

const emptyForm = {
  fullName: '',
  preferredName: '',
  age: '',
  hometown: '',
  languageCode: 'en' as LangCode,
  dementiaNotes: '',
  medicalRecommendations: '',
  morningHour: '9',
  morningMinute: '0',
  eveningHour: '18',
  eveningMinute: '0',
};

export function PatientEditor({ mode }: { mode: 'new' | 'edit' }) {
  const { id } = useParams();
  const nav = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const caregiver = await db.caregivers.toCollection().first();
      if (!caregiver && mode === 'new') {
        nav('/onboarding/caregiver', { replace: true });
        return;
      }
      if (mode !== 'edit' || !id) return;
      const p = await db.patients.get(id);
      if (!p) return;
      setForm({
        fullName: p.fullName,
        preferredName: p.preferredName || '',
        age: p.age != null ? String(p.age) : '',
        hometown: p.hometown || '',
        languageCode: p.languageCode,
        dementiaNotes: p.dementiaNotes || '',
        medicalRecommendations: p.medicalRecommendations || '',
        morningHour: String(p.morningHour),
        morningMinute: String(p.morningMinute),
        eveningHour: String(p.eveningHour),
        eveningMinute: String(p.eveningMinute),
      });
    })();
  }, [mode, id, nav]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setErr(null);
    if (!form.fullName.trim()) {
      setErr('Patient full name is required.');
      return;
    }
    const caregiver = await db.caregivers.toCollection().first();
    if (!caregiver) {
      nav('/onboarding/caregiver', { replace: true });
      return;
    }
    const ts = now();
    const patientId = mode === 'edit' && id ? id : nid();
    const existing = mode === 'edit' ? await db.patients.get(patientId) : null;
    const patient: Patient = {
      id: patientId,
      caregiverId: caregiver.id,
      fullName: form.fullName.trim(),
      preferredName: form.preferredName.trim() || undefined,
      age: form.age ? Number(form.age) : undefined,
      hometown: form.hometown.trim() || undefined,
      languageCode: form.languageCode,
      dementiaNotes: form.dementiaNotes.trim() || undefined,
      medicalRecommendations: form.medicalRecommendations.trim() || undefined,
      morningHour: Number(form.morningHour) || 9,
      morningMinute: Number(form.morningMinute) || 0,
      eveningHour: Number(form.eveningHour) || 18,
      eveningMinute: Number(form.eveningMinute) || 0,
      createdAt: existing?.createdAt || ts,
      updatedAt: ts,
      syncStatus: 'pending',
    };
    await db.patients.put(patient);
    await db.meta.put({ key: 'active_patient_id', value: patientId });
    await enqueueSync('patient', patientId, patient);
    const alarmMsg = await scheduleSessionAlarms(patient);
    setMsg(alarmMsg);
    nav(mode === 'new' ? `/patient/${patientId}/memories?setup=1` : '/', { replace: mode === 'new' });
  }

  return (
    <div className="app-shell page-pad">
      {mode === 'edit' && <BackLink onClick={() => nav('/')} label="Home" />}
      <BrandMark />
      <div style={{ height: 20 }} />
      <PageHeader
        eyebrow={mode === 'new' ? 'Step 2 of 3 · Patient' : 'Profile'}
        title={mode === 'new' ? 'Who are you caring for?' : 'Profile & session times'}
        lede="Language and doctor notes shape session length and hints. Times drive offline reminders."
      />
      <Panel>
        <Field label="Full name" value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />
        <Field
          label="Preferred name (spoken in sessions)"
          value={form.preferredName}
          onChange={(e) => set('preferredName', e.target.value)}
        />
        <Field label="Age" value={form.age} onChange={(e) => set('age', e.target.value)} inputMode="numeric" />
        <Field
          label="Hometown / where they live"
          value={form.hometown}
          onChange={(e) => set('hometown', e.target.value)}
        />

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 8 }}>Preferred language</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {(Object.keys(LANG_LABELS) as LangCode[]).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => set('languageCode', code)}
                style={{
                  padding: '12px 10px',
                  borderRadius: 999,
                  border: form.languageCode === code ? 'none' : '1px solid var(--line)',
                  background: form.languageCode === code ? 'var(--teal)' : 'transparent',
                  color: form.languageCode === code ? '#fff' : 'var(--ink)',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {LANG_LABELS[code]}
              </button>
            ))}
          </div>
        </div>

        <Field
          label="Dementia stage / care notes"
          as="textarea"
          value={form.dementiaNotes}
          onChange={(e) => set('dementiaNotes', (e.target as HTMLTextAreaElement).value)}
        />
        <Field
          label="Doctor recommendations"
          as="textarea"
          value={form.medicalRecommendations}
          onChange={(e) => set('medicalRecommendations', (e.target as HTMLTextAreaElement).value)}
          placeholder="e.g. Keep sessions short. Offer more hints if anxious."
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field
            label="Morning hour (0–23)"
            value={form.morningHour}
            onChange={(e) => set('morningHour', e.target.value)}
            inputMode="numeric"
          />
          <Field
            label="Morning minute"
            value={form.morningMinute}
            onChange={(e) => set('morningMinute', e.target.value)}
            inputMode="numeric"
          />
          <Field
            label="Evening hour (0–23)"
            value={form.eveningHour}
            onChange={(e) => set('eveningHour', e.target.value)}
            inputMode="numeric"
          />
          <Field
            label="Evening minute"
            value={form.eveningMinute}
            onChange={(e) => set('eveningMinute', e.target.value)}
            inputMode="numeric"
          />
        </div>

        {err && <p style={{ color: 'var(--danger)' }}>{err}</p>}
        <Button onClick={save}>{mode === 'new' ? 'Continue to family photos' : 'Save profile'}</Button>
        {msg && <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>{msg}</p>}
      </Panel>
    </div>
  );
}

export function NewPatient() {
  return <PatientEditor mode="new" />;
}

export function EditPatient() {
  return <PatientEditor mode="edit" />;
}
