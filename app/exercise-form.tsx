import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { MuscleCategory } from '@/types/training';
import { useThemeCustomization } from '@/contexts/ThemeContext';
import { useStorage } from '@/contexts/StorageContext';
import { useExercises } from '@/hooks/useExercises';
import { usePrograms } from '@/hooks/usePrograms';

const muscleCategoryOptions = Object.values(MuscleCategory);

const muscleSubcategories: Record<string, string[]> = {
  Chest: ['Upper', 'Middle', 'Lower'],
  Delts: ['Front', 'Lateral', 'Rear'],
  Back: ['Lats', 'Mid Back', 'Upper Traps', 'Lower Back'],
  Arms: ['Biceps', 'Triceps', 'Forearms'],
  Legs: ['Quads', 'Hamstrings', 'Glutes', 'Calves', 'Adductors'],
  Core: ['Abs', 'Obliques'],
};

const targetPositions = ['Lengthened', 'Shortened', 'Neutral'];

export default function ExerciseFormScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { customColors } = useThemeCustomization();

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
  };
  const { userId } = useStorage();
  const { createExercise, updateExercise, allExercises, loading: exercisesLoading } = useExercises();
  const { programs, updateProgram } = usePrograms();
  const params = useLocalSearchParams<{ trainingDayId?: string; programId?: string; exerciseId?: string }>();

  const isEditMode = !!params.exerciseId;

  // Form state
  const [name, setName] = useState('');
  const [muscleCategory, setMuscleCategory] = useState<MuscleCategory | ''>('');
  const [muscleSubcategory, setMuscleSubcategory] = useState('');
  const [equipment, setEquipment] = useState('');
  const [targetRepetitions, setTargetRepetitions] = useState('');
  const [targetRIR, setTargetRIR] = useState('');
  const [targetPosition, setTargetPosition] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  // Show/hide pickers
  const [showMusclePicker, setShowMusclePicker] = useState(false);
  const [showSubcategoryPicker, setShowSubcategoryPicker] = useState(false);
  const [showPositionPicker, setShowPositionPicker] = useState(false);

  const availableSubcategories = muscleCategory && muscleSubcategories[muscleCategory] || [];

  // Fill the form once the exercise library has the record being edited.
  const existingExercise = isEditMode && params.exerciseId && !exercisesLoading
    ? allExercises.find(ex => ex.id === params.exerciseId)
    : undefined;
  const [loadedExerciseId, setLoadedExerciseId] = useState<string | null>(null);
  if (existingExercise?.id && loadedExerciseId !== existingExercise.id) {
    setLoadedExerciseId(existingExercise.id);
    setName(existingExercise.name || '');
    setMuscleCategory(existingExercise.muscleCategory || '');
    setMuscleSubcategory(existingExercise.muscleSubcategory || '');
    setEquipment(existingExercise.equipment || '');
    setTargetRepetitions(existingExercise.targetRepetitions || '');
    setTargetRIR(existingExercise.targetRepetitionsInReserve || '');
    setTargetPosition(existingExercise.targetPosition || '');
    setNotes(existingExercise.notes || '');
  }

  const handleSubmit = async () => {
    // Validation
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter an exercise name');
      return;
    }

    if (!muscleCategory) {
      Alert.alert('Error', 'Please select a muscle category');
      return;
    }

    if (!userId) {
      Alert.alert('Error', 'User not initialized');
      return;
    }

    setLoading(true);

    try {
      if (isEditMode && params.exerciseId) {
        // Update existing exercise
        const existingExercise = allExercises.find(ex => ex.id === params.exerciseId);
        await updateExercise({
          id: params.exerciseId,
          userId,
          trainingDayIds: existingExercise?.trainingDayIds || [],
          name: name.trim(),
          muscleCategory,
          muscleSubcategory: muscleSubcategory || null,
          equipment: equipment.trim() || null,
          targetRepetitions: targetRepetitions.trim() || null,
          targetRepetitionsInReserve: targetRIR.trim() || null,
          targetPosition: targetPosition || null,
          notes: notes.trim() || null,
          sets: existingExercise?.sets || [],
        });

        Alert.alert('Success', 'Exercise updated', [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]);
        return;
      }

      // Create the exercise in exercise storage
      const trainingDayIds = params.trainingDayId ? [params.trainingDayId] : [];
      const newExercise = await createExercise({
        userId,
        trainingDayIds,
        name: name.trim(),
        muscleCategory,
        muscleSubcategory: muscleSubcategory || null,
        equipment: equipment.trim() || null,
        targetRepetitions: targetRepetitions.trim() || null,
        targetRepetitionsInReserve: targetRIR.trim() || null,
        targetPosition: targetPosition || null,
        notes: notes.trim() || null,
        sets: [],
      });

      // If trainingDayId and programId are provided, add exercise to the program
      if (params.trainingDayId && params.programId) {
        // Find the program and update it with the new exercise
        const program = programs.find(p => p.id === params.programId);
        if (!program) {
          Alert.alert('Warning', 'Exercise created but could not add to program - program not found');
          router.back();
          return;
        }

        // Deep clone the program to avoid mutation
        const updatedProgram = JSON.parse(JSON.stringify(program));

        // Find and update the training day with the new exercise
        let trainingDayFound = false;

        if (updatedProgram.type === 'simple' && updatedProgram.trainingDays) {
          const dayIndex = updatedProgram.trainingDays.findIndex((d: any) => d.id === params.trainingDayId);
          if (dayIndex !== -1) {
            if (!updatedProgram.trainingDays[dayIndex].exercises) {
              updatedProgram.trainingDays[dayIndex].exercises = [];
            }
            updatedProgram.trainingDays[dayIndex].exercises.push(newExercise);
            trainingDayFound = true;
          }
        } else if (updatedProgram.type === 'periodized' && updatedProgram.mesocycles) {
          for (const meso of updatedProgram.mesocycles) {
            if (meso.microcycles) {
              for (const micro of meso.microcycles) {
                if (micro.trainingDays) {
                  const dayIndex = micro.trainingDays.findIndex((d: any) => d.id === params.trainingDayId);
                  if (dayIndex !== -1) {
                    if (!micro.trainingDays[dayIndex].exercises) {
                      micro.trainingDays[dayIndex].exercises = [];
                    }
                    micro.trainingDays[dayIndex].exercises.push(newExercise);
                    trainingDayFound = true;
                    break;
                  }
                }
              }
            }
            if (trainingDayFound) break;
          }
        }

        if (!trainingDayFound) {
          Alert.alert('Warning', 'Exercise created but could not add to training day - day not found');
          router.back();
          return;
        }

        // Save the updated program
        await updateProgram(updatedProgram);

        Alert.alert('Success', 'Exercise added to training day', [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]);
      } else {
        // Exercise created as standalone (not attached to a program)
        Alert.alert('Success', 'Exercise added to library', [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]);
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create exercise');
    } finally {
      setLoading(false);
    }
  };

  // Show loading state when loading exercise data in edit mode
  if (isEditMode && exercisesLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: palette.cardBorder }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
            <View style={[styles.closeButtonInner, { backgroundColor: isDark ? '#1F1F23' : '#F4F4F5' }]}>
              <Ionicons name="close" size={22} color={palette.text} />
            </View>
          </TouchableOpacity>
          <View>
            <Text style={[styles.headerLabel, { color: palette.textMuted }]}>EDIT</Text>
            <Text style={[styles.headerTitle, { color: palette.text }]}>Edit Exercise</Text>
          </View>
          <View style={styles.closeButton} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={palette.accent} />
          <Text style={[styles.loadingText, { color: palette.textMuted }]}>Loading exercise...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: palette.cardBorder }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <View style={[styles.closeButtonInner, { backgroundColor: isDark ? '#1F1F23' : '#F4F4F5' }]}>
            <Ionicons name="close" size={22} color={palette.text} />
          </View>
        </TouchableOpacity>
        <View>
          <Text style={[styles.headerLabel, { color: palette.textMuted }]}>{isEditMode ? 'EDIT' : 'CREATE'}</Text>
          <Text style={[styles.headerTitle, { color: palette.text }]}>{isEditMode ? 'Edit Exercise' : 'New Exercise'}</Text>
        </View>
        <View style={styles.closeButton} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {/* Exercise Name */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: palette.text }]}>Exercise Name *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: palette.cardBg, color: palette.text, borderColor: palette.cardBorder }]}
            placeholder="e.g., Barbell Bench Press"
            placeholderTextColor={palette.textMuted}
            value={name}
            onChangeText={setName}
          />
        </View>

        {/* Muscle Category */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: palette.text }]}>Muscle Category *</Text>
          <TouchableOpacity
            style={[styles.picker, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}
            onPress={() => setShowMusclePicker(!showMusclePicker)}
            activeOpacity={0.8}
          >
            <Text style={[styles.pickerText, { color: muscleCategory ? palette.text : palette.textMuted }]}>
              {muscleCategory || 'Select muscle category'}
            </Text>
            <Ionicons name={showMusclePicker ? 'chevron-up' : 'chevron-down'} size={20} color={palette.textMuted} />
          </TouchableOpacity>
          {showMusclePicker && (
            <View style={[styles.pickerOptions, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
              {muscleCategoryOptions.map((option, index) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.pickerOption,
                    index < muscleCategoryOptions.length - 1 && { borderBottomWidth: 1, borderBottomColor: palette.cardBorder },
                  ]}
                  onPress={() => {
                    setMuscleCategory(option);
                    setMuscleSubcategory('');
                    setShowMusclePicker(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.pickerOptionText, { color: palette.text }]}>{option}</Text>
                  {muscleCategory === option && <Ionicons name="checkmark" size={18} color={palette.accent} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Muscle Subcategory */}
        {availableSubcategories.length > 0 && (
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: palette.text }]}>Muscle Subcategory</Text>
            <TouchableOpacity
              style={[styles.picker, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}
              onPress={() => setShowSubcategoryPicker(!showSubcategoryPicker)}
              activeOpacity={0.8}
            >
              <Text style={[styles.pickerText, { color: muscleSubcategory ? palette.text : palette.textMuted }]}>
                {muscleSubcategory || 'Select subcategory (optional)'}
              </Text>
              <Ionicons name={showSubcategoryPicker ? 'chevron-up' : 'chevron-down'} size={20} color={palette.textMuted} />
            </TouchableOpacity>
            {showSubcategoryPicker && (
              <View style={[styles.pickerOptions, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
                {availableSubcategories.map((option, index) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.pickerOption,
                      index < availableSubcategories.length - 1 && { borderBottomWidth: 1, borderBottomColor: palette.cardBorder },
                    ]}
                    onPress={() => {
                      setMuscleSubcategory(option);
                      setShowSubcategoryPicker(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.pickerOptionText, { color: palette.text }]}>{option}</Text>
                    {muscleSubcategory === option && <Ionicons name="checkmark" size={18} color={palette.accent} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Equipment */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: palette.text }]}>Equipment</Text>
          <TextInput
            style={[styles.input, { backgroundColor: palette.cardBg, color: palette.text, borderColor: palette.cardBorder }]}
            placeholder="e.g., Barbell, Dumbbells, Cable"
            placeholderTextColor={palette.textMuted}
            value={equipment}
            onChangeText={setEquipment}
          />
        </View>

        {/* Target Repetitions */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: palette.text }]}>Target Repetitions</Text>
          <TextInput
            style={[styles.input, { backgroundColor: palette.cardBg, color: palette.text, borderColor: palette.cardBorder }]}
            placeholder="e.g., 8-12, 15-20"
            placeholderTextColor={palette.textMuted}
            value={targetRepetitions}
            onChangeText={setTargetRepetitions}
          />
        </View>

        {/* Target RIR */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: palette.text }]}>Target RIR (Reps In Reserve)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: palette.cardBg, color: palette.text, borderColor: palette.cardBorder }]}
            placeholder="e.g., 2-3, 1-2"
            placeholderTextColor={palette.textMuted}
            value={targetRIR}
            onChangeText={setTargetRIR}
          />
        </View>

        {/* Target Position */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: palette.text }]}>Target Position</Text>
          <TouchableOpacity
            style={[styles.picker, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}
            onPress={() => setShowPositionPicker(!showPositionPicker)}
            activeOpacity={0.8}
          >
            <Text style={[styles.pickerText, { color: targetPosition ? palette.text : palette.textMuted }]}>
              {targetPosition || 'Select position (optional)'}
            </Text>
            <Ionicons name={showPositionPicker ? 'chevron-up' : 'chevron-down'} size={20} color={palette.textMuted} />
          </TouchableOpacity>
          {showPositionPicker && (
            <View style={[styles.pickerOptions, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
              {targetPositions.map((option, index) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.pickerOption,
                    index < targetPositions.length - 1 && { borderBottomWidth: 1, borderBottomColor: palette.cardBorder },
                  ]}
                  onPress={() => {
                    setTargetPosition(option);
                    setShowPositionPicker(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.pickerOptionText, { color: palette.text }]}>{option}</Text>
                  {targetPosition === option && <Ionicons name="checkmark" size={18} color={palette.accent} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Notes */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: palette.text }]}>Notes</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: palette.cardBg, color: palette.text, borderColor: palette.cardBorder }]}
            placeholder="Additional notes or instructions"
            placeholderTextColor={palette.textMuted}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, { shadowColor: palette.accent }]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={[palette.accent, hexToRgba(palette.accent, 0.85)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.submitButtonGradient}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <View style={styles.submitButtonIcon}>
                  <Ionicons name="checkmark" size={22} color="#FFF" />
                </View>
                <Text style={styles.submitButtonText}>{isEditMode ? 'Update Exercise' : 'Create Exercise'}</Text>
                <Ionicons name="arrow-forward" size={20} color="rgba(255,255,255,0.7)" />
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonInner: {
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
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    minHeight: 100,
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  pickerText: {
    fontSize: 16,
  },
  pickerOptions: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  pickerOptionText: {
    fontSize: 16,
  },
  submitButton: {
    marginTop: 24,
    borderRadius: 16,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
});
