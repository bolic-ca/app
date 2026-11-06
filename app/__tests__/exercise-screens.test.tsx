import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';

import ExercisesPage from '../(tabs)/exercises';
import ExerciseFormScreen from '../exercise-form';
import { exerciseStorage } from '@/services/storage/exercise-storage';
import { programStorage } from '@/services/storage/program-storage';
import { STORAGE_KEYS } from '@/services/storage/config';
import { makeExercise, makeProgram } from '@/test-utils/fixtures';
import {
  renderWithProviders,
  TEST_USER_ID,
} from '@/test-utils/render-with-providers';
import { MuscleCategory } from '@/types/training';
import { router } from 'expo-router';

const mockSearchParams: Record<string, string | undefined> = {};
let mockRunFocusEffect = true;

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const mockRouter = {
    back: jest.fn(),
    push: jest.fn(),
  };
  return {
    router: mockRouter,
    useLocalSearchParams: () => mockSearchParams,
    useFocusEffect: (callback: () => void) => {
      React.useEffect(() => {
        if (mockRunFocusEffect) callback();
      }, [callback]);
    },
  };
});

const mockRouter = jest.mocked(router);

async function chooseAlertAction(label: string) {
  const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
  const button = Array.isArray(buttons)
    ? buttons.find((candidate) => candidate.text === label)
    : undefined;
  if (!button) throw new Error(`Alert action "${label}" was not found`);
  await act(async () => {
    await button.onPress?.();
  });
}

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  mockRunFocusEffect = true;
  Object.keys(mockSearchParams).forEach((key) => delete mockSearchParams[key]);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('exercises page', () => {
  it('shows loading, refreshes on focus, and then renders empty state', async () => {
    const getAll = jest.spyOn(exerciseStorage, 'getAll');
    mockRunFocusEffect = false;
    const getItem = jest.mocked(AsyncStorage.getItem);
    const originalGetItem = getItem.getMockImplementation()!;
    getItem.mockImplementation((key, callback) =>
      key === STORAGE_KEYS.CONFIG
        ? new Promise(() => {})
        : originalGetItem(key, callback)
    );
    const loadingView = await renderWithProviders(<ExercisesPage />);
    expect(loadingView.getByLabelText('Loading exercises')).toBeOnTheScreen();
    await loadingView.unmount();
    getItem.mockImplementation(originalGetItem);
    mockRunFocusEffect = true;

    const view = await renderWithProviders(<ExercisesPage />);
    expect(await view.findByText('No Exercises Yet')).toBeOnTheScreen();
    expect(getAll).toHaveBeenCalled();
  });

  it('searches the library and navigates to create and edit', async () => {
    await exerciseStorage.save(
      TEST_USER_ID,
      makeExercise({ id: undefined, name: 'Bench Press' })
    );
    await exerciseStorage.save(
      TEST_USER_ID,
      makeExercise({
        id: undefined,
        name: 'Back Squat',
        muscleCategory: MuscleCategory.Legs,
        equipment: 'Barbell',
      })
    );
    const view = await renderWithProviders(<ExercisesPage />);

    expect(await view.findByText('Bench Press')).toBeOnTheScreen();
    expect(view.getByText('Back Squat')).toBeOnTheScreen();
    await fireEvent.changeText(
      view.getByPlaceholderText('Search name, muscle, equipment'),
      'squat'
    );
    expect(view.queryByText('Bench Press')).not.toBeOnTheScreen();
    expect(view.getByText('Back Squat')).toBeOnTheScreen();

    await fireEvent.changeText(
      view.getByPlaceholderText('Search name, muscle, equipment'),
      'missing'
    );
    expect(view.getByText('No Matches')).toBeOnTheScreen();
    await fireEvent.press(view.getByText('Clear filters'));
    expect(view.getByText('Bench Press')).toBeOnTheScreen();

    await fireEvent.press(view.getByText('Add Exercise'));
    expect(mockRouter.push).toHaveBeenCalledWith('/exercise-form');
    await fireEvent.press(view.getByLabelText('Edit Bench Press'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/exercise-form',
      params: { exerciseId: expect.any(String) },
    });
  });

  it('confirms and deletes an exercise from storage', async () => {
    const saved = await exerciseStorage.save(
      TEST_USER_ID,
      makeExercise({ id: undefined, name: 'Remove Me' })
    );
    const view = await renderWithProviders(<ExercisesPage />);

    await view.findByText('Remove Me');
    await fireEvent.press(view.getByLabelText('Delete Remove Me'));
    expect(Alert.alert).toHaveBeenLastCalledWith(
      'Delete Exercise',
      'Are you sure you want to delete "Remove Me"? This action cannot be undone.',
      expect.any(Array)
    );
    await chooseAlertAction('Delete');

    await waitFor(async () =>
      expect(await exerciseStorage.getById(TEST_USER_ID, saved.id)).toBeNull()
    );
    expect(await view.findByText('No Exercises Yet')).toBeOnTheScreen();
  });
});

describe('exercise form', () => {
  it('validates required fields and creates a persisted exercise', async () => {
    const view = await renderWithProviders(<ExerciseFormScreen />);

    await fireEvent.press(view.getByText('Create Exercise'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Please enter an exercise name'
    );

    await fireEvent.changeText(
      view.getByPlaceholderText('e.g., Barbell Bench Press'),
      'Cable Fly'
    );
    await fireEvent.press(view.getByText('Create Exercise'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Please select a muscle category'
    );

    await fireEvent.press(view.getByText('Select muscle category'));
    await fireEvent.press(view.getByText(MuscleCategory.Chest));
    await fireEvent.press(view.getByText('Select subcategory (optional)'));
    await fireEvent.press(view.getByText('Upper'));
    await fireEvent.changeText(
      view.getByPlaceholderText('e.g., Barbell, Dumbbells, Cable'),
      'Cable'
    );
    await fireEvent.changeText(
      view.getByPlaceholderText('e.g., 8-12, 15-20'),
      '10-15'
    );
    await fireEvent.press(view.getByText('Create Exercise'));

    await waitFor(async () => {
      const stored = await exerciseStorage.getAll(TEST_USER_ID);
      expect(stored).toHaveLength(1);
      expect(stored[0].data).toEqual(
        expect.objectContaining({
          name: 'Cable Fly',
          muscleCategory: MuscleCategory.Chest,
          muscleSubcategory: 'Upper',
          equipment: 'Cable',
          targetRepetitions: '10-15',
        })
      );
    });
    expect(Alert.alert).toHaveBeenLastCalledWith(
      'Success',
      'Exercise added to library',
      expect.any(Array)
    );
    await chooseAlertAction('OK');
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('creates an exercise and attaches it to the requested training day', async () => {
    await programStorage.save(TEST_USER_ID, makeProgram(), 'program-1');
    mockSearchParams.programId = 'program-1';
    mockSearchParams.trainingDayId = 'day-1';
    const view = await renderWithProviders(<ExerciseFormScreen />);

    await fireEvent.changeText(
      view.getByPlaceholderText('e.g., Barbell Bench Press'),
      'Incline Press'
    );
    await fireEvent.press(view.getByText('Select muscle category'));
    await fireEvent.press(view.getByText(MuscleCategory.Chest));
    await fireEvent.press(view.getByText('Create Exercise'));

    await waitFor(async () => {
      const program = await programStorage.getById(TEST_USER_ID, 'program-1');
      expect(program?.data.trainingDays[0].exercises).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Incline Press' }),
        ])
      );
    });
    expect(Alert.alert).toHaveBeenLastCalledWith(
      'Success',
      'Exercise added to training day',
      expect.any(Array)
    );
  });

  it('loads edit mode and persists changes to the same exercise', async () => {
    const saved = await exerciseStorage.save(
      TEST_USER_ID,
      makeExercise({
        id: undefined,
        name: 'Old Name',
        notes: 'Old notes',
      })
    );
    mockSearchParams.exerciseId = saved.id;
    const view = await renderWithProviders(<ExerciseFormScreen />);

    const nameInput = await view.findByDisplayValue('Old Name');
    await fireEvent.changeText(nameInput, 'New Name');
    await fireEvent.changeText(
      view.getByPlaceholderText('Additional notes or instructions'),
      'Updated notes'
    );
    await fireEvent.press(view.getByText('Update Exercise'));

    await waitFor(async () => {
      const updated = await exerciseStorage.getById(TEST_USER_ID, saved.id);
      expect(updated?.data).toEqual(
        expect.objectContaining({
          name: 'New Name',
          notes: 'Updated notes',
        })
      );
    });
    expect((await exerciseStorage.getAll(TEST_USER_ID))).toHaveLength(1);
    expect(Alert.alert).toHaveBeenLastCalledWith(
      'Success',
      'Exercise updated',
      expect.any(Array)
    );
  });
});
