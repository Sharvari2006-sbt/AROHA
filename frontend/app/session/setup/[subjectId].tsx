import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import Input from '@/src/components/Input';
import PrimaryButton from '@/src/components/PrimaryButton';
import PressableCard from '@/src/components/PressableCard';
import BlobBackground from '@/src/components/BlobBackground';
import Robot3D from '@/src/components/Robot3D';
import VoiceBubble from '@/src/components/VoiceBubble';
import { colors, radius, spacing } from '@/src/theme';
import {
  getSubject, getUserId, predictSession, startSession, twinVoice,
  Prediction, TwinProfile, Subject, getRobotState, RobotState,
} from '@/src/api/twin';

export default function SessionSetup() {
  const router = useRouter();
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const [userId, setUserId] = useState('');
  const [subject, setSubject] = useState<Subject | null>(null);
  const [profile, setProfile] = useState<TwinProfile | null>(null);
  const [topic, setTopic] = useState('');
  const [goal, setGoal] = useState('');
  const [minutesText, setMinutesText] = useState('45');
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [predVoice, setPredVoice] = useState<string | null>(null);
  const [predLoading, setPredLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [robot, setRobot] = useState<RobotState | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const uid = await getUserId();
      setUserId(uid);
      const [data, rob] = await Promise.all([getSubject(uid, subjectId as string), getRobotState(uid)]);
      setSubject(data.subject);
      setProfile(data.profile);
      setRobot(rob);
    })();
  }, [subjectId]);

  const minutes = Number.parseInt(minutesText, 10);
  const durationValid = Number.isFinite(minutes) && minutes >= 1 && minutes <= 600;
  const canPredict = goal.trim().length > 1 && durationValid;

  const runPrediction = useCallback(async () => {
    if (!canPredict || !userId || !subject) return;
    setErr(null);
    setPredLoading(true);
    try {
      const { prediction: pred } = await predictSession(userId, subject.id, goal.trim(), minutes);
      setPrediction(pred);
      const msg = await twinVoice(
        'pre_session',
        {
          subject_name: subject.name,
          predicted_units: pred.predicted_units,
          predicted_distraction_point_minutes: pred.predicted_distraction_point_seconds != null ? Math.round(pred.predicted_distraction_point_seconds / 60) : null,
          predicted_focus_minutes: pred.predicted_focus_seconds != null ? Math.round(pred.predicted_focus_seconds / 60) : null,
          predicted_completion_percent: Math.round(pred.predicted_completion_probability * 100),
          planned_minutes: minutes,
          confidence: pred.confidence,
          is_first_session: pred.is_first_session,
          has_enough_data: pred.has_enough_data,
          previous_subject_sessions: profile?.sessions_count ?? 0,
        },
        pred.is_first_session ? 'warm' : 'playful',
        2,
      );
      setPredVoice(msg);
    } catch {
      setErr('Could not compute a prediction. Please try again.');
    } finally {
      setPredLoading(false);
    }
  }, [canPredict, goal, minutes, profile?.sessions_count, subject, userId]);

  useEffect(() => {
    if (!canPredict) { setPrediction(null); setPredVoice(null); return; }
    const timer = setTimeout(runPrediction, 450);
    return () => clearTimeout(timer);
  }, [canPredict, runPrediction]);

  const startNow = async () => {
    if (!userId || !subject) return;
    if (goal.trim().length < 2) { setErr('Please describe your goal.'); return; }
    if (!durationValid) { setErr('Enter a duration between 1 and 600 minutes.'); return; }
    setSaving(true);
    setErr(null);
    try {
      const { session } = await startSession(userId, subject.id, goal.trim(), minutes, topic.trim());
      router.replace(`/session/live/${session.id}` as any);
    } catch {
      setErr('Could not start the session.');
      setSaving(false);
    }
  };

  const twinIntro = useMemo(() => {
    if (!profile) return null;
    if (profile.sessions_count === 0) return "I'm Reo. I don't know your rhythm here yet — this first session teaches me.";
    if (profile.sessions_count === 1) return `I'm Reo. I've studied one ${subject?.name} session so far; this second session finishes my calibration.`;
    return `I'm Reo. I've studied ${profile.sessions_count} of your ${subject?.name} sessions. Give me a goal and let's see if you can beat my prediction.`;
  }, [profile, subject]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8} testID="setup-back">
              <Feather name="arrow-left" size={18} color={colors.onSurface} />
            </Pressable>
            <Text style={styles.headerTitle}>{subject?.name ?? 'Session'}</Text>
          </View>

          <Text style={styles.eyebrow}>PRE-SESSION</Text>
          <Text style={styles.title}>What&apos;s the goal?</Text>
          <Text style={styles.subtitle}>{twinIntro}</Text>

          <View style={styles.form}>
            <Input
              label="Topic (optional)"
              icon="hash"
              placeholder="e.g. Linked List"
              value={topic}
              onChangeText={setTopic}
              testID="setup-topic"
            />
            <Input
              label="Goal"
              icon="target"
              placeholder="e.g. Solve 15 questions"
              value={goal}
              onChangeText={setGoal}
              testID="setup-goal"
            />

            <Input
              label="Planned duration (minutes)"
              icon="clock"
              placeholder="Enter exact minutes"
              value={minutesText}
              onChangeText={(value) => setMinutesText(value.replace(/\D/g, '').slice(0, 3))}
              keyboardType="number-pad"
              maxLength={3}
              testID="setup-duration"
            />
          </View>

          {/* Prediction card */}
          <PressableCard style={styles.predCard} onPress={runPrediction} testID="prediction-card">
            <View style={styles.predBlob} pointerEvents="none">
              <BlobBackground colorA={colors.brandSoft} colorB={colors.yellowSoft} width={200} height={170} />
            </View>
            <View style={styles.predRow}>
              <View style={{ flex: 1, marginRight: spacing.sm }}>
                <Text style={styles.predEyebrow}>TWIN PREDICTION</Text>
                {prediction ? (
                  <>
                    <View style={styles.predStats}>
                      {prediction.predicted_units != null ? (
                        <View style={styles.predStat}>
                          <Text style={styles.predStatV}>{prediction.predicted_units}</Text>
                          <Text style={styles.predStatL}>units</Text>
                        </View>
                      ) : null}
                      {prediction.predicted_focus_seconds != null ? <View style={styles.predStat}>
                        <Text style={styles.predStatV}>{Math.round(prediction.predicted_focus_seconds / 60)}m</Text>
                        <Text style={styles.predStatL}>focus</Text>
                      </View> : null}
                      {prediction.predicted_distraction_point_seconds != null ? <View style={styles.predStat}>
                        <Text style={styles.predStatV}>min {Math.round(prediction.predicted_distraction_point_seconds / 60)}</Text>
                        <Text style={styles.predStatL}>drift near</Text>
                      </View> : null}
                      {prediction.has_enough_data ? <View style={styles.predStat}>
                        <Text style={styles.predStatV}>{Math.round(prediction.confidence * 100)}%</Text>
                        <Text style={styles.predStatL}>confidence</Text>
                      </View> : <View style={styles.predStat}><Text style={styles.predStatV}>Learning</Text><Text style={styles.predStatL}>calibration</Text></View>}
                    </View>
                    <VoiceBubble message={predVoice} loading={predLoading} />
                  </>
                ) : (
                  <>
                    <Text style={styles.predHint}>Enter a goal to see my prediction.</Text>
                    <VoiceBubble message={null} loading={predLoading} />
                  </>
                )}
              </View>
              <Robot3D mood="thinking" stage={(robot?.stage ?? 1) as 1|2|3|4|5} size={110} />
            </View>
          </PressableCard>

          {err ? <Text style={styles.err}>{err}</Text> : null}

          <PrimaryButton
            label={saving ? 'Starting…' : 'Start session'}
            loading={saving}
            onPress={startNow}
            testID="start-now-btn"
            style={{ marginTop: spacing.lg, backgroundColor: subject?.color ?? colors.brand }}
          />
          <Text style={styles.footNote}>Reo and your Digital Twin will track focus quietly. No manual input needed.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  back: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 15, fontWeight: '800', color: colors.onSurface },
  eyebrow: { marginTop: spacing.md, fontSize: 11, fontWeight: '800', letterSpacing: 2, color: colors.brandDeep },
  title: { fontSize: 28, fontWeight: '800', color: colors.onSurface, marginTop: 4 },
  subtitle: { marginTop: spacing.sm, fontSize: 14, color: colors.onSurfaceMuted, lineHeight: 20 },
  form: { marginTop: spacing.lg },
  predCard: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
    minHeight: 180,
  },
  predBlob: { position: 'absolute', top: -20, right: -20 },
  predRow: { flexDirection: 'row', alignItems: 'center' },
  predEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: colors.brandDeep, marginBottom: spacing.sm },
  predStats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  predStat: {
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    minWidth: 68,
  },
  predStatV: { fontSize: 14, fontWeight: '800', color: colors.onSurface },
  predStatL: { fontSize: 10, fontWeight: '700', color: colors.onSurfaceMuted, marginTop: 1, letterSpacing: 0.5 },
  predHint: { fontSize: 13, color: colors.onSurfaceMuted, marginBottom: spacing.sm },
  err: { marginTop: spacing.md, color: '#8A3B18', fontSize: 13, fontWeight: '600' },
  footNote: { marginTop: spacing.md, textAlign: 'center', fontSize: 12, color: colors.onSurfaceMuted },
});
