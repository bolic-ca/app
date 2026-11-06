import type { WorkoutSession } from '@/services/storage/session-storage';
import { MuscleCategory, type Program, type TrainingExercise } from '@/types/training';

export function makeExercise(
  overrides: Partial<TrainingExercise> = {}
): TrainingExercise {
  return {
    id: 'exercise-1',
    userId: 'test-user',
    trainingDayIds: [],
    name: 'Bench Press',
    muscleCategory: MuscleCategory.Chest,
    equipment: 'Barbell',
    targetNumberOfSets: 3,
    targetRepetitions: '8-10',
    ...overrides,
  };
}

export function makeProgram(overrides: Partial<Program> = {}): Program {
  return {
    id: 'program-1',
    userId: 'test-user',
    name: 'Upper / Lower',
    type: 'simple',
    schedule: 'rotating',
    trainingDays: [
      {
        id: 'day-1',
        userId: 'test-user',
        name: 'Upper',
        number: 1,
        exercises: [makeExercise()],
      },
    ],
    ...overrides,
  };
}

export function makeSession(
  overrides: Partial<WorkoutSession> = {}
): WorkoutSession {
  return {
    id: 'session-1',
    programId: 'program-1',
    trainingDayId: 'day-1',
    name: 'Upper',
    startedAt: '2026-11-03T12:00:00.000Z',
    completedAt: null,
    exercisePlan: [
      {
        exerciseId: 'exercise-1',
        exerciseName: 'Bench Press',
      },
    ],
    exercises: [],
    ...overrides,
  };
}
