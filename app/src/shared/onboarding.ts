import { db } from './db';

/** Fresh install = empty DB. No demo patients, pins, or placeholder memories. */
export async function wipeAllUserData() {
  await Promise.all([
    db.caregivers.clear(),
    db.patients.clear(),
    db.memories.clear(),
    db.sessions.clear(),
    db.sessionItems.clear(),
    db.answerLogs.clear(),
    db.alerts.clear(),
    db.syncQueue.clear(),
    db.meta.clear(),
  ]);
}

export async function getOnboardingStep(): Promise<
  'disclaimer' | 'caregiver' | 'patient' | 'memories' | 'ready'
> {
  const disclaimer = await db.meta.get('disclaimer_seen');
  if (disclaimer?.value !== '1') return 'disclaimer';

  const caregiver = await db.caregivers.toCollection().first();
  if (!caregiver) return 'caregiver';

  const patient = await db.patients.toCollection().first();
  if (!patient) return 'patient';

  const memoryCount = await db.memories.where('patientId').equals(patient.id).count();
  if (memoryCount < 3) return 'memories';

  return 'ready';
}
