import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BrandMark, Button, ListRow, PageHeader, Panel, StatusPill } from '../../shared/ui';
import { FamilyShell } from '../../shells/FamilyShell';
import { db } from '../../shared/db';
import type { Memory, Patient, Session } from '../../shared/types';
import { getActivePatient, todaySessions } from '../../shared/sessionsToday';

/**
 * Family hub — ease of use for relatives who are not the primary caregiver.
 * Upload is caregiver-owned; family views today + memory library + progress.
 */
export function FamilyHome() {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [today, setToday] = useState<Session[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    (async () => {
      const p = await getActivePatient();
      setPatient(p);
      if (!p) return;
      setToday(await todaySessions(p.id));
      const mems = await db.memories.where('patientId').equals(p.id).reverse().sortBy('createdAt');
      setMemories(mems.slice(0, 6));
    })();
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return (
    <FamilyShell>
      <div className="page-pad">
        <PageHeader
          title="Family"
          lede={patient ? `Supporting ${patient.preferredName || patient.fullName}` : 'Set up a patient first'}
          right={<StatusPill label={offline ? 'Offline' : 'Ready'} />}
        />
        <div style={{ marginBottom: 20 }}>
          <BrandMark />
        </div>

        <p className="section-label" style={{ marginTop: 8 }}>
          Today
        </p>
        {!patient ? (
          <Panel>
            <p style={{ margin: 0, color: 'var(--ink-2)' }}>
              Ask the primary caregiver to finish setup, then open Family again.
            </p>
            <Link to="/" style={{ display: 'inline-block', marginTop: 16 }}>
              <Button variant="primary">Caregiver home</Button>
            </Link>
          </Panel>
        ) : (
          <div className="list-stack">
            {today.length === 0 ? (
              <Panel>
                <p style={{ margin: 0, color: 'var(--ink-2)' }}>No sessions scheduled yet today.</p>
              </Panel>
            ) : (
              today.map((s) => (
                <ListRow
                  key={s.id}
                  title={s.sessionType === 'morning' ? 'Morning memory' : 'Evening orientation'}
                  subtitle={s.status}
                  trailing={
                    <span style={{ fontWeight: 700, color: 'var(--vital-deep)' }}>
                      {s.compositeScore != null ? Math.round(s.compositeScore) : '—'}
                    </span>
                  }
                />
              ))
            )}
          </div>
        )}

        <p className="section-label">Family photos</p>
        <div className="list-stack">
          {memories.length === 0 ? (
            <Panel>
              <p style={{ margin: 0, color: 'var(--ink-2)' }}>
                Photos appear here after the caregiver adds memories.
              </p>
            </Panel>
          ) : (
            memories.map((m) => (
              <ListRow
                key={m.id}
                title={m.shortLabel || m.caption.slice(0, 40)}
                subtitle={m.caption}
                leading={
                  m.localUri ? (
                    <img
                      src={m.localUri}
                      alt=""
                      style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover' }}
                    />
                  ) : undefined
                }
              />
            ))
          )}
        </div>

        {patient ? (
          <div style={{ marginTop: 24, display: 'grid', gap: 12 }}>
            <Link to={`/patient/${patient.id}/memories`}>
              <Button variant="secondary" style={{ width: '100%' }}>
                Open full memory library
              </Button>
            </Link>
            <Link to="/progress">
              <Button variant="ghost" style={{ width: '100%' }}>
                View weekly progress
              </Button>
            </Link>
          </div>
        ) : null}
      </div>
    </FamilyShell>
  );
}
