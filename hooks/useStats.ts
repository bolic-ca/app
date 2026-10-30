/**
 * useStats Hook
 * React hook for managing user workout statistics
 */

import { useState, useEffect } from 'react';
import { useStorage } from '@/contexts/StorageContext';
import { UserStats, getStats, updateStats } from '@/services/storage/stats-storage';
import { personalRecordsStorage, PersonalRecord } from '@/services/storage/personal-records-storage';
import { nextWorkoutStreak } from '@/utils/streak';

export function useStats() {
  const { userId, isInitialized } = useStorage();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [prs, setPrs] = useState<PersonalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  async function fetchStats() {
    if (!userId) return;

    try {
      setLoading(true);
      setError(null);

      const userStats = await getStats(userId);
      setStats(userStats);

      const prItems = await personalRecordsStorage.getAll(userId);
      setPrs(prItems.map(item => item.data));
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load stats'));
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isInitialized && userId) {
      fetchStats();
    }
  }, [userId, isInitialized]);

  async function incrementWorkouts(durationSeconds = 0): Promise<void> {
    if (!userId) {
      throw new Error('Storage is not ready');
    }

    try {
      const base = stats ?? (await getStats(userId));
      const now = new Date();
      const newStreak = nextWorkoutStreak(base.currentStreak, base.lastWorkoutDate, now);
      const durationHours = durationSeconds > 0 ? durationSeconds / 3600 : 0;

      const updatedStats: UserStats = {
        ...base,
        totalWorkouts: base.totalWorkouts + 1,
        currentStreak: newStreak,
        longestStreak: Math.max(base.longestStreak, newStreak),
        activeTime: Math.round((base.activeTime + durationHours) * 10) / 10,
        lastWorkoutDate: now.toISOString(),
      };

      await updateStats(userId, updatedStats);
      setStats(updatedStats);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update stats');
      setError(error);
      throw error;
    }
  }

  async function addPersonalRecord(pr: Omit<PersonalRecord, 'id'>): Promise<void> {
    try {
      await personalRecordsStorage.save(userId, pr as PersonalRecord);
      await fetchStats(); // Refresh to get updated PRs
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to add personal record');
      setError(error);
      throw error;
    }
  }

  async function checkAndUpdatePR(
    exerciseName: string,
    weight: number,
    reps: number,
    unit: 'kg' | 'lbs',
    sessionId?: string
  ): Promise<boolean> {
    try {
      // Find existing PR for this exercise
      const existingPR = prs.find(pr => pr.exerciseName === exerciseName);

      // Calculate one-rep max estimate for comparison
      // Using Epley formula: weight * (1 + reps/30)
      const newEstimate = weight * (1 + reps / 30);
      const existingEstimate = existingPR
        ? existingPR.weight * (1 + existingPR.reps / 30)
        : 0;

      if (newEstimate > existingEstimate) {
        // New PR!
        await addPersonalRecord({
          exerciseName,
          weight,
          reps,
          unit,
          achievedAt: new Date().toISOString(),
          sessionId,
        } as PersonalRecord);
        return true;
      }

      return false;
    } catch (err) {
      console.error('Error checking PR:', err);
      return false;
    }
  }

  return {
    stats,
    prs,
    loading,
    error,
    incrementWorkouts,
    addPersonalRecord,
    checkAndUpdatePR,
    refetch: fetchStats,
  };
}
