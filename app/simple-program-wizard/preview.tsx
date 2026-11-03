import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useColorScheme, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSimpleProgramWizard } from '@/contexts/SimpleProgramWizardContext';
import { useThemeCustomization } from '@/contexts/ThemeContext';
import type { TrainingExercise } from '@/types/training';

import { muscleCategoryColors } from '@/constants/muscle-categories';

export default function PreviewScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { customColors } = useThemeCustomization();
  const { state, saveProgram, isSaving, canSave } = useSimpleProgramWizard();

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
    success: '#22C55E',
  };

  const totalExercises = state.trainingDays.reduce((sum, day) => sum + day.exercises.length, 0);

  const handleSave = async () => {
    await saveProgram();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: palette.cardBorder }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <View style={[styles.backButtonInner, { backgroundColor: isDark ? '#1F1F23' : '#F4F4F5' }]}>
            <Ionicons name="chevron-back" size={22} color={palette.text} />
          </View>
        </TouchableOpacity>
        <View>
          <Text style={[styles.headerLabel, { color: palette.textMuted }]}>STEP 3</Text>
          <Text style={[styles.headerTitle, { color: palette.text }]}>Preview</Text>
        </View>
        <View style={styles.backButton} />
      </View>

      {/* Step Indicator */}
      <View style={styles.stepIndicator}>
        <View style={[styles.stepDot, { backgroundColor: palette.accent }]} />
        <View style={[styles.stepLine, { backgroundColor: palette.accent }]} />
        <View style={[styles.stepDot, { backgroundColor: palette.accent }]} />
        <View style={[styles.stepLine, { backgroundColor: palette.accent }]} />
        <View style={[styles.stepDot, { backgroundColor: palette.accent }]} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {/* Program Info */}
        <View style={[styles.infoCard, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
          <View style={styles.infoHeader}>
            <View style={[styles.infoIcon, { backgroundColor: palette.accentGlow }]}>
              <Ionicons name={state.schedule === 'rotating' ? 'repeat' : 'calendar'} size={28} color={palette.accent} />
            </View>
            <View style={styles.infoHeaderText}>
              <Text style={[styles.programName, { color: palette.text }]}>{state.name}</Text>
              <View style={styles.programMeta}>
                <View style={[styles.typeBadge, { backgroundColor: 'rgba(78, 205, 196, 0.12)' }]}>
                  <Text style={[styles.typeBadgeText, { color: '#4ecdc4' }]}>Simple</Text>
                </View>
                <View style={[styles.scheduleBadge, { backgroundColor: palette.inputBg }]}>
                  <Text style={[styles.scheduleBadgeText, { color: palette.textMuted }]}>
                    {state.schedule === 'rotating' ? 'Rotating' : 'Weekly'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
          {state.description && (
            <Text style={[styles.description, { color: palette.textMuted }]}>{state.description}</Text>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
            <Text style={[styles.statValue, { color: palette.accent }]}>{state.trainingDays.length}</Text>
            <Text style={[styles.statLabel, { color: palette.textMuted }]}>Training Days</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
            <Text style={[styles.statValue, { color: palette.accent }]}>{totalExercises}</Text>
            <Text style={[styles.statLabel, { color: palette.textMuted }]}>Total Exercises</Text>
          </View>
        </View>

        {/* Training Days */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Training Days</Text>
          <View style={styles.daysList}>
            {state.trainingDays.map((day, dayIndex) => (
              <View
                key={day.tempId}
                style={[styles.dayCard, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}
              >
                <View style={styles.dayHeader}>
                  <View style={[styles.dayNumber, { backgroundColor: palette.accentGlow }]}>
                    <Text style={[styles.dayNumberText, { color: palette.accent }]}>{dayIndex + 1}</Text>
                  </View>
                  <View style={styles.dayHeaderInfo}>
                    <Text style={[styles.dayName, { color: palette.text }]}>{day.name}</Text>
                    <Text style={[styles.dayMeta, { color: palette.textMuted }]}>
                      {day.exercises.length} {day.exercises.length === 1 ? 'exercise' : 'exercises'}
                    </Text>
                  </View>
                </View>

                {day.description && (
                  <Text style={[styles.dayDescription, { color: palette.textMuted }]}>{day.description}</Text>
                )}

                {day.exercises.length > 0 && (
                  <View style={[styles.exercisesList, { borderTopColor: palette.cardBorder }]}>
                    {day.exercises.map((exercise: TrainingExercise, exIndex: number) => (
                      <View
                        key={exercise.id || `exercise-${exIndex}`}
                        style={[
                          styles.exerciseRow,
                          exIndex > 0 && { borderTopWidth: 1, borderTopColor: palette.cardBorder }
                        ]}
                      >
                        <View style={[styles.exerciseNumber, { backgroundColor: palette.inputBg }]}>
                          <Text style={[styles.exerciseNumberText, { color: palette.textMuted }]}>{exIndex + 1}</Text>
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
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            {
              backgroundColor: canSave() ? palette.success : palette.cardBorder,
              shadowColor: palette.success,
            },
            !canSave() && styles.submitButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={!canSave() || isSaving}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={canSave()
              ? [palette.success, hexToRgba(palette.success, 0.85)]
              : [palette.cardBorder, palette.cardBorder]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.submitButtonGradient}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" size="small" style={{ marginRight: 14 }} />
            ) : (
              <View style={styles.submitButtonIcon}>
                <Ionicons name="checkmark" size={22} color="#FFF" />
              </View>
            )}
            <Text style={styles.submitButtonText}>
              {isSaving ? 'Saving...' : 'Save Program'}
            </Text>
            {!isSaving && <Ionicons name="checkmark-circle" size={20} color="rgba(255,255,255,0.7)" />}
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonInner: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    textAlign: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  stepLine: {
    width: 32,
    height: 2,
    borderRadius: 1,
  },

  scrollView: { flex: 1 },
  contentContainer: { padding: 20 },

  infoCard: { padding: 20, borderRadius: 20, borderWidth: 1, marginBottom: 20 },
  infoHeader: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  infoIcon: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  infoHeaderText: { flex: 1 },
  programName: { fontSize: 22, fontWeight: '700', letterSpacing: -0.5, marginBottom: 8 },
  programMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  typeBadgeText: { fontSize: 12, fontWeight: '600' },
  scheduleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  scheduleBadgeText: { fontSize: 12, fontWeight: '600' },
  description: { fontSize: 14, lineHeight: 20, marginTop: 12 },

  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: { flex: 1, padding: 20, borderRadius: 16, borderWidth: 1, alignItems: 'center' },
  statValue: { fontSize: 32, fontWeight: '800', letterSpacing: -1, marginBottom: 4 },
  statLabel: { fontSize: 13, fontWeight: '500' },

  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3, marginBottom: 14 },

  daysList: { gap: 12 },
  dayCard: { padding: 16, borderRadius: 16, borderWidth: 1 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  dayNumber: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  dayNumberText: { fontSize: 18, fontWeight: '700' },
  dayHeaderInfo: { flex: 1 },
  dayName: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  dayMeta: { fontSize: 13 },
  dayDescription: { fontSize: 13, lineHeight: 18, marginTop: 12 },

  exercisesList: { marginTop: 12, paddingTop: 12, borderTopWidth: 1 },
  exerciseRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10 },
  exerciseNumber: { width: 28, height: 28, borderRadius: 7, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  exerciseNumberText: { fontSize: 12, fontWeight: '600' },
  exerciseInfo: { flex: 1 },
  exerciseName: { fontSize: 15, fontWeight: '600', marginBottom: 6 },
  exerciseDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  detailBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  detailBadgeText: { fontSize: 11, fontWeight: '500' },
  exerciseMuscle: { fontSize: 12, fontWeight: '500', marginTop: 2 },

  submitButton: {
    marginTop: 4,
    borderRadius: 16,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  submitButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  submitButtonIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  submitButtonText: {
    flex: 1,
    color: 'white',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
});
