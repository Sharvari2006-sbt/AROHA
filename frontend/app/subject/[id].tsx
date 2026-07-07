import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import ScreenShell from '@/src/components/ScreenShell';
import PressableCard from '@/src/components/PressableCard';
import PrimaryButton from '@/src/components/PrimaryButton';
import BlobBackground from '@/src/components/BlobBackground';
import Robot3D, { RobotMood } from '@/src/components/Robot3D';
import VoiceBubble from '@/src/components/VoiceBubble';
import { colors, radius, shadow, spacing } from '@/src/theme';
import { getSubject, getUserId, getRobotState, twinVoice, Subject, TwinProfile, SessionDoc, RobotState } from '@/src/api/twin';

function fmtSecs(s: number): string {
  if (!s) return '—';
  const m = Math.round(s / 60);
  return `${m} min`;
}

export default function SubjectDetail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const subjectId = params.id as string;
  const [subject, setSubject] = useState<Subject | null>(null);
  const [profile, setProfile] = useState<TwinProfile | null>(null);
  const [recent, setRecent] = useState<SessionDoc[]>([]);
  const [robot, setRobot] = useState<RobotState | null>(null);
  const [voice, setVoice] = useState<string | null>(null);
  const [voiceLoading, setVoiceLoading] = useState(true);

  const load = useCallback(async () => {
    const uid = await getUserId();
    const [data, rob] = await Promise.all([getSubject(uid, subjectId), getRobotState(uid)]);
    setSubject(data.subject);
    setProfile(data.profile);
    setRecent(data.recent_sessions || []);
    setRobot(rob);
    setVoiceLoading(true);
    try {
      const facts: Record<string, unknown> = {
        subject_name: data.subject.name,
        sessions_count: data.profile.sessions_count,
      };
      if (data.profile.sessions_count > 0) {
        facts.avg_focus_minutes = Math.round((data.profile.avg_focus_seconds ?? 0) / 60);
        facts.goal_completion_percent = Math.round((data.profile.goal_completion_rate ?? 0) * 100);
        facts.typical_distraction_minute = Math.round((data.profile.avg_distraction_point_seconds ?? 0) / 60);
      }
      const msg = await twinVoice(
        data.profile.sessions_count === 0 ? 'generic' : 'analytics',
        facts, 'warm', 2,
      );
      setVoice(msg);
    } catch {
      setVoice(null);
    } finally {
      setVoiceLoading(false);
    }
  }, [subjectId]);

  useEffect(() => { load(); }, [load]);

  if (!subject || !profile) {
    return <ScreenShell title="Loading…" testID="subject-loading">{null}</ScreenShell>;
  }

  const mood: RobotMood = profile.sessions_count === 0 ? 'thinking' : profile.goal_completion_rate > 0.6 ? 'happy' : 'idle';

  return (
    <ScreenShell
      greeting="SUBJECT"
      title={subject.name}
      subtitle={profile.sessions_count === 0 ? 'The Twin has no memory here yet. Your first session will shape it.' : `${profile.sessions_count} session${profile.sessions_count === 1 ? '' : 's'} learned.`}
      right={
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn} testID="subject-back">
          <Feather name="arrow-left" size={18} color={colors.onSurface} />
        </Pressable>
      }
      testID={`subject-detail-${subjectId}`}
    >
      <PressableCard style={styles.hero}>
        <View style={styles.heroBlob} pointerEvents="none">
          <BlobBackground colorA={subject.color + '33'} colorB={colors.yellowSoft} width={220} height={180} />
        </View>
        <View style={styles.robotRow}>
          <Robot3D mood={mood} stage={(robot?.stage ?? 1) as 1|2|3|4|5} size={140} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <VoiceBubble message={voice} loading={voiceLoading} />
          </View>
        </View>
      </PressableCard>

      <Text style={styles.section}>Twin profile</Text>
      <View style={styles.statsGrid}>
        {[
          { l: 'Sessions', v: `${profile.sessions_count}` },
          { l: 'Avg focus', v: fmtSecs(profile.avg_focus_seconds) },
          { l: 'Goals hit', v: `${Math.round((profile.goal_completion_rate ?? 0) * 100)}%` },
          { l: 'Twin accuracy', v: `${Math.round((profile.prediction_accuracy ?? 0) * 100)}%` },
          { l: 'Consistency', v: `${Math.round((profile.consistency_score ?? 0) * 100)}%` },
          { l: 'Drifts near', v: profile.avg_distraction_point_seconds ? `min ${Math.round(profile.avg_distraction_point_seconds / 60)}` : '—' },
        ].map((s) => (
          <View key={s.l} style={styles.statCard}>
            <Text style={styles.statV}>{s.v}</Text>
            <Text style={styles.statL}>{s.l}</Text>
          </View>
        ))}
      </View>

      <PrimaryButton
        label="Start a session"
        style={{ marginTop: spacing.lg, backgroundColor: subject.color }}
        onPress={() => router.push(`/session/setup/${subjectId}` as any)}
        testID="start-session-btn"
      />

      <Text style={styles.section}>Recent sessions</Text>
      {recent.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No sessions yet. Your first one starts the Twin.</Text>
        </View>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {recent.map((r) => (
            <PressableCard key={r.id} style={styles.sessionRow} testID={`recent-${r.id}`}>
              <View style={[styles.sessionDot, { backgroundColor: r.goal_completed ? colors.brand : colors.orange }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.sessionTitle}>{r.topic || r.goal}</Text>
                <Text style={styles.sessionMeta}>
                  {fmtSecs(r.active_seconds)} · {r.units_done ?? 0}{r.goal_units_target ? `/${r.goal_units_target}` : ''}
                  {r.distractions ? ` · ${r.distractions} distraction${r.distractions === 1 ? '' : 's'}` : ''}
                </Text>
              </View>
              {r.goal_completed ? (
                <View style={styles.badgeOk}><Feather name="check" size={12} color="#FFF" /></View>
              ) : null}
            </PressableCard>
          ))}
        </View>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  backBtn: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  hero: {
    padding: spacing.lg,
    borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  heroBlob: { position: 'absolute', top: -20, right: -30 },
  robotRow: { flexDirection: 'row', alignItems: 'center' },
  section: { marginTop: spacing.lg, marginBottom: spacing.md, fontSize: 15, fontWeight: '800', color: colors.onSurface, letterSpacing: 0.3 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statCard: {
    width: '31%',
    padding: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    ...shadow.card,
  },
  statV: { fontSize: 15, fontWeight: '800', color: colors.onSurface },
  statL: { marginTop: 2, fontSize: 10, fontWeight: '700', color: colors.onSurfaceMuted, letterSpacing: 0.5 },
  emptyBox: { padding: spacing.md, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md },
  emptyText: { color: colors.onSurfaceMuted, fontSize: 13 },
  sessionRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  sessionDot: { width: 10, height: 10, borderRadius: 999 },
  sessionTitle: { fontSize: 14, fontWeight: '700', color: colors.onSurface },
  sessionMeta: { fontSize: 12, color: colors.onSurfaceMuted, marginTop: 2 },
  badgeOk: {
    width: 28, height: 28, borderRadius: 999,
    backgroundColor: colors.brand,
    alignItems: 'center', justifyContent: 'center',
  },
});
