import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useColorScheme, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { WorkoutSession, SessionExercisePlan, getLastSessionPlanForDay } from '@/services/storage/session-storage';
import type { TrainingDay, TrainingExercise } from '@/types/training';
import { useActiveProgram } from '@/hooks/useActiveProgram';
import { useWorkoutSession } from '@/contexts/WorkoutSessionContext';
import { useStorage } from '@/contexts/StorageContext';
import { useStats } from '@/hooks/useStats';
import { useWorkoutUI } from '@/contexts/WorkoutUIContext';
import { useThemeCustomization } from '@/contexts/ThemeContext';
import { programStorage } from '@/services/storage/program-storage';
import { exerciseStorage } from '@/services/storage/exercise-storage';
import WorkoutInterface from '@/components/workout/WorkoutInterface';
import SessionStartOptions, { SessionStartChoice } from '@/components/workout/SessionStartOptions';
import { consumePendingDayOverride } from '@/utils/day-override-store';
import { calculateWorkoutDuration } from '@/utils/workout-helpers';

/** Returns true when two exercise plans have the same ordered IDs. */
function plansEqual(a: SessionExercisePlan[], b: SessionExercisePlan[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((entry, i) => entry.exerciseId === b[i].exerciseId);
}

/**
 * Saves a new exercise plan back to the training day template embedded in the program.
 * Handles both simple and periodized program structures.
 */
async function saveExercisePlanToTemplate(
  userId: string,
  programId: string,
  trainingDayId: string,
  plan: SessionExercisePlan[]
): Promise<void> {
  const item = await programStorage.getById(userId, programId);
  if (!item) return;

  const program = { ...item.data, id: item.id } as any;

  // Build a lookup for exercises from the library
  const libraryItems = await exerciseStorage.getAll(userId);
  const libraryMap = new Map(libraryItems.map(i => [i.id, { ...i.data, id: i.id }]));

  const remapDay = (day: any): any => {
    if (day.id !== trainingDayId) return day;
    // Build new exercises array in plan order, merging in library data for added exercises
    const templateMap = new Map((day.exercises ?? []).map((e: any) => [e.id, e]));
    const newExercises = plan
      .map(entry => {
        const templateEx = templateMap.get(entry.exerciseId);
        if (templateEx) return templateEx;
        // Exercise was added mid-session — pull from library
        const libraryEx = libraryMap.get(entry.exerciseId);
        return libraryEx ?? { id: entry.exerciseId, name: entry.exerciseName };
      })
      .filter(Boolean);
    return { ...day, exercises: newExercises };
  };

  let updatedProgram = { ...program };
  if (program.type === 'simple' && program.trainingDays) {
    updatedProgram.trainingDays = program.trainingDays.map(remapDay);
  } else if (program.type === 'periodized' && program.mesocycles) {
    updatedProgram.mesocycles = program.mesocycles.map((meso: any) => ({
      ...meso,
      microcycles: (meso.microcycles ?? []).map((micro: any) => ({
        ...micro,
        trainingDays: (micro.trainingDays ?? []).map(remapDay),
      })),
    }));
  }

  await programStorage.save(userId, updatedProgram, programId);
}

export default function HomePage() {
  const colorScheme = useColorScheme();
  const { isExpanded, expand, minimize } = useWorkoutUI();
  const { customColors } = useThemeCustomization();
  const { userId } = useStorage();
  // Fetch data from storage
  const { program: activeProgram, loading: programLoading, refetch: refetchActiveProgram } = useActiveProgram();
  const { session, sessionHistory, startSession, completeSession, cancelSession, loading: sessionLoading } = useWorkoutSession();
  const { stats, incrementWorkouts, loading: statsLoading } = useStats();

  // Track user-selected day override (cleared once a session starts with it)
  const [selectedDayOverride, setSelectedDayOverride] = React.useState<string | null>(null);

  // SessionStartOptions state
  const [sessionStartVisible, setSessionStartVisible] = React.useState(false);
  const [pendingLastPlan, setPendingLastPlan] = React.useState<SessionExercisePlan[] | null>(null);
  const [pendingTemplatePlan, setPendingTemplatePlan] = React.useState<SessionExercisePlan[]>([]);

  // Refetch active program and consume any pending day override when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refetchActiveProgram();
      const pending = consumePendingDayOverride();
      if (pending) setSelectedDayOverride(pending);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  // Get next training day from active program based on session history
  const nextTrainingDay = useMemo(() => {
    if (!activeProgram) return null;

    // Get all training days for the program
    let trainingDays: TrainingDay[] = [];
    if (activeProgram.type === 'simple' && activeProgram.trainingDays?.length > 0) {
      trainingDays = activeProgram.trainingDays;
    } else if (activeProgram.type === 'periodized' && activeProgram.mesocycles?.length > 0) {
      // For periodized, flatten all training days from all microcycles
      for (const meso of activeProgram.mesocycles) {
        if (meso.microcycles) {
          for (const micro of meso.microcycles) {
            if (micro.trainingDays) {
              trainingDays.push(...micro.trainingDays);
            }
          }
        }
      }
    }

    if (trainingDays.length === 0) return null;

    // Find last completed session for this program
    const lastProgramSession = sessionHistory?.find(
      s => s.programId === activeProgram.id
    );

    if (!lastProgramSession) {
      // No previous sessions, start with first training day
      return trainingDays[0];
    }

    // Find the index of the last completed training day
    const lastIndex = trainingDays.findIndex(
      td => td.id === lastProgramSession.trainingDayId
    );

    if (lastIndex === -1) {
      // Last session's training day not found, start with first
      return trainingDays[0];
    }

    // Return next training day in rotation (wrap around)
    const nextIndex = (lastIndex + 1) % trainingDays.length;
    return trainingDays[nextIndex];
  }, [activeProgram, sessionHistory]);

  // Find training day for active session from the program structure
  const activeTrainingDay = useMemo(() => {
    if (!session || !activeProgram) return null;

    const findTrainingDay = (trainingDayId: string) => {
      // Search in simple program
      if (activeProgram.type === 'simple' && activeProgram.trainingDays) {
        const found = activeProgram.trainingDays.find((td: TrainingDay) => td.id === trainingDayId);
        if (found) return found;
      }

      // Search in periodized program
      if (activeProgram.type === 'periodized' && activeProgram.mesocycles) {
        for (const meso of activeProgram.mesocycles) {
          if (meso.microcycles) {
            for (const micro of meso.microcycles) {
              if (micro.trainingDays) {
                const found = micro.trainingDays.find((td: TrainingDay) => td.id === trainingDayId);
                if (found) return found;
              }
            }
          }
        }
      }

      return null;
    };

    return findTrainingDay(session.trainingDayId);
  }, [session, activeProgram]);

  // Get last completed session
  const lastSession = useMemo(() => {
    return sessionHistory && sessionHistory.length > 0 ? sessionHistory[0] : null;
  }, [sessionHistory]);

  // Get previous instance of next training day (if available) — recalculated after effectiveNextDay is known
  const previousInstanceOfToday = useMemo(() => {
    if (!nextTrainingDay || !sessionHistory) return null;
    return sessionHistory.find(s => s.trainingDayId === nextTrainingDay.id) || null;
  }, [nextTrainingDay, sessionHistory]);

  // All training days flattened for override lookup
  const allTrainingDays = useMemo(() => {
    if (!activeProgram) return [];
    if (activeProgram.type === 'simple') return activeProgram.trainingDays ?? [];
    const days: TrainingDay[] = [];
    for (const meso of activeProgram.mesocycles ?? []) {
      for (const micro of meso.microcycles ?? []) {
        days.push(...(micro.trainingDays ?? []));
      }
    }
    return days;
  }, [activeProgram]);

  // If user selected a specific day override, use that instead of auto-calculated next
  const effectiveNextDay = useMemo(() => {
    if (selectedDayOverride) {
      const found = allTrainingDays.find((d: TrainingDay) => d.id === selectedDayOverride);
      if (found) return found;
    }
    return nextTrainingDay;
  }, [selectedDayOverride, allTrainingDays, nextTrainingDay]);

  const loading = programLoading || sessionLoading || statsLoading;

  const handleWorkoutButtonPress = async () => {
    // If there's already a session, just expand the interface
    if (session) {
      expand();
      return;
    }

    if (!activeProgram) {
      Alert.alert(
        'No Active Program',
        'Please set an active program in the Programs tab before starting a workout.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!effectiveNextDay || !effectiveNextDay.id) {
      Alert.alert(
        'No Training Day',
        'Your active program doesn\'t have any training days configured.',
        [{ text: 'OK' }]
      );
      return;
    }

    const templatePlan: SessionExercisePlan[] = (effectiveNextDay.exercises ?? []).map((e: TrainingExercise) => ({
      exerciseId: e.id!,
      exerciseName: e.name!,
    }));

    // Check if last session for this day had a different layout
    try {
      const lastPlan = userId
        ? await getLastSessionPlanForDay(userId, effectiveNextDay.id)
        : null;

      if (lastPlan && !plansEqual(lastPlan, templatePlan)) {
        // Differences found — let user choose
        setPendingLastPlan(lastPlan);
        setPendingTemplatePlan(templatePlan);
        setSessionStartVisible(true);
        return;
      }
    } catch {
      // If lookup fails, just proceed with template
    }

    // No difference (or first ever session) — start with template plan
    try {
      await startSession(activeProgram.id, effectiveNextDay.id, effectiveNextDay.name ?? undefined, templatePlan);
      setSelectedDayOverride(null);
      expand();
    } catch (err) {
      Alert.alert('Error', 'Failed to start workout session');
      console.error('Error starting workout:', err);
    }
  };

  const handleSessionStartChoice = async (choice: SessionStartChoice) => {
    setSessionStartVisible(false);
    if (!activeProgram || !effectiveNextDay?.id) return;

    const planToUse = choice === 'template' ? pendingTemplatePlan : (pendingLastPlan ?? pendingTemplatePlan);

    if (choice === 'lastAndSave' && pendingLastPlan && userId) {
      try {
        await saveExercisePlanToTemplate(userId, activeProgram.id, effectiveNextDay.id, pendingLastPlan);
      } catch (err) {
        console.error('Failed to save plan to template:', err);
      }
    }

    try {
      await startSession(activeProgram.id, effectiveNextDay.id, effectiveNextDay.name ?? undefined, planToUse);
      setSelectedDayOverride(null);
      expand();
    } catch (err) {
      Alert.alert('Error', 'Failed to start workout session');
      console.error('Error starting workout:', err);
    }
  };

  const handleCompleteWorkout = async (notes?: string) => {
    try {
      // Capture duration before completeSession clears the active session
      const durationSeconds = session ? calculateWorkoutDuration(session.startedAt) : 0;

      await completeSession(notes);

      // Update stats (workouts, streak, and active time)
      await incrementWorkouts(durationSeconds);

      Alert.alert('Workout Complete!', 'Great job! Your progress has been saved.');
    } catch (err) {
      Alert.alert('Error', 'Failed to complete workout');
      console.error('Error completing workout:', err);
    }
  };

  const handleCancelWorkout = async () => {
    Alert.alert(
      'Cancel Workout?',
      'Are you sure? Your progress will be lost.',
      [
        { text: 'Keep Training', style: 'cancel' },
        {
          text: 'Cancel Workout',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelSession();
              minimize(); // Minimize after canceling
            } catch {
              Alert.alert('Error', 'Failed to cancel workout');
            }
          },
        },
      ]
    );
  };

  const handleMinimizeWorkout = () => {
    minimize();
  };

  const handleViewSession = useCallback((sessionData: WorkoutSession) => {
    router.push({
      pathname: '/session-detail',
      params: { session: JSON.stringify(sessionData) },
    });
  }, []);

  const handleViewTrainingDay = useCallback((trainingDay: TrainingDay) => {
    router.push({
      pathname: '/training-day-detail',
      params: { trainingDay: JSON.stringify(trainingDay) },
    });
  }, []);

  const isDark = colorScheme === 'dark';

  // Helper to convert hex to rgba
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Athletic color palette - uses customColors from settings
  const accent = customColors.primaryButton;
  const palette = {
    bg: isDark ? '#0A0A0B' : '#FAFAF9',
    cardBg: isDark ? '#141416' : '#FFFFFF',
    cardBorder: isDark ? '#2A2A2E' : '#E8E8E6',
    text: isDark ? '#FAFAFA' : '#0A0A0B',
    textMuted: isDark ? '#71717A' : '#71717A',
    accent,
    accentGlow: isDark ? hexToRgba(accent, 0.15) : hexToRgba(accent, 0.08),
    success: '#22C55E',
    streak: '#FACC15',
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]} edges={['top']}>
      {sessionStartVisible && effectiveNextDay && pendingLastPlan && (
        <SessionStartOptions
          visible={sessionStartVisible}
          trainingDay={effectiveNextDay}
          lastPlan={pendingLastPlan}
          onChoose={handleSessionStartChoice}
          onDismiss={() => setSessionStartVisible(false)}
        />
      )}
      {session && isExpanded ? (
        <WorkoutInterface
          session={session}
          trainingDay={activeTrainingDay}
          programName={activeProgram?.name}
          loading={false}
          onComplete={handleCompleteWorkout}
          onCancel={handleCancelWorkout}
          onMinimize={handleMinimizeWorkout}
        />
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Header with Day + Status Badge */}
          <View style={styles.header}>
            <Text style={[styles.headerDay, { color: palette.textMuted }]}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: isDark ? '#1F1F23' : '#F4F4F5', borderColor: palette.cardBorder }]}>
              <View style={[styles.statusDot, { backgroundColor: session ? palette.success : palette.accent }]} />
              <Text style={[styles.statusText, { color: palette.textMuted }]}>
                {session ? 'Active' : 'Ready'}
              </Text>
            </View>
          </View>

          {/* Hero Section */}
          <View style={styles.heroSection}>
            <Text style={[styles.heroTitle, { color: palette.text }]}>
              {session ? 'Session\nActive' : 'Ready to\nTrain?'}
            </Text>

            {/* Decorative diagonal accent */}
            <View style={[styles.heroAccent, { backgroundColor: palette.accentGlow }]}>
              <View style={[styles.heroAccentInner, { backgroundColor: palette.accent }]} />
            </View>
          </View>

          {/* Primary Action Button */}
          <TouchableOpacity
            style={[styles.primaryAction, { shadowColor: palette.accent }]}
            onPress={handleWorkoutButtonPress}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={[palette.accent, hexToRgba(palette.accent, 0.85)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryActionGradient}
            >
              <View style={styles.primaryActionContent}>
                <View style={styles.primaryActionIcon}>
                  <Ionicons name={session ? "play" : "flash"} size={32} color="#FFF" />
                </View>
                <View style={styles.primaryActionText}>
                  <Text style={styles.primaryActionTitle}>
                    {session ? 'Resume Workout' : 'Start Workout'}
                  </Text>
                  {effectiveNextDay && !session && (
                    <Text style={styles.primaryActionSubtitle}>
                      {effectiveNextDay.name}
                    </Text>
                  )}
                </View>
                <Ionicons name="arrow-forward" size={24} color="rgba(255,255,255,0.7)" />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* Loading State */}
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={palette.accent} />
            </View>
          )}

          {/* Stats Row */}
          {!loading && stats && (
            <View style={styles.statsRow}>
              <View style={[styles.statPill, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
                <View style={[styles.statIconBg, { backgroundColor: hexToRgba(palette.accent, 0.12) }]}>
                  <Ionicons name="flame" size={18} color={palette.accent} />
                </View>
                <View>
                  <Text style={[styles.statValue, { color: palette.text }]}>{stats.totalWorkouts || 0}</Text>
                  <Text style={[styles.statLabel, { color: palette.textMuted }]}>workouts</Text>
                </View>
              </View>
              <View style={[styles.statPill, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
                <View style={[styles.statIconBg, { backgroundColor: 'rgba(250, 204, 21, 0.12)' }]}>
                  <Ionicons name="trending-up" size={18} color={palette.streak} />
                </View>
                <View>
                  <Text style={[styles.statValue, { color: palette.text }]}>{stats.currentStreak || 0}</Text>
                  <Text style={[styles.statLabel, { color: palette.textMuted }]}>day streak</Text>
                </View>
              </View>
            </View>
          )}

          {/* Up Next Section */}
          {!loading && effectiveNextDay && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionBadge, { backgroundColor: palette.accentGlow }]}>
                  <Text style={[styles.sectionBadgeText, { color: palette.accent }]}>UP NEXT</Text>
                </View>
                {selectedDayOverride && (
                  <View style={[styles.overrideBadge, { backgroundColor: isDark ? '#1F1F23' : '#F4F4F5' }]}>
                    <Ionicons name="swap-horizontal" size={12} color={palette.textMuted} />
                    <Text style={[styles.overrideBadgeText, { color: palette.textMuted }]}>CUSTOM</Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={[styles.upNextCard, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}
                onPress={() => handleViewTrainingDay(effectiveNextDay)}
                activeOpacity={0.8}
              >
                <View style={styles.upNextContent}>
                  <View style={[styles.upNextIconContainer, { backgroundColor: palette.accentGlow }]}>
                    <Ionicons name="barbell-outline" size={28} color={palette.accent} />
                  </View>
                  <View style={styles.upNextDetails}>
                    <Text style={[styles.upNextTitle, { color: palette.text }]} numberOfLines={1}>
                      {effectiveNextDay.name}
                    </Text>
                    <Text style={[styles.upNextMeta, { color: palette.textMuted }]}>
                      {effectiveNextDay.exercises?.length || 0} exercises
                      {effectiveNextDay.description ? ` · ${effectiveNextDay.description}` : ''}
                    </Text>
                  </View>
                  <View style={[styles.upNextArrow, { backgroundColor: isDark ? '#1F1F23' : '#F4F4F5' }]}>
                    <Ionicons name="chevron-forward" size={20} color={palette.textMuted} />
                  </View>
                </View>
              </TouchableOpacity>

              {/* Choose Different Day */}
              {!session && activeProgram && allTrainingDays.length > 1 && (
                <TouchableOpacity
                  style={[styles.chooseDayButton, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}
                  onPress={() =>
                    router.push({
                      pathname: '/select-training-day',
                      params: {
                        programId: activeProgram.id,
                        currentNextDayId: effectiveNextDay.id ?? '',
                      },
                    })
                  }
                  activeOpacity={0.7}
                >
                  <Ionicons name="list-outline" size={18} color={palette.textMuted} />
                  <Text style={[styles.chooseDayText, { color: palette.textMuted }]}>
                    Choose a different day
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={palette.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Empty state for no active program */}
          {!loading && !nextTrainingDay && (
            <View style={styles.section}>
              <View style={[styles.emptyCard, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
                <View style={[styles.emptyIconContainer, { backgroundColor: isDark ? '#1F1F23' : '#F4F4F5' }]}>
                  <Ionicons name="calendar-outline" size={32} color={palette.textMuted} />
                </View>
                <Text style={[styles.emptyTitle, { color: palette.text }]}>No Program Selected</Text>
                <Text style={[styles.emptyDescription, { color: palette.textMuted }]}>
                  Set an active program to see your next workout
                </Text>
                <TouchableOpacity
                  style={[styles.emptyAction, { backgroundColor: palette.accentGlow }]}
                  onPress={() => router.push('/(tabs)/programs')}
                >
                  <Text style={[styles.emptyActionText, { color: palette.accent }]}>Browse Programs</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Look Back Section */}
          {!loading && (lastSession || previousInstanceOfToday) && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Look Back</Text>
              </View>

              {/* Last Session */}
              {lastSession && (
                <TouchableOpacity
                  style={[styles.lookBackCard, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}
                  onPress={() => handleViewSession(lastSession)}
                  activeOpacity={0.8}
                >
                  <View style={styles.lookBackHeader}>
                    <View style={[styles.lookBackIconContainer, { backgroundColor: `${palette.success}15` }]}>
                      <Ionicons name="checkmark-circle" size={24} color={palette.success} />
                    </View>
                    <View style={styles.lookBackHeaderInfo}>
                      <Text style={[styles.lookBackLabel, { color: palette.textMuted }]}>LAST COMPLETED</Text>
                      <Text style={[styles.lookBackTitle, { color: palette.text }]} numberOfLines={1}>
                        {lastSession.name || 'Workout'}
                      </Text>
                    </View>
                    <View style={styles.lookBackDateContainer}>
                      <Text style={[styles.lookBackDate, { color: palette.textMuted }]}>
                        {lastSession.completedAt ? new Date(lastSession.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Recent'}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={palette.textMuted} />
                    </View>
                  </View>
                  {lastSession.exercises && lastSession.exercises.length > 0 && (
                    <View style={[styles.lookBackExercises, { borderTopColor: palette.cardBorder }]}>
                      {lastSession.exercises.slice(0, 4).map((ex, idx) => (
                        <View key={ex.exerciseId || idx} style={styles.lookBackExerciseRow}>
                          <Text style={[styles.lookBackExerciseName, { color: palette.text }]} numberOfLines={1}>
                            {ex.exerciseName}
                          </Text>
                          <Text style={[styles.lookBackExerciseSets, { color: palette.textMuted }]}>
                            {ex.sets.length} sets
                          </Text>
                        </View>
                      ))}
                      {lastSession.exercises.length > 4 && (
                        <Text style={[styles.lookBackMore, { color: palette.textMuted }]}>
                          +{lastSession.exercises.length - 4} more
                        </Text>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              )}

              {/* Previous Instance of Today's Training Day */}
              {previousInstanceOfToday && (
                <TouchableOpacity
                  style={[styles.lookBackCard, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}
                  onPress={() => handleViewSession(previousInstanceOfToday)}
                  activeOpacity={0.8}
                >
                  <View style={styles.lookBackHeader}>
                    <View style={[styles.lookBackIconContainer, { backgroundColor: `${palette.streak}15` }]}>
                      <Ionicons name="repeat" size={24} color={palette.streak} />
                    </View>
                    <View style={styles.lookBackHeaderInfo}>
                      <Text style={[styles.lookBackLabel, { color: palette.textMuted }]}>PREVIOUS {nextTrainingDay?.name?.toUpperCase()}</Text>
                      <Text style={[styles.lookBackTitle, { color: palette.text }]} numberOfLines={1}>
                        {previousInstanceOfToday.name || 'Workout'}
                      </Text>
                    </View>
                    <View style={styles.lookBackDateContainer}>
                      <Text style={[styles.lookBackDate, { color: palette.textMuted }]}>
                        {previousInstanceOfToday.completedAt ? new Date(previousInstanceOfToday.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Previous'}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={palette.textMuted} />
                    </View>
                  </View>
                  {previousInstanceOfToday.exercises && previousInstanceOfToday.exercises.length > 0 && (
                    <View style={[styles.lookBackExercises, { borderTopColor: palette.cardBorder }]}>
                      {previousInstanceOfToday.exercises.slice(0, 4).map((ex, idx) => (
                        <View key={ex.exerciseId || idx} style={styles.lookBackExerciseRow}>
                          <Text style={[styles.lookBackExerciseName, { color: palette.text }]} numberOfLines={1}>
                            {ex.exerciseName}
                          </Text>
                          <Text style={[styles.lookBackExerciseSets, { color: palette.textMuted }]}>
                            {ex.sets.length} sets
                          </Text>
                        </View>
                      ))}
                      {previousInstanceOfToday.exercises.length > 4 && (
                        <Text style={[styles.lookBackMore, { color: palette.textMuted }]}>
                          +{previousInstanceOfToday.exercises.length - 4} more
                        </Text>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Bottom Spacer */}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 155,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerDay: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Hero Section
  heroSection: {
    paddingTop: 8,
    paddingBottom: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  heroTitle: {
    fontSize: 42,
    fontWeight: '800',
    lineHeight: 46,
    letterSpacing: -1.5,
  },
  heroAccent: {
    position: 'absolute',
    top: -20,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroAccentInner: {
    width: 8,
    height: 60,
    borderRadius: 4,
    transform: [{ rotate: '45deg' }],
  },

  // Primary Action Button
  primaryAction: {
    marginBottom: 24,
    borderRadius: 20,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryActionGradient: {
    paddingVertical: 20,
    paddingHorizontal: 24,
  },
  primaryActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  primaryActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  primaryActionText: {
    flex: 1,
  },
  primaryActionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: -0.3,
  },
  primaryActionSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  statPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  statIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Section
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sectionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },

  // Override badge
  overrideBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
    marginLeft: 8,
  },
  overrideBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  // Choose Different Day button
  chooseDayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  chooseDayText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },

  // Up Next Card
  upNextCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  upNextContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  upNextIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  upNextDetails: {
    flex: 1,
  },
  upNextTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 3,
  },
  upNextMeta: {
    fontSize: 13,
    fontWeight: '500',
  },
  upNextArrow: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Empty State
  emptyCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  emptyDescription: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyAction: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyActionText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Look Back Cards
  lookBackCard: {
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  lookBackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  lookBackIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lookBackHeaderInfo: {
    flex: 1,
  },
  lookBackLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  lookBackTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  lookBackDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lookBackDate: {
    fontSize: 12,
    fontWeight: '500',
  },
  lookBackExercises: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  lookBackExerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lookBackExerciseName: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    marginRight: 12,
  },
  lookBackExerciseSets: {
    fontSize: 13,
    fontWeight: '500',
  },
  lookBackMore: {
    fontSize: 12,
    fontWeight: '500',
    fontStyle: 'italic',
    marginTop: 4,
  },

  // Loading
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
});
