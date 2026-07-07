import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import ScreenShell from '@/src/components/ScreenShell';
import PressableCard from '@/src/components/PressableCard';
import BlobBackground from '@/src/components/BlobBackground';
import { colors, radius, spacing } from '@/src/theme';

const QUIZZES = [
  { id: 1, title: 'Solar System', qs: 8, mins: 6, difficulty: 'Easy', icon: 'sun' as const, accent: colors.yellow, blobA: colors.yellowSoft, blobB: colors.orangeSoft },
  { id: 2, title: 'Fractions Fun', qs: 10, mins: 8, difficulty: 'Medium', icon: 'divide' as const, accent: colors.orange, blobA: colors.orangeSoft, blobB: colors.yellowSoft },
  { id: 3, title: 'Little Words', qs: 12, mins: 7, difficulty: 'Easy', icon: 'feather' as const, accent: colors.brand, blobA: colors.brandSoft, blobB: colors.yellowSoft },
  { id: 4, title: 'Body & Bones', qs: 6, mins: 5, difficulty: 'Easy', icon: 'activity' as const, accent: colors.brandDeep, blobA: colors.brandSoft, blobB: colors.orangeSoft },
];

export default function ChildQuiz() {
  return (
    <ScreenShell greeting="PLAY" title="Quiz time!" subtitle="Answer, learn, earn stars." testID="child-quiz">
      <View style={{ gap: spacing.md }}>
        {QUIZZES.map((q) => (
          <PressableCard key={q.id} style={styles.card} testID={`quiz-card-${q.id}`}>
            <View style={styles.blob} pointerEvents="none">
              <BlobBackground colorA={q.blobA} colorB={q.blobB} width={160} height={140} variant="c" />
            </View>
            <View style={[styles.icon, { backgroundColor: q.accent }]}>
              <Feather name={q.icon} size={20} color="#FFF" />
            </View>
            <Text style={styles.title}>{q.title}</Text>
            <View style={styles.metaRow}>
              <View style={styles.meta}><Feather name="help-circle" size={11} color={colors.onSurface} /><Text style={styles.metaText}>{q.qs} questions</Text></View>
              <View style={styles.meta}><Feather name="clock" size={11} color={colors.onSurface} /><Text style={styles.metaText}>{q.mins} min</Text></View>
              <View style={styles.meta}><Feather name="star" size={11} color={colors.onSurface} /><Text style={styles.metaText}>{q.difficulty}</Text></View>
            </View>
          </PressableCard>
        ))}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  blob: { position: 'absolute', top: -10, right: -20 },
  icon: {
    width: 42, height: 42, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: { fontSize: 17, fontWeight: '800', color: colors.onSurface },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.md },
  meta: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radius.pill,
  },
  metaText: { fontSize: 11, fontWeight: '700', color: colors.onSurface },
});
