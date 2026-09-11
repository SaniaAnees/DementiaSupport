import { db, nid, now, todayKey } from './db';
import type { Patient, Session, SessionType } from './types';

export async function getActivePatient(): Promise<Patient | null> {
  const meta = await db.meta.get('active_patient_id');
  if (meta?.value) {
    const p = await db.patients.get(meta.value);
    if (p) return p;
  }
  return (await db.patients.orderBy('updatedAt').reverse().first()) ?? null;
}

export async function ensureTodaySlots(patient: Patient) {
  const day = todayKey();
  const existing = await db.sessions.where('patientId').equals(patient.id).toArray();
  for (const sessionType of ['morning', 'evening'] as SessionType[]) {
    if (existing.some((s) => s.scheduledFor === day && s.sessionType === sessionType)) continue;
    await db.sessions.put({
      id: nid(),
      patientId: patient.id,
      sessionType,
      status: 'scheduled',
      scheduledFor: day,
      hintsUsed: 0,
      repetitions: 0,
      createdAt: now(),
      updatedAt: now(),
      syncStatus: 'pending',
    });
  }
}

export async function refreshMissed(patient: Patient) {
  const day = todayKey();
  const nowDate = new Date();
  const slots = (await db.sessions.where('patientId').equals(patient.id).toArray()).filter(
    (s) => s.scheduledFor === day
  );
  for (const s of slots) {
    if (s.status !== 'scheduled') continue;
    const hour = s.sessionType === 'morning' ? patient.morningHour : patient.eveningHour;
    const minute = s.sessionType === 'morning' ? patient.morningMinute : patient.eveningMinute;
    const due = new Date();
    due.setHours(hour, minute, 0, 0);
    if (nowDate.getTime() > due.getTime() + 90 * 60 * 1000) {
      await db.sessions.update(s.id, { status: 'missed', updatedAt: now() });
    }
  }
}

export async function todaySessions(patientId: string): Promise<Session[]> {
  const day = todayKey();
  return (await db.sessions.where('patientId').equals(patientId).toArray()).filter(
    (s) => s.scheduledFor === day
  );
}

export function weeklyShareText(patient: Patient, sessions: Session[], paragraph: string) {
  const week = sessions
    .filter((s) => s.status === 'completed')
    .slice(0, 14)
    .map(
      (s) =>
        `• ${s.scheduledFor || ''} ${s.sessionType}: ${
          s.accuracy != null ? Math.round(s.accuracy * 100) + '%' : '—'
        } (hints ${s.hintsUsed})`
    )
    .join('\n');
  return `DementiaSupport weekly note for ${patient.preferredName || patient.fullName}

${paragraph}

Recent sessions:
${week || '• No completed sessions yet'}

This is caregiver-monitoring data, not a medical diagnosis.
Generated ${new Date().toLocaleString()}`;
}
