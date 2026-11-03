import { beforeEach, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual(
    '@react-native-async-storage/async-storage/jest/async-storage-mock'
  )
);
jest.mock('react-native-safe-area-context', () => mockSafeAreaContext);
jest.mock('react-native-reanimated', () => {
  const ReactNative =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: ReactNative.Animated,
    interpolate: (_value: number, _input: number[], output: number[]) =>
      output[0],
    runOnJS: (callback: (...args: unknown[]) => unknown) => callback,
    useAnimatedRef: () => ({ current: null }),
    useAnimatedStyle: (factory: () => object) => factory(),
    useScrollOffset: () => ({ value: 0 }),
    useSharedValue: (value: unknown) => ({ value }),
    withSpring: (value: unknown) => value,
  };
});

jest.mock('expo-linear-gradient', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');

  return {
    LinearGradient: View,
  };
});

beforeEach(async () => {
  await AsyncStorage.clear();
});
