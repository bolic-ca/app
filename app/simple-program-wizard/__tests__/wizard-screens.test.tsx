import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import DayEditorScreen from '../day-editor';
import ExerciseSelectorScreen from '../exercise-selector';
import SimpleProgramWizardIndex from '../index';
import PreviewScreen from '../preview';
import TrainingDaysScreen from '../training-days';
import { exerciseStorage } from '@/services/storage/exercise-storage';
import { programStorage } from '@/services/storage/program-storage';
import { makeExercise, makeProgram } from '@/test-utils/fixtures';
import {
  renderWithProviders,
  TEST_USER_ID,
} from '@/test-utils/render-with-providers';
import { MuscleCategory } from '@/types/training';
import { router } from 'expo-router';

const mockSearchParams: { editProgramId?: string } = {};

jest.mock('expo-router', () => {
  const mockRouter = {
    back: jest.fn(),
    dismissAll: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
  };

  return {
    router: mockRouter,
    useRouter: () => mockRouter,
    useLocalSearchParams: () => mockSearchParams,
    // Navigation focus is a platform boundary. The exercise hook's initial
    // load is enough for these tests.
    useFocusEffect: jest.fn(),
  };
});

const mockRouter = jest.mocked(router);
const DRAFT_KEY = 'simple_program_wizard_draft';

async function chooseAlertAction(label: string) {
  const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
  const button = Array.isArray(buttons)
    ? buttons.find((candidate) => candidate.text === label)
    : undefined;

  if (!button) {
    throw new Error(`Alert action "${label}" was not found`);
  }

  await act(async () => {
    await button.onPress?.();
  });
}

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  delete mockSearchParams.editProgramId;
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('create wizard integration', () => {
  it('keeps state across every create screen, filters and selects an exercise, then saves', async () => {
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
      })
    );

    const view = await renderWithProviders(<SimpleProgramWizardIndex />, {
      wizard: true,
    });

    await waitFor(() =>
      expect(
        view.getByPlaceholderText('e.g., Upper/Lower Split')
      ).toHaveDisplayValue('')
    );

    await fireEvent.press(view.getByText('Next: Add Training Days'));
    expect(mockRouter.push).not.toHaveBeenCalled();

    await fireEvent.changeText(
      view.getByPlaceholderText('e.g., Upper/Lower Split'),
      'Upper / Lower'
    );
    await fireEvent.changeText(
      view.getByPlaceholderText("Describe your program's focus and goals"),
      'Four-day strength program'
    );
    await fireEvent.press(view.getByText('Next: Add Training Days'));
    expect(mockRouter.push).toHaveBeenLastCalledWith(
      '/simple-program-wizard/training-days'
    );

    await view.rerender(<TrainingDaysScreen />);
    await fireEvent.press(view.getByText('Add Training Day'));
    expect(await view.findByText('Day 1')).toBeOnTheScreen();
    expect(view.getByText('0 exercises')).toBeOnTheScreen();

    await fireEvent.press(view.getByText('Edit'));
    expect(mockRouter.push).toHaveBeenLastCalledWith(
      '/simple-program-wizard/day-editor'
    );

    await view.rerender(<DayEditorScreen />);
    await fireEvent.changeText(
      view.getByPlaceholderText('e.g., Upper Body Push'),
      'Upper'
    );
    await fireEvent.changeText(
      view.getByPlaceholderText('Optional notes about this training day'),
      'Upper body'
    );
    await fireEvent.press(view.getByText('Save'));

    await view.rerender(<TrainingDaysScreen />);
    expect(view.getByText('Upper')).toBeOnTheScreen();
    await fireEvent.press(view.getByText('Edit'));

    await view.rerender(<DayEditorScreen />);
    await fireEvent.press(view.getByText('Add Exercise'));
    expect(mockRouter.push).toHaveBeenLastCalledWith(
      '/simple-program-wizard/exercise-selector'
    );

    await view.rerender(<ExerciseSelectorScreen />);
    await view.findByText('Bench Press');
    expect(view.getByText('Back Squat')).toBeOnTheScreen();

    await fireEvent.changeText(
      view.getByPlaceholderText('Search exercises...'),
      'squat'
    );
    expect(view.getByText('Back Squat')).toBeOnTheScreen();
    expect(view.queryByText('Bench Press')).not.toBeOnTheScreen();

    await fireEvent.changeText(
      view.getByPlaceholderText('Search exercises...'),
      ''
    );
    await fireEvent.press(view.getAllByText(MuscleCategory.Chest)[0]);
    expect(view.getByText('Bench Press')).toBeOnTheScreen();
    expect(view.queryByText('Back Squat')).not.toBeOnTheScreen();

    await fireEvent.press(view.getByText('Bench Press'));
    expect(mockRouter.back).toHaveBeenCalled();

    await view.rerender(<DayEditorScreen />);
    expect(view.getByText('Bench Press')).toBeOnTheScreen();
    await fireEvent.press(view.getByText('Save'));

    await view.rerender(<TrainingDaysScreen />);
    expect(view.getByText('Upper')).toBeOnTheScreen();
    expect(view.getByText('1 exercise')).toBeOnTheScreen();
    await fireEvent.press(view.getByText('Preview & Save'));
    expect(mockRouter.push).toHaveBeenLastCalledWith(
      '/simple-program-wizard/preview'
    );

    await view.rerender(<PreviewScreen />);
    expect(view.getByText('Upper / Lower')).toBeOnTheScreen();
    expect(view.getByText('Four-day strength program')).toBeOnTheScreen();
    expect(view.getByText('Upper body')).toBeOnTheScreen();
    expect(view.getByText('3 sets')).toBeOnTheScreen();
    expect(view.getByText('8-10 reps')).toBeOnTheScreen();

    await fireEvent.press(view.getByText('Save Program'));

    await waitFor(async () => {
      const saved = await programStorage.getAll(TEST_USER_ID);
      expect(saved).toHaveLength(1);
      expect(saved[0].data).toEqual(
        expect.objectContaining({
          userId: TEST_USER_ID,
          name: 'Upper / Lower',
          description: 'Four-day strength program',
          type: 'simple',
          schedule: 'rotating',
          trainingDays: [
            expect.objectContaining({
              userId: TEST_USER_ID,
              name: 'Upper',
              description: 'Upper body',
              number: 1,
              exercises: [
                expect.objectContaining({
                  name: 'Bench Press',
                  userId: TEST_USER_ID,
                  trainingDayIds: [],
                }),
              ],
            }),
          ],
        })
      );
    });
    expect(await AsyncStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(mockRouter.dismissAll).toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/programs');
  });

  it('restores a draft and discards it through Start Fresh', async () => {
    await AsyncStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        name: 'Restored Program',
        description: 'Continue this',
        schedule: 'weekly',
        trainingDays: [],
        currentDayIndex: null,
      })
    );

    const view = await renderWithProviders(<SimpleProgramWizardIndex />, {
      wizard: true,
    });

    expect(
      await view.findByText('Draft restored - continue where you left off')
    ).toBeOnTheScreen();
    expect(
      view.getByPlaceholderText('e.g., Upper/Lower Split')
    ).toHaveDisplayValue('Restored Program');

    await fireEvent.press(view.getByText('Start Fresh'));
    expect(Alert.alert).toHaveBeenLastCalledWith(
      'Start Fresh?',
      expect.any(String),
      expect.any(Array)
    );
    await chooseAlertAction('Start Fresh');

    await waitFor(() =>
      expect(
        view.getByPlaceholderText('e.g., Upper/Lower Split')
      ).toHaveDisplayValue('')
    );
    expect(await AsyncStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(
      view.queryByText('Draft restored - continue where you left off')
    ).not.toBeOnTheScreen();
  });

});

describe('edit mode integration', () => {
  it('loads a simple program, updates the same storage record, and exits', async () => {
    await programStorage.save(
      TEST_USER_ID,
      makeProgram({ name: 'Original Name' }),
      'program-1'
    );
    mockSearchParams.editProgramId = 'program-1';

    const view = await renderWithProviders(<SimpleProgramWizardIndex />, {
      wizard: true,
    });

    expect(await view.findByText('EDIT')).toBeOnTheScreen();
    await waitFor(() =>
      expect(
        view.getByPlaceholderText('e.g., Upper/Lower Split')
      ).toHaveDisplayValue('Original Name')
    );

    await fireEvent.changeText(
      view.getByPlaceholderText('e.g., Upper/Lower Split'),
      'Updated Name'
    );
    await view.rerender(<PreviewScreen />);
    await fireEvent.press(view.getByText('Save Program'));

    await waitFor(async () => {
      const saved = await programStorage.getAll(TEST_USER_ID);
      expect(saved).toHaveLength(1);
      expect(saved[0].id).toBe('program-1');
      expect(saved[0].data.name).toBe('Updated Name');
    });
    expect(Alert.alert).toHaveBeenCalledWith(
      'Success',
      'Program updated successfully!'
    );
    expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/programs');
  });

  it('reports a missing edit target without replacing create state', async () => {
    mockSearchParams.editProgramId = 'missing-program';

    const view = await renderWithProviders(<SimpleProgramWizardIndex />, {
      wizard: true,
    });

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        'Program not found or is not a simple program'
      )
    );
    expect(
      view.getByPlaceholderText('e.g., Upper/Lower Split')
    ).toHaveDisplayValue('');
    expect(view.getByText('CREATE')).toBeOnTheScreen();
  });
});

describe('validation and failure paths', () => {
  it('rejects a blank training-day name and preserves editor state', async () => {
    const view = await renderWithProviders(<SimpleProgramWizardIndex />, {
      wizard: true,
    });
    await view.findByPlaceholderText('e.g., Upper/Lower Split');
    await fireEvent.changeText(
      view.getByPlaceholderText('e.g., Upper/Lower Split'),
      'Program'
    );

    await view.rerender(<TrainingDaysScreen />);
    await fireEvent.press(view.getByText('Add Training Day'));
    await fireEvent.press(await view.findByText('Edit'));
    await view.rerender(<DayEditorScreen />);

    await fireEvent.changeText(
      view.getByPlaceholderText('e.g., Upper Body Push'),
      '   '
    );
    await fireEvent.press(view.getByText('Save'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Validation Error',
      'Please provide a name for this training day.'
    );
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('shows selector and editor guards when no day is selected', async () => {
    const view = await renderWithProviders(<ExerciseSelectorScreen />, {
      wizard: true,
    });
    expect(await view.findByText('No training day selected')).toBeOnTheScreen();

    await view.rerender(<DayEditorScreen />);
    expect(view.getByText('Training day not found')).toBeOnTheScreen();
  });

  it('reports storage failure and does not navigate away', async () => {
    const view = await renderWithProviders(<SimpleProgramWizardIndex />, {
      wizard: true,
    });
    await view.findByPlaceholderText('e.g., Upper/Lower Split');
    await fireEvent.changeText(
      view.getByPlaceholderText('e.g., Upper/Lower Split'),
      'Will Fail'
    );
    await view.rerender(<TrainingDaysScreen />);
    await fireEvent.press(view.getByText('Add Training Day'));
    await view.findByText('Day 1');
    await view.rerender(<PreviewScreen />);

    jest
      .spyOn(programStorage, 'save')
      .mockRejectedValueOnce(new Error('disk full'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await fireEvent.press(view.getByText('Save Program'));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        'Failed to save program. Please try again.'
      )
    );
    expect(mockRouter.dismissAll).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(view.getByText('Will Fail')).toBeOnTheScreen();
  });
});
