import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import type { ComponentProps } from 'react';

// expo-router (SDK 58) ships its own copy of the react-navigation types whose
// color types differ slightly from @react-navigation/elements, so we accept the
// pressable props directly and let tabBarButton's loose signature handle it.
type HapticTabProps = ComponentProps<typeof PlatformPressable>;

export function HapticTab(props: HapticTabProps) {
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
