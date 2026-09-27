import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import PrimaryButton from '@/src/components/PrimaryButton';
import RobotMascot from '@/src/components/RobotMascot';
import { colors, radius, shadow, spacing } from '@/src/theme';

export default function BlockedAppScreen() {
  const router = useRouter();
  const { app } = useLocalSearchParams<{ app?: string }>();
  const appName = typeof app === 'string' && app ? app : 'That app';
  return <View style={styles.screen}>
    <RobotMascot size={120} />
    <View style={styles.card}>
      <View style={styles.icon}><Feather name="shield" size={22} color="#FFF" /></View>
      <Text style={styles.title}>{appName} is paused</Text>
      <Text style={styles.body}>Reo is keeping your focus session protected. You can use this app again when study time ends.</Text>
      <PrimaryButton label="Return to study" onPress={() => router.back()} style={{ marginTop: spacing.lg }} />
    </View>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.surface },
  card: { width: '100%', alignItems: 'center', padding: spacing.xl, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, ...shadow.card },
  icon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand },
  title: { marginTop: spacing.md, fontSize: 22, fontWeight: '800', color: colors.onSurface, textAlign: 'center' },
  body: { marginTop: spacing.sm, fontSize: 13, lineHeight: 20, color: colors.onSurfaceMuted, textAlign: 'center' },
});
