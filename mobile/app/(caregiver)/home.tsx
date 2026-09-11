import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Body, Card, PrimaryButton, Screen, Title } from '@/src/components/ui/primitives';
import { alertRepo, patientRepo } from '@/src/db/repos';
import type { CaregiverAlert, Patient } from '@/src/types/models';
import { useAppStore } from '@/src/store/appStore';
import { flushSyncQueue } from '@/src/sync/syncService';
import { colors, spacing } from '@/src/theme/tokens';

export default function CaregiverHome() {
  const syncStatus = useAppStore((s) => s.syncStatus);
  const setActivePatientId = useAppStore((s) => s.setActivePatientId);
  const activePatientId = useAppStore((s) => s.activePatientId);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [alerts, setAlerts] = useState<CaregiverAlert[]>([]);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const list = await patientRepo.list();
    setPatients(list);
    const pid = activePatientId || list[0]?.id;
    if (pid && pid !== activePatientId) setActivePatientId(pid);
    if (pid) setAlerts(await alertRepo.listByPatient(pid));
  }, [activePatientId, setActivePatientId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const patient = patients.find((p) => p.id === activePatientId) || patients[0];

  return (
    <Screen style={{ paddingTop: spacing.sm }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View style={styles.row}>
          <Title style={{ flex: 1, marginBottom: 0 }}>Caregiver home</Title>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{syncStatus.replace('_', ' ')}</Text>
          </View>
        </View>
        <Body muted style={{ marginBottom: spacing.md }}>
          Personalized memory care that keeps working offline.
        </Body>

        {patient ? (
          <Card>
            <Text style={styles.patientName}>{patient.preferred_name || patient.full_name}</Text>
            <Body muted>
              {patient.age ? `${patient.age} years` : 'Age n/a'}
              {patient.hometown ? ` · ${patient.hometown}` : ''}
            </Body>
            <View style={styles.actions}>
              <PrimaryButton
                label="Morning session"
                onPress={() => {
                  setActivePatientId(patient.id);
                  router.push({
                    pathname: '/(patient)/session/start',
                    params: { type: 'morning', patientId: patient.id },
                  });
                }}
              />
              <PrimaryButton
                label="Evening session"
                variant="secondary"
                onPress={() => {
                  setActivePatientId(patient.id);
                  router.push({
                    pathname: '/(patient)/session/start',
                    params: { type: 'evening', patientId: patient.id },
                  });
                }}
              />
            </View>
          </Card>
        ) : (
          <Card>
            <Body>No patient yet. Create a profile to begin.</Body>
          </Card>
        )}

        <View style={styles.linkRow}>
          <PrimaryButton
            label="Memories"
            variant="secondary"
            disabled={!patient}
            onPress={() => patient && router.push(`/(caregiver)/patient/${patient.id}/memories`)}
            style={{ flex: 1 }}
          />
          <PrimaryButton
            label="Progress"
            variant="secondary"
            disabled={!patient}
            onPress={() => router.push('/(caregiver)/dashboard')}
            style={{ flex: 1 }}
          />
        </View>

        <PrimaryButton
          label="Add patient"
          variant="ghost"
          onPress={() => router.push('/(caregiver)/patient/new')}
        />
        <PrimaryButton
          label="Sync now"
          variant="ghost"
          onPress={async () => {
            const res = await flushSyncQueue();
            setSyncMsg(res.message);
          }}
        />
        {syncMsg ? <Body muted>{syncMsg}</Body> : null}

        <Title style={{ fontSize: 22, marginTop: spacing.lg }}>Alerts</Title>
        {alerts.length === 0 ? (
          <Body muted>No alerts yet.</Body>
        ) : (
          alerts.slice(0, 5).map((a) => (
            <Pressable
              key={a.id}
              onPress={() => alertRepo.markRead(a.id).then(load)}
              style={styles.alert}
            >
              <Text style={styles.alertTitle}>{a.title}</Text>
              <Body muted>{a.body}</Body>
            </Pressable>
          ))
        )}

        <PrimaryButton
          label="Settings"
          variant="ghost"
          onPress={() => router.push('/(caregiver)/settings')}
          style={{ marginTop: spacing.md }}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm },
  chip: {
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipText: { color: colors.accent, fontWeight: '700', textTransform: 'capitalize', fontSize: 12 },
  patientName: { fontSize: 24, fontWeight: '700', color: colors.ink, marginBottom: 4 },
  actions: { gap: 10, marginTop: spacing.md },
  linkRow: { flexDirection: 'row', gap: 10, marginBottom: spacing.sm },
  alert: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  alertTitle: { fontWeight: '700', color: colors.ink, marginBottom: 4 },
});
