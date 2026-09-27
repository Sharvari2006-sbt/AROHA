import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, radius } from '@/src/theme';

export default function BackButton() {
  const router = useRouter();
  return <Pressable onPress={() => router.back()} style={styles.button} hitSlop={8} testID="inner-back"><Feather name="arrow-left" size={18} color={colors.onSurface} /></Pressable>;
}

const styles = StyleSheet.create({
  button: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
});
