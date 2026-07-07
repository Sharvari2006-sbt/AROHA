import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';

import ScreenShell from '@/src/components/ScreenShell';
import PressableCard from '@/src/components/PressableCard';
import { colors, radius, spacing } from '@/src/theme';

const INITIAL = [
  { id: 1, title: 'Read a short story', xp: 10, done: true, icon: 'book-open' as const, c: colors.brand },
  { id: 2, title: 'Practice 5 math questions', xp: 15, done: false, icon: 'edit-3' as const, c: colors.orange },
  { id: 3, title: 'Watch: The Sun', xp: 8, done: false, icon: 'sun' as const, c: colors.yellow },
  { id: 4, title: 'Drawing time (10 min)', xp: 12, done: false, icon: 'feather' as const, c: colors.brandDeep },
];

export default function Tasks() {
  const [tasks, setTasks] = useState(INITIAL);
  const toggle = (id: number) => setTasks((t) => t.map((x) => (x.id === id ? { ...x, done: !x.done } : x)));
  const doneCount = tasks.filter((t) => t.done).length;
  const pct = Math.round((doneCount / tasks.length) * 100);

  return (
    <ScreenShell greeting="TODAY" title="Your tasks" subtitle={`${doneCount} of ${tasks.length} done · keep going!`} testID="child-tasks">
      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>Today&apos;s progress</Text>
          <Text style={styles.progressPct}>{pct}%</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%` }]} />
        </View>
      </View>

      <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
        {tasks.map((t) => (
          <PressableCard key={t.id} style={styles.task} onPress={() => toggle(t.id)} testID={`task-${t.id}`}>
            <Pressable onPress={() => toggle(t.id)} style={[styles.check, t.done && styles.checkDone]} hitSlop={6}>
              {t.done ? <Feather name="check" size={14} color="#FFF" /> : null}
            </Pressable>
            <View style={[styles.tIcon, { backgroundColor: t.c }]}>
              <Feather name={t.icon} size={14} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.tTitle, t.done && styles.tDone]}>{t.title}</Text>
              <Text style={styles.tMeta}>+{t.xp} XP</Text>
            </View>
          </PressableCard>
        ))}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  progressCard: {
    padding: spacing.lg,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressTitle: { fontSize: 15, fontWeight: '800', color: colors.onSurface },
  progressPct: { fontSize: 18, fontWeight: '800', color: colors.brandDeep },
  track: { height: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, marginTop: spacing.md, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.brand, borderRadius: radius.pill },
  task: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  check: {
    width: 26, height: 26, borderRadius: 8,
    borderWidth: 2, borderColor: colors.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  checkDone: { backgroundColor: colors.brand, borderColor: colors.brand },
  tIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tTitle: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  tDone: { textDecorationLine: 'line-through', color: colors.onSurfaceMuted },
  tMeta: { fontSize: 11, color: colors.onSurfaceMuted, marginTop: 2, fontWeight: '600' },
});
