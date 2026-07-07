import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors, radius, spacing } from '@/src/theme';

type Props = {
  stage: number;
  stageProgress: number; // 0-100
  xp: number;
  nextStageXp?: number | null;
  style?: StyleProp<ViewStyle>;
};

const STAGE_LABELS = ['Sprout', 'Curious', 'Bright', 'Focused', 'Awakened'];

export default function EvolutionBar({ stage, stageProgress, xp, nextStageXp, style }: Props) {
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withTiming(Math.max(0, Math.min(100, stageProgress)), { duration: 800 });
  }, [stageProgress, w]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${w.value}%` }));

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.header}>
        <View style={styles.stagePill}>
          <Text style={styles.stagePillText}>Stage {stage}</Text>
        </View>
        <Text style={styles.label}>{STAGE_LABELS[Math.min(stage, 5) - 1]}</Text>
        <View style={{ flex: 1 }} />
        <Text style={styles.xp}>{xp}{nextStageXp ? ` / ${nextStageXp}` : ''} XP</Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fillStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {},
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  stagePill: {
    backgroundColor: colors.brand,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  stagePillText: { color: '#FFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  label: { fontSize: 12, fontWeight: '700', color: colors.onSurface },
  xp: { fontSize: 11, fontWeight: '700', color: colors.onSurfaceMuted },
  track: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
  },
});
