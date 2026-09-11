import { Stack } from 'expo-router';
import { colors } from '@/src/theme/tokens';

export default function PatientLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.patientBg },
        animation: 'fade',
      }}
    >
      <Stack.Screen name="session/start" />
      <Stack.Screen name="session/morning/[step]" />
      <Stack.Screen name="session/evening/[step]" />
      <Stack.Screen name="session/summary" />
    </Stack>
  );
}
