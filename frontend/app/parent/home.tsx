import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';

import ScreenShell from '@/src/components/ScreenShell';
import PressableCard from '@/src/components/PressableCard';
import BlobBackground from '@/src/components/BlobBackground';
import { colors, radius, shadow, spacing } from '@/src/theme';

const CHILDREN = [
  { id: 1, name: 'Mia', age: 9, progress: 72, streak: 5, color: colors.orange },
  { id: 2, name: 'Leo', age: 12, progress: 48, streak: 3, color: colors.brand },
  { id: 3, name: 'Ada', age: 7, progress: 88, streak: 9, color: colors.yellow },
];

const ACTIVITY = [
  { id: 1, name: 'Mia', text: 'completed Quiz: Fractions', time: '10m ago', icon: 'check-circle' as const, c: colors.brand },
  { id: 2, name: 'Leo', text: 'started chapter: Cell Biology', time: '1h ago', icon: 'book-open' as const, c: colors.orange },
  { id: 3, name: 'Ada', text: 'earned 30 XP · storytelling', time: '3h ago', icon: 'award' as const, c: colors.yellow },
];

export default function ParentHome() {
  return (
    <ScreenShell
      greeting="Good afternoon"
      title="Hello, Priya"
      subtitle="Everyone's doing gently well today."
      right={<View style={styles.avatar}><Text style={styles.avatarText}>P</Text></View>}
      testID="parent-home"
    >
      <PressableCard style={styles.hero}>
        <View style={styles.heroBlob} pointerEvents="none">
          <BlobBackground colorA={colors.brandSoft} colorB={colors.yellowSoft} width={200} height={180} />
        </View>
        <Text style={styles.heroEyebrow}>FAMILY OVERVIEW</Text>
        <Text style={styles.heroTitle}>3 learners{'\n'}steady progress</Text>
        <Text style={styles.heroDesc}>Weekly average: 42 min/day · 96% focus</Text>
      </PressableCard>

      <View style={styles.sectionRow}>
        <Text style={styles.section}>Your Children</Text>
        <Text style={styles.sectionAction}>Manage</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingRight: spacing.lg }}>
        {CHILDREN.map((c) => (
          <PressableCard key={c.id} style={styles.childCard} testID={`child-${c.id}`}>
            <View style={[styles.childAvatar, { backgroundColor: c.color }]}>
              <Text style={styles.childAvatarText}>{c.name.charAt(0)}</Text>
            </View>
            <Text style={styles.childName}>{c.name}</Text>
            <Text style={styles.childMeta}>Age {c.age}</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${c.progress}%`, backgroundColor: c.color }]} />
            </View>
            <View style={styles.childRow}>
              <Feather name="zap" size={11} color={colors.orange} />
              <Text style={styles.childMeta}>{c.streak} day streak</Text>
            </View>
          </PressableCard>
        ))}
      </ScrollView>

      <Text style={styles.section}>Recent Activity</Text>
      <View style={{ gap: spacing.sm }}>
        {ACTIVITY.map((a) => (
          <PressableCard key={a.id} style={styles.activity} testID={`activity-${a.id}`}>
            <View style={[styles.actIcon, { backgroundColor: a.c }]}>
              <Feather name={a.icon} size={14} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actTitle}><Text style={{ fontWeight: '800' }}>{a.name}</Text> {a.text}</Text>
              <Text style={styles.actTime}>{a.time}</Text>
            </View>
          </PressableCard>
        ))}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 42, height: 42, borderRadius: 999,
    backgroundColor: colors.brand,
    alignItems: 'center', justifyContent: 'center',
    ...shadow.card,
  },
  avatarText: { color: '#FFF', fontWeight: '800' },
  hero: {
    padding: spacing.lg,
    minHeight: 150,
    borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  heroBlob: { position: 'absolute', top: -20, right: -20 },
  heroEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: colors.brandDeep },
  heroTitle: { marginTop: 6, fontSize: 22, fontWeight: '800', color: colors.onSurface, lineHeight: 28 },
  heroDesc: { marginTop: 6, fontSize: 13, color: colors.onSurfaceMuted },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md, marginTop: spacing.md },
  section: { fontSize: 17, fontWeight: '800', color: colors.onSurface, marginBottom: spacing.md, marginTop: spacing.md },
  sectionAction: { color: colors.brandDeep, fontWeight: '700', fontSize: 13 },
  childCard: {
    width: 160,
    padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  childAvatar: {
    width: 48, height: 48, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  childAvatarText: { color: '#FFF', fontWeight: '800', fontSize: 18 },
  childName: { fontSize: 15, fontWeight: '800', color: colors.onSurface },
  childMeta: { fontSize: 11, color: colors.onSurfaceMuted, fontWeight: '600' },
  progressTrack: { height: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, marginVertical: spacing.sm, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.pill },
  childRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  activity: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  actIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actTitle: { fontSize: 13, color: colors.onSurface, lineHeight: 18 },
  actTime: { fontSize: 11, color: colors.onSurfaceMuted, marginTop: 2 },
});
