import { Tabs } from 'expo-router';
import React, { useMemo } from 'react';
import { useColorScheme, Platform, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { useThemeCustomization } from '@/contexts/ThemeContext';
import { useWorkoutSession } from '@/contexts/WorkoutSessionContext';
import { useActiveProgram } from '@/hooks/useActiveProgram';
import ActiveWorkoutBanner from '@/components/workout/ActiveWorkoutBanner';
import type { TrainingDay } from '@/types/training';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const { customColors } = useThemeCustomization();
  const { session } = useWorkoutSession();
  const { program: activeProgram } = useActiveProgram();

  // Find training day name for banner
  const trainingDayName = useMemo(() => {
    if (!session || !activeProgram) return undefined;

    const findTrainingDay = (trainingDayId: string) => {
      // Search in simple program
      if (activeProgram.type === 'simple' && activeProgram.trainingDays) {
        const found = activeProgram.trainingDays.find((td: TrainingDay) => td.id === trainingDayId);
        if (found) return found.name;
      }

      // Search in periodized program
      if (activeProgram.type === 'periodized' && activeProgram.mesocycles) {
        for (const meso of activeProgram.mesocycles) {
          if (meso.microcycles) {
            for (const micro of meso.microcycles) {
              if (micro.trainingDays) {
                const found = micro.trainingDays.find((td: TrainingDay) => td.id === trainingDayId);
                if (found) return found.name;
              }
            }
          }
        }
      }

      return undefined;
    };

    return findTrainingDay(session.trainingDayId);
  }, [session, activeProgram]);

  // Show banner when there's an active session
  const showBanner = !!session;

  return (
    <View style={{ flex: 1 }}>
      <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: customColors.primaryButton,
        tabBarInactiveTintColor: theme.icon,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 85,
          paddingBottom: 25,
          paddingTop: 10,
          borderTopWidth: 0,
          elevation: 0,
          backgroundColor: 'transparent',
        },
        tabBarBackground: () =>
          Platform.OS === 'ios' ? (
            <BlurView
              intensity={95}
              tint={colorScheme === 'dark' ? 'dark' : 'light'}
              style={styles.blur}
            />
          ) : (
            <View style={[styles.blur, { backgroundColor: theme.background, borderTopColor: theme.cardBorder, borderTopWidth: 1 }]} />
          ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && { backgroundColor: `${customColors.primaryButton}15` }]}>
              <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color as string} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="programs"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && { backgroundColor: `${customColors.primaryButton}15` }]}>
              <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={24} color={color as string} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="exercises"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && { backgroundColor: `${customColors.primaryButton}15` }]}>
              <Ionicons name={focused ? 'barbell' : 'barbell-outline'} size={24} color={color as string} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && { backgroundColor: `${customColors.primaryButton}15` }]}>
              <Ionicons name={focused ? 'stats-chart' : 'stats-chart-outline'} size={24} color={color as string} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && { backgroundColor: `${customColors.primaryButton}15` }]}>
              <Ionicons name={focused ? 'settings' : 'settings-outline'} size={24} color={color as string} />
            </View>
          ),
        }}
      />
    </Tabs>
      {showBanner && (
        <ActiveWorkoutBanner
          startedAt={session!.startedAt}
          trainingDayName={trainingDayName}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  blur: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
