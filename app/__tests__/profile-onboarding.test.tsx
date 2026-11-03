import React from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import ProfilePage from '@/app/(tabs)/profile';
import OnboardingScreen from '@/app/onboarding';
import { renderWithProviders } from '@/test-utils/render-with-providers';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { STORAGE_KEYS } from '@/services/storage/config';

jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
  },
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  writeAsStringAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
}));

const mockRouter = jest.mocked(router);
const mockGetDocument = jest.mocked(DocumentPicker.getDocumentAsync);
const mockWriteFile = jest.mocked(FileSystem.writeAsStringAsync);
const mockReadFile = jest.mocked(FileSystem.readAsStringAsync);
const mockCanShare = jest.mocked(Sharing.isAvailableAsync);
const mockShare = jest.mocked(Sharing.shareAsync);

async function chooseAlertAction(label: string) {
  const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2];
  const button = Array.isArray(buttons)
    ? buttons.find(candidate => candidate.text === label)
    : undefined;
  if (!button) throw new Error(`Alert action "${label}" was not found`);
  await act(async () => {
    await button.onPress?.();
  });
}

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockCanShare.mockResolvedValue(true);
  mockWriteFile.mockResolvedValue();
  mockShare.mockResolvedValue();
});

describe('onboarding', () => {
  it('presents the product value and completes first-run onboarding', async () => {
    const view = await renderWithProviders(<OnboardingScreen />, {
      onboardingCompleted: false,
    });

    expect(view.getByText('Works Offline')).toBeOnTheScreen();
    expect(view.getByText('Track Progress')).toBeOnTheScreen();
    expect(view.getByText('Science-based')).toBeOnTheScreen();
    await fireEvent.press(view.getByText('Get Started'));

    await waitFor(() =>
      expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)')
    );
    expect(
      JSON.parse((await AsyncStorage.getItem(STORAGE_KEYS.CONFIG))!)
    ).toEqual({
      version: 1,
      userId: 'test-user',
      onboardingCompleted: true,
    });
  });
});

describe('profile preferences and support', () => {
  it('persists color, units, and workout field preferences', async () => {
    const view = await renderWithProviders(<ProfilePage />);
    await view.findByText('Total Items');

    await fireEvent.press(view.getByText('Button Color'));
    await fireEvent.press(view.getByText('Ocean Blue'));
    await fireEvent.press(view.getByText('kg'));
    const switches = view.getAllByRole('switch');
    await fireEvent(switches[0], 'valueChange', false);
    await fireEvent(switches[1], 'valueChange', false);
    await fireEvent(switches[2], 'valueChange', false);
    await fireEvent(switches[3], 'valueChange', true);

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

    await fireEvent.press(view.getByText('Help Center'));
    await fireEvent.press(view.getByText('Privacy Policy'));
    expect(WebBrowser.openBrowserAsync).toHaveBeenNthCalledWith(
      1,
      'https://bolic.ca/support'
    );
    expect(WebBrowser.openBrowserAsync).toHaveBeenNthCalledWith(
      2,
      'https://bolic.ca/privacy-policy'
    );
  });

  it('explains the set-quality preference', async () => {
    const view = await renderWithProviders(<ProfilePage />);
    const qualityRow = view.getByText('Show Set Quality').parent?.parent;
    const infoButton = qualityRow?.children[2];
    fireEvent.press(infoButton as never);

    expect(Alert.alert).toHaveBeenCalledWith(
      'Set Quality',
      expect.stringContaining('1–5 scale'),
      [{ text: 'Got it' }]
    );
  });
});

describe('profile data management', () => {
  it('exports the real stored payload through native file and sharing boundaries', async () => {
    await AsyncStorage.setItem('@bolic:user:test:sample', JSON.stringify('ok'));
    const view = await renderWithProviders(<ProfilePage />);

    await fireEvent.press(view.getByText('Export All Data'));

    await waitFor(() => expect(mockWriteFile).toHaveBeenCalled());
    expect(mockWriteFile.mock.calls[0][0]).toMatch(
      /^file:\/\/\/documents\/bolic-backup-.*\.json$/
    );
    const payload = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
    expect(payload.data['@bolic:user:test:sample']).toBe('ok');
    expect(mockShare).toHaveBeenCalledWith(
      mockWriteFile.mock.calls[0][0],
      expect.objectContaining({ mimeType: 'application/json' })
    );
    expect(Alert.alert).toHaveBeenCalledWith(
      'Export Successful',
      expect.stringContaining('Keep this file safe'),
      [{ text: 'OK' }]
    );
  });

  it('reports export failures and restores the enabled action', async () => {
    mockWriteFile.mockRejectedValueOnce(new Error('permission denied'));
    const view = await renderWithProviders(<ProfilePage />);

    await fireEvent.press(view.getByText('Export All Data'));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Export Failed',
        'Failed to create export file. Please try again.'
      )
    );
    await fireEvent.press(view.getByText('Export All Data'));
    await waitFor(() => expect(mockWriteFile).toHaveBeenCalledTimes(2));
  });

  it('merges a selected backup and refreshes storage statistics', async () => {
    mockGetDocument.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///backup.json',
          name: 'backup.json',
          mimeType: 'application/json',
          size: 100,
          lastModified: 0,
        },
      ],
    });
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        exportDate: '2026-11-03T00:00:00.000Z',
        appVersion: '1.0.0',
        platform: 'android',
        data: { '@imported:item': { value: 42 } },
      })
    );
    const view = await renderWithProviders(<ProfilePage />);
    await view.findByText('Total Items');

    await fireEvent.press(view.getByText('Import Data'));
    await chooseAlertAction('Merge with Existing');

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Import Successful',
        expect.stringContaining('restart the app'),
        [{ text: 'OK' }]
      )
    );
    expect(await AsyncStorage.getItem('@imported:item')).toBe(
      JSON.stringify({ value: 42 })
    );
    expect(view.getByText('2')).toBeOnTheScreen();
  });

  it('requires replacement confirmation and reports invalid backups', async () => {
    mockGetDocument.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///broken.json',
          name: 'broken.json',
          mimeType: 'application/json',
          size: 6,
          lastModified: 0,
        },
      ],
    });
    mockReadFile.mockResolvedValue('broken');
    const view = await renderWithProviders(<ProfilePage />);

    await fireEvent.press(view.getByText('Import Data'));
    await chooseAlertAction('Replace All Data');
    expect(Alert.alert).toHaveBeenLastCalledWith(
      'Confirm Replace',
      expect.stringContaining('delete all current data'),
      expect.any(Array)
    );
    await chooseAlertAction('Replace');

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Import Failed',
        'Failed to read import file. Please check the file is valid.'
      )
    );
    expect(await AsyncStorage.getItem(STORAGE_KEYS.CONFIG)).not.toBeNull();
  });

  it('does nothing when file selection is canceled', async () => {
    mockGetDocument.mockResolvedValue({
      canceled: true,
      assets: null,
    });
    const view = await renderWithProviders(<ProfilePage />);

    await fireEvent.press(view.getByText('Import Data'));
    await chooseAlertAction('Merge with Existing');

    expect(mockReadFile).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalledWith(
      'Import Successful',
      expect.anything(),
      expect.anything()
    );
  });

  it('clears all data only after both destructive confirmations', async () => {
    await AsyncStorage.setItem('@extra', 'value');
    const view = await renderWithProviders(<ProfilePage />);

    await fireEvent.press(view.getByText('Reset All Data'));
    await chooseAlertAction('Reset Everything');
    expect(Alert.alert).toHaveBeenLastCalledWith(
      'Final Confirmation',
      expect.stringContaining('last chance'),
      expect.any(Array)
    );
    await chooseAlertAction('Delete All Data');

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Data Cleared',
        'All data has been deleted. Please restart the app.',
        [{ text: 'OK' }]
      )
    );
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
  });

  it('reports storage clear failures without claiming success', async () => {
    jest
      .spyOn(AsyncStorage, 'clear')
      .mockRejectedValueOnce(new Error('storage locked'));
    const view = await renderWithProviders(<ProfilePage />);

    await fireEvent.press(view.getByText('Reset All Data'));
    await chooseAlertAction('Reset Everything');
    await chooseAlertAction('Delete All Data');

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        'Failed to clear data. Please try again.'
      )
    );
    expect(Alert.alert).not.toHaveBeenCalledWith(
      'Data Cleared',
      expect.anything(),
      expect.anything()
    );
  });
});
