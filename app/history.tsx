import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useColorScheme, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeCustomization } from '@/contexts/ThemeContext';
import { useStorage } from '@/contexts/StorageContext';
import { getSessionsByMonth, WorkoutSession, formatRirShort } from '@/services/storage/session-storage';
import { StorageItem } from '@/types/storage';
import { displayWeight } from '@/utils/weight';

interface WeekGroup {
  weekLabel: string;
  sessions: StorageItem<WorkoutSession>[];
  totalVolume: number;
  totalSets: number;
}

export default function HistoryPage() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { customColors, preferences } = useThemeCustomization();
  const { userId } = useStorage();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [sessions, setSessions] = useState<StorageItem<WorkoutSession>[]>([]);
  const requestKey = userId
    ? `${userId}:${currentDate.getFullYear()}:${currentDate.getMonth()}`
    : null;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = requestKey === null || loadedKey !== requestKey;

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

  useEffect(() => {
    if (!userId || !requestKey) return;

    let cancelled = false;
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;

    getSessionsByMonth(userId, year, month)
      .then(monthSessions => {
        if (cancelled) return;
        const sorted = monthSessions.sort((a, b) =>
          new Date(b.data.startedAt).getTime() - new Date(a.data.startedAt).getTime()
        );
        setSessions(sorted);
        setLoadedKey(requestKey);
      })
      .catch(error => {
        console.error('Error fetching sessions:', error);
        if (!cancelled) setLoadedKey(requestKey);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, currentDate, requestKey]);

  const handlePrevMonth = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() - 1);
      return newDate;
    });
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + 1);
      return newDate;
    });
  };

  const formatMonth = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const calculateVolume = (session: WorkoutSession) => {
    return session.exercises.reduce((acc, ex) => 
      acc + ex.sets.reduce((sAcc, s) => sAcc + (s.weight * s.reps), 0)
    , 0);
  };

  const calculateDuration = (session: WorkoutSession) => {
    if (!session.completedAt) return 'In progress';
    const start = new Date(session.startedAt);
    const end = new Date(session.completedAt);
    const diffMins = Math.floor((end.getTime() - start.getTime()) / 60000);
    return `${diffMins} min`;
  };

  // Get week number and label
  const getWeekInfo = (date: Date) => {
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const dayOfMonth = date.getDate();
    const weekNum = Math.ceil((dayOfMonth + startOfMonth.getDay()) / 7);

    // Get start and end of week
    const dayOfWeek = date.getDay();
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - dayOfWeek);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const formatShortDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const weekLabel = `${formatShortDate(startOfWeek)} - ${formatShortDate(endOfWeek)}`;

    return { weekNum, weekLabel };
  };

  // Group sessions by week
  const weekGroups = useMemo((): WeekGroup[] => {
    if (sessions.length === 0) return [];

    const groups: Map<string, WeekGroup> = new Map();

    sessions.forEach(item => {
      const date = new Date(item.data.startedAt);
      const { weekLabel } = getWeekInfo(date);

      if (!groups.has(weekLabel)) {
        groups.set(weekLabel, {
          weekLabel,
          sessions: [],
          totalVolume: 0,
          totalSets: 0,
        });
      }

      const group = groups.get(weekLabel)!;
      group.sessions.push(item);
      group.totalVolume += calculateVolume(item.data);
      group.totalSets += item.data.exercises.reduce((t, e) => t + e.sets.length, 0);
    });

    return Array.from(groups.values());
  }, [sessions]);

  // Month summary stats
  const monthStats = useMemo(() => {
    if (sessions.length === 0) return null;

    const totalWorkouts = sessions.length;
    const totalVolume = sessions.reduce((acc, item) => acc + calculateVolume(item.data), 0);
    const totalSets = sessions.reduce((acc, item) =>
      acc + item.data.exercises.reduce((t, e) => t + e.sets.length, 0), 0
    );

    return { totalWorkouts, totalVolume, totalSets };
  }, [sessions]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: palette.cardBorder }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: palette.text }]}>Workout History</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Month Navigator */}
      <View style={[styles.monthNav, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
        <TouchableOpacity onPress={handlePrevMonth} style={styles.navButton}>
          <Ionicons name="chevron-back" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={[styles.monthTitle, { color: palette.text }]}>{formatMonth(currentDate)}</Text>
        <TouchableOpacity onPress={handleNextMonth} style={styles.navButton}>
          <Ionicons name="chevron-forward" size={24} color={palette.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={palette.accent} />
          </View>
        ) : sessions.length > 0 ? (
          <View style={styles.listContainer}>
            {/* Month Summary */}
            {monthStats && (
              <View style={[styles.monthSummary, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
                <View style={styles.monthSummaryRow}>
                  <View style={styles.monthStat}>
                    <Text style={[styles.monthStatValue, { color: palette.text }]}>{monthStats.totalWorkouts}</Text>
                    <Text style={[styles.monthStatLabel, { color: palette.textMuted }]}>workouts</Text>
                  </View>
                  <View style={[styles.monthStatDivider, { backgroundColor: palette.cardBorder }]} />
                  <View style={styles.monthStat}>
                    <Text style={[styles.monthStatValue, { color: palette.text }]}>{monthStats.totalSets}</Text>
                    <Text style={[styles.monthStatLabel, { color: palette.textMuted }]}>sets</Text>
                  </View>
                  <View style={[styles.monthStatDivider, { backgroundColor: palette.cardBorder }]} />
                  <View style={styles.monthStat}>
                    <Text style={[styles.monthStatValue, { color: palette.text }]}>{(displayWeight(monthStats.totalVolume, preferences.weightUnit) / 1000).toFixed(1)}k</Text>
                    <Text style={[styles.monthStatLabel, { color: palette.textMuted }]}>{preferences.weightUnit}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Week Groups */}
            {weekGroups.map((group) => (
              <View key={group.weekLabel} style={styles.weekGroup}>
                {/* Week Header */}
                <View style={styles.weekHeader}>
                  <View style={styles.weekHeaderLeft}>
                    <Text style={[styles.weekLabel, { color: palette.text }]}>{group.weekLabel}</Text>
                    <Text style={[styles.weekMeta, { color: palette.textMuted }]}>
                      {group.sessions.length} workout{group.sessions.length !== 1 ? 's' : ''} · {(displayWeight(group.totalVolume, preferences.weightUnit) / 1000).toFixed(1)}k {preferences.weightUnit}
                    </Text>
                  </View>
                </View>

                {/* Week Sessions */}
                <View style={styles.weekSessions}>
                  {group.sessions.map((item) => {
                    const session = item.data;
                    const date = new Date(session.startedAt);
                    const dayStr = date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });

                    return (
                      <TouchableOpacity
                        key={session.id}
                        style={[styles.card, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}
                        onPress={() => router.push({
                          pathname: '/session-detail',
                          params: { session: JSON.stringify(session) }
                        })}
                        activeOpacity={0.7}
                      >
                        <View style={styles.cardContent}>
                          <View style={styles.cardInfo}>
                            <Text style={[styles.cardTitle, { color: palette.text }]} numberOfLines={1}>
                              {session.name || 'Workout'}
                            </Text>
                            <Text style={[styles.cardSubtitle, { color: palette.textMuted }]}>
                              {dayStr} · {session.exercises.length} exercises · {calculateDuration(session)}
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color={palette.textMuted} />
                        </View>
                        {session.exercises.length > 0 && (
                          <View style={[styles.cardExercises, { borderTopColor: palette.cardBorder }]}>
                            {session.exercises.map((ex, exIdx) => (
                              <View key={ex.exerciseId || exIdx} style={styles.cardExerciseRow}>
                                <Text style={[styles.cardExerciseName, { color: palette.text }]} numberOfLines={1}>
                                  {ex.exerciseName}
                                </Text>
                                <View style={styles.cardSets}>
                                  {ex.sets.map((s, sIdx) => {
                                    let label = `${displayWeight(s.weight, preferences.weightUnit)}${preferences.weightUnit}×${s.reps}`;
                                    if (s.numberOfPartials !== undefined) {
                                      label += ` +${s.numberOfPartials}P`;
                                    } else if (s.rir !== undefined) {
                                      label += ` ${s.rir === 'F' ? 'F' : `${formatRirShort(s.rir)}RIR`}`;
                                    }
                                    if (s.rpe !== undefined) label += ` RPE${s.rpe}`;
                                    if (s.quality !== undefined) label += ` Q${s.quality}/5`;
                                    return (
                                      <Text key={sIdx} style={[styles.cardSetText, { color: palette.textMuted }]}>
                                        {label}
                                      </Text>
                                    );
                                  })}
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
            ))}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIcon, { backgroundColor: isDark ? '#1F1F23' : '#F4F4F5' }]}>
              <Ionicons name="calendar-outline" size={48} color={palette.textMuted} />
            </View>
            <Text style={[styles.emptyTitle, { color: palette.text }]}>No workouts found</Text>
            <Text style={[styles.emptySubtitle, { color: palette.textMuted }]}>
              No workouts recorded in {formatMonth(currentDate)}
            </Text>
          </View>
        )}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  placeholder: {
    width: 40,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    margin: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  navButton: {
    padding: 8,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    paddingTop: 60,
    alignItems: 'center',
  },
  listContainer: {
    gap: 20,
  },
  // Month Summary
  monthSummary: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  monthSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  monthStat: {
    alignItems: 'center',
    flex: 1,
  },
  monthStatValue: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  monthStatLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  monthStatDivider: {
    width: 1,
    height: 32,
  },
  // Week Groups
  weekGroup: {
    gap: 8,
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  weekHeaderLeft: {
    flex: 1,
  },
  weekLabel: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  weekMeta: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  weekSessions: {
    gap: 8,
  },
  // Session Card
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  cardExercises: {
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 10,
    gap: 8,
  },
  cardExerciseRow: {
    gap: 4,
  },
  cardExerciseName: {
    fontSize: 13,
    fontWeight: '600',
  },
  cardSets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  cardSetText: {
    fontSize: 12,
    fontWeight: '500',
  },
  // Empty State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
  },
});
