import { Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Body, PrimaryButton, Screen, Title } from '@/src/components/ui/primitives';
import { seedDemoData } from '@/src/db/seed';
import { metaRepo, patientRepo } from '@/src/db/repos';
import { useAppStore } from '@/src/store/appStore';
import { isDemoMode } from '@/src/sync/syncService';
import { spacing } from '@/src/theme/tokens';

export default function SettingsScreen() {
  const setActivePatientId = useAppStore((s) => s.setActivePatientId);

  return (
    <Screen>
      <ScrollView>
        <Title>Settings</Title>
        <Body muted style={{ marginBottom: spacing.md }}>
          Mode: {isDemoMode() ? 'Local / demo (offline-first)' : 'Cloud sync enabled'}
        </Body>
        <PrimaryButton
          label="Reset demo data"
          variant="secondary"
          onPress={() => {
            Alert.alert('Reset demo data?', 'This replaces local demo patient and sessions.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Reset',
                style: 'destructive',
                onPress: async () => {
                  await seedDemoData(true);
                  const patients = await patientRepo.list();
                  setActivePatientId(patients[0]?.id ?? null);
                  Alert.alert('Done', 'Demo data restored.');
                  router.replace('/(caregiver)/home');
                },
              },
            ]);
          }}
        />
        <PrimaryButton
          label="Show disclaimer"
          variant="ghost"
          onPress={async () => {
            await metaRepo.set('disclaimer_seen', '0');
            router.push('/disclaimer');
          }}
          style={{ marginTop: spacing.sm }}
        />
        <Body muted style={{ marginTop: spacing.lg }}>
          DementiaSupport is not a medical device. Package: com.dementiasupport.app
        </Body>
      </ScrollView>
    </Screen>
  );
}
