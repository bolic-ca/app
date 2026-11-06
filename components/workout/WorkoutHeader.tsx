/**
 * WorkoutHeader Component
 * Header for active workout with timer and action buttons
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useThemeCustomization } from '@/contexts/ThemeContext';
import WorkoutTimer from './WorkoutTimer';

interface WorkoutHeaderProps {
  startedAt: string;
  trainingDayName?: string;
  programName?: string;
  onCancel: () => void;
  onFinish: () => void;
  onMinimize?: () => void;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  };
  return date.toLocaleDateString('en-US', options);
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export default function WorkoutHeader({
  startedAt,
  trainingDayName = 'Workout',
  programName,
  onCancel,
  onFinish,
  onMinimize,
}: WorkoutHeaderProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const { customColors } = useThemeCustomization();

  const dateStr = formatDate(startedAt);
  const timeStr = formatTime(startedAt);

  return (
    <View style={[styles.container, { backgroundColor: theme.background, borderBottomColor: theme.cardBorder }]}>
      {/* Top Row: Date/Time and Actions */}
      <View style={styles.topRow}>
        <View style={styles.dateTimeContainer}>
          <Ionicons name="calendar-outline" size={14} color={theme.textSecondary} />
          <Text style={[styles.dateText, { color: theme.textSecondary }]}>
            {dateStr} at {timeStr}
          </Text>
        </View>
        <View style={styles.actions}>
          {onMinimize && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={onMinimize}
              accessibilityLabel="Minimize workout"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-down" size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onCancel}
            accessibilityLabel="Cancel workout"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={22} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content: Title and Timer */}
      <View style={styles.mainContent}>
        <View style={styles.titleSection}>
          {programName && (
            <Text style={[styles.programName, { color: theme.textSecondary }]} numberOfLines={1}>
              {programName}
            </Text>
          )}
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            {trainingDayName}
          </Text>
        </View>

        <View style={styles.timerSection}>
          <WorkoutTimer startedAt={startedAt} color={customColors.primaryButton} />
          <TouchableOpacity
            style={[styles.finishButton, { backgroundColor: customColors.primaryButton }]}
            onPress={onFinish}
          >
            <Ionicons name="checkmark" size={18} color={customColors.primaryButtonText} />
            <Text style={[styles.finishButtonText, { color: customColors.primaryButtonText }]}>
              Finish
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dateTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 13,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionButton: {
    padding: 4,
  },
  mainContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleSection: {
    flex: 1,
    marginRight: 16,
  },
  programName: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  timerSection: {
    alignItems: 'flex-end',
    gap: 8,
  },
  finishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    gap: 4,
  },
  finishButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
