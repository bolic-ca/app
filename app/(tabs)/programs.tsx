import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useColorScheme, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { router } from 'expo-router';
import type { TrainingExercise, Program } from '@/types/training';
import { useThemeCustomization } from '@/contexts/ThemeContext';
import { usePrograms } from '@/hooks/usePrograms';
import { useActiveProgram } from '@/hooks/useActiveProgram';
import { muscleCategoryColors } from '@/constants/muscle-categories';

export default function ProgramsPage() {
  const colorScheme = useColorScheme();
  const { customColors } = useThemeCustomization();
  const { programs, loading, error, deleteProgram, refetch: refetchPrograms } = usePrograms();
  const { program: activeProgram, setActive, clearActive, refetch: refetchActiveProgram } = useActiveProgram();
  const [expandedProgram, setExpandedProgram] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const isDark = colorScheme === 'dark';

  // Athletic color palette
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
    success: '#22C55E',
    danger: '#EF4444',
  };

  useFocusEffect(
    useCallback(() => {
      const refetchData = async () => {
        try {
          await Promise.all([refetchPrograms(), refetchActiveProgram()]);
        } catch (err) {
          console.error('Error refetching data on focus:', err);
        }
      };
      refetchData();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const handleSetActiveProgram = async (program: Program) => {
    try {
      await setActive(program.id);
      await refetchPrograms();
      await refetchActiveProgram();
      Alert.alert('Success', `"${program.name}" is now your active program!`);
    } catch (err) {
      Alert.alert('Error', 'Failed to set active program');
      console.error('Error setting active program:', err);
    }
  };

  const handleEditProgram = (program: Program) => {
    router.push({
      pathname: '/simple-program-wizard',
      params: { editProgramId: program.id }
    });
  };

  const handleDeleteProgram = async (program: Program) => {
    Alert.alert(
      'Delete Program',
      `Are you sure you want to delete "${program.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (activeProgram?.id === program.id) {
                await clearActive();
              }
              await deleteProgram(program.id);
              await refetchPrograms();
              await refetchActiveProgram();
            } catch (err) {
              Alert.alert('Error', 'Failed to delete program');
              console.error('Error deleting program:', err);
            }
          },
        },
      ]
    );
  };

  const renderProgramCard = (program: Program, isActive: boolean = false) => {
    const isExpanded = expandedProgram === program.id;

    return (
      <TouchableOpacity
        key={program.id}
        style={[
          styles.programCard,
          { backgroundColor: palette.cardBg, borderColor: isActive ? palette.accent : palette.cardBorder },
          isActive && { borderWidth: 2 },
        ]}
        onPress={() => setExpandedProgram(isExpanded ? null : program.id)}
        activeOpacity={0.8}
      >
        <View style={styles.programHeader}>
          <View style={[styles.programIconContainer, { backgroundColor: palette.accentGlow }]}>
            <Ionicons name="repeat" size={24} color={palette.accent} />
          </View>
          <View style={styles.programInfo}>
            <View style={styles.programTitleRow}>
              <Text style={[styles.programName, { color: palette.text }]} numberOfLines={1}>
                {program.name}
              </Text>
              {isActive && (
                <View style={[styles.activeBadge, { backgroundColor: palette.accent }]}>
                  <Text style={styles.activeBadgeText}>Active</Text>
                </View>
              )}
            </View>
            <View style={styles.programMeta}>
              <Text style={[styles.programDays, { color: palette.textMuted }]}>
                {program.trainingDays?.length || 0} days
              </Text>
            </View>
          </View>
          <View style={styles.programActions}>
            {!isActive && (
              <TouchableOpacity
                onPress={(e) => { e.stopPropagation(); handleSetActiveProgram(program); }}
                style={[styles.actionButton, { backgroundColor: palette.accentGlow }]}
              >
                <Ionicons name="play" size={18} color={palette.accent} />
              </TouchableOpacity>
            )}
            <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={palette.textMuted} />
          </View>
        </View>

        {isExpanded && (
          <View style={[styles.expandedContent, { borderTopColor: palette.cardBorder }]}>
            {/* Action Buttons */}
            <View style={styles.expandedActions}>
              <TouchableOpacity
                onPress={(e) => { e.stopPropagation(); handleEditProgram(program); }}
                style={[styles.expandedActionButton, { backgroundColor: isDark ? 'rgba(100, 116, 139, 0.15)' : 'rgba(100, 116, 139, 0.1)' }]}
              >
                <Ionicons name="create-outline" size={18} color={palette.textMuted} />
                <Text style={[styles.expandedActionText, { color: palette.textMuted }]}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={(e) => { e.stopPropagation(); handleDeleteProgram(program); }}
                style={[styles.expandedActionButton, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}
              >
                <Ionicons name="trash-outline" size={18} color={palette.danger} />
                <Text style={[styles.expandedActionText, { color: palette.danger }]}>Delete</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.trainingDaysList}>
              {program.trainingDays?.map((day, index) => {
                const isDayExpanded = expandedDay === day.id;
                return (
                  <TouchableOpacity
                    key={day.id}
                    style={[styles.dayCard, { backgroundColor: isDark ? '#1F1F23' : '#F9F9F8' }]}
                    onPress={() => setExpandedDay(isDayExpanded ? null : day.id!)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.dayHeader}>
                      <Text style={[styles.dayNumber, { color: palette.textMuted }]}>Day {index + 1}</Text>
                      <View style={styles.dayHeaderRight}>
                        <Text style={[styles.dayExercises, { color: palette.textMuted }]}>
                          {day.exercises?.length || 0} exercises
                        </Text>
                        <Ionicons
                          name={isDayExpanded ? 'chevron-up' : 'chevron-down'}
                          size={16}
                          color={palette.textMuted}
                        />
                      </View>
                    </View>
                    <Text style={[styles.dayName, { color: palette.text }]}>{day.name}</Text>

                    {isDayExpanded && day.exercises && day.exercises.length > 0 && (
                      <View style={[styles.dayExercisesList, { borderTopColor: palette.cardBorder }]}>
                        {day.exercises.map((exercise: TrainingExercise, exIndex: number) => (
                          <View
                            key={exercise.id || exIndex}
                            style={[
                              styles.dayExerciseRow,
                              exIndex > 0 && { borderTopWidth: 1, borderTopColor: palette.cardBorder }
                            ]}
                          >
                            <View style={[styles.dayExerciseNumber, { backgroundColor: isDark ? '#2A2A2E' : '#EFEFED' }]}>
                              <Text style={[styles.dayExerciseNumberText, { color: palette.textMuted }]}>{exIndex + 1}</Text>
                            </View>
                            <View style={styles.dayExerciseContent}>
                              <Text style={[styles.dayExerciseName, { color: palette.text }]} numberOfLines={1}>
                                {exercise.name}
                              </Text>
                              <View style={styles.dayExerciseDetails}>
                                {exercise.targetNumberOfSets && (
                                  <View style={[styles.detailBadge, { backgroundColor: isDark ? '#2A2A2E' : '#EFEFED' }]}>
                                    <Text style={[styles.detailBadgeText, { color: palette.textMuted }]}>
                                      {exercise.targetNumberOfSets} sets
                                    </Text>
                                  </View>
                                )}
                                {exercise.targetRepetitions && (
                                  <View style={[styles.detailBadge, { backgroundColor: isDark ? '#2A2A2E' : '#EFEFED' }]}>
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
                              <View style={styles.dayExerciseMeta}>
                                {exercise.muscleCategory && (
                                  <Text style={[styles.dayExerciseMuscle, { color: muscleCategoryColors[exercise.muscleCategory] || palette.textMuted }]}>
                                    {exercise.muscleCategory}
                                    {exercise.muscleSubcategory ? ` · ${exercise.muscleSubcategory}` : ''}
                                  </Text>
                                )}
                                {exercise.equipment && (
                                  <Text style={[styles.dayExerciseEquipment, { color: palette.textMuted }]}>
                                    {exercise.equipment}
                                  </Text>
                                )}
                              </View>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerLabel, { color: palette.textMuted }]}>TRAINING</Text>
          <Text style={[styles.headerTitle, { color: palette.text }]}>Programs</Text>
        </View>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={palette.accent} />
          </View>
        )}

        {error && (
          <View style={[styles.errorCard, { backgroundColor: palette.cardBg, borderColor: palette.danger }]}>
            <Ionicons name="alert-circle" size={32} color={palette.danger} />
            <Text style={[styles.errorText, { color: palette.text }]}>{error.message}</Text>
          </View>
        )}

        {/* Active Program */}
        {!loading && !error && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionBadge, { backgroundColor: palette.accentGlow }]}>
                <Text style={[styles.sectionBadgeText, { color: palette.accent }]}>ACTIVE PROGRAM</Text>
              </View>
            </View>

            {activeProgram ? (
              renderProgramCard(activeProgram, true)
            ) : (
              <View style={[styles.emptyCard, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
                <View style={[styles.emptyIconContainer, { backgroundColor: isDark ? '#1F1F23' : '#F4F4F5' }]}>
                  <Ionicons name="calendar-outline" size={32} color={palette.textMuted} />
                </View>
                <Text style={[styles.emptyTitle, { color: palette.text }]}>No Active Program</Text>
                <Text style={[styles.emptyDescription, { color: palette.textMuted }]}>
                  Select a program below to get started
                </Text>
              </View>
            )}
          </View>
        )}

        {/* All Programs */}
        {!loading && !error && programs.filter(p => p.id !== activeProgram?.id).length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>All Programs</Text>
            </View>
            {programs.filter(p => p.id !== activeProgram?.id).map((program) => renderProgramCard(program))}
          </View>
        )}

        {/* Create Program */}
        {!loading && !error && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Create Program</Text>
            </View>

            <TouchableOpacity
              style={[styles.createProgramButton, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}
              onPress={() => router.push('/simple-program-wizard')}
              activeOpacity={0.8}
            >
              <View style={[styles.createProgramIcon, { backgroundColor: palette.accentGlow }]}>
                <Ionicons name="repeat" size={28} color={palette.accent} />
              </View>
              <View style={styles.createProgramInfo}>
                <Text style={[styles.createProgramTitle, { color: palette.text }]}>New Program</Text>
                <Text style={[styles.createProgramDescription, { color: palette.textMuted }]}>
                  Create a rotating schedule with training days
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={palette.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  contentContainer: { paddingHorizontal: 20, paddingBottom: 155 },

  // Header
  header: { paddingTop: 8, paddingBottom: 24 },
  headerLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 1.2, marginBottom: 4 },
  headerTitle: { fontSize: 32, fontWeight: '800', letterSpacing: -1 },

  // Section
  section: { marginBottom: 28 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sectionBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  sectionBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  sectionTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 14, marginBottom: 16, marginTop: -4 },

  // Loading & Error
  loadingContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  errorCard: { borderRadius: 16, borderWidth: 1, padding: 24, alignItems: 'center', gap: 12 },
  errorText: { fontSize: 15, textAlign: 'center' },

  // Empty State
  emptyCard: { borderRadius: 20, borderWidth: 1, padding: 32, alignItems: 'center' },
  emptyIconContainer: { width: 72, height: 72, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3, marginBottom: 6 },
  emptyDescription: { fontSize: 14, textAlign: 'center' },

  // Program Card
  programCard: { borderRadius: 20, borderWidth: 1, padding: 16, marginBottom: 12 },
  programHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  programIconContainer: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  programInfo: { flex: 1 },
  programTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  programName: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3, flex: 1 },
  activeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  activeBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  programMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  typeBadgeText: { fontSize: 11, fontWeight: '600' },
  programDays: { fontSize: 13 },
  programActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionButton: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },

  // Expanded Content
  expandedContent: { marginTop: 16, paddingTop: 16, borderTopWidth: 1 },
  expandedActions: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  expandedActionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10 },
  expandedActionText: { fontSize: 14, fontWeight: '600' },
  trainingDaysList: { gap: 8 },
  dayCard: { padding: 14, borderRadius: 12 },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  dayNumber: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  dayExercises: { fontSize: 11 },
  dayName: { fontSize: 15, fontWeight: '600' },
  dayHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  // Expanded Day Exercises
  dayExercisesList: { marginTop: 12, paddingTop: 12, borderTopWidth: 1 },
  dayExerciseRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10 },
  dayExerciseNumber: { width: 24, height: 24, borderRadius: 6, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  dayExerciseNumberText: { fontSize: 11, fontWeight: '600' },
  dayExerciseContent: { flex: 1 },
  dayExerciseName: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  dayExerciseDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  detailBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  detailBadgeText: { fontSize: 11, fontWeight: '500' },
  dayExerciseMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  dayExerciseMuscle: { fontSize: 11, fontWeight: '500' },
  dayExerciseEquipment: { fontSize: 11 },

  // Create Program
  createProgramButton: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, padding: 16, gap: 14 },
  createProgramIcon: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  createProgramInfo: { flex: 1 },
  createProgramTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  createProgramDescription: { fontSize: 13, lineHeight: 18 },

});
