import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import ScreenShell from '@/src/components/ScreenShell';
import PressableCard from '@/src/components/PressableCard';
import BlobBackground from '@/src/components/BlobBackground';
import { colors, shadow, spacing } from '@/src/theme';

const MODES = [
  { id: 1, title: 'Focus Timer', desc: 'Pomodoro-style calm sessions.', minutes: 25, icon: 'clock' as const, accent: colors.orange, blobA: colors.orangeSoft, blobB: colors.yellowSoft },
  { id: 2, title: 'Flashcards', desc: 'Space-repeat concepts effortlessly.', minutes: 15, icon: 'layers' as const, accent: colors.brand, blobA: colors.brandSoft, blobB: colors.yellowSoft },
  { id: 3, title: 'Twin Chat', desc: 'Ask your Digital Twin anything.', minutes: 10, icon: 'message-circle' as const, accent: colors.yellow, blobA: colors.yellowSoft, blobB: colors.brandSoft },
  { id: 4, title: 'Deep Reading', desc: 'Read with gentle prompts.', minutes: 30, icon: 'book-open' as const, accent: colors.brandDeep, blobA: colors.brandSoft, blobB: colors.orangeSoft },
];

export default function Study() {
  return (
    <ScreenShell greeting="STUDY" title="How would you like to learn today?" testID="student-study">
      <View style={styles.grid}>
        {MODES.map((m) => (
          <PressableCard key={m.id} style={styles.card} testID={`study-mode-${m.id}`}>
            <View style={styles.blob} pointerEvents="none">
              <BlobBackground colorA={m.blobA} colorB={m.blobB} width={140} height={120} variant="a" />
            </View>
            <View style={[styles.icon, { backgroundColor: m.accent }]}>
              <Feather name={m.icon} size={18} color="#FFF" />
            </View>
            <Text style={styles.title}>{m.title}</Text>
            <Text style={styles.desc} numberOfLines={2}>{m.desc}</Text>
            <View style={styles.meta}>
              <Feather name="clock" size={11} color={colors.onSurfaceMuted} />
              <Text style={styles.metaText}>{m.minutes} min</Text>
            </View>
          </PressableCard>
        ))}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: {
    width: '48%',
    minHeight: 180,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  blob: { position: 'absolute', top: -10, right: -20 },
  icon: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  title: { fontSize: 15, fontWeight: '800', color: colors.onSurface },
  desc: { marginTop: 4, fontSize: 12, lineHeight: 16, color: colors.onSurfaceMuted },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.md },
  metaText: { fontSize: 11, color: colors.onSurfaceMuted, fontWeight: '600' },
});
