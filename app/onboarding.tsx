/**
 * Onboarding Screen
 * First-time user experience
 */

import { View, Text, StyleSheet, TouchableOpacity, useColorScheme, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useStorage } from '@/contexts/StorageContext';
import { useThemeCustomization } from '@/contexts/ThemeContext';

export default function OnboardingScreen() {
  const { completeOnboarding } = useStorage();
  const { customColors } = useThemeCustomization();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Athletic color palette
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const accent = customColors.primaryButton;
  const palette = {
    bg: isDark ? '#0A0A0B' : '#FAFAF9',
    cardBg: isDark ? '#141416' : '#FFFFFF',
    cardBorder: isDark ? '#2A2A2E' : '#E8E8E6',
    text: isDark ? '#FAFAFA' : '#0A0A0B',
    textMuted: isDark ? '#71717A' : '#71717A',
    accent,
    accentGlow: isDark ? hexToRgba(accent, 0.15) : hexToRgba(accent, 0.08),
  };

  async function handleGetStarted() {
    await completeOnboarding();
    router.replace('/(tabs)');
  }

  const features = [
    { icon: 'phone-portrait-outline' as const, title: 'Works Offline', description: 'Track workouts without internet' },
    { icon: 'stats-chart' as const, title: 'Track Progress', description: 'History of previous sets' },
    { icon: 'barbell-outline' as const, title: 'Science-based', description: 'Science-based programming and exercise tracking' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]} edges={['top', 'bottom']}>
      <View style={styles.content}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={[styles.logoContainer, { backgroundColor: palette.accentGlow }]}>
            <Image source={require('@/assets/images/icon.png')} style={styles.logoImage} />
          </View>
          <Text style={[styles.welcomeLabel, { color: palette.textMuted }]}>WELCOME TO</Text>
          <Text style={[styles.title, { color: palette.text }]}>Bolic</Text>
          <Text style={[styles.subtitle, { color: palette.textMuted }]}>
            A science-based hypertrophy focused fitness training app.  
          </Text>
        </View>

        {/* Features */}
        <View style={styles.featuresContainer}>
          {features.map((feature, index) => (
            <View
              key={index}
              style={[styles.featureCard, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}
            >
              <View style={[styles.featureIconBg, { backgroundColor: palette.accentGlow }]}>
                <Ionicons name={feature.icon} size={22} color={palette.accent} />
              </View>
              <View style={styles.featureText}>
                <Text style={[styles.featureTitle, { color: palette.text }]}>{feature.title}</Text>
                <Text style={[styles.featureDescription, { color: palette.textMuted }]}>{feature.description}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: palette.accent, shadowColor: palette.accent },
          ]}
          onPress={handleGetStarted}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={[palette.accent, hexToRgba(palette.accent, 0.85)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.buttonGradient}
          >
            <Text style={styles.buttonText}>Get Started</Text>
            <View style={styles.buttonIconBg}>
              <Ionicons name="arrow-forward" size={20} color="#FFF" />
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },

  // Hero
  heroSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoContainer: {
    width: 96,
    height: 96,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    overflow: 'hidden',
  },
  logoImage: {
    width: 96,
    height: 96,
    borderRadius: 28,
  },
  welcomeLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 4,
  },
  title: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -2,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Features
  featuresContainer: {
    gap: 12,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
  },
  featureIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Footer
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  button: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    gap: 12,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  buttonIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
