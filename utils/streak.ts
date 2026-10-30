/**
 * Workout streak math on the device's local calendar.
 * Timestamps are stored as UTC ISO strings; comparing those UTC dates
 * shifts the day for anyone west of UTC who trains in the evening.
 */

/** Local calendar date as YYYY-MM-DD. */
export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Whole local calendar days from earlierKey to laterKey. Negative if later is first. */
export function calendarDaysBetween(earlierKey: string, laterKey: string): number {
  const [ey, em, ed] = earlierKey.split('-').map(Number);
  const [ly, lm, ld] = laterKey.split('-').map(Number);
  const start = new Date(ey, em - 1, ed);
  const end = new Date(ly, lm - 1, ld);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

/**
 * Streak after completing a workout at `now`.
 * Same local day keeps the streak, the next local day increments it, otherwise it restarts at 1.
 */
export function nextWorkoutStreak(
  currentStreak: number,
  lastWorkoutDate: string | null,
  now: Date
): number {
  if (!lastWorkoutDate) return 1;

  const daysDiff = calendarDaysBetween(
    localDateKey(new Date(lastWorkoutDate)),
    localDateKey(now)
  );

  if (daysDiff <= 0) return currentStreak;
  if (daysDiff === 1) return currentStreak + 1;
  return 1;
}
