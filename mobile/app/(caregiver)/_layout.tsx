import { Stack } from 'expo-router';
import { colors } from '@/src/theme/tokens';

export default function CaregiverLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.ink,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="home" options={{ title: 'DementiaSupport' }} />
      <Stack.Screen name="patient/new" options={{ title: 'New patient' }} />
      <Stack.Screen name="patient/[id]/index" options={{ title: 'Patient' }} />
      <Stack.Screen name="patient/[id]/edit" options={{ title: 'Edit patient' }} />
      <Stack.Screen name="patient/[id]/memories" options={{ title: 'Memories' }} />
      <Stack.Screen name="dashboard/index" options={{ title: 'Progress' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
    </Stack>
  );
}
