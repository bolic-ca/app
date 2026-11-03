import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import HistoryPage from '../history';
import SessionDetailModal from '../session-detail';
import SelectTrainingDayScreen from '../select-training-day';
import StatsPage from '../(tabs)/stats';
import { makeExercise, makeProgram, makeSession } from '@/test-utils/fixtures';
import {
  renderWithProviders,
  TEST_USER_ID,
} from '@/test-utils/render-with-providers';
import {
  getSessionsByMonth,
  saveSession,
  type SessionSet,
  type WorkoutSession,
} from '@/services/storage/session-storage';
import * as sessionStorage from '@/services/storage/session-storage';
import { updateStats } from '@/services/storage/stats-storage';
import * as statsStorage from '@/services/storage/stats-storage';
import { programStorage } from '@/services/storage/program-storage';
import {
  consumePendingDayOverride,
} from '@/utils/day-override-store';
import { router } from 'expo-router';
import type { Program } from '@/types/training';

const mockSearchParams: Record<string, string | undefined> = {};

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const mockRouter = {
    back: jest.fn(),
    push: jest.fn(),
  };
  return {
    router: mockRouter,
    Stack: { Screen: () => null },
    useLocalSearchParams: () => mockSearchParams,
    useFocusEffect: (callback: () => void | (() => void)) => {
      React.useEffect(() => callback(), [callback]);
    },
  };
});

const mockRouter = jest.mocked(router);

function localDateAt(daysFromToday: number, hour = 12, minute = 0) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  date.setDate(date.getDate() + daysFromToday);
  return date;
}

function loggedSession(
  overrides: Partial<WorkoutSession> = {},
  sets: SessionSet[] = [
    {
      weight: 100,
      reps: 10,
      rir: 2,
      rpe: 9,
      quality: 4,
      completedAt: localDateAt(0).toISOString(),
    },
  ]
): WorkoutSession {
  const startedAt = overrides.startedAt ?? localDateAt(0, 10).toISOString();
  return makeSession({
    completedAt: localDateAt(0, 11, 15).toISOString(),
    exercises: [
      {
        exerciseId: 'exercise-1',
        exerciseName: 'Bench Press',
        sets,
      },
    ],
    ...overrides,
    startedAt,
  });
}

async function chooseAlertAction(label: string) {
  const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
  const button = Array.isArray(buttons)
    ? buttons.find(candidate => candidate.text === label)
    : undefined;
  if (!button) throw new Error(`Alert action "${label}" was not found`);
  await act(async () => {
    await button.onPress?.();
  });
}

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  Object.keys(mockSearchParams).forEach(key => delete mockSearchParams[key]);
  consumePendingDayOverride();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('workout history', () => {
  it('moves from loading to empty state and navigates across months', async () => {
    let resolveSessions!: (
      sessions: Awaited<ReturnType<typeof getSessionsByMonth>>
    ) => void;
    const sessionsPending = new Promise<
      Awaited<ReturnType<typeof getSessionsByMonth>>
    >(resolve => {
      resolveSessions = resolve;
    });
    const getSessions = jest
      .spyOn(sessionStorage, 'getSessionsByMonth')
      .mockReturnValue(sessionsPending);
    const view = await renderWithProviders(<HistoryPage />);

    expect(view.getByLabelText('Loading workout history')).toBeOnTheScreen();
    await act(async () => resolveSessions([]));
    expect(await view.findByText('No workouts found')).toBeOnTheScreen();
    getSessions.mockRestore();

    const previousMonth = new Date();
    previousMonth.setMonth(previousMonth.getMonth() - 1);
    await fireEvent.press(view.getByLabelText('Previous month'));
    expect(
      await view.findByText(
        previousMonth.toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
        })
      )
    ).toBeOnTheScreen();

    await fireEvent.press(view.getByLabelText('Go back'));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('summarizes stored sessions, formats edge metrics, and opens details', async () => {
    const startedAt = localDateAt(0, 8).toISOString();
    const completedAt = localDateAt(0, 9, 15).toISOString();
    const session = loggedSession(
      {
        id: 'morning-session',
        name: 'Morning Strength',
        startedAt,
        completedAt,
      },
      [
        {
          weight: 100,
          reps: 10,
          numberOfPartials: 2,
          rir: 1,
          rpe: 9,
          quality: 4,
          completedAt,
        },
      ]
    );
    await saveSession(TEST_USER_ID, session, session.id);
    await saveSession(
      TEST_USER_ID,
      makeSession({
        id: 'open-session',
        name: undefined,
        startedAt: localDateAt(0, 7).toISOString(),
        completedAt: null,
      }),
      'open-session'
    );

    const view = await renderWithProviders(<HistoryPage />);

    expect(await view.findByText('Morning Strength')).toBeOnTheScreen();
    expect(view.getByText('Workout')).toBeOnTheScreen();
    expect(view.getByText('2')).toBeOnTheScreen();
    expect(view.getByText('workouts')).toBeOnTheScreen();
    expect(view.getByText('1')).toBeOnTheScreen();
    expect(view.getByText('sets')).toBeOnTheScreen();
    expect(view.getByText('2.2k')).toBeOnTheScreen();
    expect(view.getByText('220.5lbs×10 +2P RPE9 Q4/5')).toBeOnTheScreen();
    expect(view.getByText(/0 exercises · In progress/)).toBeOnTheScreen();

    await fireEvent.press(view.getByText('Morning Strength'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/session-detail',
      params: { session: JSON.stringify(session) },
    });
  });
});

describe('session details', () => {
  it('handles missing session data and goes back', async () => {
    mockSearchParams.session = '{not json';
    const view = await renderWithProviders(<SessionDetailModal />);

    expect(view.getByText('Session not found')).toBeOnTheScreen();
    await fireEvent.press(view.getByText('Go Back'));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('shows duration, notes, volume, and uncommon set metrics', async () => {
    const startedAt = localDateAt(0, 8).toISOString();
    const completedAt = localDateAt(0, 9, 15).toISOString();
    mockSearchParams.session = JSON.stringify(
      loggedSession(
        {
          name: '',
          notes: 'Strong finish',
          startedAt,
          completedAt,
        },
        [
          {
            weight: 100,
            reps: 5,
            numberOfPartials: 3,
            rir: 'P',
            rpe: 10,
            quality: 5,
            notes: 'Slow eccentric',
            completedAt,
          },
        ]
      )
    );

    const view = await renderWithProviders(<SessionDetailModal />);

    expect(view.getByText('Session Details')).toBeOnTheScreen();
    expect(view.getByText('1h 15m')).toBeOnTheScreen();
    expect(view.getByText('1 sets')).toBeOnTheScreen();
    expect(view.getByText('1,102.3 lbs')).toBeOnTheScreen();
    expect(view.getByText('+3P · Partials · RPE 10 · Q5/5')).toBeOnTheScreen();
    expect(view.getByText('Slow eccentric')).toBeOnTheScreen();
    expect(view.getByText('Strong finish')).toBeOnTheScreen();
  });

  it('edits and persists session fields using display weight units', async () => {
    const session = loggedSession({ id: 'editable', notes: 'Before' });
    await saveSession(TEST_USER_ID, session, session.id);
    mockSearchParams.session = JSON.stringify(session);
    const view = await renderWithProviders(<SessionDetailModal />);

    await fireEvent.press(view.getByText('Edit'));
    await fireEvent.changeText(view.getByDisplayValue('Upper'), 'Lower');
    await fireEvent.changeText(view.getByDisplayValue('Before'), 'After');
    await fireEvent.changeText(view.getByDisplayValue('220.5'), '110.2');
    await fireEvent.press(view.getByText('Save'));

    await waitFor(async () => {
      const stored = await getSessionsByMonth(
        TEST_USER_ID,
        new Date(session.startedAt).getFullYear(),
        new Date(session.startedAt).getMonth() + 1
      );
      expect(stored.find(item => item.id === session.id)?.data).toEqual(
        expect.objectContaining({
          name: 'Lower',
          notes: 'After',
          exercises: [
            expect.objectContaining({
              sets: [
                expect.objectContaining({
                  weight: expect.closeTo(49.99, 1),
                }),
              ],
            }),
          ],
        })
      );
    });
    expect(Alert.alert).toHaveBeenCalledWith('Success', 'Session updated');
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('confirms and deletes a persisted session', async () => {
    const session = loggedSession({ id: 'delete-me' });
    await saveSession(TEST_USER_ID, session, session.id);
    mockSearchParams.session = JSON.stringify(session);
    const view = await renderWithProviders(<SessionDetailModal />);

    await fireEvent.press(view.getByText('Edit'));
    await fireEvent.press(view.getByText('Delete Session'));
    expect(Alert.alert).toHaveBeenLastCalledWith(
      'Delete Session',
      'Are you sure you want to delete this session? This cannot be undone.',
      expect.any(Array)
    );
    await chooseAlertAction('Delete');

    const date = new Date(session.startedAt);
    expect(
      await getSessionsByMonth(
        TEST_USER_ID,
        date.getFullYear(),
        date.getMonth() + 1
      )
    ).toHaveLength(0);
    expect(mockRouter.back).toHaveBeenCalled();
  });
});

describe('training day selection', () => {
  it('shows loading and then a missing-program state', async () => {
    let resolvePrograms!: (
      programs: Awaited<ReturnType<typeof programStorage.getAll>>
    ) => void;
    const programsPending = new Promise<
      Awaited<ReturnType<typeof programStorage.getAll>>
    >(resolve => {
      resolvePrograms = resolve;
    });
    jest.spyOn(programStorage, 'getAll').mockReturnValue(programsPending);
    mockSearchParams.programId = 'missing';
    const view = await renderWithProviders(<SelectTrainingDayScreen />);

    expect(view.getByLabelText('Loading training days')).toBeOnTheScreen();
    await act(async () => resolvePrograms([]));
    expect(await view.findByText('Program not found')).toBeOnTheScreen();
  });

  it('flattens periodized days, marks the next day, and stores selection', async () => {
    const upper = {
      id: 'upper-day',
      userId: TEST_USER_ID,
      number: 1,
      name: 'Upper',
      exercises: [makeExercise()],
    };
    const lower = {
      id: 'lower-day',
      userId: TEST_USER_ID,
      number: 2,
      name: 'Lower',
      description: 'Heavy squats',
      exercises: [makeExercise({ id: 'squat', name: 'Squat' })],
    };
    const program: Program = {
      ...makeProgram(),
      id: 'periodized',
      name: 'Power Block',
      type: 'periodized',
      trainingDays: undefined,
      mesocycles: [
        {
          id: 'meso-1',
          userId: TEST_USER_ID,
          name: 'Base',
          microcycles: [
            {
              id: 'micro-1',
              userId: TEST_USER_ID,
              mesocycleId: 'meso-1',
              weekNumber: 1,
              trainingDays: [upper, lower],
            },
          ],
        },
      ],
    };
    await programStorage.save(TEST_USER_ID, program, program.id);
    mockSearchParams.programId = program.id;
    mockSearchParams.currentNextDayId = upper.id;

    const view = await renderWithProviders(<SelectTrainingDayScreen />);

    expect(await view.findByText('Power Block')).toBeOnTheScreen();
    expect(view.getByText('2 training days · tap a day to start there')).toBeOnTheScreen();
    expect(view.getByText('UP NEXT')).toBeOnTheScreen();
    expect(view.getByText('1 exercises · Heavy squats')).toBeOnTheScreen();

    await fireEvent.press(view.getByText('Lower'));
    expect(consumePendingDayOverride()).toBe('lower-day');
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('shows an empty state for a program without training days', async () => {
    const program = makeProgram({
      id: 'empty-program',
      name: 'Empty Plan',
      trainingDays: [],
    });
    await programStorage.save(TEST_USER_ID, program, program.id);
    mockSearchParams.programId = program.id;

    const view = await renderWithProviders(<SelectTrainingDayScreen />);
    expect(await view.findByText('No training days')).toBeOnTheScreen();
  });
});

describe('stats', () => {
  it('shows loading followed by zero stats and empty recent activity', async () => {
    let resolveStats!: (
      stats: Awaited<ReturnType<typeof statsStorage.getStats>>
    ) => void;
    const statsPending = new Promise<
      Awaited<ReturnType<typeof statsStorage.getStats>>
    >(resolve => {
      resolveStats = resolve;
    });
    jest.spyOn(statsStorage, 'getStats').mockReturnValue(statsPending);
    const view = await renderWithProviders(<StatsPage />, {
      workoutSession: true,
    });

    expect(view.getByLabelText('Loading stats')).toBeOnTheScreen();
    await act(async () =>
      resolveStats({
        totalWorkouts: 0,
        currentStreak: 0,
        longestStreak: 0,
        totalVolume: 0,
        activeTime: 0,
        lastWorkoutDate: null,
        weeklyWorkouts: [0, 0, 0, 0, 0, 0, 0],
      })
    );
    expect(await view.findByText('No Recent Activity')).toBeOnTheScreen();
    expect(view.getByText('0.0k')).toBeOnTheScreen();
    expect(view.getByText('0%')).toBeOnTheScreen();
  });

  it('calculates totals and local seven-day boundaries and navigates', async () => {
    const rangeStart = localDateAt(-6, 0, 0);
    const justOutside = new Date(rangeStart.getTime() - 1);
    const includedCompleted = rangeStart;
    const includedStarted = new Date(rangeStart.getTime() - 60 * 60 * 1000);
    const outsideCompleted = justOutside;
    const outsideStarted = new Date(justOutside.getTime() - 60 * 60 * 1000);

    const included = loggedSession({
      id: 'inside-week',
      name: 'Boundary Day',
      startedAt: includedStarted.toISOString(),
      completedAt: includedCompleted.toISOString(),
      exercises: [
        {
          exerciseId: 'bench',
          exerciseName: 'Bench Press',
          sets: [
            {
              weight: 100,
              reps: 10,
              completedAt: includedCompleted.toISOString(),
            },
          ],
        },
      ],
    });
    const outside = loggedSession({
      id: 'outside-week',
      name: 'Prior Day',
      startedAt: outsideStarted.toISOString(),
      completedAt: outsideCompleted.toISOString(),
      exercises: [
        {
          exerciseId: 'row',
          exerciseName: 'Row',
          sets: [
            {
              weight: 50,
              reps: 10,
              completedAt: outsideCompleted.toISOString(),
            },
          ],
        },
      ],
    });
    await saveSession(TEST_USER_ID, included, included.id);
    await saveSession(TEST_USER_ID, outside, outside.id);
    await updateStats(TEST_USER_ID, {
      totalWorkouts: 9,
      currentStreak: 4,
      longestStreak: 6,
      totalVolume: 0,
      activeTime: 0,
      lastWorkoutDate: included.completedAt,
      weeklyWorkouts: [0, 0, 0, 0, 0, 0, 0],
    });

    const view = await renderWithProviders(<StatsPage />, {
      workoutSession: true,
    });

    expect(await view.findByText('Boundary Day')).toBeOnTheScreen();
    expect(view.getByText('9')).toBeOnTheScreen();
    expect(view.getByText('4')).toBeOnTheScreen();
    expect(view.getByText('3.3k')).toBeOnTheScreen();
    expect(view.getByText('2')).toBeOnTheScreen();
    expect(view.getByText('1')).toBeOnTheScreen();
    expect(view.getByText('of 7 days')).toBeOnTheScreen();
    expect(view.getByText('14%')).toBeOnTheScreen();
    expect(view.getAllByLabelText(/workout completed/)).toHaveLength(1);

    await fireEvent.press(view.getByText('Boundary Day'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/session-detail',
      params: { session: JSON.stringify(included) },
    });
    await fireEvent.press(view.getByText('View All History'));
    expect(mockRouter.push).toHaveBeenCalledWith('/history');
  });
});
