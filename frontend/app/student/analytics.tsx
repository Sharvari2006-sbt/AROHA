import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

import ScreenShell from '@/src/components/ScreenShell';
import PressableCard from '@/src/components/PressableCard';
import Robot3D from '@/src/components/Robot3D';
import VoiceBubble from '@/src/components/VoiceBubble';
import EvolutionBar from '@/src/components/EvolutionBar';
import BlobBackground from '@/src/components/BlobBackground';
import { colors, radius, shadow, spacing } from '@/src/theme';
import {
  AnalyticsSummary, RobotState, analyticsSummary, getRobotState, getUserId, twinVoice,
} from '@/src/api/twin';

function shortDay(iso: string): string {
  try {
    const d = new Date(iso);
    return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()];
  } catch { return '·'; }
}

export default function Analytics() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [robot, setRobot] = useState<RobotState | null>(null);
  const [voice, setVoice] = useState<string | null>(null);
  const [voiceLoading, setVoiceLoading] = useState(true);

  const load = useCallback(async () => {
    const uid = await getUserId();
    const [s, r] = await Promise.all([analyticsSummary(uid), getRobotState(uid)]);
    setSummary(s);
    setRobot(r);
    setVoiceLoading(true);
    try {
      const msg = await twinVoice('analytics', {
        total_minutes: s.total_minutes,
        sessions_count: s.sessions_count,
        completion_rate_percent: Math.round(s.completion_rate * 100),
        streak_days: r.streak_days,
        stage: r.stage,
      }, 'warm', 2);
      setVoice(msg);
    } catch {
      setVoice(null);
    } finally {
      setVoiceLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const maxSec = Math.max(1, ...(summary?.week ?? []).map((w) => w.seconds));
  const mood = robot ? (robot.streak_days >= 3 ? 'happy' : 'idle') : 'idle';

  return (
    <ScreenShell greeting="INSIGHTS" title="Your calm progress" testID="student-analytics">
      <PressableCard style={styles.hero}>
        <View style={styles.heroBlob} pointerEvents="none">
          <BlobBackground colorA={colors.brandSoft} colorB={colors.yellowSoft} width={220} height={190} />
        </View>
        <View style={styles.heroRow}>
          <Robot3D mood={mood as any} stage={(robot?.stage ?? 1) as 1|2|3|4|5} size={130} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <VoiceBubble message={voice} loading={voiceLoading} />
          </View>
        </View>
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

      <View style={styles.statsRow}>
        {[
          { l: 'Minutes', v: `${summary?.total_minutes ?? 0}`, i: 'clock' as const, c: colors.brand },
          { l: 'Sessions', v: `${summary?.sessions_count ?? 0}`, i: 'target' as const, c: colors.orange },
          { l: 'Streak', v: `${robot?.streak_days ?? 0}d`, i: 'zap' as const, c: colors.yellow },
        ].map((s) => (
          <View key={s.l} style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: s.c }]}>
              <Feather name={s.i} size={14} color="#FFF" />
            </View>
            <Text style={styles.statValue}>{s.v}</Text>
            <Text style={styles.statLabel}>{s.l}</Text>
          </View>
        ))}
      </View>

      <PressableCard style={styles.chartCard}>
        <Text style={styles.chartTitle}>Study minutes · 7 days</Text>
        <View style={styles.bars}>
          {(summary?.week ?? []).map((w, i) => {
            const h = Math.max(4, (w.seconds / maxSec) * 100);
            return (
              <View key={i} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { height: `${h}%` }]} />
                </View>
                <Text style={styles.barLabel}>{shortDay(w.date)}</Text>
              </View>
            );
          })}
        </View>
      </PressableCard>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  hero: {
    padding: spacing.lg,
    borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  heroBlob: { position: 'absolute', top: -30, right: -30 },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  statCard: {
    flex: 1, padding: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    ...shadow.card,
  },
  statIcon: { width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.onSurface, marginTop: spacing.sm },
  statLabel: { fontSize: 11, color: colors.onSurfaceMuted, marginTop: 2, fontWeight: '600' },
  chartCard: {
    padding: spacing.lg,
    borderWidth: 1, borderColor: colors.border,
    marginTop: spacing.md,
  },
  chartTitle: { fontSize: 15, fontWeight: '800', color: colors.onSurface, marginBottom: spacing.md },
  bars: { flexDirection: 'row', height: 140, alignItems: 'flex-end', gap: 8 },
  barCol: { flex: 1, alignItems: 'center' },
  barTrack: { flex: 1, width: 16, backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', backgroundColor: colors.brand, borderRadius: radius.pill },
  barLabel: { marginTop: 6, fontSize: 11, color: colors.onSurfaceMuted, fontWeight: '600' },
});
