import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BrandMark,
  Button,
  ListRow,
  MetricTile,
  PageHeader,
  Panel,
  ScoreRing,
  StatusPill,
} from '../../shared/ui';
import { db } from '../../shared/db';
import type { CaregiverAlert, Patient, Session } from '../../shared/types';
import {
  ensureTodaySlots,
  getActivePatient,
  refreshMissed,
  todaySessions,
  weeklyShareText,
} from '../../shared/sessionsToday';
import { classifyTrend, detectFlags } from '../insights/flags';
import { usePatientLock } from '../patient-mode/lockStore';
import { flushSyncQueue } from '../../shared/sync';

function Spark({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 0.01);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 56 }}>
      {values.map((v, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${Math.max(10, (v / max) * 100)}%`,
            borderRadius: 8,
            background: `linear-gradient(180deg, ${color} 0%, ${color}99 100%)`,
            opacity: 0.4 + (i / Math.max(values.length - 1, 1)) * 0.6,
          }}
        />
      ))}
    </div>
  );
}

export function CaregiverHome() {
  const nav = useNavigate();
  const lock = usePatientLock((s) => s.lock);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [memoryCount, setMemoryCount] = useState(0);
  const [today, setToday] = useState<Session[]>([]);
  const [history, setHistory] = useState<Session[]>([]);
  const [alerts, setAlerts] = useState<CaregiverAlert[]>([]);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  async function load() {
    const p = await getActivePatient();
    setPatient(p);
    if (!p) {
      setMemoryCount(0);
      return;
    }
    setMemoryCount(await db.memories.where('patientId').equals(p.id).count());
    await ensureTodaySlots(p);
    await refreshMissed(p);
    setToday(await todaySessions(p.id));
    const hist = await db.sessions.where('patientId').equals(p.id).reverse().sortBy('createdAt');
    setHistory(hist);
    const logs = await db.answerLogs.where('patientId').equals(p.id).toArray();
    const autoFlags = detectFlags(hist, logs);
    for (const f of autoFlags) {
      const exists = await db.alerts
        .where('patientId')
        .equals(p.id)
        .filter((a) => a.title === f.title && a.createdAt.slice(0, 10) === new Date().toISOString().slice(0, 10))
        .first();
      if (!exists) {
        await db.alerts.add({
          id: crypto.randomUUID(),
          patientId: p.id,
          severity: f.severity,
          title: f.title,
          body: f.body,
          createdAt: new Date().toISOString(),
        });
      }
    }
    setAlerts(await db.alerts.where('patientId').equals(p.id).reverse().sortBy('createdAt'));
  }

  useEffect(() => {
    load();
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const trend = useMemo(() => classifyTrend(history), [history]);
  const completed = history.filter((s) => s.status === 'completed' && s.accuracy != null);
  const accSpark = completed.slice(-7).map((s) => s.accuracy ?? 0);
  const hintSpark = completed.slice(-7).map((s) => s.hintRate ?? 0);
  const latestAcc = completed[0]?.accuracy;
  const scorePct = latestAcc != null ? Math.round(latestAcc * 100) : 0;
  const doneToday = today.filter((s) => s.status === 'completed').length;
  const todayPct = Math.round((doneToday / 2) * 100);

  function slot(type: 'morning' | 'evening') {
    return today.find((s) => s.sessionType === type);
  }

  async function shareWeekly() {
    if (!patient) return;
    const text = weeklyShareText(patient, history, trend.paragraph);
    if (navigator.share) await navigator.share({ title: 'DementiaSupport weekly note', text });
    else {
      await navigator.clipboard.writeText(text);
      setSyncMsg('Weekly note copied for clinic share.');
    }
  }

  return (
    <div className="app-shell page-pad">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <BrandMark />
        <StatusPill label={offline ? 'offline' : 'on device'} />
      </div>

      {patient ? (
        <>
          <div className="hero-atmosphere" style={{ marginBottom: 22 }}>
            <p className="eyebrow" style={{ position: 'relative', zIndex: 1 }}>
              Today · {patient.preferredName || patient.fullName}
            </p>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                position: 'relative',
                zIndex: 1,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1
                  className="display-title"
                  style={{ fontSize: 'clamp(28px, 7vw, 36px)', marginBottom: 8 }}
                >
                  {latestAcc != null ? 'Steady rhythm' : 'Start the day'}
                </h1>
                <p style={{ margin: 0, color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.5, fontWeight: 500 }}>
                  {trend.paragraph}
                </p>
              </div>
              <ScoreRing
                value={latestAcc != null ? scorePct : todayPct}
                label={latestAcc != null ? 'Acc' : 'Today'}
                size={108}
              />
            </div>
          </div>

          <div className="metric-grid" style={{ marginBottom: 8 }}>
            <MetricTile
              label="Latest accuracy"
              value={latestAcc != null ? `${scorePct}%` : '—'}
              hint="Last completed"
              tone={latestAcc != null && latestAcc < 0.5 ? 'warn' : 'health'}
            />
            <MetricTile
              label="Photo library"
              value={String(memoryCount)}
              hint={memoryCount < 3 ? 'Need 3+ to start' : 'Ready for sessions'}
              tone={memoryCount < 3 ? 'warn' : 'mind'}
            />
          </div>

          <h2 className="section-label">Sessions</h2>
          <div className="list-stack">
            {(['morning', 'evening'] as const).map((type) => {
              const s = slot(type);
              const status = s?.status ?? 'scheduled';
              return (
                <ListRow
                  key={type}
                  title={type === 'morning' ? 'Morning memories' : 'Evening orientation'}
                  subtitle={
                    status === 'completed' && s?.accuracy != null
                      ? `Done · ${Math.round(s.accuracy * 100)}%`
                      : status
                  }
                  tone={status === 'missed' ? 'danger' : status === 'completed' ? 'ok' : 'default'}
                />
              );
            })}
          </div>

          <h2 className="section-label">7-day pulse</h2>
          <Panel>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 10 }}>
              Accuracy
            </div>
            {accSpark.length ? (
              <Spark values={accSpark} color="var(--vital)" />
            ) : (
              <p style={{ color: 'var(--ink-3)', margin: 0, fontSize: 14 }}>Complete sessions to fill this.</p>
            )}
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)', margin: '18px 0 10px' }}>
              Hint rate
            </div>
            {hintSpark.length ? <Spark values={hintSpark} color="var(--energy)" /> : null}
          </Panel>

          <div style={{ display: 'grid', gap: 10, marginTop: 20 }}>
            {memoryCount < 3 ? (
              <Button large onClick={() => nav(`/patient/${patient.id}/memories?setup=1`)}>
                Add photos to unlock sessions ({memoryCount}/3)
              </Button>
            ) : (
              <Button
                large
                onClick={() => {
                  lock();
                  nav('/patient-mode');
                }}
              >
                Enter patient mode
              </Button>
            )}
            <Button variant="secondary" onClick={() => nav(`/patient/${patient.id}/memories`)}>
              Memory library
            </Button>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Button variant="secondary" onClick={() => nav(`/patient/${patient.id}/edit`)}>
                Profile
              </Button>
              <Button variant="secondary" onClick={() => nav('/progress')}>
                Trends
              </Button>
            </div>
            <Button variant="secondary" onClick={shareWeekly}>
              Share weekly clinic note
            </Button>
            <Button variant="ghost" onClick={async () => setSyncMsg((await flushSyncQueue()).message)}>
              Sync queue
            </Button>
            {syncMsg && <p style={{ color: 'var(--ink-3)', fontSize: 13 }}>{syncMsg}</p>}
          </div>
        </>
      ) : (
        <>
          <PageHeader title="Finish setup" lede="Add the person you care for to begin daily sessions." />
          <Button large onClick={() => nav('/patient/new')}>
            Add patient profile
          </Button>
        </>
      )}

      <h2 className="section-label">Attention</h2>
      {alerts.filter((a) => a.severity !== 'info').length === 0 ? (
        <Panel style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>All clear</div>
          <p style={{ color: 'var(--ink-2)', margin: 0, fontSize: 14 }}>No shift flags right now.</p>
        </Panel>
      ) : (
        <div className="list-stack">
          {alerts
            .filter((a) => a.severity !== 'info')
            .slice(0, 4)
            .map((a) => (
              <Panel key={a.id} style={{ padding: 16, borderColor: 'rgba(239,68,68,0.2)' }}>
                <div style={{ fontWeight: 700 }}>{a.title}</div>
                <p style={{ margin: '6px 0 0', color: 'var(--ink-2)', fontSize: 14 }}>{a.body}</p>
              </Panel>
            ))}
        </div>
      )}

      <div style={{ marginTop: 24, display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        <Link to="/patient/new" style={{ color: 'var(--mind)', fontWeight: 700 }}>
          Add another patient
        </Link>
        <Link to="/settings" style={{ color: 'var(--ink-3)', fontWeight: 600 }}>
          Settings
        </Link>
      </div>
    </div>
  );
}
