import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import ScreenShell from '@/src/components/ScreenShell';
import PressableCard from '@/src/components/PressableCard';
import BlobBackground from '@/src/components/BlobBackground';
import { colors, shadow, spacing } from '@/src/theme';

const MODES = [
  { id: 1, title: 'Story Time', desc: 'Read gentle stories aloud.', icon: 'book-open' as const, accent: colors.orange, blobA: colors.orangeSoft, blobB: colors.yellowSoft },
  { id: 2, title: 'Number Play', desc: 'Learn math with games.', icon: 'hash' as const, accent: colors.brand, blobA: colors.brandSoft, blobB: colors.yellowSoft },
  { id: 3, title: 'Word Garden', desc: 'Grow your vocabulary.', icon: 'feather' as const, accent: colors.yellow, blobA: colors.yellowSoft, blobB: colors.brandSoft },
  { id: 4, title: 'Curious You', desc: 'Ask your twin anything.', icon: 'message-circle' as const, accent: colors.brandDeep, blobA: colors.brandSoft, blobB: colors.orangeSoft },
];

export default function ChildStudy() {
  return (
    <ScreenShell greeting="LEARN" title="What sounds fun?" subtitle="Pick a playful learning mode." testID="child-study">
      <View style={styles.grid}>
        {MODES.map((m) => (
          <PressableCard key={m.id} style={styles.card} testID={`child-mode-${m.id}`}>
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: {
    width: '48%',
    minHeight: 160,
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
