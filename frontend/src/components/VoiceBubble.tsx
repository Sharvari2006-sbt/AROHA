import React, { useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors, radius, shadow, spacing } from '@/src/theme';

type Props = {
  message: string | null;
  loading?: boolean;
  compact?: boolean;
};

export default function VoiceBubble({ message, loading, compact }: Props) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(message || loading ? 1 : 0, { duration: 350 });
  }, [message, loading, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!message && !loading) return null;

  return (
    <Animated.View style={[styles.wrap, compact && styles.compact, style]}>
      <View style={styles.tail} />
      {loading ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <ActivityIndicator size="small" color={colors.brandDeep} />
          <Text style={styles.loading}>Twin thinking…</Text>
        </View>
      ) : (
        <Text style={styles.text}>{message}</Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...shadow.card,
  },
  compact: { paddingVertical: spacing.sm + 2 },
  tail: {
    position: 'absolute',
    top: -6,
    left: 24,
    width: 12,
    height: 12,
    backgroundColor: colors.surfaceSecondary,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: colors.border,
    transform: [{ rotate: '45deg' }],
  },
  text: { color: colors.onSurface, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  loading: { color: colors.onSurfaceMuted, fontSize: 13, fontWeight: '600' },
});
