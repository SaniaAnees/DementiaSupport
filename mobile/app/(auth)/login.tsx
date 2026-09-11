import { router } from 'expo-router';
import { Body, PrimaryButton, Screen, Title } from '@/src/components/ui/primitives';
import { spacing } from '@/src/theme/tokens';

export default function LoginScreen() {
  return (
    <Screen>
      <Title>DementiaSupport</Title>
      <Body muted style={{ marginBottom: spacing.lg }}>
        Demo mode skips cloud login. Continue locally — sync is optional later.
      </Body>
      <PrimaryButton label="Continue in demo mode" onPress={() => router.replace('/(caregiver)/home')} />
    </Screen>
  );
}
