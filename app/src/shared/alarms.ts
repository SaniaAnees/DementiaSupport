import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import type { Patient } from './types';

async function ensurePermission() {
  if (!Capacitor.isNativePlatform()) return false;
  const perm = await LocalNotifications.checkPermissions();
  if (perm.display === 'granted') return true;
  const req = await LocalNotifications.requestPermissions();
  return req.display === 'granted';
}

/** Schedule recurring-feel daily alarms. On web, stores schedule in meta only. */
export async function scheduleSessionAlarms(patient: Patient): Promise<string> {
  const label = `${patient.morningHour.toString().padStart(2, '0')}:${patient.morningMinute
    .toString()
    .padStart(2, '0')} / ${patient.eveningHour.toString().padStart(2, '0')}:${patient.eveningMinute
    .toString()
    .padStart(2, '0')}`;

  if (!Capacitor.isNativePlatform()) {
    return `Local alarm times saved (${label}). Native APK delivers notifications offline via Capacitor.`;
  }

  const ok = await ensurePermission();
  if (!ok) return 'Notification permission needed for offline alarms.';

  await LocalNotifications.cancel({ notifications: [{ id: 901 }, { id: 902 }] });

  const nextAt = (hour: number, minute: number) => {
    const d = new Date();
    d.setSeconds(0, 0);
    d.setHours(hour, minute, 0, 0);
    if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
    return d;
  };

  await LocalNotifications.schedule({
    notifications: [
      {
        id: 901,
        title: 'Morning memory session',
        body: 'Time for a short warm-up and recognition session.',
        schedule: { at: nextAt(patient.morningHour, patient.morningMinute), allowWhileIdle: true },
        extra: { type: 'morning', patientId: patient.id },
      },
      {
        id: 902,
        title: 'Evening orientation session',
        body: 'Time for name, place, and familiar faces.',
        schedule: { at: nextAt(patient.eveningHour, patient.eveningMinute), allowWhileIdle: true },
        extra: { type: 'evening', patientId: patient.id },
      },
    ],
  });

  return `Offline alarms set for ${label}.`;
}
