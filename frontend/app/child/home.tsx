import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';

import ScreenShell from '@/src/components/ScreenShell';
import PressableCard from '@/src/components/PressableCard';
import BlobBackground from '@/src/components/BlobBackground';
import RobotMascot from '@/src/components/RobotMascot';
import { colors, radius, shadow, spacing } from '@/src/theme';

const QUIZZES = [
  { id: 1, title: 'Solar System', xp: 30, icon: 'sun' as const, accent: colors.yellow, blobA: colors.yellowSoft, blobB: colors.orangeSoft },
  { id: 2, title: 'Fractions Fun', xp: 25, icon: 'divide' as const, accent: colors.orange, blobA: colors.orangeSoft, blobB: colors.yellowSoft },
  { id: 3, title: 'Little Words', xp: 20, icon: 'feather' as const, accent: colors.brand, blobA: colors.brandSoft, blobB: colors.yellowSoft },
];

export default function ChildHome() {
  return (
    <ScreenShell
      greeting="Hi hero!"
      title="Let's play & learn"
      subtitle="You have 3 tiny tasks today."
      right={
        <View style={styles.avatar}><Text style={styles.avatarText}>M</Text></View>
      }
      testID="child-home"
    >
      <PressableCard style={styles.hero}>
        <View style={styles.heroBlob} pointerEvents="none">
          <BlobBackground colorA={colors.orangeSoft} colorB={colors.yellowSoft} width={220} height={200} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroEyebrow}>YOUR TWIN SAYS</Text>
          <Text style={styles.heroTitle}>You&apos;re on a{'\n'}5-day streak</Text>
          <Text style={styles.heroDesc}>Finish one quiz to unlock a sticker.</Text>
          <View style={styles.chipRow}>
            <View style={styles.chip}><Feather name="award" size={12} color={colors.onSurface} /><Text style={styles.chipText}>320 XP</Text></View>
            <View style={styles.chip}><Feather name="star" size={12} color={colors.onSurface} /><Text style={styles.chipText}>12 stars</Text></View>
          </View>
        </View>
        <View style={styles.heroMascot}><RobotMascot size={100} accent={colors.orange} /></View>
      </PressableCard>

      <Text style={styles.section}>My Quizzes</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingRight: spacing.lg }}>
        {QUIZZES.map((q) => (
          <PressableCard key={q.id} style={styles.quiz} testID={`quiz-${q.id}`}>
            <View style={styles.quizBlob} pointerEvents="none">
              <BlobBackground colorA={q.blobA} colorB={q.blobB} width={150} height={130} />
            </View>
            <View style={[styles.quizIcon, { backgroundColor: q.accent }]}>
              <Feather name={q.icon} size={20} color="#FFF" />
            </View>
            <Text style={styles.quizTitle}>{q.title}</Text>
            <View style={styles.quizMeta}>
              <Feather name="award" size={11} color={colors.onSurfaceMuted} />
              <Text style={styles.quizMetaText}>{q.xp} XP</Text>
            </View>
          </PressableCard>
        ))}
      </ScrollView>

      <Text style={styles.section}>Rewards</Text>
      <View style={styles.rewards}>
        {['crown', 'star', 'gift', 'heart'].map((r, i) => (
          <View key={i} style={styles.reward}>
            <View style={[styles.rewardCircle, { backgroundColor: [colors.yellowSoft, colors.orangeSoft, colors.brandSoft, colors.yellowSoft][i] }]}>
              <Feather name={r as any} size={18} color={colors.onSurface} />
            </View>
            <Text style={styles.rewardLabel}>{['Champion', 'Star', 'Gift', 'Kind'][i]}</Text>
          </View>
        ))}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 42, height: 42, borderRadius: 999,
    backgroundColor: colors.orange,
    alignItems: 'center', justifyContent: 'center',
    ...shadow.card,
  },
  avatarText: { color: '#FFF', fontWeight: '800' },
  hero: {
    flexDirection: 'row',
    padding: spacing.lg,
    minHeight: 180,
    borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  heroBlob: { position: 'absolute', top: -20, right: -20 },
  heroEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: colors.brandDeep },
  heroTitle: { marginTop: 6, fontSize: 22, fontWeight: '800', color: colors.onSurface, lineHeight: 28 },
  heroDesc: { marginTop: 6, fontSize: 13, color: colors.onSurfaceMuted, maxWidth: '75%' },
  chipRow: { flexDirection: 'row', gap: 8, marginTop: spacing.md },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill,
  },
  chipText: { fontSize: 11, fontWeight: '700', color: colors.onSurface },
  heroMascot: { position: 'absolute', right: 6, bottom: 4 },
  section: { fontSize: 17, fontWeight: '800', color: colors.onSurface, marginTop: spacing.md, marginBottom: spacing.md },
  quiz: {
    width: 170, padding: spacing.md, minHeight: 160,
    borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
  },
  quizBlob: { position: 'absolute', top: -10, right: -10 },
  quizIcon: {
    width: 40, height: 40, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  quizTitle: { fontSize: 15, fontWeight: '800', color: colors.onSurface },
  quizMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
  quizMetaText: { fontSize: 11, color: colors.onSurfaceMuted, fontWeight: '600' },
  rewards: { flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
  reward: { alignItems: 'center', flex: 1 },
  rewardCircle: {
    width: 60, height: 60, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  rewardLabel: { marginTop: 6, fontSize: 11, fontWeight: '700', color: colors.onSurface },
});
