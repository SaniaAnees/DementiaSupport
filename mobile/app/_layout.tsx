import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import 'react-native-reanimated';

import { bootstrapApp } from '@/src/db/bootstrap';
import { colors } from '@/src/theme/tokens';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const [bootError, setBootError] = useState<string | null>(null);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    (async () => {
      try {
        await bootstrapApp();
        setBooted(true);
      } catch (e) {
        setBootError(String(e));
      }
    })();
  }, []);

  useEffect(() => {
    if (loaded && booted) SplashScreen.hideAsync();
  }, [loaded, booted]);

  if (!loaded || !booted) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (bootError) {
    throw new Error(bootError);
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)/login" />
        <Stack.Screen name="(caregiver)" />
        <Stack.Screen name="(patient)" />
        <Stack.Screen name="disclaimer" options={{ presentation: 'modal', headerShown: true, title: 'Disclaimer' }} />
      </Stack>
    </QueryClientProvider>
  );
}
