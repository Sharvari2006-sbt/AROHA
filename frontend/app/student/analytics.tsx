import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import ScreenShell from '@/src/components/ScreenShell';
import PressableCard from '@/src/components/PressableCard';
import { colors, radius, shadow, spacing } from '@/src/theme';

const WEEK = [
  { d: 'M', v: 0.6 }, { d: 'T', v: 0.8 }, { d: 'W', v: 0.5 },
  { d: 'T', v: 0.9 }, { d: 'F', v: 0.7 }, { d: 'S', v: 0.4 }, { d: 'S', v: 0.85 },
];

export default function Analytics() {
  return (
    <ScreenShell greeting="INSIGHTS" title="Your calm progress" subtitle="This week you learned 3h 40m across 4 subjects." testID="student-analytics">
      <PressableCard style={styles.chartCard}>
        <Text style={styles.chartTitle}>Study minutes</Text>
        <Text style={styles.chartMeta}>Past 7 days</Text>
        <View style={styles.bars}>
          {WEEK.map((w, i) => (
            <View key={i} style={styles.barCol}>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { height: `${w.v * 100}%` }]} />
              </View>
              <Text style={styles.barLabel}>{w.d}</Text>
            </View>
          ))}
        </View>
      </PressableCard>

      <View style={styles.statsRow}>
        {[
          { l: 'Streak', v: '7 days', i: 'zap' as const, c: colors.orange },
          { l: 'Focus', v: '92%', i: 'target' as const, c: colors.brand },
          { l: 'Twin XP', v: '1,240', i: 'award' as const, c: colors.yellow },
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

      <Text style={styles.section}>Weekly Highlights</Text>
      <View style={{ gap: spacing.sm }}>
        {[
          { t: 'Best focus day: Thursday', d: '54 min continuous study', i: 'sun' as const },
          { t: 'Mastered concept', d: 'Infinite Potential Well', i: 'check-circle' as const },
          { t: 'Twin suggestion', d: 'Try 20 min sessions on Sundays', i: 'compass' as const },
        ].map((h, i) => (
          <PressableCard key={i} style={styles.hlCard}>
            <View style={styles.hlIcon}><Feather name={h.i} size={14} color={colors.brandDeep} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.hlTitle}>{h.t}</Text>
              <Text style={styles.hlDesc}>{h.d}</Text>
            </View>
          </PressableCard>
        ))}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  chartCard: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartTitle: { fontSize: 15, fontWeight: '800', color: colors.onSurface },
  chartMeta: { fontSize: 11, color: colors.onSurfaceMuted, marginTop: 2, marginBottom: spacing.md },
  bars: { flexDirection: 'row', height: 140, alignItems: 'flex-end', gap: 8, marginTop: spacing.sm },
  barCol: { flex: 1, alignItems: 'center' },
  barTrack: { flex: 1, width: 16, backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', backgroundColor: colors.brand, borderRadius: radius.pill },
  barLabel: { marginTop: 6, fontSize: 11, color: colors.onSurfaceMuted, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  statCard: {
    flex: 1, padding: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    ...shadow.card,
  },
  statIcon: { width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statV: { fontSize: 16, fontWeight: '800', color: colors.onSurface, marginTop: spacing.sm },
  statL: { fontSize: 11, color: colors.onSurfaceMuted, marginTop: 2, fontWeight: '600' },
  section: { marginTop: spacing.lg, marginBottom: spacing.md, fontSize: 17, fontWeight: '800', color: colors.onSurface },
  hlCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  hlIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  hlTitle: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  hlDesc: { fontSize: 12, color: colors.onSurfaceMuted, marginTop: 2 },
});
