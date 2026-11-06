import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import HomePage from '../index';
import { makeExercise, makeProgram, makeSession } from '@/test-utils/fixtures';
import { renderWithProviders } from '@/test-utils/render-with-providers';
import { router } from 'expo-router';
import type { Program } from '@/types/training';
import type { WorkoutSession } from '@/services/storage/session-storage';

let mockActiveProgram: Program | null = null;
let mockSession: WorkoutSession | null = null;
const mockStartSession = jest.fn();
const mockExpand = jest.fn();
const mockRefetchProgram = jest.fn();

jest.mock('@/hooks/useActiveProgram', () => ({
  useActiveProgram: () => ({
    program: mockActiveProgram,
    loading: false,
    refetch: mockRefetchProgram,
  }),
}));

jest.mock('@/contexts/WorkoutSessionContext', () => ({
  useWorkoutSession: () => ({
    session: mockSession,
    sessionHistory: [],
    startSession: mockStartSession,
    completeSession: jest.fn(),
    cancelSession: jest.fn(),
    loading: false,
  }),
}));

jest.mock('@/hooks/useStats', () => ({
  useStats: () => ({
    stats: { totalWorkouts: 0, currentStreak: 0 },
    incrementWorkouts: jest.fn(),
    loading: false,
  }),
}));

jest.mock('@/contexts/WorkoutUIContext', () => ({
  useWorkoutUI: () => ({
    isExpanded: false,
    expand: mockExpand,
    minimize: jest.fn(),
  }),
}));

jest.mock('expo-router', () => {
  const mockRouter = { push: jest.fn() };
  return {
    router: mockRouter,
    useFocusEffect: (callback: () => void) => callback(),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockActiveProgram = null;
  mockSession = null;
});

describe('home workout orchestration', () => {
  it('guards start when there is no active program', async () => {
    const view = await renderWithProviders(<HomePage />);
    await waitFor(() =>
      expect(view.getByText('No Program Selected')).toBeOnTheScreen()
    );

    await fireEvent.press(view.getByText('Start Workout'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'No Active Program',
      'Please set an active program in the Programs tab before starting a workout.',
      [{ text: 'OK' }]
    );
    expect(mockStartSession).not.toHaveBeenCalled();

    await fireEvent.press(view.getByText('Browse Programs'));
    expect(router.push).toHaveBeenCalledWith('/(tabs)/programs');
  });

  it('starts the next day with a snapshot of its exercise plan', async () => {
    mockActiveProgram = makeProgram();
    const view = await renderWithProviders(<HomePage />);
    expect((await view.findAllByText('Upper')).length).toBeGreaterThan(0);

    await fireEvent.press(view.getByText('Start Workout'));
    await waitFor(() =>
      expect(mockStartSession).toHaveBeenCalledWith(
        'program-1',
        'day-1',
        'Upper',
        [{ exerciseId: 'exercise-1', exerciseName: 'Bench Press' }]
      )
    );
    expect(mockExpand).toHaveBeenCalled();
  });

  it('resumes an active session without creating another one', async () => {
    mockActiveProgram = makeProgram();
    mockSession = makeSession();
    const view = await renderWithProviders(<HomePage />);

    await fireEvent.press(await view.findByText('Resume Workout'));
    expect(mockExpand).toHaveBeenCalled();
    expect(mockStartSession).not.toHaveBeenCalled();
  });

  it('navigates to day selection with the calculated next day', async () => {
    mockActiveProgram = makeProgram({
      trainingDays: [
        makeProgram().trainingDays![0],
        {
          id: 'day-2',
          userId: 'test-user',
          number: 2,
          name: 'Lower',
          exercises: [
            makeExercise({ id: 'exercise-2', name: 'Squat' }),
          ],
        },
      ],
    });
    const view = await renderWithProviders(<HomePage />);

    await fireEvent.press(await view.findByText('Choose a different day'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/select-training-day',
      params: {
        programId: 'program-1',
        currentNextDayId: 'day-1',
      },
    });
  });
});
