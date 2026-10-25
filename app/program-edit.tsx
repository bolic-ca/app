import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { usePrograms } from '@/hooks/usePrograms';
import { useThemeCustomization } from '@/contexts/ThemeContext';
import type { Program, TrainingDay } from '@/types/training';

export default function ProgramEditScreen() {
  const colorScheme = useColorScheme();
  const { customColors } = useThemeCustomization();
  const { programId } = useLocalSearchParams<{ programId: string }>();
  const { programs, updateProgram, loading: programsLoading } = usePrograms();

  const foundProgram: Program | null =
    programs.find((p: Program) => p.id === programId) ?? null;
  const [initializedId, setInitializedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  if (foundProgram && initializedId !== foundProgram.id) {
    setInitializedId(foundProgram.id);
    setName(foundProgram.name);
    setDescription(foundProgram.description || '');
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
  };

  const handleSave = async () => {
    if (!foundProgram || !name.trim()) {
      Alert.alert('Error', 'Program name is required');
      return;
    }

    try {
      setSaving(true);
      const updatedProgram: Program = {
        ...foundProgram,
        name: name.trim(),
        description: description.trim(),
        lastModified: new Date().toISOString(),
      };
      await updateProgram(updatedProgram);
      Alert.alert('Success', 'Program updated successfully');
      router.back();
    } catch (err) {
      Alert.alert('Error', 'Failed to update program');
      console.error('Error updating program:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleEditTrainingDay = (day: TrainingDay) => {
    router.push({
      pathname: '/training-day-detail',
      params: {
        programId: foundProgram?.id,
        trainingDayId: day.id,
        mode: 'edit'
      }
    });
  };

  if (programsLoading && !foundProgram) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={palette.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!foundProgram) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]} edges={['top']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={palette.textMuted} />
          <Text style={[styles.errorText, { color: palette.text }]}>Program not found</Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: palette.accent }]}
            onPress={() => router.back()}
          >
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: palette.cardBorder }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: palette.text }]}>Edit Program</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={[styles.saveButton, { backgroundColor: palette.accent }]}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Basic Info Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Basic Information</Text>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: palette.textMuted }]}>Program Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: palette.inputBg, color: palette.text, borderColor: palette.cardBorder }]}
              value={name}
              onChangeText={setName}
              placeholder="Enter program name"
              placeholderTextColor={palette.textMuted}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: palette.textMuted }]}>Description</Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: palette.inputBg, color: palette.text, borderColor: palette.cardBorder }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Enter program description (optional)"
              placeholderTextColor={palette.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* Training Days Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Training Days</Text>
          <Text style={[styles.sectionSubtitle, { color: palette.textMuted }]}>
            {foundProgram.trainingDays?.length || 0} training days
          </Text>

          {foundProgram.trainingDays && foundProgram.trainingDays.length > 0 ? (
            <View style={styles.daysList}>
              {foundProgram.trainingDays.map((day, index) => (
                <TouchableOpacity
                  key={day.id}
                  style={[styles.dayCard, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}
                  onPress={() => handleEditTrainingDay(day)}
                  activeOpacity={0.7}
                >
                  <View style={styles.dayHeader}>
                    <View style={[styles.dayNumber, { backgroundColor: palette.accentGlow }]}>
                      <Text style={[styles.dayNumberText, { color: palette.accent }]}>{index + 1}</Text>
                    </View>
                    <View style={styles.dayInfo}>
                      <Text style={[styles.dayName, { color: palette.text }]}>{day.name}</Text>
                      <Text style={[styles.dayMeta, { color: palette.textMuted }]}>
                        {day.exercises?.length || 0} exercises
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={palette.textMuted} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={[styles.emptyState, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
              <Ionicons name="barbell-outline" size={32} color={palette.textMuted} />
              <Text style={[styles.emptyText, { color: palette.textMuted }]}>No training days</Text>
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  saveButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 70,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    minHeight: 100,
  },
  daysList: {
    gap: 10,
  },
  dayCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dayNumber: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayNumberText: {
    fontSize: 16,
    fontWeight: '700',
  },
  dayInfo: {
    flex: 1,
  },
  dayName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  dayMeta: {
    fontSize: 13,
  },
  emptyState: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
