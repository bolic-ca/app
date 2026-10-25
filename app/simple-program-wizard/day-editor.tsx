import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, useColorScheme, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSimpleProgramWizard } from '@/contexts/SimpleProgramWizardContext';
import { useThemeCustomization } from '@/contexts/ThemeContext';
import type { TrainingExercise } from '@/types/training';
import { muscleCategoryColors } from '@/constants/muscle-categories';

export default function DayEditorScreen() {
  const colorScheme = useColorScheme();
  const { customColors } = useThemeCustomization();
  const { state, updateTrainingDay, removeExercise } = useSimpleProgramWizard();

  const dayIndex = state.currentDayIndex;
  const day = dayIndex !== null ? state.trainingDays[dayIndex] : null;

  const [name, setName] = useState(day?.name || '');
  const [description, setDescription] = useState(day?.description || '');
  const dayKey = day ? `${dayIndex ?? ''}:${day.name}:${day.description}` : null;
  const [syncedDayKey, setSyncedDayKey] = useState(dayKey);
  if (day && dayKey !== syncedDayKey) {
    setSyncedDayKey(dayKey);
    setName(day.name);
    setDescription(day.description || '');
  }

  const isDark = colorScheme === 'dark';

  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const accent = customColors.primaryButton;
  const palette = {
    bg: isDark ? '#0A0A0B' : '#FAFAF9',
    cardBg: isDark ? '#141416' : '#FFFFFF',
    cardBorder: isDark ? '#2A2A2E' : '#E8E8E6',
    text: isDark ? '#FAFAFA' : '#0A0A0B',
    textMuted: isDark ? '#71717A' : '#71717A',
    accent,
    accentGlow: isDark ? hexToRgba(accent, 0.15) : hexToRgba(accent, 0.08),
    inputBg: isDark ? '#1F1F23' : '#F4F4F5',
    danger: '#EF4444',
  };

  const handleSave = () => {
    if (dayIndex === null) return;

    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please provide a name for this training day.');
      return;
    }

    updateTrainingDay(dayIndex, { name, description });
    router.back();
  };

  const handleAddExercise = () => {
    router.push('/simple-program-wizard/exercise-selector');
  };

  const handleDeleteExercise = (exerciseIndex: number) => {
    if (dayIndex === null) return;

    Alert.alert(
      'Remove Exercise',
      `Remove "${day?.exercises[exerciseIndex].name}" from this day?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeExercise(dayIndex, exerciseIndex),
        },
      ]
    );
  };

  if (!day || dayIndex === null) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]} edges={['top']}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: palette.text }]}>Training day not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={[styles.errorButton, { backgroundColor: palette.accent }]}>
            <Text style={styles.errorButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={palette.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerLabel, { color: palette.textMuted }]}>DAY {dayIndex + 1}</Text>
          <Text style={[styles.headerTitle, { color: palette.text }]}>Edit Training Day</Text>
        </View>
        <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
          <Text style={[styles.saveButtonText, { color: palette.accent }]}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {/* Day Name */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: palette.text }]}>Day Name *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: palette.inputBg, color: palette.text, borderColor: palette.cardBorder }]}
            placeholder="e.g., Upper Body Push"
            placeholderTextColor={palette.textMuted}
            value={name}
            onChangeText={setName}
          />
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: palette.text }]}>Description</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: palette.inputBg, color: palette.text, borderColor: palette.cardBorder }]}
            placeholder="Optional notes about this training day"
            placeholderTextColor={palette.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Exercises */}
        <View style={styles.section}>
          <View style={styles.exercisesHeader}>
            <Text style={[styles.label, { color: palette.text }]}>Exercises</Text>
            <TouchableOpacity
              style={[styles.addExerciseButton, { backgroundColor: palette.accentGlow }]}
              onPress={handleAddExercise}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={18} color={palette.accent} />
              <Text style={[styles.addExerciseButtonText, { color: palette.accent }]}>Add Exercise</Text>
            </TouchableOpacity>
          </View>

          {day.exercises.length === 0 ? (
            <View style={[styles.emptyExercises, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
              <View style={[styles.emptyIcon, { backgroundColor: palette.inputBg }]}>
                <Ionicons name="barbell-outline" size={28} color={palette.textMuted} />
              </View>
              <Text style={[styles.emptyTitle, { color: palette.text }]}>No Exercises Yet</Text>
              <Text style={[styles.emptyDescription, { color: palette.textMuted }]}>
                Add exercises to this training day
              </Text>
            </View>
          ) : (
            <View style={styles.exercisesList}>
              {day.exercises.map((exercise: TrainingExercise, index: number) => (
                <View
                  key={exercise.id || `exercise-${index}`}
                  style={[styles.exerciseCard, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}
                >
                  <View style={[styles.exerciseNumber, { backgroundColor: palette.inputBg }]}>
                    <Text style={[styles.exerciseNumberText, { color: palette.textMuted }]}>{index + 1}</Text>
                  </View>
                  <View style={styles.exerciseInfo}>
                    <Text style={[styles.exerciseName, { color: palette.text }]} numberOfLines={1}>
                      {exercise.name}
                    </Text>
                    <View style={styles.exerciseDetails}>
                      {exercise.targetNumberOfSets && (
                        <View style={[styles.detailBadge, { backgroundColor: palette.inputBg }]}>
                          <Text style={[styles.detailBadgeText, { color: palette.textMuted }]}>
                            {exercise.targetNumberOfSets} sets
                          </Text>
                        </View>
                      )}
                      {exercise.targetRepetitions && (
                        <View style={[styles.detailBadge, { backgroundColor: palette.inputBg }]}>
                          <Text style={[styles.detailBadgeText, { color: palette.textMuted }]}>
                            {exercise.targetRepetitions} reps
                          </Text>
                        </View>
                      )}
                      {exercise.targetRepetitionsInReserve && (
                        <View style={[styles.detailBadge, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
                          <Text style={[styles.detailBadgeText, { color: '#22C55E' }]}>
                            {exercise.targetRepetitionsInReserve} RIR
                          </Text>
                        </View>
                      )}
                    </View>
                    {exercise.muscleCategory && (
                      <Text style={[styles.exerciseMuscle, { color: muscleCategoryColors[exercise.muscleCategory] || palette.textMuted }]}>
                        {exercise.muscleCategory}
                        {exercise.muscleSubcategory ? ` · ${exercise.muscleSubcategory}` : ''}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeleteExercise(index)}
                    style={[styles.deleteButton, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}
                  >
                    <Ionicons name="trash-outline" size={18} color={palette.danger} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1, marginBottom: 2 },
  headerTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  saveButton: { paddingHorizontal: 12, paddingVertical: 8 },
  saveButtonText: { fontSize: 16, fontWeight: '700' },

  scrollView: { flex: 1 },
  contentContainer: { padding: 20 },

  section: { marginBottom: 28 },
  label: { fontSize: 15, fontWeight: '600', marginBottom: 10 },
  input: { fontSize: 16, padding: 16, borderRadius: 12, borderWidth: 1 },
  textArea: { fontSize: 16, padding: 16, borderRadius: 12, borderWidth: 1, minHeight: 100 },

  exercisesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  addExerciseButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  addExerciseButtonText: { fontSize: 14, fontWeight: '600' },

  emptyExercises: { padding: 24, borderRadius: 16, borderWidth: 1, alignItems: 'center' },
  emptyIcon: { width: 56, height: 56, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  emptyDescription: { fontSize: 13, textAlign: 'center' },

  exercisesList: { gap: 10 },
  exerciseCard: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, borderRadius: 14, borderWidth: 1, gap: 12 },
  exerciseNumber: { width: 28, height: 28, borderRadius: 7, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  exerciseNumberText: { fontSize: 12, fontWeight: '600' },
  exerciseInfo: { flex: 1 },
  exerciseName: { fontSize: 15, fontWeight: '600', marginBottom: 6 },
  exerciseDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  detailBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  detailBadgeText: { fontSize: 11, fontWeight: '500' },
  exerciseMuscle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  deleteButton: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },

  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: 16, marginBottom: 16 },
  errorButton: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  errorButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
