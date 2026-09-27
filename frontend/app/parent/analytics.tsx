import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import ScreenShell from '@/src/components/ScreenShell';
import PressableCard from '@/src/components/PressableCard';
import { getSupervisedAnalytics, SupervisedAnalytics } from '@/src/api/supervised';
import { colors, radius, shadow, spacing } from '@/src/theme';

export default function ParentAnalytics() {
  const router = useRouter();
  const [data, setData] = useState<SupervisedAnalytics | null>(null);
  const [error, setError] = useState('');
  useFocusEffect(useCallback(() => { getSupervisedAnalytics().then(setData).catch((e) => setError(e instanceof Error ? e.message : 'Could not load insights.')); }, []));
  const stats = [
    { l: 'Planned / actual', v: `${data?.planned_minutes ?? 0}/${data?.actual_minutes ?? 0}m`, i: 'clock' as const, c: colors.brand },
    { l: 'Goal completion', v: `${Math.round((data?.completion_rate ?? 0) * 100)}%`, i: 'target' as const, c: colors.orange },
    { l: 'Quizzes', v: String(data?.quizzes_completed ?? 0), i: 'check-square' as const, c: colors.yellow },
  ];
  return (
    <ScreenShell greeting="INSIGHTS" title="Family Analytics" subtitle="Only real linked activity is shown." testID="parent-analytics">
      <PressableCard style={styles.card}><Text style={styles.title}>Digital Twin observation</Text><Text style={styles.empty}>{data?.observation ?? 'Loading verified family activity…'}</Text></PressableCard>
      <View style={styles.statsRow}>{stats.map((stat) => <View key={stat.l} style={styles.statCard}><View style={[styles.statIcon, { backgroundColor: stat.c }]}><Feather name={stat.i} size={14} color="#FFF" /></View><Text style={styles.statV}>{stat.v}</Text><Text style={styles.statL}>{stat.l}</Text></View>)}</View>
      <PressableCard style={[styles.card, { marginTop: spacing.md }]}><Text style={styles.title}>Weak topics</Text>{data?.weak_topics.length ? data.weak_topics.map((topic) => <View key={topic.concept} style={styles.topic}><Text style={styles.topicName}>{topic.concept}</Text><Text style={styles.topicScore}>{topic.mastery_percent}% mastery</Text></View>) : <Text style={styles.empty}>Weak topics appear only after grounded quizzes are completed.</Text>}</PressableCard>
      <Text style={styles.section}>Recent verified activity</Text>
      <View style={{ gap: spacing.sm }}>{data?.recent_activity?.map((item) => <PressableCard key={item.assignment_id} style={styles.activity} onPress={() => router.push(`/parent/student/${item.child_id}` as any)}><View style={styles.activityIcon}><Feather name={item.quiz_percent == null ? 'book-open' : 'check-square'} size={15} color="#FFF" /></View><View style={{ flex: 1 }}><Text style={styles.activityTitle}>{item.title}</Text><Text style={styles.empty}>{item.child_name} · {item.actual_minutes}/{item.planned_minutes} min{item.quiz_percent == null ? '' : ` · Quiz ${item.quiz_percent}%`}</Text></View><Feather name="chevron-right" size={18} color={colors.onSurfaceMuted} /></PressableCard>)}</View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.lg, borderWidth: 1, borderColor: colors.border }, title: { fontSize: 15, fontWeight: '800', color: colors.onSurface, marginBottom: spacing.md }, empty: { fontSize: 13, lineHeight: 19, color: colors.onSurfaceMuted }, statsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }, statCard: { flex: 1, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, ...shadow.card }, statIcon: { width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, statV: { fontSize: 15, fontWeight: '800', color: colors.onSurface, marginTop: spacing.sm }, statL: { fontSize: 11, color: colors.onSurfaceMuted, marginTop: 2, fontWeight: '600' }, topic: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }, topicName: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.onSurface }, topicScore: { fontSize: 12, color: colors.orange, fontWeight: '700' }, section: { marginTop: spacing.lg, marginBottom: spacing.md, fontSize: 17, fontWeight: '800', color: colors.onSurface }, activity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border }, activityIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }, activityTitle: { fontSize: 14, fontWeight: '800', color: colors.onSurface }, error: { marginTop: spacing.md, color: '#8A3B18', fontSize: 12, fontWeight: '600' },
});
