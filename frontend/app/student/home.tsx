import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';

import ScreenShell from '@/src/components/ScreenShell';
import PressableCard from '@/src/components/PressableCard';
import BlobBackground from '@/src/components/BlobBackground';
import Robot3D from '@/src/components/Robot3D';
import VoiceBubble from '@/src/components/VoiceBubble';
import EvolutionBar from '@/src/components/EvolutionBar';
import AddSubjectSheet from '@/src/components/AddSubjectSheet';
import { colors, radius, shadow, spacing } from '@/src/theme';
import {
  Subject,
  RobotState,
  getUserId,
  listSubjects,
  getRobotState,
  twinVoice,
} from '@/src/api/twin';

export default function StudentHome() {
  const router = useRouter();
  const [userId, setUserId] = useState<string>('');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [robot, setRobot] = useState<RobotState | null>(null);
  const [greeting, setGreeting] = useState<string | null>(null);
  const [greetingLoading, setGreetingLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async (uid: string, refreshVoice = true) => {
    const [subs, rob] = await Promise.all([listSubjects(uid), getRobotState(uid)]);
    setSubjects(subs);
    setRobot(rob);
    if (refreshVoice) {
      setGreetingLoading(true);
      try {
        const msg = await twinVoice('greeting', {
          streak_days: rob.streak_days,
          stage: rob.stage,
          subjects_count: subs.length,
          xp: rob.xp,
        }, 'warm', 2);
        setGreeting(msg);
      } catch {
        setGreeting("Hey, welcome back. Let's build a calm streak today.");
      } finally {
        setGreetingLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    (async () => {
      const uid = await getUserId();
      setUserId(uid);
      await load(uid);
    })();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (userId) load(userId, false);
    }, [userId, load]),
  );

  const mood = robot ? (robot.streak_days >= 3 ? 'happy' : robot.streak_days === 0 ? 'sleepy' : 'idle') : 'idle';

  return (
    <ScreenShell
      greeting={robot ? `${robot.streak_days}-day streak` : ''}
      title="Ready to learn?"
      subtitle="Pick a subject or add a new one to begin."
      right={
        <Pressable onPress={() => setShowAdd(true)} style={styles.addBtn} hitSlop={8} testID="add-subject-btn">
          <Feather name="plus" size={18} color="#FFF" />
        </Pressable>
      }
      testID="student-home"
    >
      {/* Robot hero */}
      <PressableCard style={styles.hero}>
        <View style={styles.heroBlob} pointerEvents="none">
          <BlobBackground colorA={colors.brandSoft} colorB={colors.yellowSoft} width={260} height={220} />
        </View>
        <View style={styles.robotWrap} testID="home-robot">
          <Robot3D mood={mood as any} stage={(robot?.stage ?? 1) as 1|2|3|4|5} size={190} />
        </View>
        <VoiceBubble message={greeting} loading={greetingLoading} />
        {robot ? (
          <EvolutionBar
            stage={robot.stage}
            stageProgress={robot.stage_progress}
            xp={robot.xp}
            nextStageXp={robot.next_stage_xp}
            style={{ marginTop: spacing.md }}
          />
        ) : null}
      </PressableCard>

      {/* Subjects */}
      <View style={styles.sectionRow}>
        <Text style={styles.section}>Subjects</Text>
        <Pressable onPress={() => setShowAdd(true)} hitSlop={8} testID="add-subject-link">
          <Text style={styles.sectionAction}>+ Add</Text>
        </Pressable>
      </View>

      {subjects.length === 0 ? (
        <PressableCard style={styles.empty} testID="empty-subjects" onPress={() => setShowAdd(true)}>
          <View style={styles.emptyIcon}><Feather name="book-open" size={20} color="#FFF" /></View>
          <Text style={styles.emptyTitle}>No subjects yet</Text>
          <Text style={styles.emptyDesc}>Add your first subject — the Twin will start learning your rhythm from your very first session.</Text>
        </PressableCard>
      ) : (
        <View style={{ gap: spacing.md }}>
          {subjects.map((s) => (
            <PressableCard
              key={s.id}
              style={styles.subjectCard}
              testID={`subject-${s.id}`}
              onPress={() => router.push(`/subject/${s.id}` as any)}
            >
              <View style={styles.subjectBlob} pointerEvents="none">
                <BlobBackground colorA={s.color + '33'} colorB={colors.yellowSoft} width={160} height={140} variant="b" />
              </View>
              <View style={[styles.subjectIcon, { backgroundColor: s.color }]}>
                <Feather name={s.icon as any} size={20} color="#FFF" />
              </View>
              <Text style={styles.subjectName}>{s.name}</Text>
              <Text style={styles.subjectMeta}>
                {(s.profile?.sessions_count ?? 0) === 0
                  ? 'Ready for your first session'
                  : `${s.profile?.sessions_count} session${(s.profile?.sessions_count ?? 0) === 1 ? '' : 's'} · ${Math.round((s.profile?.goal_completion_rate ?? 0) * 100)}% goals hit`}
              </Text>
              <View style={styles.startBtn}>
                <Text style={styles.startBtnText}>Start session</Text>
                <Feather name="arrow-right" size={14} color={colors.onSurface} />
              </View>
            </PressableCard>
          ))}
        </View>
      )}

      <AddSubjectSheet
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={async () => { setShowAdd(false); if (userId) await load(userId, false); }}
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
  hero: {
    padding: spacing.lg,
    borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    alignItems: 'stretch',
  },
  heroBlob: { position: 'absolute', top: -20, right: -30 },
  robotWrap: { alignItems: 'center', marginBottom: spacing.md },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md, marginTop: spacing.md },
  section: { fontSize: 17, fontWeight: '800', color: colors.onSurface },
  sectionAction: { color: colors.brandDeep, fontWeight: '700', fontSize: 13 },
  subjectCard: {
    padding: spacing.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  subjectBlob: { position: 'absolute', top: -10, right: -20 },
  subjectIcon: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm, ...shadow.card,
  },
  subjectName: { fontSize: 18, fontWeight: '800', color: colors.onSurface },
  subjectMeta: { fontSize: 12, color: colors.onSurfaceMuted, marginTop: 2, fontWeight: '600' },
  startBtn: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: radius.pill,
  },
  startBtnText: { fontSize: 12, fontWeight: '800', color: colors.onSurface },
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
});
