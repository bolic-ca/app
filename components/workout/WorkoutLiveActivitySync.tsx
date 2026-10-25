/**
 * WorkoutLiveActivitySync
 * Headless component that mirrors the active workout session into an iOS
 * Live Activity (Lock Screen + Dynamic Island). Renders nothing.
 */

import { useEffect, useRef, useState } from 'react';
import { useStorage } from '@/contexts/StorageContext';
import { useWorkoutSession } from '@/contexts/WorkoutSessionContext';
import { useThemeCustomization } from '@/contexts/ThemeContext';
import { programStorage } from '@/services/storage/program-storage';
import type { TrainingDay } from '@/types/training';
import { buildWorkoutActivityState } from '@/utils/live-activity-helpers';
import {
  startWorkoutActivity,
  updateWorkoutActivity,
  stopWorkoutActivity,
  hasWorkoutActivity,
} from '@/services/live-activity/workout-live-activity';

// How often to refresh the elapsed-time text while a workout is active.
const TIME_REFRESH_MS = 30_000;

/**
 * Training days live inside the program (simple: program.trainingDays;
 * periodized: nested in mesocycles -> microcycles), not as standalone entities,
 * so resolve the active day from the program structure.
 */
function findTrainingDayInProgram(program: any, trainingDayId: string): TrainingDay | null {
  if (!program) return null;

  if (program.type === 'simple' && Array.isArray(program.trainingDays)) {
    return program.trainingDays.find((td: TrainingDay) => td.id === trainingDayId) ?? null;
  }

  if (program.type === 'periodized' && Array.isArray(program.mesocycles)) {
    for (const meso of program.mesocycles) {
      for (const micro of meso.microcycles ?? []) {
        const found = (micro.trainingDays ?? []).find((td: TrainingDay) => td.id === trainingDayId);
        if (found) return found;
      }
    }
  }

  // Fallback for shapes without an explicit type field.
  if (Array.isArray(program.trainingDays)) {
    return program.trainingDays.find((td: TrainingDay) => td.id === trainingDayId) ?? null;
  }

  return null;
}

export default function WorkoutLiveActivitySync() {
  const { userId, isInitialized } = useStorage();
  const { session, sessionHistory } = useWorkoutSession();
  const { preferences, customColors } = useThemeCustomization();

  const programId = session?.programId ?? null;
  const trainingDayId = session?.trainingDayId ?? null;
  const requestKey = isInitialized && userId && programId && trainingDayId
    ? `${userId}:${programId}:${trainingDayId}`
    : null;
  const [loadedDay, setLoadedDay] = useState<{ key: string; day: TrainingDay | null } | null>(null);
  const trainingDay = loadedDay && loadedDay.key === requestKey ? loadedDay.day : null;

  // Load the training day for the active session from its program.
  useEffect(() => {
    if (!requestKey || !userId || !programId || !trainingDayId) return;

    let cancelled = false;
    programStorage
      .getById(userId, programId)
      .then(item => {
        if (!cancelled) {
          setLoadedDay({
            key: requestKey,
            day: findTrainingDayInProgram(item?.data, trainingDayId),
          });
        }
      })
      .catch(() => {
        if (!cancelled) setLoadedDay({ key: requestKey, day: null });
      });

    return () => {
      cancelled = true;
    };
  }, [requestKey, userId, programId, trainingDayId]);

  // Keep a ref to the latest sync routine so the interval always runs fresh data.
  const syncRef = useRef<() => void>(() => {});
  useEffect(() => {
    syncRef.current = () => {
      if (!session) return;

      const state = buildWorkoutActivityState(session, trainingDay, sessionHistory, {
        weightUnit: preferences.weightUnit,
        showRir: preferences.showRir,
        showRpe: preferences.showRpe,
      });
      if (!state) return;

      if (hasWorkoutActivity()) {
        updateWorkoutActivity(state);
      } else {
        startWorkoutActivity(state, {
          accentColor: customColors.primaryButton,
          deepLinkUrl: '/',
        });
      }
    };
  });

  // Start / update on any session, history, training day, or preference change.
  useEffect(() => {
    if (!session) {
      stopWorkoutActivity();
      return;
    }
    syncRef.current();
  }, [session, sessionHistory, trainingDay, preferences, customColors.primaryButton]);

  // Periodically refresh so the elapsed-time text stays current.
  useEffect(() => {
    if (!session) return;

    const interval = setInterval(() => syncRef.current(), TIME_REFRESH_MS);
    return () => clearInterval(interval);
  }, [session]);

  return null;
}
