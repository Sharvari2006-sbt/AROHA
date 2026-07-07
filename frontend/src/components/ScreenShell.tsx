import React, { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/src/theme';

type Props = {
  greeting?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  testID?: string;
};

export default function ScreenShell({ greeting, title, subtitle, right, children, testID }: Props) {
  return (
    <SafeAreaView style={styles.container} edges={['top']} testID={testID}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            {greeting ? <Text style={styles.greeting}>{greeting}</Text> : null}
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
        {children}
        <View style={{ height: 160 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  greeting: { fontSize: 13, color: colors.onSurfaceMuted, fontWeight: '600', letterSpacing: 0.5 },
  title: { fontSize: 26, fontWeight: '800', color: colors.onSurface, marginTop: 2 },
  subtitle: { marginTop: 4, fontSize: 14, color: colors.onSurfaceMuted },
});
