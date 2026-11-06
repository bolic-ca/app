import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';

import ProgramsPage from '../(tabs)/programs';
import ProgramEditScreen from '../program-edit';
import TrainingDayDetailModal from '../training-day-detail';
import { makeExercise, makeProgram } from '@/test-utils/fixtures';
import {
  renderWithProviders,
  TEST_USER_ID,
} from '@/test-utils/render-with-providers';
import {
  getActiveProgramId,
  programStorage,
  setActiveProgramId,
} from '@/services/storage/program-storage';
import { STORAGE_KEYS } from '@/services/storage/config';
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

describe('programs page', () => {
  it('shows loading and then the empty state', async () => {
    mockRunFocusEffect = false;
    const getItem = jest.mocked(AsyncStorage.getItem);
    const originalGetItem = getItem.getMockImplementation()!;
    getItem.mockImplementation((key, callback) =>
      key === STORAGE_KEYS.CONFIG
        ? new Promise(() => {})
        : originalGetItem(key, callback)
    );
    const loadingView = await renderWithProviders(<ProgramsPage />);
    expect(loadingView.getByLabelText('Loading programs')).toBeOnTheScreen();
    await loadingView.unmount();
    getItem.mockImplementation(originalGetItem);
    mockRunFocusEffect = true;

    const view = await renderWithProviders(
      <ProgramsPage />
    );

    expect(await view.findByText('No Active Program')).toBeOnTheScreen();
    expect(view.getByText('New Program')).toBeOnTheScreen();
  });

  it('renders, expands, edits, and activates a stored program', async () => {
    await programStorage.save(
      TEST_USER_ID,
      makeProgram({ name: 'Strength Base' }),
      'program-1'
    );
    const view = await renderWithProviders(<ProgramsPage />);

    await fireEvent.press(await view.findByText('Strength Base'));
    expect(view.getByText('Upper')).toBeOnTheScreen();
    await fireEvent.press(view.getByText('Upper'));
    expect(view.getByText('Bench Press')).toBeOnTheScreen();

    await fireEvent.press(view.getByText('Edit'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/simple-program-wizard',
      params: { editProgramId: 'program-1' },
    });

    await fireEvent.press(view.getByLabelText('Set Strength Base active'));
    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Success',
        '"Strength Base" is now your active program!'
      )
    );
    expect(await getActiveProgramId(TEST_USER_ID)).toBe('program-1');
  });

  it('deletes an active program and clears the active selection', async () => {
    await programStorage.save(
      TEST_USER_ID,
      makeProgram({ name: 'Delete Me' }),
      'program-1'
    );
    await setActiveProgramId(TEST_USER_ID, 'program-1');
    const view = await renderWithProviders(<ProgramsPage />);

    await fireEvent.press(await view.findByText('Delete Me'));
    await fireEvent.press(view.getByText('Delete'));
    expect(Alert.alert).toHaveBeenLastCalledWith(
      'Delete Program',
      'Are you sure you want to delete "Delete Me"?',
      expect.any(Array)
    );
    await chooseAlertAction('Delete');

    await waitFor(async () =>
      expect(await programStorage.getById(TEST_USER_ID, 'program-1')).toBeNull()
    );
    expect(await getActiveProgramId(TEST_USER_ID)).toBeNull();
    expect(await view.findByText('No Active Program')).toBeOnTheScreen();
  });
});

describe('program edit screen', () => {
  it('shows a missing-program state and navigates back', async () => {
    mockSearchParams.programId = 'missing';
    const view = await renderWithProviders(<ProgramEditScreen />);

    expect(await view.findByText('Program not found')).toBeOnTheScreen();
    await fireEvent.press(view.getByText('Go Back'));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('validates, persists edits, and opens a training day', async () => {
    await programStorage.save(
      TEST_USER_ID,
      makeProgram({ name: 'Original', description: 'Old description' }),
      'program-1'
    );
    mockSearchParams.programId = 'program-1';
    const view = await renderWithProviders(<ProgramEditScreen />);

    const nameInput = await view.findByPlaceholderText('Enter program name');
    expect(nameInput).toHaveDisplayValue('Original');
    await fireEvent.changeText(nameInput, '   ');
    await fireEvent.press(view.getByText('Save'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Program name is required'
    );

    await fireEvent.changeText(nameInput, 'Renamed Program');
    await fireEvent.changeText(
      view.getByPlaceholderText('Enter program description (optional)'),
      'Updated description'
    );
    await fireEvent.press(view.getByText('Upper'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/training-day-detail',
      params: {
        programId: 'program-1',
        trainingDayId: 'day-1',
        mode: 'edit',
      },
    });

    await fireEvent.press(view.getByText('Save'));
    await waitFor(async () => {
      const saved = await programStorage.getById(TEST_USER_ID, 'program-1');
      expect(saved?.data).toEqual(
        expect.objectContaining({
          name: 'Renamed Program',
          description: 'Updated description',
        })
      );
    });
    expect(mockRouter.back).toHaveBeenCalled();
  });
});

describe('training day detail', () => {
  it('handles missing or malformed day data', async () => {
    mockSearchParams.trainingDay = '{bad json';
    const view = await renderWithProviders(<TrainingDayDetailModal />);

    expect(view.getByText('Training day not found')).toBeOnTheScreen();
    await fireEvent.press(view.getByText('Go Back'));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('renders empty and populated training days', async () => {
    mockSearchParams.trainingDay = JSON.stringify({
      id: 'empty-day',
      userId: TEST_USER_ID,
      name: 'Recovery',
      exercises: [],
    });
    const view = await renderWithProviders(<TrainingDayDetailModal />);
    expect(view.getByText('0 exercises')).toBeOnTheScreen();
    expect(view.getByText('No exercises added yet')).toBeOnTheScreen();

    view.unmount();
    mockSearchParams.trainingDay = JSON.stringify({
      id: 'day-1',
      userId: TEST_USER_ID,
      name: 'Upper',
      description: 'Pressing focus',
      exercises: [
        makeExercise({
          muscleCategory: MuscleCategory.Chest,
          muscleSubcategory: 'Upper',
          targetRepetitionsInReserve: '2',
          targetPosition: 'Lengthened',
          notes: 'Controlled eccentric',
        }),
      ],
    });
    const populatedView = await renderWithProviders(
      <TrainingDayDetailModal />
    );

    expect(populatedView.getByText('Pressing focus')).toBeOnTheScreen();
    expect(populatedView.getByText('Bench Press')).toBeOnTheScreen();
    expect(populatedView.getByText('Chest · Upper')).toBeOnTheScreen();
    expect(populatedView.getByText('Lengthened')).toBeOnTheScreen();
    expect(populatedView.getByText('Controlled eccentric')).toBeOnTheScreen();
  });
});
