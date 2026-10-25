import * as Haptics from 'expo-haptics';
import type { Tabs } from 'expo-router';
import { PlatformPressable } from 'expo-router/react-navigation';
import type { ComponentProps } from 'react';

type ScreenOptions = Exclude<ComponentProps<typeof Tabs>['screenOptions'], Function | undefined>;
type BottomTabBarButtonProps = Parameters<NonNullable<ScreenOptions['tabBarButton']>>[0];

export function HapticTab(props: BottomTabBarButtonProps) {
  return (
    <PlatformPressable
      {...props}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === 'ios') {
          // Add a soft haptic feedback when pressing down on the tabs.
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(ev);
      }}
    />
  );
}
