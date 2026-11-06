import React from 'react';
import { render } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import Index from '@/app/index';

let mockStorageState = {
  isInitialized: false,
  needsOnboarding: false,
};

jest.mock('@/contexts/StorageContext', () => ({
  useStorage: () => mockStorageState,
}));

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return <Text>Redirect:{href}</Text>;
  },
}));

beforeEach(() => {
  mockStorageState = {
    isInitialized: false,
    needsOnboarding: false,
  };
});

describe('root route guard', () => {
  it('shows initialization progress before making a routing decision', async () => {
    const view = await render(<Index />);

    expect(view.getByLabelText('Initializing app')).toBeOnTheScreen();
    expect(view.queryByText(/Redirect:/)).not.toBeOnTheScreen();
  });

  it('redirects first-time users to onboarding', async () => {
    mockStorageState = {
      isInitialized: true,
      needsOnboarding: true,
    };

    const view = await render(<Index />);

    expect(view.getByText('Redirect:/onboarding')).toBeOnTheScreen();
  });

  it('redirects initialized returning users to the tab app', async () => {
    mockStorageState = {
      isInitialized: true,
      needsOnboarding: false,
    };

    const view = await render(<Index />);

    expect(view.getByText('Redirect:/(tabs)')).toBeOnTheScreen();
  });
});
