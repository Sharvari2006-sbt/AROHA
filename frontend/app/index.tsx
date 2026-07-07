import React, { useEffect } from 'react';
import { StyleSheet, Text, View, Dimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';

import RobotMascot from '@/src/components/RobotMascot';
import { colors, spacing } from '@/src/theme';

const { width, height } = Dimensions.get('window');

const PARTICLES = Array.from({ length: 14 }).map((_, i) => ({
  x: Math.random() * width,
  y: 100 + Math.random() * (height - 200),
  r: 2 + Math.random() * 3,
  color: [colors.brand, colors.orange, colors.yellow][i % 3],
  delay: i * 120,
}));

function Particle({ x, y, r, color, delay }: (typeof PARTICLES)[number]) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(withSequence(withTiming(0.8, { duration: 1600 }), withTiming(0, { duration: 1600 })), -1),
    );
    translateY.value = withDelay(
      delay,
      withRepeat(withTiming(-24, { duration: 3000, easing: Easing.inOut(Easing.quad) }), -1, true),
    );
  }, [delay, opacity, translateY]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[{ position: 'absolute', left: x, top: y }, style]} pointerEvents="none">
      <Svg width={r * 2} height={r * 2}>
        <Circle cx={r} cy={r} r={r} fill={color} />
      </Svg>
    </Animated.View>
  );
}

export default function Splash() {
  const router = useRouter();

  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.85);
  const mascotOpacity = useSharedValue(0);
  const mascotFloat = useSharedValue(0);
  const glow = useSharedValue(0);
  const titleOpacity = useSharedValue(0);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
    logoScale.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.back(1.2)) });
    glow.value = withDelay(
      300,
      withRepeat(withSequence(withTiming(1, { duration: 1400 }), withTiming(0.4, { duration: 1400 })), -1, true),
    );
    mascotOpacity.value = withDelay(500, withTiming(1, { duration: 900 }));
    mascotFloat.value = withDelay(
      500,
      withRepeat(withTiming(-10, { duration: 1800, easing: Easing.inOut(Easing.sin) }), -1, true),
    );
    titleOpacity.value = withDelay(900, withTiming(1, { duration: 700 }));

    const t = setTimeout(() => {
      router.replace('/welcome');
    }, 2800);
    return () => clearTimeout(t);
  }, [glow, logoOpacity, logoScale, mascotFloat, mascotOpacity, router, titleOpacity]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const mascotStyle = useAnimatedStyle(() => ({
    opacity: mascotOpacity.value,
    transform: [{ translateY: mascotFloat.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + glow.value * 0.5,
    transform: [{ scale: 0.95 + glow.value * 0.15 }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: (1 - titleOpacity.value) * 12 }],
  }));

  return (
    <View style={styles.container} testID="splash-screen">
      {PARTICLES.map((p, i) => (
        <Particle key={i} {...p} />
      ))}

      <Animated.View style={[styles.glow, glowStyle]} />

      <Animated.View style={[styles.mascotWrap, mascotStyle]}>
        <RobotMascot size={170} />
      </Animated.View>

      <Animated.View style={[styles.logoWrap, logoStyle]}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoBadgeText}>TS</Text>
        </View>
      </Animated.View>

      <Animated.View style={[styles.titleWrap, titleStyle]}>
        <Text style={styles.title}>Twin Study</Text>
        <Text style={styles.subtitle}>Your calm learning companion</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    top: height / 2 - 180,
    width: 320,
    height: 320,
    borderRadius: 999,
    backgroundColor: colors.brandSoft,
  },
  mascotWrap: {
    marginTop: -40,
  },
  logoWrap: {
    marginTop: spacing.lg,
  },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.brand,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  logoBadgeText: {
    color: colors.onSurfaceInverse,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1,
  },
  titleWrap: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.onSurface,
    letterSpacing: 0.3,
  },
  subtitle: {
    marginTop: spacing.xs,
    fontSize: 14,
    color: colors.onSurfaceMuted,
  },
});
