import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { colors, radius, spacing } from '@/src/theme';

type Props = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  accent?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export default function AuthLayout({ title, subtitle, eyebrow, accent = colors.brand, children, footer }: Props) {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))}
              style={styles.backBtn}
              hitSlop={8}
              testID="auth-back-btn"
            >
              <Feather name="arrow-left" size={18} color={colors.onSurface} />
            </Pressable>
          </View>
          {eyebrow ? <Text style={[styles.eyebrow, { color: accent }]}>{eyebrow}</Text> : null}
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          <View style={styles.body}>{children}</View>
          {footer}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  headerRow: { flexDirection: 'row', marginTop: spacing.sm },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: {
    marginTop: spacing.xl,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  title: {
    marginTop: spacing.sm,
    fontSize: 28,
    fontWeight: '800',
    color: colors.onSurface,
    lineHeight: 34,
  },
  subtitle: {
    marginTop: spacing.sm,
    fontSize: 15,
    color: colors.onSurfaceMuted,
    lineHeight: 22,
  },
  body: { marginTop: spacing.xl },
});
