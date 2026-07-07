import React, { ReactNode } from 'react';
import { Pressable, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { colors, radius, shadow } from '@/src/theme';

type Props = {
  onPress?: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  disabled?: boolean;
};

export default function PressableCard({ onPress, children, style, testID, disabled }: Props) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      testID={testID}
      disabled={disabled}
      onPressIn={() => (scale.value = withSpring(0.96, { damping: 15, stiffness: 220 }))}
      onPressOut={() => (scale.value = withTiming(1, { duration: 160 }))}
      onPress={onPress}
    >
      <Animated.View style={[styles.card, animatedStyle, style]}>{children}</Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    ...shadow.card,
  },
});
