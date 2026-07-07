import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import ScreenShell from '@/src/components/ScreenShell';
import PressableCard from '@/src/components/PressableCard';
import PrimaryButton from '@/src/components/PrimaryButton';
import BlobBackground from '@/src/components/BlobBackground';
import RobotMascot from '@/src/components/RobotMascot';
import { colors, radius, shadow, spacing } from '@/src/theme';

type Props = {
  role: 'student' | 'parent' | 'child';
  name: string;
  email: string;
  stats: { label: string; value: string }[];
  testID?: string;
};

const MENU: { label: string; icon: keyof typeof import('@expo/vector-icons').Feather.glyphMap }[] = [
  { label: 'Preferences', icon: 'sliders' },
  { label: 'Notifications', icon: 'bell' },
  { label: 'Privacy & Data', icon: 'shield' },
  { label: 'Help Center', icon: 'help-circle' },
  { label: 'About Aroha', icon: 'info' },
];

export default function ProfileScreen({ role, name, email, stats, testID }: Props) {
  const router = useRouter();
  const initial = name.charAt(0).toUpperCase();
  return (
    <ScreenShell greeting="ACCOUNT" title="Profile" subtitle="Settings, preferences and your twin." testID={testID}>
      <PressableCard style={styles.hero}>
        <View style={styles.blob} pointerEvents="none">
          <BlobBackground colorA={colors.brandSoft} colorB={colors.yellowSoft} width={200} height={180} />
        </View>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initial}</Text></View>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.email}>{email}</Text>
        <View style={styles.roleChip}>
          <Feather name="user" size={12} color={colors.onSurface} />
          <Text style={styles.roleChipText}>{role.toUpperCase()}</Text>
        </View>
        <View style={styles.mascot}><RobotMascot size={70} /></View>
      </PressableCard>

      <View style={styles.statsRow}>
        {stats.map((s) => (
          <View key={s.label} style={styles.statCard}>
            <Text style={styles.statValue}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.section}>Settings</Text>
      <View style={{ gap: spacing.sm }}>
        {MENU.map((m) => (
          <PressableCard key={m.label} style={styles.menuItem} testID={`menu-${m.label.toLowerCase().replace(/\s+/g,'-')}`}>
            <View style={styles.menuIcon}><Feather name={m.icon} size={16} color={colors.onSurface} /></View>
            <Text style={styles.menuLabel}>{m.label}</Text>
            <Feather name="chevron-right" size={18} color={colors.onSurfaceMuted} />
          </PressableCard>
        ))}
      </View>

      <PrimaryButton
        label="Log out"
        variant="secondary"
        style={{ marginTop: spacing.lg }}
        onPress={() => router.replace('/welcome')}
        testID="logout-btn"
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  hero: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    alignItems: 'flex-start',
  },
  blob: { position: 'absolute', top: -30, right: -30 },
  avatar: {
    width: 64, height: 64, borderRadius: 999,
    backgroundColor: colors.brand,
    alignItems: 'center', justifyContent: 'center',
    ...shadow.card,
  },
  avatarText: { color: '#FFF', fontSize: 24, fontWeight: '800' },
  name: { marginTop: spacing.md, fontSize: 20, fontWeight: '800', color: colors.onSurface },
  email: { marginTop: 2, fontSize: 13, color: colors.onSurfaceMuted },
  roleChip: {
    marginTop: spacing.sm,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radius.pill,
  },
  roleChipText: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: colors.onSurface },
  mascot: { position: 'absolute', right: 8, bottom: 8 },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  statCard: {
    flex: 1, padding: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center',
  },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.onSurface },
  statLabel: { fontSize: 11, color: colors.onSurfaceMuted, marginTop: 4, fontWeight: '600' },
  section: { marginTop: spacing.lg, marginBottom: spacing.md, fontSize: 17, fontWeight: '800', color: colors.onSurface },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  menuIcon: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: colors.brandSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  menuLabel: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.onSurface },
});
