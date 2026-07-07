import React, { useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import PressableCard from '@/src/components/PressableCard';
import BlobBackground from '@/src/components/BlobBackground';
import { colors, radius, spacing } from '@/src/theme';

type ModeCard = {
  id: 'independent' | 'supervised';
  title: string;
  desc: string;
  icon: keyof typeof Feather.glyphMap;
  iconBg: string;
  blobA: string;
  blobB: string;
  testID: string;
};

const CARDS: ModeCard[] = [
  {
    id: 'independent',
    title: 'Independent Learning',
    desc: 'Build discipline using your personal Digital Twin.',
    icon: 'compass',
    iconBg: colors.orange,
    blobA: colors.orangeSoft,
    blobB: colors.yellowSoft,
    testID: 'welcome-independent-card',
  },
  {
    id: 'supervised',
    title: 'Supervised Learning',
    desc: 'Learn with guidance from your parent.',
    icon: 'users',
    iconBg: colors.brand,
    blobA: colors.brandSoft,
    blobB: colors.yellowSoft,
    testID: 'welcome-supervised-card',
  },
];

function AnimatedCard({ card, index, onPress }: { card: ModeCard; index: number; onPress: () => void }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    opacity.value = withDelay(200 + index * 150, withTiming(1, { duration: 500 }));
    translateY.value = withDelay(200 + index * 150, withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }));
  }, [index, opacity, translateY]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={style}>
      <PressableCard testID={card.testID} onPress={onPress} style={styles.card}>
        <View style={styles.blob} pointerEvents="none">
          <BlobBackground colorA={card.blobA} colorB={card.blobB} width={180} height={160} />
        </View>
        <View style={[styles.iconTile, { backgroundColor: card.iconBg }]}>
          <Feather name={card.icon} size={22} color="#FFF" />
        </View>
        <Text style={styles.cardTitle}>{card.title}</Text>
        <Text style={styles.cardDesc}>{card.desc}</Text>
        <View style={styles.cta}>
          <Text style={styles.ctaText}>Get started</Text>
          <Feather name="arrow-right" size={16} color={colors.onSurface} />
        </View>
      </PressableCard>
    </Animated.View>
  );
}

export default function Welcome() {
  const router = useRouter();

  const headerOpacity = useSharedValue(0);
  useEffect(() => {
    headerOpacity.value = withTiming(1, { duration: 600 });
  }, [headerOpacity]);
  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [{ translateY: (1 - headerOpacity.value) * 10 }],
  }));

  const handlePress = (id: ModeCard['id']) => {
    if (id === 'independent') router.push('/auth/student-login');
    else router.push('/auth/role');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={headerStyle}>
          <View style={styles.brandRow}>
            <View style={styles.brandBadge}>
              <Text style={styles.brandBadgeText}>A</Text>
            </View>
            <Text style={styles.brandName}>Aroha</Text>
          </View>
          <Text style={styles.eyebrow}>WELCOME</Text>
          <Text style={styles.heading}>Your AI Digital Twin{'\n'}that grows with you.</Text>
          <Text style={styles.subheading}>
            Pick how you&apos;d like to learn. You can always switch later.
          </Text>
        </Animated.View>

        <View style={styles.cards}>
          {CARDS.map((c, i) => (
            <AnimatedCard key={c.id} card={c} index={i} onPress={() => handlePress(c.id)} />
          ))}
        </View>

        <Text style={styles.footer}>Calm • Focused • Playful</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing.sm },
  brandBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandBadgeText: { color: '#FFF', fontWeight: '800' },
  brandName: { fontSize: 16, fontWeight: '700', color: colors.onSurface },
  eyebrow: {
    marginTop: spacing.xl,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    color: colors.brandDeep,
  },
  heading: {
    marginTop: spacing.sm,
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '800',
    color: colors.onSurface,
  },
  subheading: {
    marginTop: spacing.sm,
    fontSize: 15,
    lineHeight: 22,
    color: colors.onSurfaceMuted,
  },
  cards: { marginTop: spacing.xl, gap: spacing.md },
  card: {
    padding: spacing.lg,
    minHeight: 180,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: colors.border,
  },
  blob: { position: 'absolute', top: -20, right: -30, opacity: 0.9 },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  cardTitle: { fontSize: 20, fontWeight: '800', color: colors.onSurface },
  cardDesc: {
    marginTop: spacing.xs + 2,
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
  footer: {
    marginTop: spacing.xl,
    textAlign: 'center',
    color: colors.onSurfaceMuted,
    fontSize: 12,
    letterSpacing: 1.5,
  },
});
