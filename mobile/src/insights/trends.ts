import type { Session, TrendState } from '../types/models';
import { newId, nowIso } from '../utils/ids';
import { alertRepo } from '../db/repos';

export function classifyTrend(sessions: Session[]): {
  state: TrendState;
  message: string;
  avg7: number | null;
  avg30: number | null;
} {
  const scored = sessions
    .filter((s) => s.accuracy != null)
    .sort((a, b) => (a.started_at < b.started_at ? -1 : 1));

  if (scored.length < 3) {
    return {
      state: 'insufficient_data',
      message: 'Need a few more sessions to spot a clear trend.',
      avg7: null,
      avg30: null,
    };
  }

  const last7 = scored.slice(-7);
  const last30 = scored.slice(-30);
  const avg = (list: Session[]) =>
    list.reduce((s, x) => s + (x.accuracy ?? 0), 0) / (list.length || 1);

  const avg7 = avg(last7);
  const avg30 = avg(last30);
  const recent = scored.slice(-3);
  const prior = scored.slice(-6, -3);
  if (prior.length < 3) {
    return {
      state: 'stable',
      message: 'Performance looks steady so far. Keep the daily morning and evening rhythm.',
      avg7,
      avg30,
    };
  }
  const recentAvg = avg(recent) * 100;
  const priorAvg = avg(prior) * 100;
  const delta = recentAvg - priorAvg;

  if (delta <= -15) {
    return {
      state: 'declining',
      message:
        'Recent accuracy is lower than the previous few sessions. Consider a calmer pace and extra family photo practice.',
      avg7,
      avg30,
    };
  }
  if (delta >= 15) {
    return {
      state: 'improving',
      message: 'Nice progress — recent sessions are stronger than earlier ones.',
      avg7,
      avg30,
    };
  }
  return {
    state: 'stable',
    message: 'Cognitive engagement scores are relatively stable across recent sessions.',
    avg7,
    avg30,
  };
}

export async function maybeCreateTrendAlert(patientId: string, sessions: Session[]) {
  const trend = classifyTrend(sessions);
  if (trend.state !== 'declining') return trend;

  await alertRepo.upsert({
    id: newId(),
    patient_id: patientId,
    severity: 'watch',
    title: 'Change in recent performance',
    body: trend.message,
    created_at: nowIso(),
    read_at: null,
    sync_status: 'pending',
  });
  return trend;
}
