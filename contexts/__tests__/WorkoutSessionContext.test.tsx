import React from 'react';
import { Text } from 'react-native';
import { act, waitFor } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';

import { useWorkoutSession } from '@/contexts/WorkoutSessionContext';
import {
  getActiveSession,
  getSessionHistory,
  setActiveSession,
} from '@/services/storage/session-storage';
import * as storageClient from '@/services/storage/storage-client';
import { makeExercise, makeSession } from '@/test-utils/fixtures';
import {
  renderWithProviders,
  seedTestUser,
  TEST_USER_ID,
} from '@/test-utils/render-with-providers';

type SessionContext = ReturnType<typeof useWorkoutSession>;
let context: SessionContext;

function Probe() {
  context = useWorkoutSession();
  return <Text>{context.loading ? 'loading' : context.session?.name ?? 'idle'}</Text>;
}

async function renderContext() {
  const view = await renderWithProviders(<Probe />, { workoutSession: true });
  await waitFor(() => expect(view.getByText('idle')).toBeOnTheScreen());
  return view;
}

describe('WorkoutSessionContext', () => {
  it('starts a session and persists its ordered plan', async () => {
    await renderContext();

    await act(async () => {
      await context.startSession('program-1', 'day-1', 'Upper', [
        { exerciseId: 'exercise-1', exerciseName: 'Bench Press' },
      ]);
    });

    expect(context.session).toEqual(
      expect.objectContaining({
        programId: 'program-1',
        trainingDayId: 'day-1',
        name: 'Upper',
        completedAt: null,
        exercisePlan: [
          { exerciseId: 'exercise-1', exerciseName: 'Bench Press' },
        ],
      })
    );
    expect((await getActiveSession(TEST_USER_ID))?.data).toEqual(context.session);
  });

  it('adds, updates, and deletes sets while preserving completion time', async () => {
    await renderContext();
    await act(async () => {
      await context.startSession('program-1', 'day-1');
    });
    await act(async () => {
      await context.addSet('exercise-1', 'Bench Press', {
        weight: 100,
        reps: 8,
        rir: 2,
      });
    });

    const completedAt = context.session!.exercises[0].sets[0].completedAt;
    expect(completedAt).toEqual(expect.any(String));

    await act(async () => {
      await context.updateSet('exercise-1', 0, {
        weight: 105,
        reps: 6,
        notes: 'heavy',
      });
    });
    expect(context.session!.exercises[0].sets[0]).toEqual({
      weight: 105,
      reps: 6,
      notes: 'heavy',
      completedAt,
    });

    await act(async () => {
      await context.deleteSet('exercise-1', 0);
    });
    expect(context.session!.exercises).toEqual([]);
    expect((await getActiveSession(TEST_USER_ID))?.data.exercises).toEqual([]);
  });

  it('swaps an exercise in the plan and migrates logged sets', async () => {
    await renderContext();
    await act(async () => {
      await context.startSession('program-1', 'day-1', 'Upper', [
        { exerciseId: 'exercise-1', exerciseName: 'Bench Press' },
      ]);
    });
    await act(async () => {
      await context.addSet('exercise-1', 'Bench Press', { weight: 80, reps: 10 });
    });
    await act(async () => {
      await context.swapExercise('exercise-1', 'exercise-2', 'Incline Press');
    });

    expect(context.session!.exercisePlan).toEqual([
      { exerciseId: 'exercise-2', exerciseName: 'Incline Press' },
    ]);
    expect(context.session!.exercises[0]).toEqual(
      expect.objectContaining({
        exerciseId: 'exercise-2',
        exerciseName: 'Incline Press',
        sets: [expect.objectContaining({ weight: 80, reps: 10 })],
      })
    );
    expect(context.session!.exerciseOverrides).toEqual({
      'exercise-1': {
        exerciseId: 'exercise-2',
        exerciseName: 'Incline Press',
      },
    });
  });

  it('adds, removes, and reorders session exercises', async () => {
    await renderContext();
    await act(async () => {
      await context.startSession('program-1', 'day-1', undefined, [
        { exerciseId: 'exercise-1', exerciseName: 'Bench Press' },
      ]);
    });
    await act(async () => {
      await context.addExerciseToSession(
        makeExercise({ id: 'exercise-2', name: 'Row' })
      );
    });
    await act(async () => {
      await context.addExerciseToSession(
        makeExercise({ id: 'exercise-3', name: 'Curl' })
      );
    });
    await act(async () => {
      await context.reorderExercises([
        'exercise-3',
        'unknown',
        'exercise-1',
        'exercise-2',
      ]);
    });

    expect(context.session!.exercisePlan?.map((entry) => entry.exerciseId)).toEqual([
      'exercise-3',
      'exercise-1',
      'exercise-2',
    ]);

    await act(async () => {
      await context.addSet('exercise-1', 'Bench Press', { weight: 60, reps: 12 });
    });
    await act(async () => {
      await context.removeExerciseFromSession('exercise-1');
    });
    expect(context.session!.exercisePlan?.map((entry) => entry.exerciseId)).toEqual([
      'exercise-3',
      'exercise-2',
    ]);
    expect(context.session!.exercises).toEqual([]);
  });

  it('does not duplicate an exercise or swap to one already in the plan', async () => {
    await renderContext();
    await act(async () => {
      await context.startSession('program-1', 'day-1', undefined, [
        { exerciseId: 'exercise-1', exerciseName: 'Bench Press' },
        { exerciseId: 'exercise-2', exerciseName: 'Row' },
      ]);
    });
    await act(async () => {
      await context.addExerciseToSession(
        makeExercise({ id: 'exercise-2', name: 'Row' })
      );
    });

    expect(context.session!.exercisePlan).toHaveLength(2);
    await expect(
      context.swapExercise('exercise-1', 'exercise-2', 'Row')
    ).rejects.toThrow('Exercise already in session');
  });

  it('completes a session into history and clears active storage', async () => {
    await renderContext();
    await act(async () => {
      await context.startSession('program-1', 'day-1', 'Upper');
    });
    await act(async () => {
      await context.addSet('exercise-1', 'Bench Press', { weight: 90, reps: 8 });
    });
    await act(async () => {
      await context.completeSession('Felt strong');
    });

    expect(context.session).toBeNull();
    expect(await getActiveSession(TEST_USER_ID)).toBeNull();
    const history = await getSessionHistory(TEST_USER_ID);
    expect(history[0].data).toEqual(
      expect.objectContaining({
        notes: 'Felt strong',
        completedAt: expect.any(String),
      })
    );
    expect(context.sessionHistory[0].notes).toBe('Felt strong');
  });

  it('cancels without adding the active session to history', async () => {
    await renderContext();
    await act(async () => {
      await context.startSession('program-1', 'day-1');
      await context.cancelSession();
    });

    expect(context.session).toBeNull();
    expect(await getActiveSession(TEST_USER_ID)).toBeNull();
    expect(await getSessionHistory(TEST_USER_ID)).toEqual([]);
  });

  it('restores a persisted active session on mount', async () => {
    await seedTestUser();
    const persisted = makeSession({ name: 'Restored Workout' });
    await setActiveSession(TEST_USER_ID, {
      id: persisted.id,
      userId: TEST_USER_ID,
      data: persisted,
      createdAt: persisted.startedAt,
      updatedAt: persisted.startedAt,
    });

    const view = await renderWithProviders(<Probe />, { workoutSession: true });
    expect(await view.findByText('Restored Workout')).toBeOnTheScreen();
    expect(context.session).toEqual(persisted);
  });

  it('guards invalid operations and surfaces persistence failures', async () => {
    await renderContext();
    await expect(
      context.addSet('exercise-1', 'Bench Press', { weight: 10, reps: 10 })
    ).rejects.toThrow('No active session');

    await act(async () => {
      await context.startSession('program-1', 'day-1');
    });
    await act(async () => {
      await expect(
        context.updateSet('missing', 0, { weight: 10, reps: 10 })
      ).rejects.toThrow('Exercise not found in session');
    });

    jest.spyOn(storageClient, 'set').mockRejectedValueOnce(new Error('disk full'));
    await act(async () => {
      await expect(
        context.addSet('exercise-1', 'Bench Press', { weight: 10, reps: 10 })
      ).rejects.toThrow('disk full');
    });
    expect(context.error?.message).toBe('disk full');
    expect(context.session!.exercises).toEqual([]);
  });
});
