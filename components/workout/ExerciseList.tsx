/**
 * ExerciseList Component
 * Renders exercises for the active workout session.
 *
 * Source of truth for which exercises to show (and their order) is
 * session.exercisePlan when present. Legacy sessions without exercisePlan
 * fall back to trainingDay.exercises + exerciseOverrides.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { TrainingDay, TrainingExercise } from '@/types/training';
import type { WorkoutSession, SessionSet, SessionExercisePlan } from '@/services/storage/session-storage';
import { getPreviousPerformance } from '@/utils/workout-helpers';
import { useExercises } from '@/hooks/useExercises';
import { useThemeCustomization } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/theme';
import ExerciseCard from './ExerciseCard';
import ExerciseSwapModal from './ExerciseSwapModal';
import ReorderModal from './ReorderModal';

interface ExerciseListProps {
  trainingDay: TrainingDay;
  session: WorkoutSession;
  sessionHistory: WorkoutSession[];
  onAddSet: (exerciseId: string, exerciseName: string, set: Omit<SessionSet, 'completedAt'>) => void;
  onUpdateSet?: (exerciseId: string, setIndex: number, set: Omit<SessionSet, 'completedAt'>) => void;
  onDeleteSet?: (exerciseId: string, setIndex: number) => void;
  onSwapExercise?: (originalExerciseId: string, newExercise: TrainingExercise) => void;
  onAddExercise?: (exercise: TrainingExercise) => void;
  onRemoveExercise?: (exerciseId: string) => void;
  onReorderExercises?: (newOrder: SessionExercisePlan[]) => void;
}

export default function ExerciseList({
  trainingDay,
  session,
  sessionHistory,
  onAddSet,
  onUpdateSet,
  onDeleteSet,
  onSwapExercise,
  onAddExercise,
  onRemoveExercise,
  onReorderExercises,
}: ExerciseListProps) {
  const { allExercises, refetch } = useExercises();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const { customColors } = useThemeCustomization();

  // Refresh exercise library when the screen regains focus (e.g. after editing
  // an exercise in the exercise-form modal) so edits apply without reopening
  // the session. Ref keeps the focus effect stable to avoid refetch loops.
  const refetchRef = useRef(refetch);
  useEffect(() => {
    refetchRef.current = refetch;
  }, [refetch]);
  useFocusEffect(
    useCallback(() => {
      refetchRef.current();
    }, [])
  );

  const [addExerciseVisible, setAddExerciseVisible] = useState(false);
  const [reorderVisible, setReorderVisible] = useState(false);

  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // --- Build effective exercise list ---
  // New sessions: use session.exercisePlan (ordered, reflects adds/removes/swaps)
  // Legacy sessions (no exercisePlan): fall back to template + overrides
  const effectiveExercises: TrainingExercise[] = React.useMemo(() => {
    if (session.exercisePlan && session.exercisePlan.length >= 0) {
      // exercisePlan is source of truth (even if empty — user removed everything)
      return session.exercisePlan.map(entry => {
        const lib = allExercises.find(ex => ex.id === entry.exerciseId);
        const tpl = (trainingDay.exercises ?? []).find(ex => ex.id === entry.exerciseId);
        return lib ?? tpl ?? ({ id: entry.exerciseId, name: entry.exerciseName } as TrainingExercise);
      });
    }

    // Legacy fallback: template + swap overrides
    return (trainingDay.exercises ?? []).map(ex => {
      const override = session.exerciseOverrides?.[ex.id!];
      if (override) {
        const found = allExercises.find(e => e.id === override.exerciseId);
        return found ?? ({ ...ex, id: override.exerciseId, name: override.exerciseName } as TrainingExercise);
      }
      return allExercises.find(e => e.id === ex.id) ?? ex;
    });
  }, [session.exercisePlan, session.exerciseOverrides, allExercises, trainingDay.exercises]);

  const handleSelectAddExercise = (exercise: TrainingExercise) => {
    setAddExerciseVisible(false);
    onAddExercise?.(exercise);
  };

  const handleReorderSave = (newOrder: SessionExercisePlan[]) => {
    setReorderVisible(false);
    onReorderExercises?.(newOrder);
  };

  // Derive current plan for reorder modal
  const currentPlan: SessionExercisePlan[] = effectiveExercises.map(ex => ({
    exerciseId: ex.id!,
    exerciseName: ex.name!,
  }));

  const canEdit = !!(onAddExercise || onRemoveExercise || onReorderExercises);

  return (
    <View style={styles.container}>
      {/* List header — only shown when editing is enabled */}
      {canEdit && (
        <View style={styles.listHeader}>
          <Text style={[styles.listHeaderText, { color: theme.textSecondary }]}>
            {effectiveExercises.length} exercise{effectiveExercises.length !== 1 ? 's' : ''}
          </Text>
          {onReorderExercises && effectiveExercises.length > 1 && (
            <TouchableOpacity
              style={[styles.headerAction, { backgroundColor: theme.cardBorder + '50' }]}
              onPress={() => setReorderVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="reorder-three-outline" size={18} color={theme.textSecondary} />
              <Text style={[styles.headerActionText, { color: theme.textSecondary }]}>Reorder</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {effectiveExercises.map((exercise) => {
        const sessionExercise = session.exercises.find(ex => ex.exerciseId === exercise.id);
        const previousPerformance = getPreviousPerformance(exercise.id!, sessionHistory);
        const libraryExercise = allExercises.find(ex => ex.id === exercise.id);

        return (
          <View key={exercise.id} style={styles.cardWrapper}>
            <ExerciseCard
              exercise={exercise}
              sessionExercise={sessionExercise}
              previousPerformance={previousPerformance}
              originalExerciseId={exercise.id}
              onAddSet={onAddSet}
              onUpdateSet={onUpdateSet}
              onDeleteSet={onDeleteSet}
              onSwapExercise={onSwapExercise}
              onRemoveExercise={onRemoveExercise ? () => onRemoveExercise(exercise.id!) : undefined}
              canEditExercise={!!libraryExercise}
              sessionHistory={sessionHistory}
            />
          </View>
        );
      })}

      {/* Add Exercise button */}
      {onAddExercise && (
        <TouchableOpacity
          style={[
            styles.addExerciseButton,
            { backgroundColor: hexToRgba(customColors.primaryButton, 0.08), borderColor: hexToRgba(customColors.primaryButton, 0.25) },
          ]}
          onPress={() => setAddExerciseVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle-outline" size={22} color={customColors.primaryButton} />
          <Text style={[styles.addExerciseText, { color: customColors.primaryButton }]}>Add Exercise</Text>
        </TouchableOpacity>
      )}

      {/* Add Exercise Modal */}
      <ExerciseSwapModal
        visible={addExerciseVisible}
        headerLabel="ADD"
        onClose={() => setAddExerciseVisible(false)}
        onSelectExercise={handleSelectAddExercise}
        sessionHistory={sessionHistory}
      />

      {/* Reorder Modal */}
      <ReorderModal
        visible={reorderVisible}
        exercises={currentPlan}
        onClose={() => setReorderVisible(false)}
        onSave={handleReorderSave}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  listHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  headerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  headerActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  cardWrapper: {
    position: 'relative',
  },
  addExerciseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    marginTop: 4,
    marginBottom: 16,
  },
  addExerciseText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
