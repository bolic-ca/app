import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { Collapsible } from '@/components/ui/collapsible';
import { ExternalLink } from '@/components/external-link';
import { HapticTab } from '@/components/haptic-tab';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import TabLayout from '@/app/(tabs)/_layout';
import { ThemeProvider } from '@/contexts/ThemeContext';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import type { Program } from '@/types/training';
import type { WorkoutSession } from '@/services/storage/session-storage';

let mockSession: WorkoutSession | null = null;
let mockActiveProgram: Program | null = null;

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light' },
  impactAsync: jest.fn(),
}));

jest.mock('expo-web-browser', () => ({
  WebBrowserPresentationStyle: { AUTOMATIC: 'automatic' },
  openBrowserAsync: jest.fn(),
}));

jest.mock('expo-router/react-navigation', () => {
  const { Pressable } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return { PlatformPressable: Pressable };
});

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { TouchableOpacity, View } =
    jest.requireActual<typeof import('react-native')>('react-native');

  function Link({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) {
    return React.createElement(TouchableOpacity, props, children);
  }
  function Tabs({ children }: React.PropsWithChildren) {
    return React.createElement(View, { testID: 'tabs' }, children);
  }
  Tabs.Screen = function MockTabScreen() {
    return null;
  };

  return { Link, Tabs };
});

jest.mock('@/contexts/WorkoutSessionContext', () => ({
  useWorkoutSession: () => ({ session: mockSession }),
}));

jest.mock('@/hooks/useActiveProgram', () => ({
  useActiveProgram: () => ({ program: mockActiveProgram }),
}));

jest.mock('@/components/workout/ActiveWorkoutBanner', () => {
  const { Text } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return function MockBanner({
    trainingDayName,
  }: {
    trainingDayName?: string;
  }) {
    return <Text>Banner:{trainingDayName ?? 'unknown'}</Text>;
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockSession = null;
  mockActiveProgram = null;
});

describe('shared UI behavior', () => {
  it('toggles collapsible content', async () => {
    const view = await render(
      <Collapsible title="Details">
        <Text>Hidden details</Text>
      </Collapsible>
    );

    expect(view.queryByText('Hidden details')).not.toBeOnTheScreen();
    await fireEvent.press(view.getByText('Details'));
    expect(view.getByText('Hidden details')).toBeOnTheScreen();
    await fireEvent.press(view.getByText('Details'));
    expect(view.queryByText('Hidden details')).not.toBeOnTheScreen();
  });

  it('opens external links in-app and prevents native default navigation', async () => {
    process.env.EXPO_OS = 'ios';
    const preventDefault = jest.fn();
    const view = await render(
      <ExternalLink href="https://bolic.ca">
        <Text>Website</Text>
      </ExternalLink>
    );

    await fireEvent.press(view.getByText('Website'), { preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      'https://bolic.ca',
      {
        presentationStyle:
          WebBrowser.WebBrowserPresentationStyle.AUTOMATIC,
      }
    );
  });

  it('adds iOS tab haptics while preserving the supplied press callback', async () => {
    process.env.EXPO_OS = 'ios';
    const onPressIn = jest.fn();
    const view = await render(
      <HapticTab
        accessibilityState={{ selected: false }}
        onPress={jest.fn()}
        onPressIn={onPressIn}
      >
        <Text>Tab</Text>
      </HapticTab>
    );

    await fireEvent(view.getByText('Tab'), 'pressIn');

    expect(Haptics.impactAsync).toHaveBeenCalledWith(
      Haptics.ImpactFeedbackStyle.Light
    );
    expect(onPressIn).toHaveBeenCalled();
  });

  it('renders parallax header and body content', async () => {
    const view = await render(
      <ParallaxScrollView
        headerImage={<Text>Header art</Text>}
        headerBackgroundColor={{ light: '#fff', dark: '#000' }}
      >
        <Text>Page body</Text>
      </ParallaxScrollView>
    );

    expect(view.getByText('Header art')).toBeOnTheScreen();
    expect(view.getByText('Page body')).toBeOnTheScreen();
  });
});

describe('tab layout workout banner logic', () => {
  async function renderLayout() {
    return render(
      <ThemeProvider>
        <TabLayout />
      </ThemeProvider>
    );
  }

  it('hides the resume banner without an active session', async () => {
    const view = await renderLayout();

    expect(view.getByTestId('tabs')).toBeOnTheScreen();
    expect(view.queryByText(/Banner:/)).not.toBeOnTheScreen();
  });

  it('resolves a simple-program training day for the active session', async () => {
    mockSession = {
      id: 'session',
      programId: 'program',
      trainingDayId: 'lower',
      startedAt: '2026-11-03T12:00:00.000Z',
      completedAt: null,
      exercises: [],
    };
    mockActiveProgram = {
      id: 'program',
      userId: 'user',
      name: 'Simple',
      type: 'simple',
      isActive: true,
      trainingDays: [
        {
          id: 'lower',
          userId: 'user',
          number: 1,
          name: 'Lower',
          exercises: [],
        },
      ],
    };

    const view = await renderLayout();

    expect(view.getByText('Banner:Lower')).toBeOnTheScreen();
  });

  it('resolves a nested periodized training day and handles a missing day', async () => {
    mockSession = {
      id: 'session',
      programId: 'program',
      trainingDayId: 'upper',
      startedAt: '2026-11-03T12:00:00.000Z',
      completedAt: null,
      exercises: [],
    };
    mockActiveProgram = {
      id: 'program',
      userId: 'user',
      name: 'Block',
      type: 'periodized',
      isActive: true,
      mesocycles: [
        {
          id: 'meso',
          userId: 'user',
          name: 'Base',
          microcycles: [
            {
              id: 'micro',
              userId: 'user',
              mesocycleId: 'meso',
              weekNumber: 1,
              trainingDays: [
                {
                  id: 'upper',
                  userId: 'user',
                  number: 1,
                  name: 'Upper',
                  exercises: [],
                },
              ],
            },
          ],
        },
      ],
    };

    const view = await renderLayout();
    expect(view.getByText('Banner:Upper')).toBeOnTheScreen();

    mockSession = { ...mockSession!, trainingDayId: 'missing' };
    await view.rerender(
      <ThemeProvider>
        <TabLayout />
      </ThemeProvider>
    );
    expect(view.getByText('Banner:unknown')).toBeOnTheScreen();
  });
});
