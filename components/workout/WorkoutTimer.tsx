/**
 * WorkoutTimer Component
 * Displays elapsed time for an active workout session
 */

import React, { useState, useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';

interface WorkoutTimerProps {
  startedAt: string;
  color?: string;
}

function calculateElapsed(startedAt: string): number {
  const start = new Date(startedAt).getTime();
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Math.floor((Date.now() - start) / 1000));
}

export default function WorkoutTimer({ startedAt, color = '#000' }: WorkoutTimerProps) {
  const [elapsedTime, setElapsedTime] = useState(() => calculateElapsed(startedAt));
  const [trackedStart, setTrackedStart] = useState(startedAt);

  if (startedAt !== trackedStart) {
    setTrackedStart(startedAt);
    setElapsedTime(calculateElapsed(startedAt));
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(calculateElapsed(startedAt));
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt]);

  // Format time as MM:SS or HH:MM:SS
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <Text style={[styles.timer, { color }]}>
      {formatTime(elapsedTime)}
    </Text>
  );
}

const styles = StyleSheet.create({
  timer: {
    fontSize: 24,
    fontWeight: '700',
    fontVariant: ['tabular-nums'], // Monospace numbers for stable layout
  },
});
