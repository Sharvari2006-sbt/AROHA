import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import ScreenShell from '@/src/components/ScreenShell';
import PressableCard from '@/src/components/PressableCard';
import { listAssignments, SupervisedAssignment } from '@/src/api/supervised';
import { colors, radius, spacing } from '@/src/theme';

export default function Tasks() {
  const router = useRouter();
  const [tasks, setTasks] = useState<SupervisedAssignment[]>([]);
  const [error, setError] = useState('');
  useFocusEffect(useCallback(() => {
    listAssignments().then(setTasks).catch((e) => setError(e instanceof Error ? e.message : 'Could not load tasks.'));
  }, []));
  const doneCount = tasks.filter((task) => task.status === 'completed').length;

  return (
    <ScreenShell greeting="TODAY" title="Your tasks" subtitle={`${doneCount} of ${tasks.length} done · keep going!`} testID="child-tasks">
      <View style={{ gap: spacing.sm }}>
        {tasks.map((task) => {
          const done = task.status === 'completed';
          return (
            <PressableCard key={task.id} style={[styles.task, done && styles.done]} onPress={() => router.push(`/child/assignment/${task.id}` as any)} testID={`child-task-${task.id}`}>
              <View style={[styles.icon, done && styles.iconDone]}><Feather name={done ? 'check' : 'book-open'} size={17} color="#FFF" /></View>
              <View style={{ flex: 1 }}><Text style={styles.title}>{task.title}</Text><Text style={styles.meta}>{task.subject}{task.topic ? ` · ${task.topic}` : ''} · {task.planned_duration_minutes} min</Text>{task.parent_note ? <Text style={styles.note}>{task.parent_note}</Text> : null}</View>
              <Feather name="chevron-right" size={18} color={colors.onSurfaceMuted} />
            </PressableCard>
          );
        })}
        {tasks.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>No tasks assigned</Text><Text style={styles.meta}>Your parent’s approved assignments will appear here.</Text></View> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  task: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border }, done: { opacity: 0.68 }, icon: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' }, iconDone: { backgroundColor: colors.brand }, title: { fontSize: 15, fontWeight: '800', color: colors.onSurface }, meta: { marginTop: 2, fontSize: 12, color: colors.onSurfaceMuted, lineHeight: 17 }, note: { marginTop: 6, fontSize: 12, color: colors.onSurface, lineHeight: 17 }, empty: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }, emptyTitle: { fontSize: 15, fontWeight: '800', color: colors.onSurface, marginBottom: 3 }, error: { color: '#8A3B18', fontSize: 12, fontWeight: '600' },
});
