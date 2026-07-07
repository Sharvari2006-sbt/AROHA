import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, StyleProp, ActivityIndicator } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { colors, radius, spacing } from '@/src/theme';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  disabled?: boolean;
};

export default function PrimaryButton({
  label,
  onPress,
  variant = 'primary',
  loading,
  style,
  testID,
  disabled,
}: Props) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const bg =
    variant === 'primary' ? colors.brand : variant === 'secondary' ? colors.surfaceSecondary : 'transparent';
  const fg = variant === 'primary' ? colors.onSurfaceInverse : colors.onSurface;
  const border = variant === 'secondary' ? colors.border : 'transparent';

  return (
    <Pressable
      testID={testID}
      disabled={disabled || loading}
      onPressIn={() => (scale.value = withSpring(0.97, { damping: 15, stiffness: 220 }))}
      onPressOut={() => (scale.value = withTiming(1, { duration: 160 }))}
      onPress={onPress}
    >
      <Animated.View
        style={[
          styles.btn,
          { backgroundColor: bg, borderColor: border, borderWidth: variant === 'secondary' ? 1 : 0 },
          disabled && { opacity: 0.5 },
          animatedStyle,
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={fg} />
        ) : (
          <Text style={[styles.label, { color: fg }]}>{label}</Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 54,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
