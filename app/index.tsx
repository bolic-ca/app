/**
 * Index Screen
 * Route guard that handles onboarding flow
 */

import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useStorage } from '@/contexts/StorageContext';

export default function Index() {
  const { isInitialized, needsOnboarding } = useStorage();

  // Show loading spinner while storage initializes
  if (!isInitialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator
          size="large"
          accessibilityLabel="Initializing app"
        />
      </View>
    );
  }

  // Redirect to onboarding if needed
  if (needsOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  // Otherwise go to main app
  return <Redirect href="/(tabs)" />;
}
