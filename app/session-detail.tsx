import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeCustomization } from '@/contexts/ThemeContext';
import { useStorage } from '@/contexts/StorageContext';
import {
  WorkoutSession,
  SessionExercise,
  SessionSet,
  saveSession,
  deleteSession,
  formatRirShort,
} from '@/services/storage/session-storage';
import { displayWeight, toStorageUnit } from '@/utils/weight';

export default function SessionDetailModal() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { customColors, preferences } = useThemeCustomization();
  const { userId } = useStorage();
  const params = useLocalSearchParams();

  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedNotes, setEditedNotes] = useState('');
  const [editedExercises, setEditedExercises] = useState<SessionExercise[]>([]);

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

  // Parse the session data from params
  const session: WorkoutSession | null = useMemo(() => {
    if (params.session) {
      try {
        return JSON.parse(params.session as string);
      } catch {
        return null;
      }
    }
    return null;
  }, [params.session]);

  // Copy session fields into editable state when a different session is opened.
  const [initializedSessionId, setInitializedSessionId] = useState<string | null>(null);
  if (session && initializedSessionId !== session.id) {
    setInitializedSessionId(session.id);
    setEditedName(session.name || '');
    setEditedNotes(session.notes || '');
    // Deep copy to ensure we don't mutate original state directly
    setEditedExercises(JSON.parse(JSON.stringify(session.exercises)));
  }

  const handleSetChange = (exerciseId: string, setIndex: number, field: keyof SessionSet, value: string) => {
    const updatedExercises = editedExercises.map(ex => {
      if (ex.exerciseId !== exerciseId) return ex;

      const updatedSets = ex.sets.map((set, idx) => {
        if (idx !== setIndex) return set;

        // Special handling for RIR field (can be number, 'F', or 'P')
        if (field === 'rir') {
          const upperValue = value.toUpperCase();
          if (upperValue === 'F' || upperValue === 'P') {
            return { ...set, rir: upperValue as 'F' | 'P' };
          }
          if (value === '') {
            return { ...set, rir: undefined };
          }
          const numValue = parseInt(value, 10);
          if (!isNaN(numValue) && numValue >= 0) {
            return { ...set, rir: numValue };
          }
          return set; // Invalid input, don't change
        }

        // Handle string fields (notes)
        if (field === 'notes') {
          return { ...set, notes: value === '' ? undefined : value };
        }

        // Handle numeric conversion for other fields
        const numValue = parseFloat(value);
        if (isNaN(numValue) && value !== '') return set; // Prevent non-numeric inputs

        // For required fields (weight, reps), fallback to 0 if empty
        // For optional fields (rpe, quality), allow undefined if empty
        let newValue: number | undefined = numValue;
        if (value === '') {
          if (field === 'weight' || field === 'reps') {
            newValue = 0;
          } else {
            newValue = undefined;
          }
        }

        // Convert weight from display unit to storage unit (kg)
        if (field === 'weight' && newValue !== undefined) {
          newValue = toStorageUnit(newValue, preferences.weightUnit);
        }

        return {
          ...set,
          [field]: newValue
        };
      });

      return { ...ex, sets: updatedSets };
    });

    setEditedExercises(updatedExercises);
  };

  const handleSave = async () => {
    if (!session || !userId) return;

    try {
      const updatedSession: WorkoutSession = {
        ...session,
        name: editedName,
        notes: editedNotes,
        exercises: editedExercises,
      };

      await saveSession(userId, updatedSession, session.id);
      setIsEditing(false);
      
      Alert.alert('Success', 'Session updated');
      router.back();

    } catch {
      Alert.alert('Error', 'Failed to save changes');
    }
  };

  const handleDelete = async () => {
    if (!session || !userId) return;

    Alert.alert(
      'Delete Session',
      'Are you sure you want to delete this session? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (session.startedAt) {
                await deleteSession(userId, session.id, session.startedAt);
                router.back();
              }
            } catch {
              Alert.alert('Error', 'Failed to delete session');
            }
          },
        },
      ]
    );
  };

  // Calculate session duration
  const duration = useMemo(() => {
    if (!session?.startedAt || !session?.completedAt) return null;
    const start = new Date(session.startedAt);
    const end = new Date(session.completedAt);
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) {
      return `${diffMins} min`;
    }
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m`;
  }, [session]);

  // Calculate total volume (using edited values if editing)
  const displayExercises = useMemo(() => {
    return isEditing ? editedExercises : (session?.exercises || []);
  }, [isEditing, editedExercises, session?.exercises]);

  const totalVolume = useMemo(() => {
    if (!displayExercises) return 0;
    return displayExercises.reduce((total, exercise) => {
      return total + exercise.sets.reduce((setTotal, set) => {
        return setTotal + (set.weight * set.reps);
      }, 0);
    }, 0);
  }, [displayExercises]);

  // Calculate total sets
  const totalSets = useMemo(() => {
    if (!displayExercises) return 0;
    return displayExercises.reduce((total, exercise) => total + exercise.sets.length, 0);
  }, [displayExercises]);

  // Format date
  const formattedDate = useMemo(() => {
    if (!session?.completedAt) return 'In progress';
    const date = new Date(session.completedAt);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [session]);

  // Format time
  const formattedTime = useMemo(() => {
    if (!session?.startedAt) return '';
    const start = new Date(session.startedAt);
    const end = session.completedAt ? new Date(session.completedAt) : null;
    const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    if (end) {
      const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      return `${startTime} - ${endTime}`;
    }
    return `Started at ${startTime}`;
  }, [session]);

  if (!session) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]}>
        <View style={styles.errorContainer}>
          <View style={[styles.emptyIconContainer, { backgroundColor: isDark ? '#1F1F23' : '#F4F4F5' }]}>
            <Ionicons name="document-outline" size={32} color={palette.textMuted} />
          </View>
          <Text style={[styles.errorText, { color: palette.text }]}>Session not found</Text>
          <TouchableOpacity style={[styles.errorButton, { backgroundColor: palette.accentGlow }]} onPress={() => router.back()}>
            <Text style={[styles.closeText, { color: palette.accent }]}>Go Back</Text>
          </TouchableOpacity>
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
        
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.headerLabel, { color: palette.textMuted }]}>WORKOUT</Text>
          {isEditing ? (
            <Text style={[styles.headerTitle, { color: palette.text }]}>Edit Session</Text>
          ) : (
            <Text style={[styles.headerTitle, { color: palette.text }]}>{session.name || 'Session Details'}</Text>
          )}
        </View>

        <TouchableOpacity 
          style={styles.editButton} 
          onPress={isEditing ? handleSave : () => setIsEditing(true)}
        >
          <Text style={[styles.editText, { color: palette.accent }]}>
            {isEditing ? 'Save' : 'Edit'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Date and Time */}
        <View style={styles.dateSection}>
          <Text style={[styles.dateText, { color: palette.text }]}>{formattedDate}</Text>
          <Text style={[styles.timeText, { color: palette.textMuted }]}>{formattedTime}</Text>
        </View>

        {/* Editable Name */}
        {isEditing && (
          <View style={styles.editSection}>
            <Text style={[styles.editLabel, { color: palette.textMuted }]}>Session Name</Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: palette.cardBg, 
                borderColor: palette.cardBorder,
                color: palette.text 
              }]}
              value={editedName}
              onChangeText={setEditedName}
              placeholder="Session Name"
              placeholderTextColor={palette.textMuted}
            />
          </View>
        )}

        {/* Summary Stats */}
        <View style={styles.statsRow}>
          {duration && (
            <View style={[styles.statBadge, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
              <View style={[styles.statIconBg, { backgroundColor: palette.accentGlow }]}>
                <Ionicons name="time-outline" size={16} color={palette.accent} />
              </View>
              <Text style={[styles.statBadgeText, { color: palette.text }]}>{duration}</Text>
            </View>
          )}
          <View style={[styles.statBadge, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
            <View style={[styles.statIconBg, { backgroundColor: 'rgba(78, 205, 196, 0.12)' }]}>
              <Ionicons name="fitness-outline" size={16} color="#4ecdc4" />
            </View>
            <Text style={[styles.statBadgeText, { color: palette.text }]}>{totalSets} sets</Text>
          </View>
          <View style={[styles.statBadge, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
            <View style={[styles.statIconBg, { backgroundColor: 'rgba(255, 107, 107, 0.12)' }]}>
              <Ionicons name="barbell-outline" size={16} color="#ff6b6b" />
            </View>
            <Text style={[styles.statBadgeText, { color: palette.text }]}>{displayWeight(totalVolume, preferences.weightUnit).toLocaleString()} {preferences.weightUnit}</Text>
          </View>
        </View>

        {/* Exercises */}
        <View style={styles.exercisesSection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Exercises</Text>
          </View>
          {displayExercises.map((exercise, index) => (
            <ExerciseCard
              key={`${exercise.exerciseId}-${index}`}
              exercise={exercise}
              palette={palette}
              isDark={isDark}
              isEditing={isEditing}
              onSetChange={handleSetChange}
              weightUnit={preferences.weightUnit}
            />
          ))}
        </View>

        {/* Notes */}
        {(session.notes || isEditing) && (
          <View style={styles.notesSection}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Notes</Text>
            </View>
            
            {isEditing ? (
              <TextInput
                style={[styles.notesInput, { 
                  backgroundColor: palette.cardBg, 
                  borderColor: palette.cardBorder,
                  color: palette.text 
                }]}
                value={editedNotes}
                onChangeText={setEditedNotes}
                placeholder="Add notes about this workout..."
                placeholderTextColor={palette.textMuted}
                multiline
                textAlignVertical="top"
              />
            ) : (
              <View style={[styles.notesCard, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
                <Text style={[styles.notesText, { color: palette.text }]}>{session.notes}</Text>
              </View>
            )}
          </View>
        )}

        {/* Delete Button (Only in Edit Mode) */}
        {isEditing && (
          <TouchableOpacity 
            style={[styles.deleteButton, { backgroundColor: `${palette.danger}15` }]}
            onPress={handleDelete}
          >
            <Ionicons name="trash-outline" size={20} color={palette.danger} />
            <Text style={[styles.deleteText, { color: palette.danger }]}>Delete Session</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

interface ExerciseCardProps {
  exercise: SessionExercise;
  palette: {
    bg: string;
    cardBg: string;
    cardBorder: string;
    text: string;
    textMuted: string;
    accent: string;
    accentGlow: string;
    success: string;
  };
  isDark: boolean;
  isEditing?: boolean;
  onSetChange?: (exerciseId: string, setIndex: number, field: keyof SessionSet, value: string) => void;
  weightUnit: 'lbs' | 'kg';
}

function ExerciseCard({ exercise, palette, isDark, isEditing, onSetChange, weightUnit }: ExerciseCardProps) {
  return (
    <View style={[styles.exerciseCard, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
      <View style={styles.exerciseHeader}>
        <View style={[styles.exerciseIconBg, { backgroundColor: palette.accentGlow }]}>
          <Ionicons name="barbell-outline" size={18} color={palette.accent} />
        </View>
        <Text style={[styles.exerciseName, { color: palette.text }]}>{exercise.exerciseName}</Text>
      </View>
      <View style={styles.setsContainer}>
        {exercise.sets.map((set, index) => (
          <View key={index} style={[styles.setRow, { backgroundColor: isDark ? '#1F1F23' : '#F9F9F8' }]}>
            <View style={styles.setRowMain}>
              <View style={[styles.setNumberBadge, { backgroundColor: palette.accentGlow }]}>
                <Text style={[styles.setNumber, { color: palette.accent }]}>{index + 1}</Text>
              </View>

              {isEditing ? (
                <View style={styles.editSetContainer}>
                  <View style={styles.editInputGroup}>
                    <TextInput
                      style={[styles.editInput, { color: palette.text, backgroundColor: palette.bg }]}
                      value={displayWeight(set.weight, weightUnit).toString()}
                      onChangeText={(val) => onSetChange?.(exercise.exerciseId, index, 'weight', val)}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={palette.textMuted}
                    />
                    <Text style={[styles.editUnit, { color: palette.textMuted }]}>{weightUnit}</Text>
                  </View>
                  <Text style={{ color: palette.textMuted }}>×</Text>
                  <View style={styles.editInputGroup}>
                    <TextInput
                      style={[styles.editInput, { color: palette.text, backgroundColor: palette.bg }]}
                      value={set.reps.toString()}
                      onChangeText={(val) => onSetChange?.(exercise.exerciseId, index, 'reps', val)}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={palette.textMuted}
                    />
                    <Text style={[styles.editUnit, { color: palette.textMuted }]}>reps</Text>
                  </View>
                  <View style={[styles.editInputGroup, { marginLeft: 8 }]}>
                    <Text style={[styles.editUnit, { color: palette.textMuted, marginRight: 4 }]}>RIR</Text>
                    <TextInput
                      style={[styles.editInput, { width: 40, color: palette.text, backgroundColor: palette.bg }]}
                      value={set.rir !== undefined ? formatRirShort(set.rir) : ''}
                      onChangeText={(val) => onSetChange?.(exercise.exerciseId, index, 'rir', val)}
                      autoCapitalize="characters"
                      placeholder="-"
                      placeholderTextColor={palette.textMuted}
                    />
                  </View>
                  <View style={[styles.editInputGroup, { marginLeft: 8 }]}>
                    <Text style={[styles.editUnit, { color: palette.textMuted, marginRight: 4 }]}>RPE</Text>
                    <TextInput
                      style={[styles.editInput, { width: 40, color: palette.text, backgroundColor: palette.bg }]}
                      value={set.rpe?.toString() ?? ''}
                      onChangeText={(val) => onSetChange?.(exercise.exerciseId, index, 'rpe', val)}
                      keyboardType="numeric"
                      placeholder="-"
                      placeholderTextColor={palette.textMuted}
                    />
                  </View>
                  <View style={[styles.editInputGroup, { marginLeft: 8 }]}>
                    <Text style={[styles.editUnit, { color: palette.textMuted, marginRight: 4 }]}>Q</Text>
                    <TextInput
                      style={[styles.editInput, { width: 40, color: palette.text, backgroundColor: palette.bg }]}
                      value={set.quality?.toString() ?? ''}
                      onChangeText={(val) => onSetChange?.(exercise.exerciseId, index, 'quality', val)}
                      keyboardType="numeric"
                      placeholder="-"
                      placeholderTextColor={palette.textMuted}
                    />
                    <Text style={[styles.editUnit, { color: palette.textMuted }]}>/5</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.setViewContent}>
                  <Text style={[styles.setDetails, { color: palette.text }]}>
                    {displayWeight(set.weight, weightUnit)} {weightUnit} × {set.reps} reps
                  </Text>
                  {(set.numberOfPartials !== undefined || set.rir !== undefined || set.rpe !== undefined || set.quality !== undefined) && (
                    <Text style={[styles.setMetrics, { color: palette.textMuted }]}>
                      {set.numberOfPartials !== undefined && `+${set.numberOfPartials}P`}
                      {set.numberOfPartials !== undefined && set.rir !== undefined && ' · '}
                      {set.rir !== undefined && (
                        set.rir === 'F' ? 'Failure' :
                        set.rir === 'P' ? 'Partials' :
                        `RIR ${formatRirShort(set.rir)}`
                      )}
                      {(set.numberOfPartials !== undefined || set.rir !== undefined) && set.rpe !== undefined && ' · '}
                      {set.rpe !== undefined && `RPE ${set.rpe}`}
                      {(set.numberOfPartials !== undefined || set.rir !== undefined || set.rpe !== undefined) && set.quality !== undefined && ' · '}
                      {set.quality !== undefined && `Q${set.quality}/5`}
                    </Text>
                  )}
                  {set.notes && (
                    <Text style={[styles.setNotes, { color: palette.textMuted }]} numberOfLines={2}>
                      {set.notes}
                    </Text>
                  )}
                </View>
              )}
            </View>

            {isEditing && (
              <TextInput
                style={[styles.editNotesInput, { color: palette.text, backgroundColor: palette.bg }]}
                value={set.notes ?? ''}
                onChangeText={(val) => onSetChange?.(exercise.exerciseId, index, 'notes', val)}
                placeholder="Set notes..."
                placeholderTextColor={palette.textMuted}
              />
            )}
          </View>
        ))}
      </View>
    </View>
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
  editButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editText: {
    fontSize: 16,
    fontWeight: '600',
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
  placeholder: {
    width: 44,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  dateSection: {
    marginBottom: 20,
  },
  dateText: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 28,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  statIconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  exercisesSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  exerciseCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  exerciseIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
    flex: 1,
  },
  setsContainer: {
    gap: 8,
  },
  setRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 6,
  },
  setRowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  setNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  setNumber: {
    fontSize: 13,
    fontWeight: '700',
  },
  setViewContent: {
    flex: 1,
    gap: 4,
  },
  setDetails: {
    fontSize: 15,
    fontWeight: '600',
  },
  setMetrics: {
    fontSize: 12,
    fontWeight: '500',
  },
  setNotes: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  editSetContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  editInputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editInput: {
    width: 50,
    height: 36,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
  },
  editUnit: {
    fontSize: 12,
    fontWeight: '500',
  },
  editNotesInput: {
    marginTop: 6,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: '400',
  },
  notesSection: {
    marginBottom: 24,
  },
  notesCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  notesText: {
    fontSize: 15,
    lineHeight: 22,
  },
  notesInput: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    minHeight: 120,
    fontSize: 15,
    lineHeight: 22,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  errorButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  closeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  editSection: {
    marginBottom: 20,
  },
  editLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 16,
    marginTop: 24,
  },
  deleteText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
