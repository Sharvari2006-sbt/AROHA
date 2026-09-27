import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, AppState, AppStateStatus, ScrollView, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import PrimaryButton from '@/src/components/PrimaryButton';
import Robot3D, { RobotMood } from '@/src/components/Robot3D';
import VoiceBubble from '@/src/components/VoiceBubble';
import BlobBackground from '@/src/components/BlobBackground';
import { colors, radius, shadow, spacing } from '@/src/theme';
import {
  endSession, getRobotState, getSession, getUserId, twinVoice, SessionDoc, SessionEvent, RobotState,
} from '@/src/api/twin';
import { beginFocusShieldSession, endFocusShieldSession } from '@/src/native/focus-shield';

function fmt(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function LiveSession() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [session, setSession] = useState<SessionDoc | null>(null);
  const [robot, setRobot] = useState<RobotState | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [active, setActive] = useState(0); // seconds actually studied (excludes breaks)
  const [onBreak, setOnBreak] = useState(false);
  const [units, setUnits] = useState(0);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [voice, setVoice] = useState<string | null>(null);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [mood, setMood] = useState<RobotMood>('idle');
  const [showEnd, setShowEnd] = useState(false);
  const [ending, setEnding] = useState(false);

  const activeRef = useRef(active);
  const onBreakRef = useRef(onBreak);
  const elapsedRef = useRef(elapsed);
  const appActiveRef = useRef(true);
  const backgroundStartRef = useRef<number | null>(null);
  const driftTriggeredRef = useRef(false);
  const startedAtRef = useRef(Date.now());
  const breakStartedAtRef = useRef<number | null>(null);
  const inactivityTriggeredRef = useRef(false);
  const currentElapsed = useCallback(() => Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000)), []);

  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => { onBreakRef.current = onBreak; }, [onBreak]);
  useEffect(() => { elapsedRef.current = elapsed; }, [elapsed]);

  useEffect(() => {
    beginFocusShieldSession().catch(() => false);
    return () => endFocusShieldSession();
  }, []);

  // Load session doc
  useEffect(() => {
    (async () => {
      const uid = await getUserId();
      const [found, robotState] = await Promise.all([getSession(uid, sessionId as string), getRobotState(uid)]);
      setRobot(robotState);
      setSession(found);
      if (found) {
        startedAtRef.current = new Date(found.started_at).getTime();
        const p = found.prediction_snapshot;
        setVoiceLoading(true);
        try {
          const msg = await twinVoice(
            'pre_session',
            {
              subject_name: found.subject_name,
              predicted_units: p.predicted_units,
              predicted_distraction_point_minutes: p.predicted_distraction_point_seconds != null ? Math.round(p.predicted_distraction_point_seconds / 60) : null,
              predicted_focus_minutes: p.predicted_focus_seconds != null ? Math.round(p.predicted_focus_seconds / 60) : null,
              predicted_completion_percent: Math.round(p.predicted_completion_probability * 100),
              planned_minutes: found.planned_duration_minutes,
              confidence: p.confidence,
              is_first_session: p.is_first_session,
              has_enough_data: p.has_enough_data,
              previous_subject_sessions: found.subject_profile_snapshot?.sessions_count ?? 0,
            },
            'playful',
            2,
          );
          setVoice(msg);
        } catch {
          setVoice(null);
        } finally {
          setVoiceLoading(false);
        }
      }
    })();
  }, [sessionId]);

  // Timer
  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(currentElapsed());
      if (!onBreakRef.current && appActiveRef.current) setActive((a) => a + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [currentElapsed]);

  // Auto distraction detection via AppState
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      const at = currentElapsed();
      if (state !== 'active' && appActiveRef.current) {
        appActiveRef.current = false;
        backgroundStartRef.current = at;
        setEvents((ev) => [...ev, { kind: 'background', at_seconds: at }]);
      } else if (state === 'active' && !appActiveRef.current) {
        const started = backgroundStartRef.current;
        appActiveRef.current = true;
        backgroundStartRef.current = null;
        setEvents((ev) => [...ev, { kind: 'foreground', at_seconds: at, payload: { duration: Math.max(0, at - (started ?? at)) } }]);
        setMood('worried');
        setTimeout(() => setMood('idle'), 4000);
      }
    });
    return () => sub.remove();
  }, [currentElapsed]);

  useEffect(() => {
    if (!onBreak || breakStartedAtRef.current == null || inactivityTriggeredRef.current) return;
    if (elapsed - breakStartedAtRef.current >= 120) {
      inactivityTriggeredRef.current = true;
      setMood('worried');
      setVoice(`This break has reached ${Math.round((elapsed - breakStartedAtRef.current) / 60)} minutes. Resume when you're ready, and I'll keep the timing honest.`);
    }
  }, [elapsed, onBreak]);

  // Trigger predicted-drift moment: when we cross predicted distraction point, offer help proactively
  useEffect(() => {
    if (!session) return;
    const p = session.prediction_snapshot;
    const drift = p?.predicted_distraction_point_seconds ?? 0;
    if (drift && elapsed >= drift && !driftTriggeredRef.current) {
      driftTriggeredRef.current = true;
      setMood('worried');
      // gentle nudge without demanding action
      (async () => {
        setVoiceLoading(true);
        try {
          const msg = await twinVoice('mid_session_encourage', {
            subject_name: session.subject_name,
            typical_distraction_minute: Math.round(drift / 60),
            elapsed_minutes: Math.round(elapsed / 60),
          }, 'warm', 1);
          setVoice(msg);
        } finally {
          setVoiceLoading(false);
          setTimeout(() => setMood('idle'), 4000);
        }
      })();
    }
    if (session.goal_units_target && units >= session.goal_units_target && mood !== 'celebrating') {
      setMood('celebrating');
      setTimeout(() => setMood('happy'), 5000);
    }
  }, [elapsed, session, units, mood]);

  const distraction = useCallback(async () => {
    if (!session) return;
    setEvents((ev) => [...ev, { kind: 'distraction', at_seconds: elapsedRef.current }]);
    setMood('worried');
    setVoiceLoading(true);
    try {
      const p = session.prediction_snapshot;
      const history = session.subject_profile_snapshot;
      const msg = await twinVoice('distraction_help', {
        subject_name: session.subject_name,
        typical_distraction_minute: p.predicted_distraction_point_seconds != null ? Math.round(p.predicted_distraction_point_seconds / 60) : null,
        elapsed_minutes: Math.round(elapsedRef.current / 60),
        goal: session.goal,
        previous_subject_sessions: history?.sessions_count ?? 0,
        average_focus_minutes: history?.avg_focus_seconds ? Math.round(history.avg_focus_seconds / 60) : null,
        usual_recovery_minutes: history?.avg_post_distraction_focus_seconds ? Math.max(1, Math.round(history.avg_post_distraction_focus_seconds / 60)) : null,
        post_distraction_goal_completion_percent: history?.distraction_sessions_count ? Math.round((history.post_distraction_completion_rate ?? 0) * 100) : null,
      }, 'warm', 2);
      setVoice(msg);
    } finally {
      setVoiceLoading(false);
      setTimeout(() => setMood('idle'), 4000);
    }
  }, [session]);

  const toggleBreak = () => {
    const at = elapsedRef.current;
    if (onBreak) {
      setEvents((ev) => [...ev, { kind: 'break_end', at_seconds: at }]);
      setOnBreak(false);
      breakStartedAtRef.current = null;
      inactivityTriggeredRef.current = false;
      setMood('idle');
    } else {
      setEvents((ev) => [...ev, { kind: 'break_start', at_seconds: at }]);
      setOnBreak(true);
      breakStartedAtRef.current = at;
      inactivityTriggeredRef.current = false;
      setMood('sleepy');
    }
  };

  const addUnit = () => setUnits((u) => { const next = u + 1; setEvents((ev) => [...ev, { kind: 'unit_progress', at_seconds: elapsedRef.current, payload: { units: next } }]); return next; });
  const removeUnit = () => setUnits((u) => { const next = Math.max(0, u - 1); setEvents((ev) => [...ev, { kind: 'unit_progress', at_seconds: elapsedRef.current, payload: { units: next } }]); return next; });

  const confirmEnd = () => setShowEnd(true);

  const doEnd = async (endedEarly: boolean) => {
    if (!session) return;
    setEnding(true);
    try {
      const { comparison } = await endSession(session.id, {
        ended_early: endedEarly,
        units_done: session.goal_units_target ? units : null,
        active_seconds: activeRef.current,
        elapsed_seconds: elapsedRef.current,
        events,
      });
      // Pass comparison payload via router params (JSON encoded)
      router.replace({ pathname: `/session/end/${session.id}` as any, params: { data: encodeURIComponent(JSON.stringify(comparison)) } });
    } catch {
      setEnding(false);
    }
  };

  if (!session) {
    return (
      <SafeAreaView style={styles.container}><Text style={styles.loading}>Loading…</Text></SafeAreaView>
    );
  }

  const planned = session.planned_duration_seconds;
  const progress = Math.min(1, active / Math.max(planned, 1));
  const targetUnits = session.goal_units_target;
  const stage = (robot?.stage ?? 1) as 1 | 2 | 3 | 4 | 5;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']} testID={`live-session-${session.id}`}>
      <View style={styles.header}>
        <Pressable onPress={confirmEnd} hitSlop={8} style={styles.exitBtn} testID="exit-btn">
          <Feather name="x" size={18} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.subjectLabel}>{session.subject_name}</Text>
          <Text style={styles.topicLabel} numberOfLines={1}>{session.topic || session.goal}</Text>
        </View>
        <View style={styles.timerPill}>
          <Feather name="clock" size={12} color={colors.onSurface} />
          <Text style={styles.timerPillText}>{fmt(elapsed)} / {fmt(planned)}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.stage}>
          <View style={styles.stageBlob} pointerEvents="none">
            <BlobBackground colorA={colors.brandSoft} colorB={colors.yellowSoft} width={340} height={280} />
          </View>
          <Robot3D mood={mood} stage={stage as 1|2|3|4|5} size={240} testID="live-robot" />
          <View style={styles.bubbleWrap}>
            <VoiceBubble message={voice} loading={voiceLoading} />
          </View>
        </View>

        {/* Progress */}
        <View style={styles.card}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Focus progress</Text>
            <Text style={styles.progressPct}>{Math.round(progress * 100)}%</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progress * 100}%` }]} />
          </View>
          <View style={styles.progressMetaRow}>
            <View style={styles.metaPill}>
              <Feather name="activity" size={12} color={colors.onSurface} />
              <Text style={styles.metaPillText}>{fmt(active)} active</Text>
            </View>
            {onBreak ? (
              <View style={[styles.metaPill, { backgroundColor: colors.orangeSoft }]}>
                <Feather name="coffee" size={12} color={colors.onSurface} />
                <Text style={styles.metaPillText}>On break</Text>
              </View>
            ) : null}
          </View>
        </View>

        {targetUnits ? (
          <View style={styles.card}>
            <Text style={styles.progressTitle}>Goal · {session.goal}</Text>
            <View style={styles.unitRow}>
              <Pressable onPress={removeUnit} style={styles.unitBtn} testID="unit-minus"><Feather name="minus" size={18} color={colors.onSurface} /></Pressable>
              <View style={styles.unitBig}>
                <Text style={styles.unitBigText}>{units}</Text>
                <Text style={styles.unitBigLabel}>/ {targetUnits}</Text>
              </View>
              <Pressable onPress={addUnit} style={[styles.unitBtn, styles.unitBtnPrimary]} testID="unit-plus"><Feather name="plus" size={18} color="#FFF" /></Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.actionsRow}>
          <Pressable onPress={distraction} style={[styles.actionCard, styles.actionOrange]} testID="distracted-btn">
            <Feather name="alert-circle" size={18} color="#FFF" />
            <Text style={styles.actionText}>I&apos;m getting distracted</Text>
          </Pressable>
          <Pressable onPress={toggleBreak} style={[styles.actionCard, styles.actionMuted]} testID="break-btn">
            <Feather name={onBreak ? 'play' : 'coffee'} size={18} color={colors.onSurface} />
            <Text style={[styles.actionText, { color: colors.onSurface }]}>{onBreak ? 'Resume' : 'Take a break'}</Text>
          </Pressable>
        </View>

        <PrimaryButton
          label="Finish session"
          variant="secondary"
          onPress={confirmEnd}
          testID="finish-btn"
          style={{ marginTop: spacing.md }}
        />
        <Text style={styles.footNote}>Auto-tracking: minimising the app counts as a distraction.</Text>
      </ScrollView>

      <Modal visible={showEnd} transparent animationType="fade" onRequestClose={() => setShowEnd(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Finish this session?</Text>
            <Text style={styles.modalDesc}>Reo will compare your performance with the Digital Twin prediction and update this subject profile.</Text>
            <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
              <PrimaryButton
                label={ending ? 'Wrapping up…' : 'Finish now'}
                loading={ending}
                onPress={() => doEnd(elapsed < planned * 0.9)}
                testID="confirm-finish-btn"
              />
              <PrimaryButton label="Keep going" variant="secondary" onPress={() => setShowEnd(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  loading: { color: colors.onSurface, textAlign: 'center', marginTop: spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  exitBtn: {
    width: 40, height: 40, borderRadius: 999,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  subjectLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: colors.brandDeep },
  topicLabel: { fontSize: 15, fontWeight: '800', color: colors.onSurface, marginTop: 2 },
  timerPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border,
  },
  timerPillText: { fontSize: 12, fontWeight: '800', color: colors.onSurface },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  stage: {
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    overflow: 'visible',
  },
  stageBlob: { position: 'absolute', top: -30, alignSelf: 'center' },
  bubbleWrap: { width: '100%', marginTop: -spacing.md },
  card: {
    padding: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressTitle: { fontSize: 14, fontWeight: '800', color: colors.onSurface },
  progressPct: { fontSize: 15, fontWeight: '800', color: colors.brandDeep },
  track: { height: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, marginTop: spacing.sm, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.brand, borderRadius: radius.pill },
  progressMetaRow: { flexDirection: 'row', gap: 8, marginTop: spacing.md },
  metaPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: radius.pill,
  },
  metaPillText: { fontSize: 12, fontWeight: '700', color: colors.onSurface },
  unitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, marginTop: spacing.md },
  unitBtn: {
    width: 48, height: 48, borderRadius: 999,
    backgroundColor: colors.surfaceTertiary,
    alignItems: 'center', justifyContent: 'center',
  },
  unitBtnPrimary: { backgroundColor: colors.brand },
  unitBig: { flex: 1, alignItems: 'center' },
  unitBigText: { fontSize: 36, fontWeight: '800', color: colors.onSurface },
  unitBigLabel: { fontSize: 12, color: colors.onSurfaceMuted, marginTop: -4, fontWeight: '700' },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actionCard: {
    flex: 1, padding: spacing.md, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
    gap: 6,
  },
  actionOrange: { backgroundColor: colors.orange },
  actionMuted: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  actionText: { fontSize: 13, fontWeight: '800', color: '#FFF' },
  footNote: { marginTop: spacing.md, textAlign: 'center', fontSize: 12, color: colors.onSurfaceMuted },
  modalBackdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.lg },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.soft,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.onSurface },
  modalDesc: { marginTop: spacing.sm, fontSize: 14, color: colors.onSurfaceMuted, lineHeight: 20 },
});
