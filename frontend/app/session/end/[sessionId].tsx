import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import PressableCard from '@/src/components/PressableCard';
import BlobBackground from '@/src/components/BlobBackground';
import Robot3D, { RobotMood } from '@/src/components/Robot3D';
import VoiceBubble from '@/src/components/VoiceBubble';
import EvolutionBar from '@/src/components/EvolutionBar';
import PrimaryButton from '@/src/components/PrimaryButton';
import { colors, radius, shadow, spacing } from '@/src/theme';
import { Comparison, getSession, getUserId, twinVoice } from '@/src/api/twin';

export default function SessionEnd() {
  const router = useRouter();
  const params = useLocalSearchParams<{ data?: string; sessionId?: string }>();
  const initialComparison: Comparison | null = useMemo(() => {
    try {
      return params.data ? JSON.parse(decodeURIComponent(params.data as string)) : null;
    } catch { return null; }
  }, [params.data]);
  const [comparison, setComparison] = useState<Comparison | null>(initialComparison);

  const [voice, setVoice] = useState<string | null>(null);
  const [voiceLoading, setVoiceLoading] = useState(true);

  useEffect(() => {
    if (comparison || !params.sessionId) return;
    (async () => {
      try {
        const uid = await getUserId();
        const session = await getSession(uid, params.sessionId as string);
        if (session.comparison) setComparison(session.comparison);
      } catch { /* The missing-state message below remains available. */ }
    })();
  }, [comparison, params.sessionId]);

  useEffect(() => {
    if (!comparison) return;
    (async () => {
      try {
        const msg = await twinVoice(
          'session_end',
          {
            predicted_units: comparison.predicted_units,
            actual_units: comparison.actual_units,
            predicted_focus_minutes: comparison.predicted_focus_minutes,
            actual_focus_minutes: comparison.actual_focus_minutes,
            beat_prediction: comparison.beat_prediction,
            goal_completed: comparison.goal_completed,
            ended_early: comparison.ended_early,
            energy_delta: comparison.energy_delta,
            stage: comparison.stage.stage,
          },
          comparison.beat_prediction ? 'celebrating' : comparison.goal_completed ? 'warm' : 'warm',
          3,
        );
        setVoice(msg);
      } catch {
        setVoice(comparison.beat_prediction ? "You beat me today. I'm Reo, and I underestimated you." : "Session recorded — I'm Reo, and I know a little more about how you study now.");
      } finally {
        setVoiceLoading(false);
      }
    })();
  }, [comparison]);

  if (!comparison) {
    return <SafeAreaView style={styles.container}><Text style={styles.err}>Session data missing.</Text></SafeAreaView>;
  }

  const mood: RobotMood = comparison.beat_prediction ? 'celebrating' : comparison.goal_completed ? 'happy' : comparison.ended_early ? 'sleepy' : 'idle';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']} testID="session-end-screen">
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>SESSION COMPLETE</Text>
        <Text style={styles.title}>
          {comparison.beat_prediction ? 'You beat Reo’s prediction.' : comparison.goal_completed ? 'Goal reached.' : 'Session captured.'}
        </Text>

        <PressableCard style={styles.hero}>
          <View style={styles.heroBlob} pointerEvents="none">
            <BlobBackground colorA={colors.brandSoft} colorB={colors.yellowSoft} width={260} height={220} />
          </View>
          <View style={styles.robotWrap}>
            <Robot3D mood={mood} stage={comparison.stage.stage as 1|2|3|4|5} size={190} />
          </View>
          <VoiceBubble message={voice} loading={voiceLoading} />
          <EvolutionBar
            stage={comparison.stage.stage}
            stageProgress={comparison.stage.stage_progress}
            xp={comparison.stage.xp}
            nextStageXp={comparison.stage.next_stage_xp}
            style={{ marginTop: spacing.md }}
          />
          <View style={styles.deltaPill}>
            <Feather name={comparison.energy_delta >= 0 ? 'trending-up' : 'trending-down'} size={12} color="#FFF" />
            <Text style={styles.deltaPillText}>{comparison.energy_delta >= 0 ? `+${comparison.energy_delta}` : comparison.energy_delta} energy</Text>
          </View>
        </PressableCard>

        <Text style={styles.section}>Prediction vs Actual</Text>
        <View style={styles.compareGrid}>
          {comparison.predicted_units != null ? (
            <CompareRow
              label="Units"
              predicted={String(comparison.predicted_units)}
              actual={String(comparison.actual_units ?? '—')}
              positive={comparison.actual_units != null && comparison.actual_units >= (comparison.predicted_units ?? 0)}
            />
          ) : null}
          {comparison.predicted_focus_minutes != null ? <CompareRow
            label="Focus time"
            predicted={`${comparison.predicted_focus_minutes} min`}
            actual={`${comparison.actual_focus_minutes} min`}
            positive={comparison.actual_focus_minutes >= comparison.predicted_focus_minutes}
          /> : null}
          {comparison.predicted_distraction_minute != null ? <CompareRow
            label="First drift"
            predicted={`min ${comparison.predicted_distraction_minute}`}
            actual={comparison.actual_first_distraction_minute != null ? `min ${comparison.actual_first_distraction_minute}` : 'none'}
            positive={comparison.actual_first_distraction_minute == null || comparison.actual_first_distraction_minute >= comparison.predicted_distraction_minute}
          /> : null}
          {comparison.predicted_units == null && comparison.predicted_focus_minutes == null ? <View style={styles.calibrationBox}><Text style={styles.calibrationText}>Calibration session recorded. Reo did not make a prediction without enough subject history.</Text></View> : null}
        </View>

        <PrimaryButton
          label="Back to home"
          onPress={() => router.replace('/student/home' as any)}
          testID="end-home-btn"
          style={{ marginTop: spacing.lg }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function CompareRow({ label, predicted, actual, positive }: { label: string; predicted: string; actual: string; positive: boolean }) {
  return (
    <View style={styles.compareRow}>
      <Text style={styles.compareLabel}>{label}</Text>
      <View style={styles.compareValues}>
        <View style={styles.valueBox}>
          <Text style={styles.valueBoxSmall}>PREDICTED</Text>
          <Text style={styles.valueBoxBig}>{predicted}</Text>
        </View>
        <Feather name={positive ? 'arrow-right' : 'arrow-right'} size={16} color={colors.onSurfaceMuted} />
        <View style={[styles.valueBox, { backgroundColor: positive ? colors.brandSoft : colors.orangeSoft }]}>
          <Text style={styles.valueBoxSmall}>ACTUAL</Text>
          <Text style={styles.valueBoxBig}>{actual}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  err: { color: colors.onSurface, textAlign: 'center', marginTop: spacing.xxl },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 2, color: colors.brandDeep },
  title: { marginTop: spacing.xs, fontSize: 28, fontWeight: '800', color: colors.onSurface },
  hero: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
  },
  heroBlob: { position: 'absolute', top: -30, right: -30 },
  robotWrap: { alignItems: 'center', marginBottom: spacing.sm },
  deltaPill: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.brand,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: radius.pill,
  },
  deltaPillText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  section: { marginTop: spacing.lg, marginBottom: spacing.md, fontSize: 15, fontWeight: '800', color: colors.onSurface, letterSpacing: 0.3 },
  compareGrid: { gap: spacing.sm },
  calibrationBox: { padding: spacing.md, backgroundColor: colors.brandSoft, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  calibrationText: { fontSize: 13, lineHeight: 19, color: colors.onSurface },
  compareRow: {
    padding: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    ...shadow.card,
  },
  compareLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1, color: colors.onSurfaceMuted },
  compareValues: { marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 8 },
  valueBox: {
    flex: 1,
    padding: spacing.sm,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.sm,
    alignItems: 'flex-start',
  },
  valueBoxSmall: { fontSize: 9, fontWeight: '800', letterSpacing: 1, color: colors.onSurfaceMuted },
  valueBoxBig: { marginTop: 2, fontSize: 18, fontWeight: '800', color: colors.onSurface },
});
