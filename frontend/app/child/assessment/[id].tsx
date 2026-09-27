import React, { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import ScreenShell from '@/src/components/ScreenShell';
import PressableCard from '@/src/components/PressableCard';
import PrimaryButton from '@/src/components/PrimaryButton';
import { beginAssignedQuiz, submitAssignedQuiz } from '@/src/api/supervised';
import { colors, radius, spacing } from '@/src/theme';
import { beginFocusShieldSession, endFocusShieldSession } from '@/src/native/focus-shield';

type Question = { prompt: string; choices: string[]; concept: string };

export default function LockedAssessment() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [backgroundEvents, setBackgroundEvents] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; total: number; score_percent: number; mastery_xp: number } | null>(null);
  const [error, setError] = useState('');
  const stateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    beginFocusShieldSession().catch(() => false);
    beginAssignedQuiz(id).then((data) => setQuestions(data.questions)).catch((e) => setError(e instanceof Error ? e.message : 'Quiz is not ready.'));
    const back = BackHandler.addEventListener('hardwareBackPress', () => true);
    const app = AppState.addEventListener('change', (next) => {
      if (stateRef.current === 'active' && next !== 'active') setBackgroundEvents((value) => value + 1);
      stateRef.current = next;
    });
    return () => { back.remove(); app.remove(); endFocusShieldSession(); };
  }, [id]);

  const next = async () => {
    if (picked == null) return;
    const updated = [...answers, picked];
    if (index < questions.length - 1) { setAnswers(updated); setIndex((value) => value + 1); setPicked(null); return; }
    setSubmitting(true);
    try { setResult(await submitAssignedQuiz(id, updated, backgroundEvents)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not submit assessment.'); }
    finally { setSubmitting(false); }
  };

  if (result) {
    return <ScreenShell greeting="ASSESSMENT COMPLETE" title="Quiz submitted" subtitle="Your answers are now part of your concept profile." testID="assessment-result"><PressableCard style={styles.result}><View style={styles.resultIcon}><Feather name="award" size={26} color="#FFF" /></View><Text style={styles.score}>{result.score}/{result.total}</Text><Text style={styles.resultText}>{result.score_percent}% · +{result.mastery_xp} verified mastery XP</Text><PrimaryButton label="Back to tasks" onPress={() => router.replace('/child/tasks' as any)} style={{ marginTop: spacing.lg, alignSelf: 'stretch' }} /></PressableCard></ScreenShell>;
  }

  const question = questions[index];
  return (
    <ScreenShell greeting="LOCKED ASSESSMENT" title={question ? `Question ${index + 1} of ${questions.length}` : 'Preparing quiz…'} subtitle="Materials and navigation remain locked until submission." testID="locked-assessment">
      {question ? <><View style={styles.track}><View style={[styles.fill, { width: `${((index + 1) / questions.length) * 100}%` }]} /></View><PressableCard style={styles.question}><Text style={styles.concept}>{question.concept}</Text><Text style={styles.prompt}>{question.prompt}</Text></PressableCard><View style={{ gap: spacing.sm }}>{question.choices.map((choice, choiceIndex) => <Pressable key={`${choiceIndex}-${choice}`} onPress={() => setPicked(choiceIndex)} style={[styles.choice, picked === choiceIndex && styles.choicePicked]}><Text style={[styles.letter, picked === choiceIndex && styles.letterPicked]}>{String.fromCharCode(65 + choiceIndex)}</Text><Text style={styles.choiceText}>{choice}</Text></Pressable>)}</View><PrimaryButton label={index === questions.length - 1 ? 'Submit assessment' : 'Next question'} onPress={next} disabled={picked == null} loading={submitting} style={{ marginTop: spacing.lg }} /></> : null}
      {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text>{questions.length === 0 ? <PrimaryButton label="Back to tasks" onPress={() => router.replace('/child/tasks' as any)} variant="secondary" style={{ marginTop: spacing.md }} /> : null}</View> : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  track: { height: 7, borderRadius: 999, backgroundColor: colors.surfaceTertiary, overflow: 'hidden', marginBottom: spacing.lg }, fill: { height: '100%', borderRadius: 999, backgroundColor: colors.orange }, question: { padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg }, concept: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1, color: colors.orange }, prompt: { marginTop: spacing.sm, fontSize: 19, lineHeight: 27, fontWeight: '800', color: colors.onSurface }, choice: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, choicePicked: { borderColor: colors.brand, backgroundColor: colors.brandSoft }, letter: { width: 32, height: 32, borderRadius: 10, textAlign: 'center', textAlignVertical: 'center', backgroundColor: colors.surfaceTertiary, color: colors.onSurface, fontWeight: '800' }, letterPicked: { backgroundColor: colors.brand, color: '#FFF' }, choiceText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.onSurface, fontWeight: '600' }, errorBox: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary }, error: { color: '#8A3B18', fontSize: 13, lineHeight: 19 }, result: { alignItems: 'center', padding: spacing.xl, borderWidth: 1, borderColor: colors.border }, resultIcon: { width: 58, height: 58, borderRadius: 19, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }, score: { marginTop: spacing.md, fontSize: 38, fontWeight: '800', color: colors.onSurface }, resultText: { marginTop: 4, textAlign: 'center', color: colors.onSurfaceMuted, fontSize: 13, lineHeight: 19 },
});
