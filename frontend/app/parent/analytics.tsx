import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import ScreenShell from '@/src/components/ScreenShell';
import PressableCard from '@/src/components/PressableCard';
import { colors, radius, shadow, spacing } from '@/src/theme';

const CHILDREN = [
  { name: 'Mia', min: 240, focus: 92, color: colors.orange },
  { name: 'Leo', min: 180, focus: 78, color: colors.brand },
  { name: 'Ada', min: 300, focus: 95, color: colors.yellow },
];

export default function ParentAnalytics() {
  return (
    <ScreenShell greeting="INSIGHTS" title="Family Analytics" subtitle="Gentle progress across the week." testID="parent-analytics">
      <PressableCard style={styles.card}>
        <Text style={styles.title}>Weekly minutes per child</Text>
        {CHILDREN.map((c) => {
          const pct = Math.min(100, (c.min / 320) * 100);
          return (
            <View key={c.name} style={styles.row}>
              <Text style={styles.name}>{c.name}</Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${pct}%`, backgroundColor: c.color }]} />
              </View>
              <Text style={styles.val}>{c.min}m</Text>
            </View>
          );
        })}
      </PressableCard>

      <View style={styles.statsRow}>
        {[
          { l: 'Total minutes', v: '12h 20m', i: 'clock' as const, c: colors.brand },
          { l: 'Avg focus', v: '88%', i: 'target' as const, c: colors.orange },
          { l: 'Quizzes', v: '18', i: 'check-square' as const, c: colors.yellow },
        ].map((s) => (
          <View key={s.l} style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: s.c }]}>
              <Feather name={s.i} size={14} color="#FFF" />
            </View>
            <Text style={styles.statV}>{s.v}</Text>
            <Text style={styles.statL}>{s.l}</Text>
          </View>
        ))}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  title: { fontSize: 15, fontWeight: '800', color: colors.onSurface, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  name: { width: 40, fontSize: 13, fontWeight: '700', color: colors.onSurface },
  track: { flex: 1, height: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  val: { width: 50, textAlign: 'right', fontSize: 12, color: colors.onSurfaceMuted, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  statCard: {
    flex: 1, padding: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    ...shadow.card,
  },
  statIcon: { width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statV: { fontSize: 15, fontWeight: '800', color: colors.onSurface, marginTop: spacing.sm },
  statL: { fontSize: 11, color: colors.onSurfaceMuted, marginTop: 2, fontWeight: '600' },
});
