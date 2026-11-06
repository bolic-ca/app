import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { usePrograms } from '@/hooks/usePrograms';
import { useThemeCustomization } from '@/contexts/ThemeContext';
import type { TrainingDay } from '@/types/training';
import { setPendingDayOverride } from '@/utils/day-override-store';

export default function SelectTrainingDayScreen() {
  const colorScheme = useColorScheme();
  const { customColors } = useThemeCustomization();
  const { programId, currentNextDayId } = useLocalSearchParams<{
    programId: string;
    currentNextDayId: string;
  }>();
  const { programs, loading } = usePrograms();

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
    selectedBorder: accent,
    selectedBg: isDark ? hexToRgba(accent, 0.12) : hexToRgba(accent, 0.06),
  };

  const program = useMemo(
    () => programs.find(p => p.id === programId) ?? null,
    [programs, programId]
  );

  const allTrainingDays: TrainingDay[] = useMemo(() => {
    if (!program) return [];
    if (program.type === 'simple') return program.trainingDays ?? [];
    const days: TrainingDay[] = [];
    for (const meso of program.mesocycles ?? []) {
      for (const micro of meso.microcycles ?? []) {
        days.push(...(micro.trainingDays ?? []));
      }
    }
    return days;
  }, [program]);

  const handleSelectDay = (day: TrainingDay) => {
    if (day.id) setPendingDayOverride(day.id);
    router.back();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: palette.cardBorder }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: palette.text }]}>Choose Training Day</Text>
        <View style={styles.headerRight} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            accessibilityLabel="Loading training days"
            size="large"
            color={palette.accent}
          />
        </View>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {program && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>
                {program.name}
              </Text>
              <Text style={[styles.sectionSubtitle, { color: palette.textMuted }]}>
                {allTrainingDays.length} training days · tap a day to start there
              </Text>

              {allTrainingDays.length > 0 ? (
                <View style={styles.daysList}>
                  {allTrainingDays.map((day, index) => {
                    const isNext = day.id === currentNextDayId;
                    return (
                      <TouchableOpacity
                        key={day.id ?? index}
                        style={[
                          styles.dayCard,
                          {
                            backgroundColor: isNext ? palette.selectedBg : palette.cardBg,
                            borderColor: isNext ? palette.selectedBorder : palette.cardBorder,
                          },
                        ]}
                        onPress={() => handleSelectDay(day)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.dayHeader}>
                          <View
                            style={[
                              styles.dayNumber,
                              { backgroundColor: isNext ? hexToRgba(accent, 0.2) : palette.accentGlow },
                            ]}
                          >
                            <Text style={[styles.dayNumberText, { color: palette.accent }]}>
                              {index + 1}
                            </Text>
                          </View>
                          <View style={styles.dayInfo}>
                            <Text style={[styles.dayName, { color: palette.text }]}>
                              {day.name ?? `Day ${index + 1}`}
                            </Text>
                            <Text style={[styles.dayMeta, { color: palette.textMuted }]}>
                              {day.exercises?.length ?? 0} exercises
                              {day.description ? ` · ${day.description}` : ''}
                            </Text>
                          </View>
                          {isNext ? (
                            <View style={[styles.nextBadge, { backgroundColor: palette.accentGlow }]}>
                              <Text style={[styles.nextBadgeText, { color: palette.accent }]}>
                                UP NEXT
                              </Text>
                            </View>
                          ) : (
                            <Ionicons name="chevron-forward" size={20} color={palette.textMuted} />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View
                  style={[
                    styles.emptyState,
                    { backgroundColor: palette.cardBg, borderColor: palette.cardBorder },
                  ]}
                >
                  <Ionicons name="barbell-outline" size={32} color={palette.textMuted} />
                  <Text style={[styles.emptyText, { color: palette.textMuted }]}>
                    No training days
                  </Text>
                </View>
              )}
            </View>
          )}

          {!program && !loading && (
            <View style={styles.loadingContainer}>
              <Ionicons name="alert-circle" size={48} color={palette.textMuted} />
              <Text style={[styles.emptyText, { color: palette.textMuted }]}>Program not found</Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: { padding: 8 },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerRight: { width: 40 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  content: { flex: 1 },
  contentContainer: { padding: 20 },
  section: { marginBottom: 32 },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  daysList: { gap: 10 },
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
  dayInfo: { flex: 1 },
  dayName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  dayMeta: { fontSize: 13 },
  nextBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  nextBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  emptyState: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: { fontSize: 14 },
});
