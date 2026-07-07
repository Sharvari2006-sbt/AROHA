import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import ScreenShell from '@/src/components/ScreenShell';
import PressableCard from '@/src/components/PressableCard';
import BlobBackground from '@/src/components/BlobBackground';
import { colors, radius, shadow, spacing } from '@/src/theme';

const SUBJECTS = [
  { id: 1, name: 'Quantum Physics', chapters: 12, progress: 45, icon: 'zap' as const, accent: colors.orange, blobA: colors.orangeSoft, blobB: colors.yellowSoft },
  { id: 2, name: 'Calculus', chapters: 9, progress: 60, icon: 'trending-up' as const, accent: colors.brand, blobA: colors.brandSoft, blobB: colors.yellowSoft },
  { id: 3, name: 'Organic Chemistry', chapters: 8, progress: 20, icon: 'droplet' as const, accent: colors.yellow, blobA: colors.yellowSoft, blobB: colors.orangeSoft },
  { id: 4, name: 'World History', chapters: 15, progress: 12, icon: 'globe' as const, accent: colors.brandDeep, blobA: colors.brandSoft, blobB: colors.orangeSoft },
];

export default function Subjects() {
  return (
    <ScreenShell greeting="LIBRARY" title="Your Subjects" subtitle="Pick a subject to keep learning." testID="student-subjects">
      <View style={{ gap: spacing.md }}>
        {SUBJECTS.map((s) => (
          <PressableCard key={s.id} style={styles.card} testID={`subject-${s.id}`}>
            <View style={styles.blob} pointerEvents="none">
              <BlobBackground colorA={s.blobA} colorB={s.blobB} width={160} height={140} variant="c" />
            </View>
            <View style={[styles.icon, { backgroundColor: s.accent }]}>
              <Feather name={s.icon} size={20} color="#FFF" />
            </View>
            <Text style={styles.title}>{s.name}</Text>
            <Text style={styles.meta}>{s.chapters} chapters</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${s.progress}%`, backgroundColor: s.accent }]} />
            </View>
            <Text style={styles.progressText}>{s.progress}% complete</Text>
          </PressableCard>
        ))}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  blob: { position: 'absolute', top: -10, right: -20 },
  icon: {
    width: 42, height: 42, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  title: { fontSize: 18, fontWeight: '800', color: colors.onSurface },
  meta: { fontSize: 12, color: colors.onSurfaceMuted, marginTop: 2 },
  progressTrack: {
    height: 8, borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: radius.pill },
  progressText: { fontSize: 11, color: colors.onSurfaceMuted, marginTop: 6, fontWeight: '600' },
});
