import { act, renderHook, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { useStorage } from '@/contexts/StorageContext';
import { exerciseStorage } from '@/services/storage/exercise-storage';
import { trainingDayStorage } from '@/services/storage/training-day-storage';
import {
  clearActiveProgramId,
  getActiveProgramId,
  programStorage,
  setActiveProgramId,
} from '@/services/storage/program-storage';
import { getStats, updateStats } from '@/services/storage/stats-storage';
import { personalRecordsStorage } from '@/services/storage/personal-records-storage';
import { useExercises } from '@/hooks/useExercises';
import { useTrainingDay } from '@/hooks/useTrainingDay';
import { useActiveProgram } from '@/hooks/useActiveProgram';
import { useStats } from '@/hooks/useStats';
import type { TrainingDay, TrainingExercise } from '@/types/training';

jest.mock('@/contexts/StorageContext', () => ({ useStorage: jest.fn() }));
jest.mock('@/services/storage/exercise-storage', () => ({
  exerciseStorage: {
    getAll: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  },
}));
jest.mock('@/services/storage/training-day-storage', () => ({
  trainingDayStorage: { getById: jest.fn() },
}));
jest.mock('@/services/storage/program-storage', () => ({
  programStorage: { getById: jest.fn() },
  getActiveProgramId: jest.fn(),
  setActiveProgramId: jest.fn(),
  clearActiveProgramId: jest.fn(),
}));
jest.mock('@/services/storage/stats-storage', () => ({
  getStats: jest.fn(),
  updateStats: jest.fn(),
}));
jest.mock('@/services/storage/personal-records-storage', () => ({
  personalRecordsStorage: {
    getAll: jest.fn(),
    save: jest.fn(),
  },
}));

const mockedUseStorage = jest.mocked(useStorage);
const mockedExerciseStorage = {
  getAll: jest.mocked(exerciseStorage.getAll),
  save: jest.mocked(exerciseStorage.save),
  delete: jest.mocked(exerciseStorage.delete),
};
const mockedTrainingDayGet = jest.mocked(trainingDayStorage.getById);
const mockedProgramGet = jest.mocked(programStorage.getById);
const mockedGetActiveProgramId = jest.mocked(getActiveProgramId);
const mockedSetActiveProgramId = jest.mocked(setActiveProgramId);
const mockedClearActiveProgramId = jest.mocked(clearActiveProgramId);
const mockedGetStats = jest.mocked(getStats);
const mockedUpdateStats = jest.mocked(updateStats);
const mockedPRGetAll = jest.mocked(personalRecordsStorage.getAll);
const mockedPRSave = jest.mocked(personalRecordsStorage.save);

const exercise: TrainingExercise = {
  id: 'exercise',
  userId: 'user',
  trainingDayIds: ['day'],
  name: 'Bench',
};

const trainingDay: TrainingDay = {
  id: 'day',
  userId: 'user',
  name: 'Push',
  exercises: [exercise],
};

const baseStats = {
  totalWorkouts: 2,
  currentStreak: 1,
  longestStreak: 2,
  totalVolume: 100,
  activeTime: 1,
  lastWorkoutDate: null,
  weeklyWorkouts: [0, 0, 0, 0, 0, 0, 0],
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
  mockedUseStorage.mockReturnValue({
    userId: 'user',
    isInitialized: true,
    needsOnboarding: false,
    completeOnboarding: jest.fn(async () => {}),
  });
  mockedExerciseStorage.getAll.mockResolvedValue([]);
  mockedTrainingDayGet.mockResolvedValue(null);
  mockedGetActiveProgramId.mockResolvedValue(null);
  mockedGetStats.mockResolvedValue(baseStats);
  mockedPRGetAll.mockResolvedValue([]);
});

describe('useTrainingDay', () => {
  it('loads a training day and supports refetch', async () => {
    mockedTrainingDayGet.mockResolvedValue({ id: 'day', userId: 'user', data: trainingDay } as never);
    const { result } = await renderHook(() => useTrainingDay({ trainingDayId: 'day' }));
    await waitFor(() => expect(result.current.data).toEqual(trainingDay));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();

    await act(async () => result.current.refetch());
    expect(mockedTrainingDayGet).toHaveBeenCalledTimes(2);
  });

  it('returns null for missing records and skips disabled or incomplete requests', async () => {
    const { result } = await renderHook(() =>
      useTrainingDay({ trainingDayId: 'day', enabled: false }),
    );
    await act(async () => result.current.refetch());
    expect(mockedTrainingDayGet).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
  });

  it('normalizes thrown values and clears stale data on failure', async () => {
    mockedTrainingDayGet
      .mockResolvedValueOnce({ id: 'day', userId: 'user', data: trainingDay } as never)
      .mockRejectedValueOnce('offline');
    const { result } = await renderHook(() => useTrainingDay({ trainingDayId: 'day' }));
    await waitFor(() => expect(result.current.data).toEqual(trainingDay));
    await act(async () => result.current.refetch());
    expect(result.current.data).toBeNull();
    expect(result.current.error?.message).toBe('Failed to fetch training day');
  });
});

describe('useExercises', () => {
  it('loads, transforms, filters, and looks up exercises', async () => {
    const other = { ...exercise, id: 'other', trainingDayIds: ['other'] };
    mockedExerciseStorage.getAll.mockResolvedValue([
      { id: 'exercise', userId: 'user', data: { ...exercise, id: undefined } },
      { id: 'other', userId: 'user', data: { ...other, id: undefined } },
    ] as never);
    const { result } = await renderHook(() => useExercises({ trainingDayId: 'day' }));
    await waitFor(() => expect(result.current.allExercises).toHaveLength(2));
    expect(result.current.exercises.map(item => item.id)).toEqual(['exercise']);
    expect(result.current.getExerciseById('other')?.name).toBe('Bench');
    expect(result.current.getExerciseById('missing')).toBeNull();
  });

  it('stops loading without a user and does not call storage', async () => {
    mockedUseStorage.mockReturnValue({
      userId: '',
      isInitialized: true,
      needsOnboarding: false,
      completeOnboarding: jest.fn(async () => {}),
    });
    const { result } = await renderHook(() => useExercises());
    await act(async () => result.current.refetch());
    expect(result.current.loading).toBe(false);
    expect(mockedExerciseStorage.getAll).not.toHaveBeenCalled();
  });

  it('surfaces fetch failures including non-Error values', async () => {
    mockedExerciseStorage.getAll.mockRejectedValueOnce('offline');
    const { result } = await renderHook(() => useExercises());
    await waitFor(() =>
      expect(result.current.error?.message).toBe('Failed to load exercises'),
    );
    expect(result.current.loading).toBe(false);
  });

  it('creates, updates, and deletes exercises then refreshes', async () => {
    mockedExerciseStorage.save.mockResolvedValue({
      id: 'new',
      userId: 'user',
      data: exercise,
    } as never);
    const { result } = await renderHook(() => useExercises());
    await waitFor(() => expect(mockedExerciseStorage.getAll).toHaveBeenCalledTimes(1));

    let created: TrainingExercise | undefined;
    await act(async () => {
      created = await result.current.createExercise({
        userId: 'user',
        trainingDayIds: [],
        name: 'Row',
      });
    });
    expect(created?.id).toBe('new');
    await act(async () => result.current.updateExercise(exercise as TrainingExercise & { id: string }));
    await act(async () => result.current.deleteExercise('exercise'));
    expect(mockedExerciseStorage.save).toHaveBeenCalledTimes(2);
    expect(mockedExerciseStorage.delete).toHaveBeenCalledWith('user', 'exercise');
    expect(mockedExerciseStorage.getAll).toHaveBeenCalledTimes(4);
  });

  it('requires a user for every mutation', async () => {
    mockedUseStorage.mockReturnValue({
      userId: '',
      isInitialized: true,
      needsOnboarding: false,
      completeOnboarding: jest.fn(async () => {}),
    });
    const { result } = await renderHook(() => useExercises({ enabled: false }));
    await expect(result.current.createExercise(exercise)).rejects.toThrow('User ID is required');
    await expect(result.current.updateExercise(exercise as TrainingExercise & { id: string }))
      .rejects.toThrow('User ID is required');
    await expect(result.current.deleteExercise('x')).rejects.toThrow('User ID is required');
  });

  it('normalizes and rethrows mutation failures', async () => {
    const { result } = await renderHook(() => useExercises({ enabled: false }));
    mockedExerciseStorage.save.mockRejectedValueOnce('create');
    await expect(result.current.createExercise(exercise)).rejects.toThrow(
      'Failed to create exercise',
    );
    mockedExerciseStorage.save.mockRejectedValueOnce('update');
    await expect(result.current.updateExercise(exercise as TrainingExercise & { id: string }))
      .rejects.toThrow('Failed to update exercise');
    mockedExerciseStorage.delete.mockRejectedValueOnce('delete');
    await expect(result.current.deleteExercise('x')).rejects.toThrow(
      'Failed to delete exercise',
    );
  });
});

describe('useActiveProgram', () => {
  const programItem = {
    id: 'program',
    userId: 'user',
    data: { name: 'Strength', type: 'simple' },
  };

  it('loads an active program', async () => {
    mockedGetActiveProgramId.mockResolvedValue('program');
    mockedProgramGet.mockResolvedValue(programItem as never);
    const { result } = await renderHook(() => useActiveProgram());
    await waitFor(() => expect(result.current.program).toMatchObject({
      id: 'program',
      name: 'Strength',
    }));
    expect(result.current.loading).toBe(false);
  });

  it('clears a dangling active ID', async () => {
    mockedGetActiveProgramId.mockResolvedValue('missing');
    mockedProgramGet.mockResolvedValue(null);
    const { result } = await renderHook(() => useActiveProgram());
    await waitFor(() => expect(mockedClearActiveProgramId).toHaveBeenCalledWith('user'));
    expect(result.current.program).toBeNull();
  });

  it('handles no active ID and normalized fetch errors', async () => {
    const { result } = await renderHook(() => useActiveProgram());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.program).toBeNull();

    mockedGetActiveProgramId.mockRejectedValueOnce('offline');
    await act(async () => result.current.refetch());
    expect(result.current.error?.message).toBe('Failed to load active program');
  });

  it('sets and clears an active program', async () => {
    mockedProgramGet.mockResolvedValue(programItem as never);
    const { result } = await renderHook(() => useActiveProgram());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => result.current.setActive('program'));
    expect(mockedSetActiveProgramId).toHaveBeenCalledWith('user', 'program');
    expect(result.current.program?.id).toBe('program');
    await act(async () => result.current.clearActive());
    expect(result.current.program).toBeNull();
  });

  it('rejects missing programs and normalizes clear failures', async () => {
    const { result } = await renderHook(() => useActiveProgram());
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockedProgramGet.mockResolvedValue(null);
    await expect(result.current.setActive('missing')).rejects.toThrow('Program not found');
    mockedClearActiveProgramId.mockRejectedValueOnce('clear');
    await expect(result.current.clearActive()).rejects.toThrow(
      'Failed to clear active program',
    );
  });
});

describe('useStats', () => {
  it('loads stats and personal records', async () => {
    mockedPRGetAll.mockResolvedValue([
      {
        id: 'pr',
        userId: 'user',
        data: { id: 'pr', exerciseName: 'Bench', weight: 100, reps: 5, unit: 'kg', achievedAt: 'now' },
      },
    ] as never);
    const { result } = await renderHook(() => useStats());
    await waitFor(() => expect(result.current.stats).toEqual(baseStats));
    expect(result.current.prs[0].exerciseName).toBe('Bench');
    expect(result.current.loading).toBe(false);
  });

  it('normalizes fetch errors and exits loading', async () => {
    mockedGetStats.mockRejectedValueOnce('offline');
    const { result } = await renderHook(() => useStats());
    await waitFor(() =>
      expect(result.current.error?.message).toBe('Failed to load stats'),
    );
    expect(result.current.loading).toBe(false);
  });

  it('increments workout totals, streak, longest streak, and active time', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-02T10:00:00.000Z'));
    mockedGetStats.mockResolvedValue({
      ...baseStats,
      currentStreak: 2,
      longestStreak: 2,
      lastWorkoutDate: '2026-01-01T10:00:00.000Z',
    });
    const { result } = await renderHook(() => useStats());
    await waitFor(() => expect(result.current.stats).not.toBeNull());
    await act(async () => result.current.incrementWorkouts(5400));
    expect(mockedUpdateStats).toHaveBeenCalledWith(
      'user',
      expect.objectContaining({
        totalWorkouts: 3,
        currentStreak: 3,
        longestStreak: 3,
        activeTime: 2.5,
        lastWorkoutDate: '2026-01-02T10:00:00.000Z',
      }),
    );
    jest.useRealTimers();
  });

  it('fetches a base for increment when state is not loaded and handles zero duration', async () => {
    mockedUseStorage.mockReturnValue({
      userId: 'user',
      isInitialized: false,
      needsOnboarding: false,
      completeOnboarding: jest.fn(async () => {}),
    });
    const { result } = await renderHook(() => useStats());
    await act(async () => result.current.incrementWorkouts());
    expect(mockedGetStats).toHaveBeenCalledWith('user');
    expect(mockedUpdateStats).toHaveBeenCalledWith(
      'user',
      expect.objectContaining({ activeTime: 1 }),
    );
  });

  it('requires storage and rethrows normalized update failures', async () => {
    mockedUseStorage.mockReturnValue({
      userId: '',
      isInitialized: true,
      needsOnboarding: false,
      completeOnboarding: jest.fn(async () => {}),
    });
    const { result } = await renderHook(() => useStats());
    await expect(result.current.incrementWorkouts()).rejects.toThrow('Storage is not ready');

    mockedUseStorage.mockReturnValue({
      userId: 'user',
      isInitialized: false,
      needsOnboarding: false,
      completeOnboarding: jest.fn(async () => {}),
    });
    const second = await renderHook(() => useStats());
    mockedUpdateStats.mockRejectedValueOnce('write');
    await expect(second.result.current.incrementWorkouts()).rejects.toThrow(
      'Failed to update stats',
    );
  });

  it('adds a personal record and refreshes stats', async () => {
    const { result } = await renderHook(() => useStats());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => result.current.addPersonalRecord({
      exerciseName: 'Squat',
      weight: 120,
      reps: 3,
      unit: 'kg',
      achievedAt: 'now',
    }));
    expect(mockedPRSave).toHaveBeenCalledWith(
      'user',
      expect.objectContaining({ exerciseName: 'Squat' }),
    );
    expect(mockedGetStats).toHaveBeenCalledTimes(2);
  });

  it('rethrows normalized personal-record save errors', async () => {
    const { result } = await renderHook(() => useStats());
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockedPRSave.mockRejectedValueOnce('write');
    await expect(result.current.addPersonalRecord({
      exerciseName: 'Squat',
      weight: 120,
      reps: 3,
      unit: 'kg',
      achievedAt: 'now',
    })).rejects.toThrow('Failed to add personal record');
  });

  it('creates only improved PRs and safely handles comparison failures', async () => {
    mockedPRGetAll.mockResolvedValue([
      {
        id: 'pr',
        userId: 'user',
        data: { id: 'pr', exerciseName: 'Bench', weight: 100, reps: 5, unit: 'kg', achievedAt: 'now' },
      },
    ] as never);
    const { result } = await renderHook(() => useStats());
    await waitFor(() => expect(result.current.prs).toHaveLength(1));
    expect(await result.current.checkAndUpdatePR('Bench', 90, 5, 'kg')).toBe(false);
    expect(await result.current.checkAndUpdatePR('Bench', 110, 5, 'kg', 'session')).toBe(true);
    expect(mockedPRSave).toHaveBeenCalledWith(
      'user',
      expect.objectContaining({ weight: 110, sessionId: 'session' }),
    );

    mockedPRSave.mockRejectedValueOnce(new Error('failed'));
    expect(await result.current.checkAndUpdatePR('New', 50, 5, 'kg')).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });
});
