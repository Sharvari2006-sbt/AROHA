import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import AuthLayout from '@/src/components/AuthLayout';
import PressableCard from '@/src/components/PressableCard';
import BlobBackground from '@/src/components/BlobBackground';
import { colors, radius, spacing } from '@/src/theme';

const ROLES = [
  {
    id: 'parent' as const,
    title: 'Parent',
    desc: 'Guide your child, track progress and set gentle goals.',
    icon: 'user-check' as const,
    accent: colors.brand,
    blobA: colors.brandSoft,
    blobB: colors.yellowSoft,
    route: '/auth/parent-login',
  },
  {
    id: 'child' as const,
    title: 'Child',
    desc: 'Enter your parent invite code and start playful learning.',
    icon: 'smile' as const,
    accent: colors.orange,
    blobA: colors.orangeSoft,
    blobB: colors.yellowSoft,
    route: '/auth/child-login',
  },
];

export default function RoleSelector() {
  const router = useRouter();
  return (
    <AuthLayout eyebrow="SUPERVISED LEARNING" title="Who are you?" subtitle="Choose your role to continue.">
      <View style={styles.cards}>
        {ROLES.map((r) => (
          <PressableCard
            key={r.id}
            testID={`role-${r.id}-card`}
            onPress={() => router.push(r.route as any)}
            style={styles.card}
          >
            <View style={styles.blob} pointerEvents="none">
              <BlobBackground colorA={r.blobA} colorB={r.blobB} width={170} height={150} />
            </View>
            <View style={[styles.iconTile, { backgroundColor: r.accent }]}>
              <Feather name={r.icon} size={22} color="#FFF" />
            </View>
            <Text style={styles.title}>{r.title}</Text>
            <Text style={styles.desc}>{r.desc}</Text>
            <View style={styles.cta}>
              <Text style={styles.ctaText}>Continue</Text>
              <Feather name="arrow-right" size={16} color={colors.onSurface} />
            </View>
          </PressableCard>
        ))}
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  cards: { gap: spacing.md },
  card: {
    padding: spacing.lg,
    minHeight: 180,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  blob: { position: 'absolute', top: -20, right: -30 },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.onSurface },
  desc: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: colors.onSurfaceMuted,
    maxWidth: '80%',
  },
  cta: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceTertiary,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  ctaText: { fontSize: 13, fontWeight: '700', color: colors.onSurface },
});
