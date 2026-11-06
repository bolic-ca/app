import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import * as ReactNative from 'react-native';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { beforeEach, afterEach, describe, expect, it, jest } from '@jest/globals';

import ExerciseList from '../ExerciseList';
import ExerciseSwapModal from '../ExerciseSwapModal';
import PreviousPerformance from '../PreviousPerformance';
import ReorderModal from '../ReorderModal';
import SessionStartOptions from '../SessionStartOptions';
import SetEditor from '../SetEditor';
import SetListItem from '../SetListItem';
import WorkoutInterface from '../WorkoutInterface';
import WorkoutProgressBar from '../WorkoutProgressBar';
import WorkoutTimer from '../WorkoutTimer';
import { MuscleCategory, type TrainingExercise } from '@/types/training';
import { makeExercise, makeSession } from '@/test-utils/fixtures';
import { renderWithProviders } from '@/test-utils/render-with-providers';

const mockRefetch = jest.fn();
let mockExercises: TrainingExercise[] = [];
const mockAddSet = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockUpdateSet = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockDeleteSet = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockSwapExercise = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockAddExercise = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockRemoveExercise = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockReorderExercises = jest.fn<(...args: unknown[]) => Promise<void>>();

jest.mock('@/contexts/WorkoutSessionContext', () => ({
  useWorkoutSession: () => ({
    addSet: mockAddSet,
    updateSet: mockUpdateSet,
    deleteSet: mockDeleteSet,
    swapExercise: mockSwapExercise,
    addExerciseToSession: mockAddExercise,
    removeExerciseFromSession: mockRemoveExercise,
    reorderExercises: mockReorderExercises,
    sessionHistory: [],
  }),
}));

jest.mock('@/hooks/useExercises', () => ({
  useExercises: () => ({
    allExercises: mockExercises,
    refetch: mockRefetch,
  }),
}));

jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void) => callback(),
}));

jest.mock('react-native-gesture-handler', () => {
  const ReactNative =
    jest.requireActual<typeof import('react-native')>('react-native');
  const chain = {
    onBegin: jest.fn(),
    onUpdate: jest.fn(),
    onEnd: jest.fn(),
    onFinalize: jest.fn(),
  };
  chain.onBegin.mockReturnValue(chain);
  chain.onUpdate.mockReturnValue(chain);
  chain.onEnd.mockReturnValue(chain);
  chain.onFinalize.mockReturnValue(chain);
  return {
    Gesture: { Pan: () => chain },
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
    GestureHandlerRootView: ReactNative.View,
  };
});

const trainingDay = {
  id: 'day-1',
  userId: 'test-user',
  number: 1,
  name: 'Upper',
  exercises: [
    makeExercise(),
    makeExercise({
      id: 'exercise-2',
      name: 'Row',
      muscleCategory: MuscleCategory.Back,
      equipment: 'Cable',
    }),
  ],
};

const completedSet = {
  weight: 100,
  reps: 8,
  completedAt: '2026-10-01T10:00:00.000Z',
};

async function enableQuality() {
  await AsyncStorage.setItem(
    '@bolic_preferences',
    JSON.stringify({
      weightUnit: 'lbs',
      showRir: true,
      showRpe: true,
      showNotes: true,
      showQuality: true,
    })
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockExercises = trainingDay.exercises;
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('SessionStartOptions', () => {
  it('summarizes added and removed exercises and handles every choice', async () => {
    const onChoose = jest.fn();
    const onDismiss = jest.fn();
    const view = await renderWithProviders(
      <SessionStartOptions
        visible
        trainingDay={trainingDay}
        lastPlan={[
          { exerciseId: 'exercise-1', exerciseName: 'Bench Press' },
          { exerciseId: 'exercise-3', exerciseName: 'Pulldown' },
        ]}
        onChoose={onChoose}
        onDismiss={onDismiss}
      />
    );

    expect(view.getByText('Added  ')).toBeOnTheScreen();
    expect(view.getByText('Removed  ')).toBeOnTheScreen();

    await fireEvent.press(view.getByText('Use template'));
    await fireEvent.press(view.getByText('Repeat last session'));
    await fireEvent.press(view.getByText('Repeat last + update template'));
    expect(onChoose.mock.calls.map(([choice]) => choice)).toEqual([
      'template',
      'last',
      'lastAndSave',
    ]);

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('shows reorder-only changes and the fallback workout title', async () => {
    const view = await renderWithProviders(
      <SessionStartOptions
        visible
        trainingDay={{ ...trainingDay, name: null }}
        lastPlan={[
          { exerciseId: 'exercise-2', exerciseName: 'Row' },
          { exerciseId: 'exercise-1', exerciseName: 'Bench Press' },
        ]}
        onChoose={jest.fn()}
        onDismiss={jest.fn()}
      />
    );

    expect(view.getByText('Start Workout?')).toBeOnTheScreen();
    expect(view.getByText('Reordered  ')).toBeOnTheScreen();
  });

  it('omits the diff card when layouts match', async () => {
    const view = await renderWithProviders(
      <SessionStartOptions
        visible
        trainingDay={trainingDay}
        lastPlan={[
          { exerciseId: 'exercise-1', exerciseName: 'Bench Press' },
          { exerciseId: 'exercise-2', exerciseName: 'Row' },
        ]}
        onChoose={jest.fn()}
        onDismiss={jest.fn()}
      />
    );
    expect(view.queryByText('Changes from last time')).not.toBeOnTheScreen();
  });
});

describe('PreviousPerformance', () => {
  it('renders the first-time state', async () => {
    const view = await renderWithProviders(<PreviousPerformance data={null} />);
    expect(view.getByText('First time doing this exercise')).toBeOnTheScreen();
  });

  it('shows set metadata, opens notes, and displays full history', async () => {
    await enableQuality();
    const set = {
      ...completedSet,
      rir: 'F' as const,
      rpe: 9,
      quality: 4,
      notes: 'Long controlled eccentric',
    };
    const partialSet = { ...completedSet, numberOfPartials: 3 };
    const history = [
      makeSession({
        id: 'past-1',
        name: 'Upper A',
        startedAt: '2026-10-01T10:00:00.000Z',
        completedAt: '2026-10-01T11:00:00.000Z',
        exercises: [{ exerciseId: 'exercise-1', exerciseName: 'Bench Press', sets: [set, partialSet] }],
      }),
      makeSession({
        id: 'past-2',
        name: undefined,
        startedAt: '2026-09-01T10:00:00.000Z',
        completedAt: '2026-09-01T11:00:00.000Z',
        exercises: [{
          exerciseId: 'exercise-1',
          exerciseName: 'Bench Press',
          sets: [{ ...completedSet, rir: 'P' as const, notes: 'Backoff' }],
        }],
      }),
      makeSession(),
    ];
    const view = await renderWithProviders(
      <PreviousPerformance
        data={{ sets: [set, partialSet], weight: 100, reps: 8, rir: 'F', rpe: 9, quality: 4 }}
        exerciseId="exercise-1"
        exerciseName="Bench Press"
        sessionHistory={history}
      />
    );

    await waitFor(() => expect(view.getByText('2 sessions')).toBeOnTheScreen());
    expect(view.getByText('F')).toBeOnTheScreen();
    expect(view.getByText('RPE9')).toBeOnTheScreen();
    expect(view.getByText('Q4/5')).toBeOnTheScreen();
    expect(view.getByText('+3P')).toBeOnTheScreen();

    await fireEvent.press(view.getByText('Long control…'));
    expect(view.getByText('Set Note')).toBeOnTheScreen();
    expect(view.getByText('Long controlled eccentric')).toBeOnTheScreen();
    await fireEvent.press(view.getByText('2 sessions'));
    expect(view.getByText('HISTORY')).toBeOnTheScreen();
    expect(view.getByText('Latest')).toBeOnTheScreen();
    expect(view.getByText('Upper A')).toBeOnTheScreen();
    expect(view.getByText('Failure')).toBeOnTheScreen();
    expect(view.getByText('Partials')).toBeOnTheScreen();
    expect(view.getByText('RPE 9')).toBeOnTheScreen();
  });

  it('does not offer history expansion without identifiers', async () => {
    const view = await renderWithProviders(
      <PreviousPerformance
        data={{ sets: [completedSet], weight: 100, reps: 8 }}
      />
    );
    expect(view.queryByText(/session/)).not.toBeOnTheScreen();
  });
});

describe('ExerciseSwapModal', () => {
  it('filters by text and category, clears filters, and selects a replacement', async () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();
    const history = [
      makeSession({
        completedAt: '2026-10-01T11:00:00.000Z',
        exercises: [{
          exerciseId: 'exercise-2',
          exerciseName: 'Row',
          sets: [{ ...completedSet, rir: 2 }],
        }],
      }),
    ];
    const view = await renderWithProviders(
      <ExerciseSwapModal
        visible
        currentExerciseId="exercise-1"
        sessionHistory={history}
        onClose={onClose}
        onSelectExercise={onSelect}
      />
    );

    expect(view.getByText('Current')).toBeOnTheScreen();
    expect(view.getByText('No history')).toBeOnTheScreen();
    expect(view.getByText(/Last: 220\.5lbs × 8 @2RIR/)).toBeOnTheScreen();
    await fireEvent.press(view.getByText('Bench Press'));
    expect(onSelect).not.toHaveBeenCalled();

    const search = view.getByPlaceholderText('Search name, muscle, equipment');
    await fireEvent.changeText(search, 'nothing');
    expect(view.getByText('No Matches')).toBeOnTheScreen();
    await fireEvent.press(view.getByText('Clear filters'));
    expect(view.getByText('Row')).toBeOnTheScreen();

    await fireEvent.press(view.getAllByText('Back')[0]);
    expect(view.queryByText('Bench Press')).not.toBeOnTheScreen();
    await fireEvent.press(view.getAllByText('Back')[0]);
    expect(view.getByText('Bench Press')).toBeOnTheScreen();

    await fireEvent.changeText(search, 'cable');
    await fireEvent.press(view.getByText('Row'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'exercise-2' }));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows the unfiltered empty-library state', async () => {
    mockExercises = [];
    const view = await renderWithProviders(
      <ExerciseSwapModal visible onClose={jest.fn()} onSelectExercise={jest.fn()} />
    );
    expect(view.getByText('No exercises found')).toBeOnTheScreen();
    expect(view.getByText('No exercises in library')).toBeOnTheScreen();
    expect(view.queryByText('Clear filters')).not.toBeOnTheScreen();
  });
});

describe('ExerciseList and ReorderModal', () => {
  it('uses the session plan, opens add/reorder flows, and forwards actions', async () => {
    const onAddExercise = jest.fn();
    const onReorder = jest.fn();
    const view = await renderWithProviders(
      <ExerciseList
        trainingDay={trainingDay}
        session={makeSession({
          exercisePlan: [
            { exerciseId: 'exercise-1', exerciseName: 'Bench Press' },
            { exerciseId: 'missing', exerciseName: 'Legacy Movement' },
          ],
        })}
        sessionHistory={[]}
        onAddSet={jest.fn()}
        onAddExercise={onAddExercise}
        onRemoveExercise={jest.fn()}
        onReorderExercises={onReorder}
      />
    );

    expect(mockRefetch).toHaveBeenCalled();
    expect(view.getByText('2 exercises')).toBeOnTheScreen();
    expect(view.getByText('Legacy Movement')).toBeOnTheScreen();
    await fireEvent.press(view.getByText('Add Exercise'));
    expect(view.getByText('ADD')).toBeOnTheScreen();
    await fireEvent.press(view.getByText('Row'));
    expect(onAddExercise).toHaveBeenCalledWith(expect.objectContaining({ id: 'exercise-2' }));

    await fireEvent.press(view.getByText('Reorder'));
    expect(view.getByText('Drag any exercise to reorder')).toBeOnTheScreen();
    await fireEvent.press(view.getByText('Done'));
    expect(onReorder).toHaveBeenCalledWith([
      { exerciseId: 'exercise-1', exerciseName: 'Bench Press' },
      { exerciseId: 'missing', exerciseName: 'Legacy Movement' },
    ]);
  });

  it('handles an explicitly empty plan and legacy swap fallback', async () => {
    const empty = await renderWithProviders(
      <ExerciseList
        trainingDay={trainingDay}
        session={makeSession({ exercisePlan: [] })}
        sessionHistory={[]}
        onAddSet={jest.fn()}
        onAddExercise={jest.fn()}
      />
    );
    expect(empty.getByText('0 exercises')).toBeOnTheScreen();

    await empty.rerender(
      <ExerciseList
        trainingDay={trainingDay}
        session={makeSession({
          exercisePlan: undefined,
          exerciseOverrides: {
            'exercise-1': { exerciseId: 'exercise-2', exerciseName: 'Row' },
          },
        })}
        sessionHistory={[]}
        onAddSet={jest.fn()}
      />
    );
    expect(empty.getAllByText('Row')).not.toHaveLength(0);
  });

  it('resets on reopen and supports cancel and save without dragging', async () => {
    const onClose = jest.fn();
    const onSave = jest.fn();
    const exercises = [
      { exerciseId: 'exercise-1', exerciseName: 'Bench Press' },
      { exerciseId: 'exercise-2', exerciseName: 'Row' },
    ];
    const view = await renderWithProviders(
      <ReorderModal visible exercises={exercises} onClose={onClose} onSave={onSave} />
    );
    await fireEvent.press(view.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();

    await view.rerender(
      <ReorderModal
        visible
        exercises={[...exercises].reverse()}
        onClose={onClose}
        onSave={onSave}
      />
    );
    await fireEvent.press(view.getByText('Done'));
    expect(onSave).toHaveBeenCalledWith([...exercises].reverse());
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('SetEditor branches', () => {
  it('validates reps after a valid weight', async () => {
    const view = await renderWithProviders(
      <SetEditor visible mode="add" onSubmit={jest.fn()} onClose={jest.fn()} />
    );
    await fireEvent.changeText(view.getByLabelText('Weight'), '100');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await fireEvent.press(view.getAllByText('Add Set').at(-1)!);
    expect(alert).toHaveBeenCalledWith(
      'Invalid Reps',
      'Please enter a valid number of reps greater than 0'
    );
  });

  it('handles free-form RIR, partials, RPE, quality toggles, and optional fields', async () => {
    await enableQuality();
    const onSubmit = jest.fn();
    const view = await renderWithProviders(
      <SetEditor visible mode="add" onSubmit={onSubmit} onClose={jest.fn()} />
    );
    await waitFor(() => expect(view.getByText(/Set Quality/)).toBeOnTheScreen());
    await fireEvent.changeText(view.getByLabelText('Weight'), '100');
    await fireEvent.changeText(view.getByLabelText('Reps'), '5');

    const freeInputs = view.getAllByPlaceholderText('—');
    await fireEvent.changeText(freeInputs[0], '-');
    await fireEvent.changeText(freeInputs[0], '1.5');
    const partials = view.getByPlaceholderText('P');
    await fireEvent.changeText(partials, '3');
    await fireEvent.changeText(partials, '');
    await fireEvent.press(view.getByText('F'));
    await fireEvent.press(view.getByText('F'));
    await fireEvent.changeText(partials, '2');

    await fireEvent.changeText(freeInputs[1], '11');
    await fireEvent.changeText(freeInputs[1], '7.5');
    await fireEvent.changeText(freeInputs[1], '-');
    await fireEvent.press(view.getByText('9'));
    await fireEvent.press(view.getByText('9'));
    await fireEvent.press(view.getByText('8'));

    await fireEvent.press(view.getByText('Great'));
    await fireEvent.press(view.getByText('Great'));
    await fireEvent.press(view.getByText('Elite'));
    await fireEvent.press(view.getAllByText('Add Set').at(-1)!);

    expect(onSubmit).toHaveBeenCalledWith({
      weight: expect.closeTo(45.36, 1),
      reps: 5,
      rpe: 8,
      numberOfPartials: 2,
      quality: 5,
    });
  });
});

describe('WorkoutInterface interactions', () => {
  it('forwards exercise mutations and reports a duplicate swap', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockAddSet.mockRejectedValueOnce(new Error('storage failed'));
    mockAddExercise.mockRejectedValueOnce(new Error('add failed'));
    mockRemoveExercise.mockRejectedValueOnce(new Error('remove failed'));
    mockReorderExercises.mockRejectedValueOnce(new Error('reorder failed'));
    mockSwapExercise.mockRejectedValueOnce(new Error('Exercise already in session'));
    mockExercises = [
      ...trainingDay.exercises,
      makeExercise({
        id: 'exercise-3',
        name: 'Squat',
        muscleCategory: MuscleCategory.Legs,
      }),
    ];

    const view = await renderWithProviders(
      <WorkoutInterface
        session={makeSession({
          exercisePlan: [
            { exerciseId: 'exercise-1', exerciseName: 'Bench Press' },
            { exerciseId: 'exercise-2', exerciseName: 'Row' },
          ],
        })}
        trainingDay={trainingDay}
        loading={false}
        onComplete={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    await fireEvent.press(view.getByText('Bench Press'));
    await fireEvent.press(view.getByText('Remove'));
    await waitFor(() => expect(mockRemoveExercise).toHaveBeenCalledWith('exercise-1'));

    await fireEvent.press(view.getByText('Add Set'));
    await fireEvent.changeText(view.getByLabelText('Weight'), '100');
    await fireEvent.changeText(view.getByLabelText('Reps'), '5');
    await fireEvent.press(view.getAllByText('Add Set').at(-1)!);
    await waitFor(() => expect(mockAddSet).toHaveBeenCalled());

    await fireEvent.press(view.getByText('Swap'));
    await fireEvent.press(view.getByText('Squat'));
    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        'Already Added',
        'This exercise is already in your session.'
      )
    );

    mockSwapExercise.mockRejectedValueOnce(new Error('network failed'));
    await fireEvent.press(view.getByText('Swap'));
    await fireEvent.press(view.getByText('Squat'));
    await waitFor(() =>
      expect(error).toHaveBeenCalledWith(
        'Error swapping exercise:',
        expect.any(Error)
      )
    );

    mockSwapExercise.mockRejectedValueOnce('unknown failure');
    await fireEvent.press(view.getByText('Swap'));
    await fireEvent.press(view.getByText('Squat'));
    await waitFor(() =>
      expect(error).toHaveBeenCalledWith(
        'Error swapping exercise:',
        'unknown failure'
      )
    );

    await fireEvent.press(view.getByText('Add Exercise'));
    await fireEvent.press(view.getByText('Squat'));
    await waitFor(() => expect(mockAddExercise).toHaveBeenCalled());

    await fireEvent.press(view.getByText('Reorder'));
    await fireEvent.press(view.getByText('Done'));
    await waitFor(() =>
      expect(mockReorderExercises).toHaveBeenCalledWith(['exercise-1', 'exercise-2'])
    );
    expect(error).toHaveBeenCalled();
  });

  it('forwards update and delete operations from a completed set', async () => {
    mockUpdateSet.mockRejectedValueOnce(new Error('update failed'));
    mockDeleteSet.mockRejectedValueOnce(new Error('delete failed'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const session = makeSession({
      exercises: [{
        exerciseId: 'exercise-1',
        exerciseName: 'Bench Press',
        sets: [completedSet],
      }],
    });
    const view = await renderWithProviders(
      <WorkoutInterface
        session={session}
        trainingDay={{ ...trainingDay, exercises: [trainingDay.exercises[0]] }}
        loading={false}
        onComplete={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    await fireEvent.press(view.getByText('Bench Press'));
    await fireEvent.press(view.getByText(/220\.5 lbs/));
    await fireEvent.changeText(view.getByLabelText('Reps'), '9');
    await fireEvent.press(view.getByText('Save Changes'));
    await waitFor(() => expect(mockUpdateSet).toHaveBeenCalled());

    await fireEvent.press(view.getByText(/220\.5 lbs/));
    await fireEvent.press(view.getByLabelText('Delete set'));
    const buttons = alert.mock.calls.at(-1)?.[2];
    const deleteButton = Array.isArray(buttons)
      ? buttons.find((button) => button.text === 'Delete')
      : undefined;
    await deleteButton?.onPress?.();
    await waitFor(() => expect(mockDeleteSet).toHaveBeenCalled());
  });
});

describe('timer, progress, and completed-set edge states', () => {
  it('handles invalid, future, changed, and hour-long timer values', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-11-03T13:01:02Z').getTime());
    const view = await renderWithProviders(<WorkoutTimer startedAt="invalid" />);
    expect(view.getByText('00:00')).toBeOnTheScreen();

    await view.rerender(<WorkoutTimer startedAt="2026-11-03T14:00:00Z" />);
    expect(view.getByText('00:00')).toBeOnTheScreen();
    await view.rerender(<WorkoutTimer startedAt="2026-11-03T12:00:00Z" />);
    expect(view.getByText('1:01:02')).toBeOnTheScreen();

  });

  it('renders zero progress and compact large volume', async () => {
    const view = await renderWithProviders(
      <WorkoutProgressBar completedExercises={0} totalExercises={0} totalSets={0} />
    );
    expect(view.getByText('0%')).toBeOnTheScreen();
    expect(view.getByText('0/0')).toBeOnTheScreen();

    await view.rerender(
      <WorkoutProgressBar
        completedExercises={2}
        totalExercises={4}
        totalSets={7}
        totalVolume={1000}
      />
    );
    expect(view.getByText('50%')).toBeOnTheScreen();
    expect(view.getByText('2.2k')).toBeOnTheScreen();
  });

  it('formats partials, failure, numeric RIR, metadata, notes, and editability', async () => {
    await enableQuality();
    const onPress = jest.fn();
    const view = await renderWithProviders(
      <SetListItem
        set={{ ...completedSet, numberOfPartials: 2, rpe: 9, quality: 5, notes: 'Hard set' }}
        setNumber={1}
        onPress={onPress}
      />
    );
    await waitFor(() =>
      expect(view.getByText(/220\.5 lbs × 8 reps \(\+2 partials\) · RPE 9 · Q5\/5/)).toBeOnTheScreen()
    );
    expect(view.getByText('Hard set')).toBeOnTheScreen();
    await fireEvent.press(view.getByText(/220\.5 lbs/));
    expect(onPress).toHaveBeenCalled();

    await view.rerender(
      <SetListItem set={{ ...completedSet, rir: 'F' }} setNumber={2} />
    );
    expect(view.getByText(/Failure/)).toBeOnTheScreen();

    await view.rerender(
      <SetListItem set={{ ...completedSet, rir: 1 }} setNumber={3} />
    );
    expect(view.getByText(/RIR 1/)).toBeOnTheScreen();
  });

  it('renders workout controls in dark mode', async () => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');
    const view = await renderWithProviders(
      <>
        <SessionStartOptions
          visible
          trainingDay={trainingDay}
          lastPlan={[]}
          onChoose={jest.fn()}
          onDismiss={jest.fn()}
        />
        <ExerciseSwapModal visible onClose={jest.fn()} onSelectExercise={jest.fn()} />
        <ReorderModal
          visible
          exercises={[{ exerciseId: 'exercise-1', exerciseName: 'Bench Press' }]}
          onClose={jest.fn()}
          onSave={jest.fn()}
        />
        <WorkoutProgressBar completedExercises={1} totalExercises={1} totalSets={1} />
        <SetListItem set={completedSet} setNumber={1} />
      </>
    );
    expect(view.getByText('100%')).toBeOnTheScreen();
    expect(view.getByText('Choose Exercise')).toBeOnTheScreen();
    expect(view.getByText('Drag any exercise to reorder')).toBeOnTheScreen();
  });
});
