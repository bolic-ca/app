import React from 'react';
import { Alert, Text, TouchableOpacity } from 'react-native';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import ActiveWorkoutBanner from '../ActiveWorkoutBanner';
import ExerciseCard from '../ExerciseCard';
import SetEditor from '../SetEditor';
import WorkoutInterface from '../WorkoutInterface';
import { useWorkoutUI } from '@/contexts/WorkoutUIContext';
import { makeExercise, makeSession } from '@/test-utils/fixtures';
import { renderWithProviders } from '@/test-utils/render-with-providers';
import { router } from 'expo-router';

const mockAddSet = jest.fn();
const mockUpdateSet = jest.fn();
const mockDeleteSet = jest.fn();
const mockSwapExercise = jest.fn();
const mockAddExercise = jest.fn();
const mockRemoveExercise = jest.fn();
const mockReorderExercises = jest.fn();
let mockPathname = '/stats';

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

jest.mock('expo-router', () => {
  const mockRouter = { push: jest.fn(), back: jest.fn() };
  return {
    router: mockRouter,
    useRouter: () => mockRouter,
    usePathname: () => mockPathname,
    useFocusEffect: jest.fn(),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockPathname = '/stats';
});

describe('SetEditor', () => {
  it('validates required fields and submits converted set details', async () => {
    const onSubmit = jest.fn();
    const onClose = jest.fn();
    const view = await renderWithProviders(
      <SetEditor
        visible
        mode="add"
        onSubmit={onSubmit}
        onClose={onClose}
      />
    );

    await fireEvent.press(view.getAllByText('Add Set').at(-1)!);
    expect(Alert.alert).toHaveBeenCalledWith(
      'Invalid Weight',
      'Please enter a valid weight greater than 0'
    );

    await fireEvent.changeText(view.getByLabelText('Weight'), '220');
    await fireEvent.changeText(view.getByLabelText('Reps'), '8');
    await fireEvent.press(view.getByText('2'));
    await fireEvent.press(view.getByText('8', { exact: true }));
    await fireEvent.changeText(
      view.getByPlaceholderText('Add notes about this set...'),
      '  controlled  '
    );
    await fireEvent.press(view.getAllByText('Add Set').at(-1)!);

    expect(onSubmit).toHaveBeenCalledWith({
      weight: expect.closeTo(99.79, 1),
      reps: 8,
      rir: 2,
      rpe: 8,
      notes: 'controlled',
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('seeds edit values and confirms deletion', async () => {
    const onDelete = jest.fn();
    const onClose = jest.fn();
    const view = await renderWithProviders(
      <SetEditor
        visible
        mode="edit"
        setNumber={2}
        initialData={{ weight: 100, reps: 5, rir: 'F' }}
        onSubmit={jest.fn()}
        onDelete={onDelete}
        onClose={onClose}
      />
    );

    expect(view.getByLabelText('Weight')).toHaveDisplayValue('220.5');
    expect(view.getByLabelText('Reps')).toHaveDisplayValue('5');
    await fireEvent.press(view.getByLabelText('Delete set'));
    const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
    const deleteButton = Array.isArray(buttons)
      ? buttons.find((button) => button.text === 'Delete')
      : undefined;
    await act(async () => deleteButton?.onPress?.());

    expect(onDelete).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

describe('ExerciseCard', () => {
  it('expands and logs a set through the editor', async () => {
    const onAddSet = jest.fn();
    const exercise = makeExercise();
    const view = await renderWithProviders(
      <ExerciseCard
        exercise={exercise}
        previousPerformance={null}
        onAddSet={onAddSet}
      />
    );

    await fireEvent.press(view.getByText('Bench Press'));
    expect(view.getByText('Add Set')).toBeOnTheScreen();
    await fireEvent.press(view.getByText('Add Set'));
    expect(view.getAllByText('Add Set', { exact: true }).length).toBeGreaterThan(1);
    await fireEvent.changeText(view.getByLabelText('Weight'), '200');
    await fireEvent.changeText(view.getByLabelText('Reps'), '10');
    await fireEvent.press(view.getAllByText('Add Set').at(-1)!);

    expect(onAddSet).toHaveBeenCalledWith(
      'exercise-1',
      'Bench Press',
      expect.objectContaining({ reps: 10, weight: expect.closeTo(90.72, 1) })
    );
  });

  it('edits and deletes a completed set and exposes exercise actions', async () => {
    const onUpdateSet = jest.fn();
    const onDeleteSet = jest.fn();
    const onRemoveExercise = jest.fn();
    const set = {
      weight: 100,
      reps: 5,
      completedAt: '2026-11-03T12:10:00.000Z',
    };
    const view = await renderWithProviders(
      <ExerciseCard
        exercise={makeExercise({ targetNumberOfSets: 1 })}
        sessionExercise={{
          exerciseId: 'exercise-1',
          exerciseName: 'Bench Press',
          sets: [set],
        }}
        previousPerformance={null}
        onAddSet={jest.fn()}
        onUpdateSet={onUpdateSet}
        onDeleteSet={onDeleteSet}
        onRemoveExercise={onRemoveExercise}
      />
    );

    await fireEvent.press(view.getByText('Bench Press'));
    expect(view.getByText('Complete')).toBeOnTheScreen();
    await fireEvent.press(view.getByText('Remove'));
    expect(onRemoveExercise).toHaveBeenCalled();

    await fireEvent.press(view.getByText(/220\.5 lbs/));
    await fireEvent.changeText(view.getByLabelText('Reps'), '6');
    await fireEvent.press(view.getByText('Save Changes'));
    expect(onUpdateSet).toHaveBeenCalledWith(
      'exercise-1',
      0,
      expect.objectContaining({ reps: 6 })
    );

    await fireEvent.press(view.getByText(/220\.5 lbs/));
    await fireEvent.press(view.getByLabelText('Delete set'));
    const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
    const deleteButton = Array.isArray(buttons)
      ? buttons.find((button) => button.text === 'Delete')
      : undefined;
    await act(async () => deleteButton?.onPress?.());
    expect(onDeleteSet).toHaveBeenCalledWith('exercise-1', 0);
  });
});

describe('WorkoutInterface', () => {
  const trainingDay = {
    id: 'day-1',
    userId: 'test-user',
    number: 1,
    name: 'Upper',
    exercises: [makeExercise()],
  };

  it('renders loading and missing-training-day guards', async () => {
    const session = makeSession();
    const loading = await renderWithProviders(
      <WorkoutInterface
        session={session}
        trainingDay={trainingDay}
        loading
        onComplete={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    expect(loading.getByText('Loading workout...')).toBeOnTheScreen();

    const onCancel = jest.fn();
    await loading.rerender(
      <WorkoutInterface
        session={session}
        trainingDay={null}
        loading={false}
        onComplete={jest.fn()}
        onCancel={onCancel}
      />
    );
    await fireEvent.press(loading.getByText('Cancel Workout'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('opens the completion modal and forwards notes', async () => {
    const onComplete = jest.fn();
    const onCancel = jest.fn();
    const onMinimize = jest.fn();
    const view = await renderWithProviders(
      <WorkoutInterface
        session={makeSession({
          exercises: [
            {
              exerciseId: 'exercise-1',
              exerciseName: 'Bench Press',
              sets: [
                {
                  weight: 100,
                  reps: 5,
                  completedAt: '2026-11-03T12:10:00.000Z',
                },
              ],
            },
          ],
        })}
        trainingDay={trainingDay}
        programName="Strength"
        loading={false}
        onComplete={onComplete}
        onCancel={onCancel}
        onMinimize={onMinimize}
      />
    );

    expect(view.getByText('Strength')).toBeOnTheScreen();
    await fireEvent.press(view.getByLabelText('Minimize workout'));
    await fireEvent.press(view.getByLabelText('Cancel workout'));
    expect(onMinimize).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();

    await fireEvent.press(view.getByText('Finish'));
    expect(view.getByText('Workout Complete!')).toBeOnTheScreen();
    expect(view.getByText('Exercises')).toBeOnTheScreen();
    expect(view.getByText('Sets')).toBeOnTheScreen();
    await fireEvent.changeText(
      view.getByPlaceholderText('Add any notes about this workout...'),
      'Good session'
    );
    await fireEvent.press(view.getByText('Save Workout'));
    expect(onComplete).toHaveBeenCalledWith('Good session');
  });
});

describe('ActiveWorkoutBanner', () => {
  it('expands the workout and navigates home from another tab', async () => {
    function UIState() {
      const { isExpanded, minimize } = useWorkoutUI();
      return (
        <>
          <Text testID="expanded-state">{String(isExpanded)}</Text>
          <TouchableOpacity onPress={minimize}>
            <Text>Test minimize</Text>
          </TouchableOpacity>
        </>
      );
    }

    const view = await renderWithProviders(
      <>
        <ActiveWorkoutBanner
          startedAt="2026-11-03T12:00:00.000Z"
          trainingDayName="Upper"
        />
        <UIState />
      </>,
      { workoutUI: true }
    );

    await fireEvent.press(view.getByText('Test minimize'));
    expect(view.getByTestId('expanded-state')).toHaveTextContent('false');
    await fireEvent.press(view.getByText('Tap to resume'));
    await waitFor(() =>
      expect(view.getByTestId('expanded-state')).toHaveTextContent('true')
    );
    expect(router.push).toHaveBeenCalledWith('/(tabs)');
  });
});
