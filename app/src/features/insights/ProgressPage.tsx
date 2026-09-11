import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackLink, BrandMark, Button, MetricTile, PageHeader, Panel, ScoreRing } from '../../shared/ui';
import { db } from '../../shared/db';
import type { Patient, Session } from '../../shared/types';
import { classifyTrend } from '../insights/flags';
import { getActivePatient, weeklyShareText } from '../../shared/sessionsToday';

export function ProgressPage() {
  const nav = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const p = await getActivePatient();
      setPatient(p);
      if (p) {
        const list = await db.sessions.where('patientId').equals(p.id).toArray();
        setSessions(list.sort((a, b) => (a.startedAt || a.createdAt).localeCompare(b.startedAt || b.createdAt)));
      }
    })();
  }, []);

  const trend = useMemo(() => classifyTrend(sessions), [sessions]);
  const morning = sessions.filter((s) => s.sessionType === 'morning' && s.status === 'completed');
  const evening = sessions.filter((s) => s.sessionType === 'evening' && s.status === 'completed');
  const chart = sessions.filter((s) => s.compositeScore != null && s.status === 'completed').slice(-7);
  const max = Math.max(...chart.map((c) => c.compositeScore || 0), 1);
  const morningAvg = morning.length
    ? Math.round((morning.reduce((s, x) => s + (x.accuracy ?? 0), 0) / morning.length) * 100)
    : null;
  const eveningAvg = evening.length
    ? Math.round((evening.reduce((s, x) => s + (x.accuracy ?? 0), 0) / evening.length) * 100)
    : null;

  return (
    <div className="app-shell page-pad">
      <BackLink onClick={() => nav('/')} label="Home" />
      <BrandMark />
      <div style={{ height: 18 }} />
      <PageHeader
        eyebrow="Insights"
        title="Trends"
        lede={patient?.preferredName || patient?.fullName || 'No patient yet'}
      />

      <div
        className="hero-atmosphere"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}
      >
        <div style={{ position: 'relative', zIndex: 1, flex: 1 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--vital-deep)',
              marginBottom: 8,
            }}
          >
            Better / worse / same
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 32,
              fontWeight: 650,
              letterSpacing: '-0.03em',
              textTransform: 'capitalize',
              marginBottom: 8,
            }}
          >
            {trend.state.replace('_', ' ')}
          </div>
          <p style={{ margin: 0, color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.5 }}>{trend.paragraph}</p>
        </div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <ScoreRing value={morningAvg ?? eveningAvg ?? 0} label="Avg" size={100} />
        </div>
      </div>

      <div className="metric-grid" style={{ marginBottom: 14 }}>
        <MetricTile
          label="Morning avg"
          value={morningAvg != null ? `${morningAvg}%` : '—'}
          hint="Recognition"
          tone="health"
        />
        <MetricTile
          label="Evening avg"
          value={eveningAvg != null ? `${eveningAvg}%` : '—'}
          hint="Orientation"
          tone="mind"
        />
      </div>

      <Panel>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--ink-3)',
            marginBottom: 14,
          }}
        >
          7-session composite
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 140 }}>
          {chart.length ? (
            chart.map((s) => (
              <div key={s.id} style={{ flex: 1, display: 'grid', alignItems: 'end', height: '100%' }}>
                <div
                  style={{
                    height: `${((s.compositeScore || 0) / max) * 100}%`,
                    minHeight: 8,
                    borderRadius: '12px 12px 6px 6px',
                    background:
                      s.sessionType === 'morning'
                        ? 'linear-gradient(180deg, #12c4a8, #007a68)'
                        : 'linear-gradient(180deg, #fbbf24, #d97706)',
                  }}
                />
              </div>
            ))
          ) : (
            <p style={{ color: 'var(--ink-3)', margin: 0, fontSize: 14 }}>Complete sessions to chart progress.</p>
          )}
        </div>
      </Panel>

      <Button
        style={{ marginTop: 16 }}
        onClick={async () => {
          if (!patient) return;
          const text = weeklyShareText(patient, [...sessions].reverse(), trend.paragraph);
          if (navigator.share) await navigator.share({ title: 'Weekly note', text });
          else {
            await navigator.clipboard.writeText(text);
            setMsg('Copied weekly clinic note.');
          }
        }}
      >
        Share weekly clinic note
      </Button>
      {msg && <p style={{ color: 'var(--ink-3)', fontSize: 13 }}>{msg}</p>}
    </div>
  );
}
