import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import * as storageClient from '@/services/storage/storage-client';
import { BaseStorage } from '@/services/storage/base-storage';
import { getUserKey, USER_DATA_KEYS } from '@/services/storage/config';
import {
  clearStats,
  getStats,
  updateStats,
  type UserStats,
} from '@/services/storage/stats-storage';
import {
  clearActiveSession,
  deleteSession,
  formatRir,
  formatRirShort,
  getActiveSession,
  getCurrentMonthSessions,
  getLastSessionPlanForDay,
  getSessionHistory,
  getSessionsByMonth,
  saveSession,
  setActiveSession,
  type WorkoutSession,
} from '@/services/storage/session-storage';

const stats: UserStats = {
  totalWorkouts: 4,
  currentStreak: 2,
  longestStreak: 3,
  totalVolume: 1000,
  activeTime: 2.5,
  lastWorkoutDate: '2026-01-02T00:00:00.000Z',
  weeklyWorkouts: [0, 1, 0, 1, 0, 0, 0],
};

const workout = (overrides: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id: 'session',
  programId: 'program',
  trainingDayId: 'day',
  startedAt: '2026-01-02T10:00:00.000Z',
  completedAt: null,
  exercises: [],
  ...overrides,
});

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('storage client', () => {
  it('round-trips values and supports remove, clear, and key queries', async () => {
    await storageClient.set('prefix:a', { value: 1 });
    await storageClient.set('other:b', [2]);
    expect(await storageClient.get('prefix:a')).toEqual({ value: 1 });
    expect(await storageClient.get('missing')).toBeNull();
    expect(await storageClient.getAllKeys()).toEqual(
      expect.arrayContaining(['prefix:a', 'other:b']),
    );
    expect(await storageClient.getKeysWithPrefix('prefix:')).toEqual(['prefix:a']);

    await storageClient.remove('prefix:a');
    expect(await storageClient.get('prefix:a')).toBeNull();
    await storageClient.clear();
    expect(await storageClient.getAllKeys()).toEqual([]);
  });

  it('handles malformed JSON and get failures as missing values', async () => {
    await AsyncStorage.setItem('bad', '{');
    expect(await storageClient.get('bad')).toBeNull();
    expect(console.error).toHaveBeenCalled();

    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('read failed'));
    expect(await storageClient.get('x')).toBeNull();
  });

  it('maps quota errors and rethrows ordinary set errors', async () => {
    jest.spyOn(AsyncStorage, 'setItem')
      .mockRejectedValueOnce(new Error('QuotaExceededError: full'))
      .mockRejectedValueOnce(new TypeError('offline'));

    await expect(storageClient.set('x', 1)).rejects.toThrow(
      'Storage quota exceeded. Please free up space.',
    );
    await expect(storageClient.set('x', 1)).rejects.toThrow('offline');
  });

  it('multi-gets valid values, nulls parse failures, and omits missing keys', async () => {
    await AsyncStorage.multiSet([
      ['valid', JSON.stringify({ ok: true })],
      ['bad', '{'],
    ]);
    expect(await storageClient.multiGet(['valid', 'bad', 'missing'])).toEqual({
      valid: { ok: true },
      bad: null,
    });
  });

  it('multi-sets and multi-removes values', async () => {
    await storageClient.multiSet([['a', 1], ['b', { two: 2 }]]);
    expect(await storageClient.multiGet(['a', 'b'])).toEqual({
      a: 1,
      b: { two: 2 },
    });
    await storageClient.multiRemove(['a', 'b']);
    expect(await storageClient.multiGet(['a', 'b'])).toEqual({});
  });

  it('returns safe fallbacks for collection read failures', async () => {
    jest.spyOn(AsyncStorage, 'multiGet').mockRejectedValueOnce(new Error('fail'));
    expect(await storageClient.multiGet(['x'])).toEqual({});
    jest.spyOn(AsyncStorage, 'getAllKeys')
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'));
    expect(await storageClient.getAllKeys()).toEqual([]);
    expect(await storageClient.getKeysWithPrefix('x')).toEqual([]);
  });

  it('rethrows mutation failures', async () => {
    jest.spyOn(AsyncStorage, 'removeItem').mockRejectedValueOnce(new Error('remove'));
    await expect(storageClient.remove('x')).rejects.toThrow('remove');
    jest.spyOn(AsyncStorage, 'clear').mockRejectedValueOnce(new Error('clear'));
    await expect(storageClient.clear()).rejects.toThrow('clear');
    jest.spyOn(AsyncStorage, 'multiSet').mockRejectedValueOnce(new Error('multi-set'));
    await expect(storageClient.multiSet([['x', 1]])).rejects.toThrow('multi-set');
    jest.spyOn(AsyncStorage, 'multiRemove').mockRejectedValueOnce(new Error('multi-remove'));
    await expect(storageClient.multiRemove(['x'])).rejects.toThrow('multi-remove');
  });
});

describe('BaseStorage', () => {
  interface Note { title: string }
  const notes = new BaseStorage<Note>('notes');

  it('creates, reads, updates, upserts, deletes, and clears entities', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    expect(await notes.getAll('user')).toEqual([]);
    expect(await notes.getById('user', 'missing')).toBeNull();

    const created = await notes.save('user', { title: 'first' });
    expect(created).toMatchObject({ userId: 'user', data: { title: 'first' } });
    expect(await notes.getById('user', created.id)).toEqual(created);

    jest.setSystemTime(new Date('2026-01-02T00:00:00.000Z'));
    const updated = await notes.save('user', { title: 'updated' }, created.id);
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.updatedAt).not.toBe(created.updatedAt);

    const upserted = await notes.save('user', { title: 'upsert' }, 'known-id');
    expect(upserted.id).toBe('known-id');
    expect(upserted.createdAt).toBe(upserted.updatedAt);
    expect(await notes.getAll('user')).toHaveLength(2);

    await notes.delete('user', created.id);
    expect(await notes.getAll('user')).toEqual([upserted]);
    await notes.clear('user');
    expect(await notes.getAll('user')).toEqual([]);
  });
});

describe('stats storage', () => {
  it('returns defaults, persists stats, and clears them', async () => {
    expect(await getStats('user')).toEqual({
      totalWorkouts: 0,
      currentStreak: 0,
      longestStreak: 0,
      totalVolume: 0,
      activeTime: 0,
      lastWorkoutDate: null,
      weeklyWorkouts: [0, 0, 0, 0, 0, 0, 0],
    });
    await updateStats('user', stats);
    expect(await getStats('user')).toEqual(stats);
    await clearStats('user');
    expect(await getStats('user')).not.toEqual(stats);
  });
});

describe('session storage', () => {
  it('formats every RIR representation', () => {
    expect(formatRir('F')).toBe('Failure');
    expect(formatRir('P')).toBe('Partials');
    expect(formatRir(2)).toBe('2');
    expect(formatRirShort('F')).toBe('F');
    expect(formatRirShort('P')).toBe('P');
    expect(formatRirShort(3)).toBe('3');
  });

  it('saves new sessions, updates existing sessions, and upserts unknown IDs', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-02T12:00:00.000Z'));
    expect(await getSessionsByMonth('user', 2026, 1)).toEqual([]);
    const created = await saveSession('user', workout());
    expect((await getSessionsByMonth('user', 2026, 1))[0]).toEqual(created);

    jest.setSystemTime(new Date('2026-01-03T12:00:00.000Z'));
    const updated = await saveSession(
      'user',
      workout({ completedAt: '2026-01-03T00:00:00.000Z' }),
      created.id,
    );
    expect(updated.createdAt).toBe(created.createdAt);
    expect(await getSessionsByMonth('user', 2026, 1)).toHaveLength(1);

    const upserted = await saveSession('user', workout({ id: 'second' }), 'unknown');
    expect(upserted.id).toBe('unknown');
    expect(await getSessionsByMonth('user', 2026, 1)).toHaveLength(2);
  });

  it('gets current-month sessions and manages the active session', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-02-15T12:00:00.000Z'));
    const item = await saveSession(
      'user',
      workout({ startedAt: '2026-02-03T10:00:00.000Z' }),
    );
    expect(await getCurrentMonthSessions('user')).toEqual([item]);
    expect(await getActiveSession('user')).toBeNull();
    await setActiveSession('user', item);
    expect(await getActiveSession('user')).toEqual(item);
    await clearActiveSession('user');
    expect(await getActiveSession('user')).toBeNull();
  });

  it('collects three months, sorts descending, and applies the limit', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-15T12:00:00.000Z'));
    await saveSession('user', workout({ id: 'jan', startedAt: '2026-01-20T10:00:00.000Z' }));
    await saveSession('user', workout({ id: 'mar', startedAt: '2026-03-01T10:00:00.000Z' }));
    await saveSession('user', workout({ id: 'feb', startedAt: '2026-02-10T10:00:00.000Z' }));
    const history = await getSessionHistory('user', 2);
    expect(history.map(item => item.data.id)).toEqual(['mar', 'feb']);
  });

  it('finds the latest completed plan and handles absent or legacy plans', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-15T12:00:00.000Z'));
    await saveSession('user', workout({
      startedAt: '2026-03-02T10:00:00.000Z',
      completedAt: '2026-03-02T11:00:00.000Z',
      exercisePlan: [{ exerciseId: 'bench', exerciseName: 'Bench' }],
    }));
    expect(await getLastSessionPlanForDay('user', 'day')).toEqual([
      { exerciseId: 'bench', exerciseName: 'Bench' },
    ]);
    expect(await getLastSessionPlanForDay('user', 'other')).toBeNull();

    await saveSession('legacy', workout({
      completedAt: '2026-03-02T11:00:00.000Z',
      exercisePlan: undefined,
    }));
    expect(await getLastSessionPlanForDay('legacy', 'day')).toBeNull();
  });

  it('deletes only the requested session from its month partition', async () => {
    const first = await saveSession('user', workout({ id: 'one' }));
    await saveSession('user', workout({ id: 'two' }));
    await deleteSession('user', first.id, first.data.startedAt);
    const remaining = await getSessionsByMonth('user', 2026, 1);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].data.id).toBe('two');
  });

  it('uses namespaced storage keys', async () => {
    await updateStats('one', stats);
    expect(await AsyncStorage.getItem(getUserKey('two', USER_DATA_KEYS.STATS))).toBeNull();
    expect(await AsyncStorage.getItem(getUserKey('one', USER_DATA_KEYS.STATS))).not.toBeNull();
  });
});
