import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  ThemeProvider,
  useThemeCustomization,
} from '@/contexts/ThemeContext';
import { StorageProvider, useStorage } from '@/contexts/StorageContext';
import { STORAGE_KEYS } from '@/services/storage/config';

function ThemeConsumer() {
  const theme = useThemeCustomization();
  return (
    <View>
      <Text testID="theme-loaded">{String(theme.isLoaded)}</Text>
      <Text testID="accent">{theme.customColors.primaryButton}</Text>
      <Text testID="preferences">
        {JSON.stringify(theme.preferences)}
      </Text>
      <TouchableOpacity
        onPress={() =>
          theme.setCustomColors({
            primaryButton: '#0a7ea4',
            primaryButtonText: '#fff',
          })
        }
      >
        <Text>Set blue</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => theme.setWeightUnit('kg')}>
        <Text>Use kg</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => theme.setShowRir(false)}>
        <Text>Hide RIR</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => theme.setShowRpe(false)}>
        <Text>Hide RPE</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => theme.setShowNotes(false)}>
        <Text>Hide notes</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => theme.setShowQuality(true)}>
        <Text>Show quality</Text>
      </TouchableOpacity>
    </View>
  );
}

function StorageConsumer() {
  const storage = useStorage();
  return (
    <View>
      <Text testID="initialized">{String(storage.isInitialized)}</Text>
      <Text testID="user-id">{storage.userId}</Text>
      <Text testID="needs-onboarding">
        {String(storage.needsOnboarding)}
      </Text>
      <TouchableOpacity onPress={storage.completeOnboarding}>
        <Text>Complete onboarding</Text>
      </TouchableOpacity>
    </View>
  );
}

beforeEach(() => {
  jest.restoreAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('ThemeProvider', () => {
  it('loads persisted theme and preferences', async () => {
    await AsyncStorage.multiSet([
      [
        '@bolic_theme_customization',
        JSON.stringify({
          primaryButton: '#059669',
          primaryButtonText: '#fff',
        }),
      ],
      [
        '@bolic_preferences',
        JSON.stringify({
          weightUnit: 'kg',
          showRir: false,
          showRpe: true,
          showNotes: false,
          showQuality: true,
        }),
      ],
    ]);

    const view = await render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    await waitFor(() =>
      expect(view.getByTestId('theme-loaded')).toHaveTextContent('true')
    );
    expect(view.getByTestId('accent')).toHaveTextContent('#059669');
    expect(
      JSON.parse(view.getByTestId('preferences').props.children)
    ).toEqual({
      weightUnit: 'kg',
      showRir: false,
      showRpe: true,
      showNotes: false,
      showQuality: true,
    });
  });

  it('persists theme and every workout preference', async () => {
    const view = await render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );
    await waitFor(() =>
      expect(view.getByTestId('theme-loaded')).toHaveTextContent('true')
    );

    await fireEvent.press(view.getByText('Set blue'));
    await fireEvent.press(view.getByText('Use kg'));
    await fireEvent.press(view.getByText('Hide RIR'));
    await fireEvent.press(view.getByText('Hide RPE'));
    await fireEvent.press(view.getByText('Hide notes'));
    await fireEvent.press(view.getByText('Show quality'));

    await waitFor(async () => {
      expect(
        JSON.parse(
          (await AsyncStorage.getItem('@bolic_theme_customization'))!
        )
      ).toEqual({
        primaryButton: '#0a7ea4',
        primaryButtonText: '#fff',
      });
      expect(
        JSON.parse((await AsyncStorage.getItem('@bolic_preferences'))!)
      ).toEqual({
        weightUnit: 'kg',
        showRir: false,
        showRpe: false,
        showNotes: false,
        showQuality: true,
      });
    });
  });

  it('keeps current state when persistence fails', async () => {
    const view = await render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );
    await waitFor(() =>
      expect(view.getByTestId('theme-loaded')).toHaveTextContent('true')
    );
    jest
      .spyOn(AsyncStorage, 'setItem')
      .mockRejectedValueOnce(new Error('disk full'));

    await fireEvent.press(view.getByText('Set blue'));

    await waitFor(() => expect(console.error).toHaveBeenCalled());
    expect(view.getByTestId('accent')).toHaveTextContent('#dc2626');
  });

  it('requires consumers to be wrapped in the provider', async () => {
    await expect(render(<ThemeConsumer />)).rejects.toThrow(
      'useThemeCustomization must be used within ThemeProvider'
    );
  });
});

describe('StorageProvider', () => {
  it('creates a first-run config and exposes onboarding state', async () => {
    const view = await render(
      <StorageProvider>
        <StorageConsumer />
      </StorageProvider>
    );

    await waitFor(() =>
      expect(view.getByTestId('initialized')).toHaveTextContent('true')
    );
    expect(view.getByTestId('user-id').props.children).not.toBe('');
    expect(view.getByTestId('needs-onboarding')).toHaveTextContent('true');

    const config = JSON.parse(
      (await AsyncStorage.getItem(STORAGE_KEYS.CONFIG))!
    );
    expect(config).toEqual({
      version: 1,
      userId: view.getByTestId('user-id').props.children,
      onboardingCompleted: false,
    });
  });

  it('loads an existing user and persists onboarding completion', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEYS.CONFIG,
      JSON.stringify({
        version: 1,
        userId: 'returning-user',
        onboardingCompleted: false,
      })
    );
    const view = await render(
      <StorageProvider>
        <StorageConsumer />
      </StorageProvider>
    );

    await waitFor(() =>
      expect(view.getByTestId('user-id')).toHaveTextContent('returning-user')
    );
    await fireEvent.press(view.getByText('Complete onboarding'));

    await waitFor(() =>
      expect(view.getByTestId('needs-onboarding')).toHaveTextContent('false')
    );
    expect(
      JSON.parse((await AsyncStorage.getItem(STORAGE_KEYS.CONFIG))!)
    ).toEqual({
      version: 1,
      userId: 'returning-user',
      onboardingCompleted: true,
    });
  });

  it('leaves loading state after an initialization write failure', async () => {
    jest
      .spyOn(AsyncStorage, 'setItem')
      .mockRejectedValueOnce(new Error('unavailable'));
    const view = await render(
      <StorageProvider>
        <StorageConsumer />
      </StorageProvider>
    );

    await waitFor(() =>
      expect(view.getByTestId('initialized')).toHaveTextContent('true')
    );
    expect(view.getByTestId('user-id')).toHaveTextContent('');
    expect(console.error).toHaveBeenCalledWith(
      'Failed to initialize storage:',
      expect.any(Error)
    );
  });

  it('requires consumers to be wrapped in the provider', async () => {
    await expect(render(<StorageConsumer />)).rejects.toThrow(
      'useStorage must be used within StorageProvider'
    );
  });
});
