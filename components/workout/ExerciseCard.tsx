/**
 * ExerciseCard Component
 * Displays an exercise in the workout with set logging functionality
 */

import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet, useColorScheme, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useThemeCustomization } from '@/contexts/ThemeContext';
import type { TrainingExercise, MuscleCategory } from '@/types/training';
import type { SessionExercise, SessionSet, WorkoutSession } from '@/services/storage/session-storage';
import type { PreviousPerformance as PreviousPerformanceData } from '@/utils/workout-helpers';
import PreviousPerformance from './PreviousPerformance';
import SetEditor from './SetEditor';
import SetListItem from './SetListItem';
import ExerciseSwapModal from './ExerciseSwapModal';
import { displayWeight } from '@/utils/weight';
import { muscleCategoryIcons, muscleCategoryColors, getMuscleBodyImage } from '@/constants/muscle-categories';

interface ExerciseCardProps {
  exercise: TrainingExercise;
  sessionExercise?: SessionExercise;
  previousPerformance: PreviousPerformanceData | null;
  /** The original exercise ID from the training day template (stable key for swap logic). */
  originalExerciseId?: string;
  onAddSet: (exerciseId: string, exerciseName: string, set: Omit<SessionSet, 'completedAt'>) => void;
  onUpdateSet?: (exerciseId: string, setIndex: number, set: Omit<SessionSet, 'completedAt'>) => void;
  onDeleteSet?: (exerciseId: string, setIndex: number) => void;
  onSwapExercise?: (originalExerciseId: string, newExercise: TrainingExercise) => void;
  /** Called when user removes this exercise from the session. */
  onRemoveExercise?: () => void;
  /** When true, shows the edit button which opens exercise-form in edit mode. */
  canEditExercise?: boolean;
  sessionHistory?: WorkoutSession[];
}

export default function ExerciseCard({
  exercise,
  sessionExercise,
  previousPerformance,
  originalExerciseId,
  onAddSet,
  onUpdateSet,
  onDeleteSet,
  onSwapExercise,
  onRemoveExercise,
  canEditExercise,
  sessionHistory,
}: ExerciseCardProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const { customColors, preferences } = useThemeCustomization();
  const [isExpanded, setIsExpanded] = useState(false);
  const defaultWeight = sessionExercise?.sets && sessionExercise.sets.length > 0
    ? sessionExercise.sets[sessionExercise.sets.length - 1].weight
    : previousPerformance?.weight;

  // Swap modal state
  const [swapModalVisible, setSwapModalVisible] = useState(false);

  const handleSelectSwapExercise = (newExercise: TrainingExercise) => {
    setSwapModalVisible(false);
    if (onSwapExercise && originalExerciseId) {
      onSwapExercise(originalExerciseId, newExercise);
    }
  };

  // SetEditor modal state
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorMode, setEditorMode] = useState<'add' | 'edit'>('add');
  const [editingSetIndex, setEditingSetIndex] = useState<number | null>(null);
  const [editingSetData, setEditingSetData] = useState<SessionSet | undefined>();

  // Calculate if exercise is complete
  const isComplete =
    sessionExercise &&
    exercise.targetNumberOfSets &&
    (sessionExercise.sets?.length ?? 0) >= exercise.targetNumberOfSets;

  // Build target suggestions text
  const targetSuggestions = [];
  if (exercise.targetRepetitions) {
    targetSuggestions.push(`${exercise.targetRepetitions} reps`);
  }
  if (exercise.targetRepetitionsInReserve) {
    targetSuggestions.push(`RIR ${exercise.targetRepetitionsInReserve}`);
  }
  const targetText = targetSuggestions.length > 0 ? `Target: ${targetSuggestions.join(', ')}` : '';

  const openAddSetEditor = () => {
    setEditorMode('add');
    setEditingSetIndex(null);
    setEditingSetData(undefined);
    setEditorVisible(true);
  };

  const openEditSetEditor = (index: number, set: SessionSet) => {
    setEditorMode('edit');
    setEditingSetIndex(index);
    setEditingSetData(set);
    setEditorVisible(true);
  };

  const handleEditorSubmit = (setData: Omit<SessionSet, 'completedAt'>) => {
    if (editorMode === 'add') {
      onAddSet(exercise.id!, exercise.name!, setData);
    } else if (editingSetIndex !== null && onUpdateSet) {
      onUpdateSet(exercise.id!, editingSetIndex, setData);
    }
  };

  const handleEditorDelete = () => {
    if (editingSetIndex !== null && onDeleteSet) {
      onDeleteSet(exercise.id!, editingSetIndex);
    }
  };

  // Memoize initialData to prevent unnecessary re-renders
  const editorInitialData = useMemo(() => {
    if (editorMode === 'add') {
      return { weight: defaultWeight };
    }
    return editingSetData;
  }, [editorMode, defaultWeight, editingSetData]);

  return (
    <View style={[styles.container, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
      {/* Header - Always visible */}
      <View style={styles.header}>
        {/* Left: icon + info (tappable for expand/collapse) */}
        <TouchableOpacity
          style={styles.headerMain}
          onPress={() => setIsExpanded(!isExpanded)}
          activeOpacity={0.7}
        >
          {/* Muscle Category Icon */}
          {exercise.muscleCategory && (
            <View
              style={[
                styles.muscleIconContainer,
                { backgroundColor: `${muscleCategoryColors[exercise.muscleCategory as MuscleCategory]}20` },
              ]}
            >
              {getMuscleBodyImage(exercise.muscleCategory as MuscleCategory, exercise.muscleSubcategory) ? (
                <Image
                  source={getMuscleBodyImage(exercise.muscleCategory as MuscleCategory, exercise.muscleSubcategory)!}
                  style={styles.muscleBodyImage}
                  resizeMode="contain"
                />
              ) : (
                <Ionicons
                  name={muscleCategoryIcons[exercise.muscleCategory as MuscleCategory] || 'fitness'}
                  size={24}
                  color={muscleCategoryColors[exercise.muscleCategory as MuscleCategory]}
                />
              )}
            </View>
          )}

          {/* Exercise Info */}
          <View style={styles.headerInfo}>
            <View style={styles.headerTopRow}>
              <Text style={[styles.exerciseName, { color: theme.text }]} numberOfLines={1}>
                {exercise.name}
              </Text>
              {isComplete && (
                <View style={[styles.completeBadge, { backgroundColor: '#00b89420' }]}>
                  <Ionicons name="checkmark-circle" size={16} color="#00b894" />
                  <Text style={[styles.completeBadgeText, { color: '#00b894' }]}>Complete</Text>
                </View>
              )}
            </View>

            {targetText && (
              <Text style={[styles.targetText, { color: theme.textSecondary }]}>{targetText}</Text>
            )}

            {exercise.equipment && (
              <Text style={[styles.equipmentText, { color: theme.textSecondary }]}>
                {exercise.equipment}
              </Text>
            )}

            {/* Sets count */}
            <Text style={[styles.setsCount, { color: theme.textSecondary }]}>
              {sessionExercise?.sets.length || 0}
              {exercise.targetNumberOfSets ? `/${exercise.targetNumberOfSets}` : ''} sets
              {previousPerformance && !isExpanded && (
                <Text style={[styles.prevHint, { color: theme.textSecondary }]}>
                  {' · '}Last: {displayWeight(previousPerformance.weight, preferences.weightUnit)}{preferences.weightUnit} × {previousPerformance.reps}
                  {previousPerformance.rir !== undefined && (
                    previousPerformance.rir === 'F' ? ' (F)' :
                    previousPerformance.rir === 'P' ? ' (P)' :
                    ` @${previousPerformance.rir}RIR`
                  )}
                </Text>
              )}
            </Text>

            {/* Notes indicator (collapsed state) */}
            {exercise.notes && !isExpanded && (
              <View style={styles.notesIndicator}>
                <Ionicons name="document-text-outline" size={12} color={theme.textSecondary} />
                <Text style={[styles.notesIndicatorText, { color: theme.textSecondary }]} numberOfLines={1}>
                  {exercise.notes}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* Right: chevron only */}
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => setIsExpanded(!isExpanded)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
          >
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Expanded Content */}
      {isExpanded && (
        <View style={styles.expandedContent}>
          {/* Action row: swap · edit · delete */}
          {(onSwapExercise || (canEditExercise && exercise.id) || onRemoveExercise) && (
            <View style={[styles.actionRow, { borderBottomColor: theme.cardBorder }]}>
              {onSwapExercise && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => setSwapModalVisible(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="swap-horizontal" size={18} color={theme.textSecondary} />
                  <Text style={[styles.actionButtonText, { color: theme.textSecondary }]}>Swap</Text>
                </TouchableOpacity>
              )}
              {canEditExercise && exercise.id && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => router.push({ pathname: '/exercise-form', params: { exerciseId: exercise.id } })}
                  activeOpacity={0.7}
                >
                  <Ionicons name="pencil" size={16} color={theme.textSecondary} />
                  <Text style={[styles.actionButtonText, { color: theme.textSecondary }]}>Edit</Text>
                </TouchableOpacity>
              )}
              {onRemoveExercise && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={onRemoveExercise}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  <Text style={[styles.actionButtonText, { color: '#EF4444' }]}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Exercise Notes */}
          {exercise.notes && (
            <View style={[styles.notesCard, { backgroundColor: theme.cardBorder + '30', borderColor: theme.cardBorder }]}>
              <View style={styles.notesCardHeader}>
                <Ionicons name="document-text-outline" size={14} color={theme.textSecondary} />
                <Text style={[styles.notesCardLabel, { color: theme.textSecondary }]}>Notes</Text>
              </View>
              <Text style={[styles.notesCardText, { color: theme.text }]}>{exercise.notes}</Text>
            </View>
          )}

          {/* Previous Performance */}
          <View style={styles.previousPerformanceContainer}>
            <PreviousPerformance
              data={previousPerformance}
              exerciseId={exercise.id}
              exerciseName={exercise.name ?? undefined}
              sessionHistory={sessionHistory}
            />
          </View>

          {/* Add Set Button */}
          <Pressable
            style={({ pressed }) => [
              styles.addSetButton,
              { backgroundColor: customColors.primaryButton },
              pressed && styles.addSetButtonPressed,
            ]}
            onPress={openAddSetEditor}
          >
            <Ionicons name="add-circle" size={22} color={customColors.primaryButtonText} />
            <Text style={[styles.addSetButtonText, { color: customColors.primaryButtonText }]}>
              Add Set
            </Text>
          </Pressable>

          {/* Completed Sets List */}
          {sessionExercise && sessionExercise.sets.length > 0 && (
            <View style={styles.setsListContainer}>
              <Text style={[styles.setsListTitle, { color: theme.text }]}>Completed Sets</Text>
              {sessionExercise.sets.map((set, index) => (
                <SetListItem
                  key={index}
                  set={set}
                  setNumber={index + 1}
                  onPress={() => openEditSetEditor(index, set)}
                />
              ))}
            </View>
          )}
        </View>
      )}

      {/* Set Editor Modal */}
      <SetEditor
        visible={editorVisible}
        onClose={() => setEditorVisible(false)}
        onSubmit={handleEditorSubmit}
        onDelete={editorMode === 'edit' && onDeleteSet ? handleEditorDelete : undefined}
        mode={editorMode}
        setNumber={editingSetIndex !== null ? editingSetIndex + 1 : undefined}
        initialData={editorInitialData}
      />

      {/* Exercise Swap Modal */}
      {onSwapExercise && (
        <ExerciseSwapModal
          visible={swapModalVisible}
          currentExerciseId={exercise.id}
          sessionHistory={sessionHistory}
          onClose={() => setSwapModalVisible(false)}
          onSelectExercise={handleSelectSwapExercise}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 12,
    gap: 8,
  },
  headerMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerIconButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  muscleIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muscleBodyImage: {
    width: 46,
    height: 46,
  },
  headerInfo: {
    flex: 1,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  completeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  completeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  targetText: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },
  equipmentText: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  setsCount: {
    fontSize: 14,
    fontWeight: '500',
  },
  prevHint: {
    fontSize: 13,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  expandedContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  actionRow: {
    flexDirection: 'row',
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  notesIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  notesIndicatorText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  notesCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  notesCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  notesCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  notesCardText: {
    fontSize: 14,
    lineHeight: 20,
  },
  previousPerformanceContainer: {
    marginBottom: 12,
  },
  addSetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  addSetButtonPressed: {
    opacity: 0.7,
  },
  addSetButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  setsListContainer: {
    marginTop: 16,
  },
  setsListTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
});
