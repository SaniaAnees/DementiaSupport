import { runMigrations } from './migrations';
import { seedDemoData } from './seed';
import { patientRepo } from './repos';
import { useAppStore } from '../store/appStore';
import { getConnectivityStatus, subscribeNetInfo } from '../sync/syncService';
import { isWebRuntime } from './webStore';

export async function bootstrapApp(): Promise<void> {
  if (!isWebRuntime()) {
    await runMigrations();
  }
  await seedDemoData(false);
  const patients = await patientRepo.list();
  if (patients[0]) {
    useAppStore.getState().setActivePatientId(patients[0].id);
  }
  const status = await getConnectivityStatus();
  useAppStore.getState().setSyncStatus(status);
  subscribeNetInfo((s) => useAppStore.getState().setSyncStatus(s));
  useAppStore.getState().setReady(true);
}
