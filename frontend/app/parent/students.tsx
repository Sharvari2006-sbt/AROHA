import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import ScreenShell from '@/src/components/ScreenShell';
import PressableCard from '@/src/components/PressableCard';
import PrimaryButton from '@/src/components/PrimaryButton';
import { colors, radius, shadow, spacing } from '@/src/theme';

const CHILDREN = [
  { id: 1, name: 'Mia Sharma', age: 9, grade: 'Grade 4', progress: 72, color: colors.orange },
  { id: 2, name: 'Leo Sharma', age: 12, grade: 'Grade 7', progress: 48, color: colors.brand },
  { id: 3, name: 'Ada Sharma', age: 7, grade: 'Grade 2', progress: 88, color: colors.yellow },
];

export default function Students() {
  return (
    <ScreenShell greeting="FAMILY" title="Students" subtitle="Everyone linked to your account." testID="parent-students">
      <PressableCard style={styles.inviteCard} testID="invite-card">
        <View style={styles.inviteIcon}><Feather name="key" size={16} color="#FFF" /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.inviteTitle}>Invite Code</Text>
          <Text style={styles.inviteCode}>TWIN-4821</Text>
        </View>
        <PrimaryButton label="Share" style={{ height: 40, paddingHorizontal: 18 }} />
      </PressableCard>

      <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
        {CHILDREN.map((c) => (
          <PressableCard key={c.id} style={styles.card} testID={`student-${c.id}`}>
            <View style={[styles.avatar, { backgroundColor: c.color }]}>
              <Text style={styles.avatarText}>{c.name.charAt(0)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{c.name}</Text>
              <Text style={styles.meta}>{c.grade} · Age {c.age}</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${c.progress}%`, backgroundColor: c.color }]} />
              </View>
            </View>
            <Feather name="chevron-right" size={18} color={colors.onSurfaceMuted} />
          </PressableCard>
        ))}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  inviteCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.brandSoft,
    ...shadow.card,
  },
  inviteIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: colors.brand,
    alignItems: 'center', justifyContent: 'center',
  },
  inviteTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: colors.brandDeep },
  inviteCode: { marginTop: 2, fontSize: 18, fontWeight: '800', color: colors.onSurface, letterSpacing: 2 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#FFF', fontWeight: '800', fontSize: 18 },
  name: { fontSize: 15, fontWeight: '800', color: colors.onSurface },
  meta: { fontSize: 12, color: colors.onSurfaceMuted, marginTop: 2 },
  progressTrack: {
    height: 6, borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    marginTop: spacing.sm, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: radius.pill },
});
