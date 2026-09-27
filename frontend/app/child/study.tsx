import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import ScreenShell from '@/src/components/ScreenShell';
import PressableCard from '@/src/components/PressableCard';
import BlobBackground from '@/src/components/BlobBackground';
import { colors, shadow, spacing } from '@/src/theme';

const MODES = [
  { id: 1, mode: 'focus', title: 'Focus Timer', desc: 'Set the exact focus time you need.', icon: 'clock' as const, accent: colors.orange, blobA: colors.orangeSoft, blobB: colors.yellowSoft },
  { id: 2, mode: 'chat', title: 'Chat with Reo', desc: 'Ask Reo about your study, quizzes or a doubt.', icon: 'message-circle' as const, accent: colors.yellow, blobA: colors.yellowSoft, blobB: colors.brandSoft },
  { id: 3, mode: 'sudoku', title: 'Sudoku', desc: 'Train focus at three difficulty levels.', icon: 'grid' as const, accent: colors.brand, blobA: colors.brandSoft, blobB: colors.orangeSoft },
  { id: 4, mode: 'notes', title: 'Revision Notes', desc: 'Open PDFs made from your saved highlights.', icon: 'file-text' as const, accent: colors.orange, blobA: colors.brandSoft, blobB: colors.yellowSoft },
];

export default function ChildStudy() {
  const router = useRouter();
  return (
    <ScreenShell greeting="STUDY" title="How would you like to focus today?" subtitle="Choose a useful study tool." testID="child-study">
      <View style={styles.grid}>
        {MODES.map((m) => (
          <PressableCard key={m.id} style={styles.card} testID={`child-mode-${m.id}`} onPress={() => router.push((m.mode === 'notes' ? '/child/revision' : `/child/learn/${m.mode}`) as any)}>
            <View style={styles.blob} pointerEvents="none">
              <BlobBackground colorA={m.blobA} colorB={m.blobB} width={140} height={120} />
            </View>
            <View style={[styles.icon, { backgroundColor: m.accent }]}>
              <Feather name={m.icon} size={18} color="#FFF" />
            </View>
            <Text style={styles.title}>{m.title}</Text>
            <Text style={styles.desc}>{m.desc}</Text>
          </PressableCard>
        ))}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  grid: { gap: spacing.md },
  card: {
    width: '100%',
    minHeight: 138,
    padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
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
});
