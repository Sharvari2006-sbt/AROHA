import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';

import ScreenShell from '@/src/components/ScreenShell';
import PressableCard from '@/src/components/PressableCard';
import BlobBackground from '@/src/components/BlobBackground';
import RobotMascot from '@/src/components/RobotMascot';
import { colors, radius, shadow, spacing } from '@/src/theme';

const FOCUS = [
  {
    id: 1,
    tag: 'PHYSICS',
    title: 'Infinite Potential Well',
    minutes: 25,
    accent: colors.orange,
    blobA: colors.orangeSoft,
    blobB: colors.yellowSoft,
    icon: 'box' as const,
  },
  {
    id: 2,
    tag: 'MATHS',
    title: 'Calculus of Curves',
    minutes: 30,
    accent: colors.brand,
    blobA: colors.brandSoft,
    blobB: colors.yellowSoft,
    icon: 'trending-up' as const,
  },
  {
    id: 3,
    tag: 'CHEMISTRY',
    title: 'Molecular Bonding',
    minutes: 20,
    accent: colors.yellow,
    blobA: colors.yellowSoft,
    blobB: colors.orangeSoft,
    icon: 'droplet' as const,
  },
];

const SESSIONS = [
  { id: 1, title: 'Quantum Tunneling review', time: '4:30 PM', minutes: 20, icon: 'zap' as const },
  { id: 2, title: 'Algebra practice set', time: '6:00 PM', minutes: 25, icon: 'edit-3' as const },
  { id: 3, title: 'Reading — Chapter 4', time: '8:15 PM', minutes: 15, icon: 'book-open' as const },
];

export default function StudentHome() {
  return (
    <ScreenShell
      greeting="Good morning"
      title="Ready to learn, Alex?"
      subtitle="Your twin has picked 3 gentle focus blocks."
      right={
        <View style={styles.avatar} testID="student-avatar">
          <Text style={styles.avatarText}>A</Text>
        </View>
      }
      testID="student-home"
    >
      {/* Hero card with mascot */}
      <PressableCard style={styles.hero}>
        <View style={styles.heroBlob} pointerEvents="none">
          <BlobBackground colorA={colors.brandSoft} colorB={colors.yellowSoft} width={220} height={200} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroEyebrow}>TODAY&apos;S TWIN INSIGHT</Text>
          <Text style={styles.heroTitle}>Small steps.{'\n'}Big flow.</Text>
          <Text style={styles.heroDesc}>You focus best between 4–6 PM. Let&apos;s try Physics first.</Text>
          <View style={styles.heroChipRow}>
            <View style={styles.heroChip}>
              <Feather name="clock" size={12} color={colors.onSurface} />
              <Text style={styles.heroChipText}>25 min</Text>
            </View>
            <View style={styles.heroChip}>
              <Feather name="flame" size={12} color={colors.onSurface} />
              <Text style={styles.heroChipText}>4-day streak</Text>
            </View>
          </View>
        </View>
        <View style={styles.heroMascot}>
          <RobotMascot size={96} />
        </View>
      </PressableCard>

      {/* Focus */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Today&apos;s Focus</Text>
        <Pressable hitSlop={8}><Text style={styles.sectionAction}>See all</Text></Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.focusScroll}
      >
        {FOCUS.map((f) => (
          <PressableCard key={f.id} style={styles.focusCard} testID={`focus-card-${f.id}`}>
            <View style={styles.focusBlob} pointerEvents="none">
              <BlobBackground colorA={f.blobA} colorB={f.blobB} width={150} height={130} variant="b" />
            </View>
            <View style={[styles.focusIcon, { backgroundColor: f.accent }]}>
              <Feather name={f.icon} size={18} color="#FFF" />
            </View>
            <Text style={styles.focusTag}>{f.tag}</Text>
            <Text style={styles.focusTitle} numberOfLines={2}>{f.title}</Text>
            <View style={styles.focusMeta}>
              <Feather name="clock" size={12} color={colors.onSurfaceMuted} />
              <Text style={styles.focusMetaText}>{f.minutes} min</Text>
            </View>
          </PressableCard>
        ))}
      </ScrollView>

      {/* Stats */}
      <View style={styles.statsRow}>
        {[
          { label: 'Chapters', value: '3', icon: 'book' as const },
          { label: 'Subtopics', value: '12', icon: 'star' as const },
          { label: 'Interactive', value: '100%', icon: 'zap' as const },
        ].map((s) => (
          <View key={s.label} style={styles.statCard}>
            <Feather name={s.icon} size={16} color={colors.brandDeep} />
            <Text style={styles.statValue}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Upcoming */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Upcoming Sessions</Text>
      </View>
      <View style={{ gap: spacing.sm }}>
        {SESSIONS.map((s) => (
          <PressableCard key={s.id} style={styles.sessionCard} testID={`session-${s.id}`}>
            <View style={styles.sessionIcon}>
              <Feather name={s.icon} size={16} color={colors.brandDeep} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sessionTitle}>{s.title}</Text>
              <Text style={styles.sessionMeta}>{s.time} • {s.minutes} min</Text>
            </View>
            <View style={styles.sessionCta}>
              <Feather name="arrow-right" size={16} color={colors.onSurface} />
            </View>
          </PressableCard>
        ))}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
    ...shadow.card,
  },
  avatarText: { color: '#FFF', fontWeight: '800' },

  hero: {
    flexDirection: 'row',
    padding: spacing.lg,
    minHeight: 180,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  heroBlob: { position: 'absolute', top: -20, right: -20 },
  heroEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: colors.brandDeep },
  heroTitle: { marginTop: 6, fontSize: 22, fontWeight: '800', color: colors.onSurface, lineHeight: 28 },
  heroDesc: { marginTop: 6, fontSize: 13, lineHeight: 18, color: colors.onSurfaceMuted, maxWidth: '70%' },
  heroChipRow: { flexDirection: 'row', gap: 8, marginTop: spacing.md },
  heroChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill,
  },
  heroChipText: { fontSize: 11, fontWeight: '700', color: colors.onSurface },
  heroMascot: { position: 'absolute', right: 4, bottom: 4 },

  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.onSurface },
  sectionAction: { fontSize: 13, color: colors.brandDeep, fontWeight: '700' },

  focusScroll: { gap: spacing.md, paddingRight: spacing.lg },
  focusCard: {
    width: 190,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    minHeight: 160,
  },
  focusBlob: { position: 'absolute', top: -10, right: -15 },
  focusIcon: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  focusTag: { fontSize: 10, letterSpacing: 1.2, fontWeight: '800', color: colors.onSurfaceMuted },
  focusTitle: { marginTop: 4, fontSize: 15, fontWeight: '800', color: colors.onSurface, lineHeight: 20 },
  focusMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
  focusMetaText: { fontSize: 12, color: colors.onSurfaceMuted, fontWeight: '600' },

  statsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  statCard: {
    flex: 1,
    padding: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'flex-start',
    gap: 2,
    ...shadow.card,
  },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.onSurface, marginTop: 4 },
  statLabel: { fontSize: 11, color: colors.onSurfaceMuted, fontWeight: '600' },

  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  sessionIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: colors.brandSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  sessionTitle: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  sessionMeta: { fontSize: 12, color: colors.onSurfaceMuted, marginTop: 2 },
  sessionCta: {
    width: 32, height: 32, borderRadius: 999,
    backgroundColor: colors.surfaceTertiary,
    alignItems: 'center', justifyContent: 'center',
  },
});
