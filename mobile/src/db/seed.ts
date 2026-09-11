import { Asset } from 'expo-asset';
import {
  alertRepo,
  caregiverRepo,
  memoryRepo,
  metaRepo,
  patientRepo,
  sessionRepo,
  wipeAllData,
} from './repos';
import { newId, nowIso } from '../utils/ids';
import type { Memory, Session } from '../types/models';

async function resolveDemoUri(moduleId: number): Promise<string> {
  const asset = Asset.fromModule(moduleId);
  await asset.downloadAsync();
  return asset.localUri ?? asset.uri;
}

export async function seedDemoData(force = false): Promise<void> {
  const seeded = await metaRepo.get('demo_seeded');
  if (seeded === '1' && !force) return;
  if (force) await wipeAllData();

  const ts = nowIso();
  const caregiverId = 'demo-caregiver';
  const patientId = 'demo-patient-anjali';

  await caregiverRepo.upsert({
    id: caregiverId,
    name: 'Demo Caregiver',
    email: 'demo@dementiasupport.local',
    created_at: ts,
    updated_at: ts,
    sync_status: 'pending',
  });

  await patientRepo.upsert({
    id: patientId,
    caregiver_id: caregiverId,
    full_name: 'Anjali Devi',
    preferred_name: 'Anjali',
    age: 72,
    hometown: 'Imphal',
    dementia_notes: 'Mild dementia. Responds well to family photos and calm pacing.',
    medical_recommendations: 'Short daily cognitive engagement; avoid rushing.',
    language_code: 'en-IN',
    created_at: ts,
    updated_at: ts,
    sync_status: 'pending',
  });

  const imageModules = [
    require('../../assets/images/icon.png'),
    require('../../assets/images/splash-icon.png'),
    require('../../assets/images/android-icon-foreground.png'),
    require('../../assets/images/favicon.png'),
  ];

  const memoryDefs = [
    {
      caption: 'This is your daughter, Meera.',
      short_label: 'Meera',
      aliases: ['daughter', 'my daughter', 'meera'],
      category: 'person' as const,
    },
    {
      caption: 'This is your grandson, Arjun.',
      short_label: 'Arjun',
      aliases: ['grandson', 'my grandson', 'arjun'],
      category: 'person' as const,
    },
    {
      caption: 'This is your home in Imphal.',
      short_label: 'home',
      aliases: ['house', 'imphal home', 'my home'],
      category: 'place' as const,
    },
    {
      caption: 'This is your husband, Ramesh.',
      short_label: 'Ramesh',
      aliases: ['husband', 'my husband', 'ramesh'],
      category: 'person' as const,
    },
  ];

  for (let i = 0; i < memoryDefs.length; i++) {
    const def = memoryDefs[i];
    const local_uri = await resolveDemoUri(imageModules[i % imageModules.length]);
    const memory: Memory = {
      id: `demo-memory-${i + 1}`,
      patient_id: patientId,
      local_uri,
      remote_url: null,
      caption: def.caption,
      short_label: def.short_label,
      aliases: JSON.stringify(def.aliases),
      category: def.category,
      sort_order: i,
      created_at: ts,
      updated_at: ts,
      sync_status: 'pending',
    };
    await memoryRepo.upsert(memory);
  }

  const accuracies = [0.5, 0.55, 0.6, 0.58, 0.62, 0.7, 0.68];
  for (let i = 0; i < accuracies.length; i++) {
    const day = new Date();
    day.setDate(day.getDate() - (accuracies.length - i));
    const started = day.toISOString();
    const accuracy = accuracies[i];
    const session: Session = {
      id: `demo-session-${i + 1}`,
      patient_id: patientId,
      session_type: i % 2 === 0 ? 'morning' : 'evening',
      started_at: started,
      ended_at: started,
      accuracy,
      avg_response_ms: 8000 + i * 400,
      hints_used: Math.max(0, 3 - Math.floor(i / 2)),
      repetitions: 1,
      composite_score: Math.round(accuracy * 70 + 18 + 8),
      notes: 'Seeded history',
      created_at: started,
      updated_at: started,
      sync_status: 'pending',
    };
    await sessionRepo.upsert(session);
  }

  await alertRepo.upsert({
    id: newId(),
    patient_id: patientId,
    severity: 'info',
    title: 'Welcome to DementiaSupport',
    body: 'Demo data is ready. Start a morning or evening session anytime — works offline.',
    created_at: ts,
    read_at: null,
    sync_status: 'pending',
  });

  await metaRepo.set('demo_seeded', '1');
  await metaRepo.set('disclaimer_seen', '0');
}
