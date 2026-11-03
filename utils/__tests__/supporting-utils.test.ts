import { afterEach, describe, expect, it, jest } from '@jest/globals';

import {
  buildWorkoutActivityState,
  type LiveActivityPreferences,
} from '@/utils/live-activity-helpers';
import {
  calendarDaysBetween,
  localDateKey,
  nextWorkoutStreak,
} from '@/utils/streak';
import {
  convertWeight,
  displayWeight,
  formatWeight,
  parseWeightInput,
  toStorageUnit,
} from '@/utils/weight';
import {
  calculateWorkoutDuration,
  formatDuration,
  getAllPreviousPerformances,
  getPreviousPerformance,
  getWorkoutProgress,
  isExerciseComplete,
} from '@/utils/workout-helpers';
import {
  generateId,
  getCurrentTimestamp,
  getMonthKey,
  isValidUUID,
} from '@/utils/storage-helpers';
import type {
  SessionSet,
  WorkoutSession,
} from '@/services/storage/session-storage';
import type { TrainingDay } from '@/types/training';

const prefs: LiveActivityPreferences = {
  weightUnit: 'kg',
  showRir: true,
  showRpe: true,
};

const set = (overrides: Partial<SessionSet> = {}): SessionSet => ({
  weight: 50,
  reps: 8,
  completedAt: '2026-01-01T10:00:00.000Z',
  ...overrides,
});

const session = (overrides: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id: 'session',
  programId: 'program',
  trainingDayId: 'day',
  startedAt: '2026-01-01T10:00:00.000Z',
  completedAt: null,
  exercises: [],
  ...overrides,
});

const day: TrainingDay = {
  id: 'day',
  userId: 'user',
  name: 'Push',
  exercises: [
    {
      id: 'bench',
      userId: 'user',
      trainingDayIds: ['day'],
      name: 'Bench',
      targetNumberOfSets: 2,
    },
    {
      id: 'fly',
      userId: 'user',
      trainingDayIds: ['day'],
      name: 'Fly',
      targetNumberOfSets: null,
    },
  ],
};

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('weight helpers', () => {
  it('converts in both directions and leaves matching units unchanged', () => {
    expect(convertWeight(10, 'kg', 'lbs')).toBeCloseTo(22.0462);
    expect(convertWeight(22.0462, 'lbs', 'kg')).toBeCloseTo(10);
    expect(convertWeight(10, 'kg', 'kg')).toBe(10);
  });

  it('rounds display values and formats missing values as zero', () => {
    expect(displayWeight(10, 'lbs')).toBe(22);
    expect(displayWeight(undefined, 'kg')).toBe(0);
    expect(displayWeight(null, 'kg')).toBe(0);
    expect(formatWeight(45.55, 'kg')).toBe('45.6 kg');
  });

  it('parses valid input and rejects invalid or negative input', () => {
    expect(toStorageUnit(22.0462, 'lbs')).toBeCloseTo(10);
    expect(parseWeightInput('100.5', 'kg')).toBe(100.5);
    expect(parseWeightInput('220.462', 'lbs')).toBeCloseTo(100);
    expect(parseWeightInput('nope', 'kg')).toBeNull();
    expect(parseWeightInput('-1', 'kg')).toBeNull();
  });
});

describe('streak helpers', () => {
  it('formats local dates and handles calendar boundaries', () => {
    expect(localDateKey(new Date(2026, 0, 2, 23, 30))).toBe('2026-01-02');
    expect(calendarDaysBetween('2025-12-31', '2026-01-02')).toBe(2);
    expect(calendarDaysBetween('2026-01-02', '2026-01-01')).toBe(-1);
  });

  it('starts, preserves, increments, and resets streaks', () => {
    expect(nextWorkoutStreak(0, null, new Date(2026, 0, 1))).toBe(1);
    expect(
      nextWorkoutStreak(3, new Date(2026, 0, 1, 8).toISOString(), new Date(2026, 0, 1, 20)),
    ).toBe(3);
    expect(
      nextWorkoutStreak(3, new Date(2026, 0, 1, 8).toISOString(), new Date(2026, 0, 2, 8)),
    ).toBe(4);
    expect(
      nextWorkoutStreak(3, new Date(2026, 0, 1, 8).toISOString(), new Date(2026, 0, 4, 8)),
    ).toBe(1);
  });
});

describe('storage helpers', () => {
  it('generates a valid version-four UUID including the variant bits', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const id = generateId();
    expect(id).toBe('00000000-0000-4000-8000-000000000000');
    expect(isValidUUID(id)).toBe(true);
    expect(isValidUUID('not-an-id')).toBe(false);
  });

  it('returns stable timestamps and padded month keys', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 0, 3, 12));
    expect(getCurrentTimestamp()).toBe(new Date(2026, 0, 3, 12).toISOString());
    expect(getMonthKey()).toBe('2026-01');
    expect(getMonthKey(new Date(2025, 10, 1))).toBe('2025-11');
  });
});

describe('workout helpers', () => {
  const history = [
    session({
      id: 'active',
      exercises: [{ exerciseId: 'bench', exerciseName: 'Bench', sets: [set({ weight: 40 })] }],
    }),
    session({
      id: 'completed',
      name: 'Push',
      completedAt: '2026-01-02T11:00:00.000Z',
      exercises: [{
        exerciseId: 'bench',
        exerciseName: 'Bench',
        sets: [set({ weight: 50 }), set({ weight: 55, reps: 6, rir: 1, rpe: 9, quality: 4 })],
      }],
    }),
  ];

  it('finds previous performance and returns null when absent', () => {
    expect(getPreviousPerformance('bench', history)).toMatchObject({ weight: 40, reps: 8 });
    expect(getPreviousPerformance('missing', history)).toBeNull();
  });

  it('returns only completed historical performances with last-set values', () => {
    const performances = getAllPreviousPerformances('bench', history);
    expect(performances).toHaveLength(1);
    expect(performances[0]).toMatchObject({
      sessionId: 'completed',
      sessionName: 'Push',
      performance: { weight: 55, reps: 6, rir: 1, rpe: 9 },
    });
  });

  it('checks targets and formats short and long durations', () => {
    expect(isExerciseComplete(undefined, 2)).toBe(false);
    expect(isExerciseComplete({ exerciseId: 'x', exerciseName: 'X', sets: [set()] }, null)).toBe(false);
    expect(isExerciseComplete({ exerciseId: 'x', exerciseName: 'X', sets: [set(), set()] }, 2)).toBe(true);
    expect(formatDuration(65)).toBe('01:05');
    expect(formatDuration(3661)).toBe('1:01:01');
  });

  it('calculates elapsed duration and handles malformed timestamps', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T10:01:05.000Z'));
    expect(calculateWorkoutDuration('2026-01-01T10:00:00.000Z')).toBe(65);
    expect(calculateWorkoutDuration('invalid')).toBe(0);
  });

  it('calculates plan progress, volume, target, and targetless completion', () => {
    const result = getWorkoutProgress(
      session({
        exercisePlan: [
          { exerciseId: 'bench', exerciseName: 'Bench' },
          { exerciseId: 'fly', exerciseName: 'Fly' },
        ],
        exercises: [
          { exerciseId: 'bench', exerciseName: 'Bench', sets: [set(), set({ weight: 60, reps: 5 })] },
          { exerciseId: 'fly', exerciseName: 'Fly', sets: [set({ weight: 10, reps: 12 })] },
        ],
      }),
      day,
    );
    expect(result).toEqual({
      completedExercises: 2,
      totalExercises: 2,
      totalSets: 3,
      totalVolume: 820,
    });
  });

  it('supports legacy templates, exercise swaps, and a missing template', () => {
    const legacy = session({
      exerciseOverrides: { bench: { exerciseId: 'incline', exerciseName: 'Incline' } },
      exercises: [
        { exerciseId: 'incline', exerciseName: 'Incline', sets: [set(), set()] },
        { exerciseId: 'fly', exerciseName: 'Fly', sets: [set()] },
      ],
    });
    expect(getWorkoutProgress(legacy, day).completedExercises).toBe(1);
    expect(getWorkoutProgress(legacy, null)).toMatchObject({
      completedExercises: 0,
      totalExercises: 0,
    });
  });
});

describe('live activity state', () => {
  it('returns null without a day or exercises', () => {
    expect(buildWorkoutActivityState(session(), null, [], prefs)).toBeNull();
    expect(
      buildWorkoutActivityState(session(), { ...day, exercises: [] }, [], prefs),
    ).toBeNull();
  });

  it('uses the exercise plan and same-day history for target and set details', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T10:01:05.000Z'));
    const history = session({
      id: 'past',
      completedAt: '2025-12-20T10:00:00.000Z',
      exercises: [{
        exerciseId: 'bench',
        exerciseName: 'Bench',
        sets: [set({ rir: 2, rpe: 8 }), set()],
      }],
    });
    const state = buildWorkoutActivityState(
      session({
        exercisePlan: [{ exerciseId: 'bench', exerciseName: 'Barbell Bench' }],
        exercises: [{ exerciseId: 'bench', exerciseName: 'Barbell Bench', sets: [set()] }],
      }),
      day,
      [history],
      prefs,
    );
    expect(state).toEqual({
      title: 'Barbell Bench · Set 2/2',
      subtitle: '50kg × 8 · 01:05',
      progress: 0.5,
    });
  });

  it('falls back to any completed history and formats partials, failure, and RPE preferences', () => {
    const otherDayHistory = session({
      id: 'past',
      trainingDayId: 'other',
      completedAt: '2025-12-20T10:00:00.000Z',
      exercises: [{
        exerciseId: 'fly',
        exerciseName: 'Fly',
        sets: [set({ numberOfPartials: 3, rir: 'F', rpe: 10 })],
      }],
    });
    const state = buildWorkoutActivityState(
      session(),
      { ...day, exercises: [day.exercises![1]] },
      [otherDayHistory],
      prefs,
    );
    expect(state?.title).toBe('Fly · Set 1/1');
    expect(state?.subtitle).toContain('50kg × 8 · +3P · RPE 10');
    expect(state?.progress).toBe(0);
  });

  it('uses swap overrides and reports first-time and out-of-range history sets', () => {
    const swappedDay = { ...day, exercises: [day.exercises![0]] };
    const swapped = session({
      exerciseOverrides: { bench: { exerciseId: 'incline', exerciseName: 'Incline' } },
      exercises: [{ exerciseId: 'incline', exerciseName: 'Incline', sets: [set()] }],
    });
    expect(buildWorkoutActivityState(swapped, swappedDay, [], prefs)?.subtitle)
      .toContain('First time');

    const past = session({
      completedAt: '2025-12-20T10:00:00.000Z',
      exercises: [{ exerciseId: 'incline', exerciseName: 'Incline', sets: [set()] }],
    });
    expect(buildWorkoutActivityState(swapped, swappedDay, [past], prefs)?.subtitle)
      .toContain('No set 2 last time');
  });

  it('shows the final exercise after all targets are complete', () => {
    const state = buildWorkoutActivityState(
      session({
        exercises: [
          { exerciseId: 'bench', exerciseName: 'Bench', sets: [set(), set()] },
          { exerciseId: 'fly', exerciseName: 'Fly', sets: [set()] },
        ],
      }),
      day,
      [],
      { ...prefs, showRir: false, showRpe: false },
    );
    expect(state?.title).toBe('Fly · Set 2');
    expect(state?.progress).toBeUndefined();
  });
});
