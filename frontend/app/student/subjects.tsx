import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import ScreenShell from '@/src/components/ScreenShell';
import PressableCard from '@/src/components/PressableCard';
import BlobBackground from '@/src/components/BlobBackground';
import AddSubjectSheet from '@/src/components/AddSubjectSheet';
import { colors, radius, shadow, spacing } from '@/src/theme';
import { Subject, getUserId, listSubjects } from '@/src/api/twin';

export default function Subjects() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    const uid = await getUserId();
    setUserId(uid);
    setSubjects(await listSubjects(uid));
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <ScreenShell
      greeting="LIBRARY"
      title="Your Subjects"
      subtitle="Each subject has its own Twin profile."
      right={
        <Pressable onPress={() => setShowAdd(true)} style={styles.addBtn} hitSlop={8} testID="subjects-add">
          <Feather name="plus" size={18} color="#FFF" />
        </Pressable>
      }
      testID="student-subjects"
    >
      {subjects.length === 0 ? (
        <PressableCard style={styles.empty} testID="subjects-empty" onPress={() => setShowAdd(true)}>
          <View style={styles.emptyIcon}><Feather name="book-open" size={18} color="#FFF" /></View>
          <Text style={styles.emptyTitle}>No subjects yet</Text>
          <Text style={styles.emptyDesc}>Add a subject and start your first session — the Twin will begin learning your rhythm.</Text>
        </PressableCard>
      ) : (
        <View style={{ gap: spacing.md }}>
          {subjects.map((s) => {
            const p = s.profile;
            const done = Math.round(((p?.goal_completion_rate ?? 0)) * 100);
            const sessions = p?.sessions_count ?? 0;
            return (
              <PressableCard key={s.id} style={styles.card} testID={`subject-${s.id}`} onPress={() => router.push(`/subject/${s.id}` as any)}>
                <View style={styles.blob} pointerEvents="none">
                  <BlobBackground colorA={s.color + '33'} colorB={colors.yellowSoft} width={160} height={140} variant="c" />
                </View>
                <View style={[styles.icon, { backgroundColor: s.color }]}>
                  <Feather name={s.icon as any} size={20} color="#FFF" />
                </View>
                <Text style={styles.title}>{s.name}</Text>
                <Text style={styles.meta}>{sessions === 0 ? 'Awaiting first session' : `${sessions} session${sessions === 1 ? '' : 's'}`}</Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${done}%`, backgroundColor: s.color }]} />
                </View>
                <Text style={styles.progressText}>{done}% goals hit · Twin accuracy {Math.round((p?.prediction_accuracy ?? 0) * 100)}%</Text>
              </PressableCard>
            );
          })}
        </View>
      )}

      <AddSubjectSheet
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={async () => { setShowAdd(false); await load(); }}
        userId={userId}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  addBtn: {
    width: 42, height: 42, borderRadius: 999,
    backgroundColor: colors.brand,
    alignItems: 'center', justifyContent: 'center',
    ...shadow.card,
  },
  empty: {
    padding: spacing.lg,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'flex-start',
  },
  emptyIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: colors.brand,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.onSurface },
  emptyDesc: { marginTop: 4, fontSize: 13, color: colors.onSurfaceMuted, lineHeight: 18 },
  card: {
    padding: spacing.lg,
    borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
  },
  blob: { position: 'absolute', top: -10, right: -20 },
  icon: {
    width: 42, height: 42, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  title: { fontSize: 18, fontWeight: '800', color: colors.onSurface },
  meta: { fontSize: 12, color: colors.onSurfaceMuted, marginTop: 2 },
  progressTrack: {
    height: 8, borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: radius.pill },
  progressText: { fontSize: 11, color: colors.onSurfaceMuted, marginTop: 6, fontWeight: '600' },
});
