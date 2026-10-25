import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, useColorScheme, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useThemeCustomization } from '@/contexts/ThemeContext';
import { useStats } from '@/hooks/useStats';
import { useWorkoutSession } from '@/contexts/WorkoutSessionContext';
import { displayWeight } from '@/utils/weight';

export default function StatsPage() {
  const colorScheme = useColorScheme();
  const { customColors, preferences } = useThemeCustomization();
  const { stats: userStats, loading: statsLoading, refetch } = useStats();
  const { sessionHistory, loading: sessionLoading } = useWorkoutSession();
  const isDark = colorScheme === 'dark';

  useFocusEffect(
    useCallback(() => {
      refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const loading = statsLoading || sessionLoading;

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
    streak: '#FACC15',
    success: '#22C55E',
  };

  // Compute total volume from session history (stored in kg)
  const totalVolumeKg = useMemo(() => {
    if (!sessionHistory) return 0;
    return sessionHistory.reduce((acc, session) =>
      acc + session.exercises.reduce((eAcc, ex) =>
        eAcc + ex.sets.reduce((sAcc, s) => sAcc + (s.weight ?? 0) * (s.reps ?? 0), 0), 0), 0);
  }, [sessionHistory]);

  // Compute active time from session history (completedAt - startedAt in hours)
  const totalActiveHours = useMemo(() => {
    if (!sessionHistory) return 0;
    const raw = sessionHistory.reduce((acc, session) => {
      if (!session.completedAt) return acc;
      const ms = new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime();
      return acc + ms / (1000 * 3600);
    }, 0);
    return Math.round(raw * 10) / 10;
  }, [sessionHistory]);

  // Build stat cards from real data
  const totalVolumeConverted = displayWeight(totalVolumeKg, preferences.weightUnit);
  const stats = [
    { title: 'Total Workouts', value: userStats?.totalWorkouts || 0, icon: 'fitness' as const, color: '#4ecdc4' },
    { title: 'Current Streak', value: `${userStats?.currentStreak || 0}`, suffix: 'days', icon: 'flame' as const, color: '#ff6b6b' },
    { title: 'Total Volume', value: `${(totalVolumeConverted / 1000).toFixed(1)}k`, suffix: preferences.weightUnit, icon: 'barbell' as const, color: '#ffd93d' },
    { title: 'Active Time', value: totalActiveHours, suffix: 'hrs', icon: 'time' as const, color: '#a29bfe' },
  ];

  // Calculate real weekly activity from session history
  const weeklyActivity = useMemo(() => {
    const today = new Date();
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today);
      date.setDate(date.getDate() - (6 - i));
      return date;
    });

    const toLocalDateKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    return last7Days.map(date => {
      const dayStr = date.toLocaleDateString('en-US', { weekday: 'short' })[0];
      const dateKey = toLocalDateKey(date);
      const completed = sessionHistory?.some(session => {
        if (!session.completedAt) return false;
        // completedAt is stored as UTC; convert to local date at display time
        return toLocalDateKey(new Date(session.completedAt)) === dateKey;
      }) || false;
      return { day: dayStr, completed };
    });
  }, [sessionHistory]);

  const weeklyStats = useMemo(() => {
    const completedCount = weeklyActivity.filter(d => d.completed).length;
    const completionRate = Math.round((completedCount / 7) * 100);
    return { completedCount, completionRate };
  }, [weeklyActivity]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerLabel, { color: palette.textMuted }]}>ANALYTICS</Text>
          <Text style={[styles.headerTitle, { color: palette.text }]}>Your Stats</Text>
        </View>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={palette.accent} />
          </View>
        )}

        {/* Stats Grid */}
        {!loading && (
          <View style={styles.statsGrid}>
            {stats.map((stat, index) => (
              <View key={index} style={[styles.statCard, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
                <View style={[styles.statIconBg, { backgroundColor: `${stat.color}15` }]}>
                  <Ionicons name={stat.icon} size={20} color={stat.color} />
                </View>
                <View style={styles.statContent}>
                  <View style={styles.statValueRow}>
                    <Text style={[styles.statValue, { color: palette.text }]}>{stat.value}</Text>
                    {stat.suffix && <Text style={[styles.statSuffix, { color: palette.textMuted }]}>{stat.suffix}</Text>}
                  </View>
                  <Text style={[styles.statTitle, { color: palette.textMuted }]}>{stat.title}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Weekly Activity */}
        {!loading && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionBadge, { backgroundColor: palette.accentGlow }]}>
                <Text style={[styles.sectionBadgeText, { color: palette.accent }]}>THIS WEEK</Text>
              </View>
            </View>

            <View style={[styles.weeklyCard, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
              <View style={styles.weeklyGrid}>
                {weeklyActivity.map((item, index) => (
                  <View key={index} style={styles.dayContainer}>
                    <Text style={[styles.dayLabel, { color: palette.textMuted }]}>{item.day}</Text>
                    <View
                      style={[
                        styles.dayCircle,
                        {
                          backgroundColor: item.completed ? palette.accent : 'transparent',
                          borderColor: item.completed ? palette.accent : palette.cardBorder,
                        },
                      ]}
                    >
                      {item.completed && <Ionicons name="checkmark" size={14} color="#FFF" />}
                    </View>
                  </View>
                ))}
              </View>

              <View style={[styles.weeklyDivider, { backgroundColor: palette.cardBorder }]} />

              <View style={styles.weeklyStats}>
                <View style={styles.weeklyStatItem}>
                  <Text style={[styles.weeklyStatValue, { color: palette.text }]}>{weeklyStats.completedCount}</Text>
                  <Text style={[styles.weeklyStatLabel, { color: palette.textMuted }]}>of 7 days</Text>
                </View>
                <View style={[styles.weeklyProgress, { backgroundColor: isDark ? '#1F1F23' : '#F4F4F5' }]}>
                  <View style={[styles.weeklyProgressBar, { backgroundColor: palette.accent, width: `${weeklyStats.completionRate}%` }]} />
                </View>
                <Text style={[styles.weeklyPercent, { color: palette.accent }]}>{weeklyStats.completionRate}%</Text>
              </View>
            </View>
          </View>
        )}

        {/* Recent Activity */}
        {!loading && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Recent Activity</Text>
            </View>

            {sessionHistory && sessionHistory.length > 0 ? (
              <View style={styles.historyList}>
                {sessionHistory.slice(0, 5).map((session) => {
                  const date = new Date(session.startedAt);
                  const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  
                  // Calculate volume
                  const volume = session.exercises.reduce((acc, ex) => 
                    acc + ex.sets.reduce((sAcc, s) => sAcc + (s.weight * s.reps), 0)
                  , 0);

                  // Calculate duration
                  let duration = '';
                  if (session.completedAt) {
                    const start = new Date(session.startedAt);
                    const end = new Date(session.completedAt);
                    const diffMins = Math.floor((end.getTime() - start.getTime()) / 60000);
                    duration = `${diffMins} min`;
                  }

                  return (
                    <TouchableOpacity
                      key={session.id}
                      style={[styles.historyCard, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}
                      onPress={() => router.push({ pathname: '/session-detail', params: { session: JSON.stringify(session) } })}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.historyIconBg, { backgroundColor: palette.accentGlow }]}>
                        <Ionicons name="barbell" size={20} color={palette.accent} />
                      </View>
                      <View style={styles.historyInfo}>
                        <Text style={[styles.historyTitle, { color: palette.text }]} numberOfLines={1}>
                          {session.name || 'Workout'}
                        </Text>
                        <Text style={[styles.historySubtitle, { color: palette.textMuted }]}>
                          {formattedDate} • {session.exercises.length} Exercises
                        </Text>
                      </View>
                      <View style={styles.historyStats}>
                        <Text style={[styles.historyValue, { color: palette.text }]}>{(displayWeight(volume, preferences.weightUnit) / 1000).toFixed(1)}k {preferences.weightUnit}</Text>
                        <Text style={[styles.historyLabel, { color: palette.textMuted }]}>{duration}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={palette.textMuted} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View style={[styles.emptyCard, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
                <View style={[styles.emptyIconContainer, { backgroundColor: isDark ? '#1F1F23' : '#F4F4F5' }]}>
                  <Ionicons name="time-outline" size={32} color={palette.textMuted} />
                </View>
                <Text style={[styles.emptyTitle, { color: palette.text }]}>No Recent Activity</Text>
                <Text style={[styles.emptyDescription, { color: palette.textMuted }]}>
                  Complete a workout to see it here
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.viewAllButton, { borderColor: palette.cardBorder }]}
              onPress={() => router.push('/history')}
            >
              <Text style={[styles.viewAllText, { color: palette.text }]}>View All History</Text>
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

  // Loading
  loadingContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },

  // Stats Grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 },
  statCard: {
    width: '48%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statIconBg: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  statContent: { flex: 1 },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  statValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  statSuffix: { fontSize: 13, fontWeight: '500' },
  statTitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },

  // Section
  section: { marginBottom: 28 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sectionBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  sectionBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  sectionTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },

  // Weekly Card
  weeklyCard: { borderRadius: 20, borderWidth: 1, padding: 20 },
  weeklyGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  dayContainer: { alignItems: 'center', gap: 8 },
  dayLabel: { fontSize: 11, fontWeight: '600' },
  dayCircle: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  weeklyDivider: { height: 1, marginBottom: 16 },
  weeklyStats: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  weeklyStatItem: { alignItems: 'center' },
  weeklyStatValue: { fontSize: 20, fontWeight: '800' },
  weeklyStatLabel: { fontSize: 11, fontWeight: '500' },
  weeklyProgress: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  weeklyProgressBar: { height: '100%', borderRadius: 4 },
  weeklyPercent: { fontSize: 16, fontWeight: '700', minWidth: 44, textAlign: 'right' },

  // History Cards
  historyList: { gap: 10 },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 12,
  },
  historyIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyInfo: { flex: 1 },
  historyTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2, marginBottom: 2 },
  historySubtitle: { fontSize: 12, fontWeight: '500' },
  historyStats: { alignItems: 'flex-end', marginRight: 4 },
  historyValue: { fontSize: 14, fontWeight: '700' },
  historyLabel: { fontSize: 11, fontWeight: '500' },
  
  viewAllButton: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Empty State
  emptyCard: { borderRadius: 20, borderWidth: 1, padding: 32, alignItems: 'center' },
  emptyIconContainer: { width: 72, height: 72, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3, marginBottom: 6 },
  emptyDescription: { fontSize: 14, textAlign: 'center' },
});
