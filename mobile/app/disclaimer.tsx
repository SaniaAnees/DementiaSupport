import { ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Body, PrimaryButton, Screen, Title } from '@/src/components/ui/primitives';
import { metaRepo } from '@/src/db/repos';
import { spacing } from '@/src/theme/tokens';

export default function DisclaimerScreen() {
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <Title>Before you begin</Title>
        <Body style={styles.p}>
          DementiaSupport is a cognitive engagement and caregiver-monitoring tool. It is not a
          medical device and does not diagnose, treat, or replace professional clinical evaluation.
        </Body>
        <Body muted style={styles.p}>
          Session data is stored on this device first (offline-first). Use only demo or consented
          caregiver-entered information — do not store real patient PHI on shared demo phones.
        </Body>
        <PrimaryButton
          label="I understand — continue"
          onPress={async () => {
            await metaRepo.set('disclaimer_seen', '1');
            router.replace('/(caregiver)/home');
          }}
          style={{ marginTop: spacing.lg }}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  p: { marginBottom: spacing.md },
});
