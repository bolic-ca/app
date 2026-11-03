import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useColorScheme, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSimpleProgramWizard } from '@/contexts/SimpleProgramWizardContext';
import { useThemeCustomization } from '@/contexts/ThemeContext';

export default function TrainingDaysScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { customColors } = useThemeCustomization();
  const { state, addTrainingDay, deleteTrainingDay, duplicateTrainingDay, setCurrentDay } = useSimpleProgramWizard();

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
    danger: '#EF4444',
  };

  const handleEditDay = (index: number) => {
    setCurrentDay(index);
    router.push('/simple-program-wizard/day-editor');
  };

  const handleDeleteDay = (index: number) => {
    Alert.alert(
      'Delete Training Day',
      `Are you sure you want to delete "${state.trainingDays[index].name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteTrainingDay(index),
        },
      ]
    );
  };

  const handleNext = () => {
    if (state.trainingDays.length === 0) {
      Alert.alert('Add Training Days', 'Please add at least one training day to continue.');
      return;
    }
    router.push('/simple-program-wizard/preview');
  };

  const hasTrainingDays = state.trainingDays.length > 0;

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
          <Text style={[styles.headerLabel, { color: palette.textMuted }]}>STEP 2</Text>
          <Text style={[styles.headerTitle, { color: palette.text }]}>Training Days</Text>
        </View>
        <View style={styles.backButton} />
      </View>

      {/* Step Indicator */}
      <View style={styles.stepIndicator}>
        <View style={[styles.stepDot, { backgroundColor: palette.accent }]} />
        <View style={[styles.stepLine, { backgroundColor: palette.accent }]} />
        <View style={[styles.stepDot, { backgroundColor: palette.accent }]} />
        <View style={[styles.stepLine, { backgroundColor: palette.cardBorder }]} />
        <View style={[styles.stepDot, { backgroundColor: palette.cardBorder }]} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {/* Training Days List */}
        {state.trainingDays.map((day, index) => (
          <View
            key={day.tempId}
            style={[styles.dayCard, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}
          >
            <View style={styles.dayHeader}>
              <View style={[styles.dayNumber, { backgroundColor: palette.accentGlow }]}>
                <Text style={[styles.dayNumberText, { color: palette.accent }]}>{index + 1}</Text>
              </View>
              <View style={styles.dayInfo}>
                <Text style={[styles.dayName, { color: palette.text }]} numberOfLines={1}>
                  {day.name}
                </Text>
                <Text style={[styles.dayMeta, { color: palette.textMuted }]}>
                  {day.exercises.length} {day.exercises.length === 1 ? 'exercise' : 'exercises'}
                </Text>
              </View>
              <View style={styles.dayActions}>
                <TouchableOpacity
                  onPress={() => duplicateTrainingDay(index)}
                  style={[styles.actionButton, { backgroundColor: isDark ? 'rgba(100, 116, 139, 0.15)' : 'rgba(100, 116, 139, 0.1)' }]}
                >
                  <Ionicons name="copy-outline" size={18} color={palette.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeleteDay(index)}
                  style={[styles.actionButton, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}
                >
                  <Ionicons name="trash-outline" size={18} color={palette.danger} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleEditDay(index)}
                  style={[styles.editButton, { backgroundColor: palette.accent }]}
                >
                  <Text style={styles.editButtonText}>Edit</Text>
                  <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}

        {/* Add Training Day Button */}
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: palette.cardBg, borderColor: palette.accent }]}
          onPress={addTrainingDay}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle" size={24} color={palette.accent} />
          <Text style={[styles.addButtonText, { color: palette.accent }]}>Add Training Day</Text>
        </TouchableOpacity>

        {/* Next Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            {
              backgroundColor: hasTrainingDays ? palette.accent : palette.cardBorder,
              shadowColor: palette.accent,
            },
            !hasTrainingDays && styles.submitButtonDisabled,
          ]}
          onPress={handleNext}
          disabled={!hasTrainingDays}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={hasTrainingDays
              ? [palette.accent, hexToRgba(palette.accent, 0.85)]
              : [palette.cardBorder, palette.cardBorder]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.submitButtonGradient}
          >
            <View style={styles.submitButtonIcon}>
              <Ionicons name="eye-outline" size={22} color="#FFF" />
            </View>
            <Text style={styles.submitButtonText}>Preview & Save</Text>
            <Ionicons name="arrow-forward" size={20} color="rgba(255,255,255,0.7)" />
          </LinearGradient>
        </TouchableOpacity>
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
  contentContainer: { padding: 20, paddingBottom: 100 },

  dayCard: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dayNumber: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  dayNumberText: { fontSize: 15, fontWeight: '700' },
  dayInfo: { flex: 1 },
  dayName: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  dayMeta: { fontSize: 13 },
  dayActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionButton: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  editButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  editButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },

  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    gap: 10,
    marginBottom: 20,
  },
  addButtonText: { fontSize: 16, fontWeight: '600' },

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
