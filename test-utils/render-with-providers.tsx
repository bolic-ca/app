import React, { type ReactElement, type ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react-native';

import { SimpleProgramWizardProvider } from '@/contexts/SimpleProgramWizardContext';
import { StorageProvider } from '@/contexts/StorageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { WorkoutSessionProvider } from '@/contexts/WorkoutSessionContext';
import { WorkoutUIProvider } from '@/contexts/WorkoutUIContext';
import { STORAGE_KEYS } from '@/services/storage/config';
import * as storageClient from '@/services/storage/storage-client';

export const TEST_USER_ID = 'test-user';

interface ProviderOptions extends RenderOptions {
  userId?: string;
  onboardingCompleted?: boolean;
  wizard?: boolean;
  workoutSession?: boolean;
  workoutUI?: boolean;
}

export async function seedTestUser(
  userId = TEST_USER_ID,
  onboardingCompleted = true
) {
  await storageClient.set(STORAGE_KEYS.CONFIG, {
    version: 1,
    userId,
    onboardingCompleted,
  });
}

export async function renderWithProviders(
  ui: ReactElement,
  {
    userId = TEST_USER_ID,
    onboardingCompleted = true,
    wizard = false,
    workoutSession = false,
    workoutUI = false,
    ...renderOptions
  }: ProviderOptions = {}
) {
  await seedTestUser(userId, onboardingCompleted);

  function Wrapper({ children }: { children: ReactNode }) {
    let tree = children;

    if (wizard) {
      tree = <SimpleProgramWizardProvider>{tree}</SimpleProgramWizardProvider>;
    }
    if (workoutUI) {
      tree = <WorkoutUIProvider>{tree}</WorkoutUIProvider>;
    }
    if (workoutSession) {
      tree = <WorkoutSessionProvider>{tree}</WorkoutSessionProvider>;
    }

    return (
      <StorageProvider>
        <ThemeProvider>{tree}</ThemeProvider>
      </StorageProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}
