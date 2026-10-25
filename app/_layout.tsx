import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeProvider as CustomThemeProvider } from '@/contexts/ThemeContext';
import { StorageProvider } from '@/contexts/StorageContext';
import { WorkoutUIProvider } from '@/contexts/WorkoutUIContext';
import { WorkoutSessionProvider } from '@/contexts/WorkoutSessionContext';
import WorkoutLiveActivitySync from '@/components/workout/WorkoutLiveActivitySync';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <StorageProvider>
      <WorkoutSessionProvider>
        <CustomThemeProvider>
          <WorkoutUIProvider>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack>
            <Stack.Screen
              name="index"
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="onboarding"
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="(tabs)"
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="modal"
              options={{
                presentation: 'modal',
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="exercise-form"
              options={{
                presentation: 'modal',
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="session-detail"
              options={{
                presentation: 'modal',
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="training-day-detail"
              options={{
                presentation: 'modal',
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="simple-program-wizard"
              options={{
                presentation: 'modal',
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="select-training-day"
              options={{
                presentation: 'modal',
                headerShown: false,
              }}
            />
            </Stack>
            <WorkoutLiveActivitySync />
            <StatusBar style="auto" />
          </ThemeProvider>
        </WorkoutUIProvider>
      </CustomThemeProvider>
    </WorkoutSessionProvider>
  </StorageProvider>
  );
}
