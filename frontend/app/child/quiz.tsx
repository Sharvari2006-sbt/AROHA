import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import ScreenShell from '@/src/components/ScreenShell';
import PressableCard from '@/src/components/PressableCard';
import { listAssignments, SupervisedAssignment } from '@/src/api/supervised';
import { colors, radius, spacing } from '@/src/theme';

export default function ChildQuiz() {
  const router = useRouter();
  const [items, setItems] = useState<SupervisedAssignment[]>([]);
  const [error, setError] = useState('');
  useFocusEffect(useCallback(() => {
    listAssignments().then((rows) => setItems(rows.filter((row) => row.quiz_required))).catch((e) => setError(e instanceof Error ? e.message : 'Could not load quizzes.'));
  }, []));
  return (
    <ScreenShell greeting="PLAY" title="Quiz time!" subtitle="Assigned quizzes are grounded in your study material and PYQs." testID="child-quiz">
      <View style={{ gap: spacing.sm }}>{items.map((item) => {
        const unlocked = item.study_completed && item.quiz_unlocked && item.quiz_status === 'ready';
        return <PressableCard key={item.id} style={styles.card} onPress={() => router.push((unlocked ? `/child/assessment/${item.id}` : `/child/assignment/${item.id}`) as any)}><View style={[styles.icon, { backgroundColor: unlocked ? colors.orange : colors.onSurfaceMuted }]}><Feather name={unlocked ? 'unlock' : 'lock'} size={17} color="#FFF" /></View><View style={{ flex: 1 }}><Text style={styles.title}>{item.title}</Text><Text style={styles.text}>{unlocked ? 'Ready · enter locked assessment mode' : item.quiz_status === 'pending_generation' ? 'Study first · grounded quiz is being prepared' : 'Complete the study phase to unlock'}</Text></View><Feather name="chevron-right" size={18} color={colors.onSurfaceMuted} /></PressableCard>;
      })}</View>
      {items.length === 0 ? <View style={styles.empty}><View style={styles.icon}><Feather name="help-circle" size={20} color="#FFF" /></View><Text style={styles.title}>No quizzes assigned</Text><Text style={styles.text}>A quiz appears only after a parent assigns real study material.</Text></View> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border }, empty: { padding: spacing.xl, alignItems: 'center', borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }, icon: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' }, title: { marginTop: 8, fontSize: 15, fontWeight: '800', color: colors.onSurface }, text: { marginTop: 3, fontSize: 12, lineHeight: 18, color: colors.onSurfaceMuted }, error: { color: '#8A3B18', fontSize: 12, fontWeight: '600' },
});
