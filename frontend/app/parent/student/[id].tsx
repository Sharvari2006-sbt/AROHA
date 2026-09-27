import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';

import BackButton from '@/src/components/BackButton';
import PressableCard from '@/src/components/PressableCard';
import Robot3D from '@/src/components/Robot3D';
import ScreenShell from '@/src/components/ScreenShell';
import { ChildAssignmentReport, ChildSupervisedReport, getChildSupervisedReport } from '@/src/api/supervised';
import { colors, radius, spacing } from '@/src/theme';

const standingLabel: Record<string, string> = {
  ahead: 'Ahead', on_track: 'On track', needs_support: 'Needs support',
  in_progress: 'In progress', not_started: 'Not started', building: 'Learning pattern',
};

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function AssignmentAnalysis({ report, expanded, onPress }: { report: ChildAssignmentReport; expanded: boolean; onPress: () => void }) {
  const quiz = report.quiz;
  return <PressableCard style={styles.report} onPress={onPress}>
    <View style={styles.reportHeader}>
      <View style={{ flex: 1 }}><Text style={styles.reportTitle}>{report.title}</Text><Text style={styles.meta}>{report.subject}{report.topic ? ` · ${report.topic}` : ''}</Text></View>
      <View style={[styles.pill, report.standing === 'needs_support' && styles.pillWarn]}><Text style={styles.pillText}>{standingLabel[report.standing]}</Text></View>
      <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.onSurfaceMuted} />
    </View>
    <View style={styles.reportMetrics}>
      <Metric label="Planned" value={`${report.planned_minutes}m`} />
      <Metric label="Read" value={`${report.actual_minutes}m`} />
      <Metric label="Quiz" value={quiz ? `${quiz.score_percent}%` : '—'} />
    </View>
    {expanded ? <View style={styles.expanded}>
      <Text style={styles.analysisText}>{report.ended_early ? 'Finished reading early' : 'Used the planned study window'} · {report.material_progress}% material opened · {report.study_background_events} study interruption{report.study_background_events === 1 ? '' : 's'}.</Text>
      {quiz ? <>
        <Text style={styles.subheading}>Quiz analysis</Text>
        <Text style={styles.analysisText}>{quiz.score}/{quiz.total} correct · {quiz.background_events} quiz interruption{quiz.background_events === 1 ? '' : 's'} · +{quiz.mastery_xp} verified mastery energy.</Text>
        {Object.entries(quiz.concepts).map(([concept, values]) => <View key={concept} style={styles.conceptRow}><Text style={styles.conceptName}>{concept}</Text><Text style={styles.conceptScore}>{values.correct}/{values.total}</Text></View>)}
        <Text style={styles.subheading}>What went wrong</Text>
        {!quiz.answers_available ? <Text style={styles.analysisText}>This quiz was completed before answer-level reporting was enabled. Its verified score and concept totals are still shown above.</Text> : null}
        {quiz.answers_available && quiz.mistakes.length === 0 ? <Text style={styles.analysisText}>No incorrect answers—excellent mastery.</Text> : null}
        {quiz.mistakes.map((mistake, index) => <View key={`${mistake.question}-${index}`} style={styles.mistake}>
          <Text style={styles.mistakeConcept}>{mistake.concept}</Text><Text style={styles.mistakeQuestion}>{mistake.question}</Text>
          <Text style={styles.wrong}>Answered: {mistake.selected}</Text><Text style={styles.correct}>Correct: {mistake.correct}</Text>
          {mistake.explanation ? <Text style={styles.explanation}>{mistake.explanation}</Text> : null}
        </View>)}
      </> : <Text style={styles.analysisText}>No completed quiz evidence yet.</Text>}
    </View> : null}
  </PressableCard>;
}

export default function StudentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<ChildSupervisedReport | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id || id === '[id]') { setError('Open a linked student from the Students page.'); return; }
    getChildSupervisedReport(id).then(setData).catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load student analysis.'));
  }, [id]);

  const mood = data?.summary.standing === 'ahead' ? 'happy' : data?.summary.standing === 'needs_support' ? 'worried' : 'idle';
  return <ScreenShell greeting="STUDENT OVERVIEW" title={data?.child.name ?? 'Student analysis'} subtitle={data ? 'Verified study behaviour and concept mastery.' : 'Loading verified learner activity…'} right={<BackButton />} testID="parent-student-report">
    {data ? <>
      <PressableCard style={styles.robotCard}>
        <Robot3D mood={mood} stage={Math.max(1, Math.min(5, data.robot.evolution_stage || 1)) as 1 | 2 | 3 | 4 | 5} size={120} />
        <View style={{ flex: 1 }}><Text style={styles.eyebrow}>DIGITAL TWIN SUMMARY · {standingLabel[data.summary.standing]?.toUpperCase()}</Text><Text style={styles.robotText}>{data.summary.robot_message}</Text></View>
      </PressableCard>
      <View style={styles.summaryMetrics}>
        <Metric label="Completed" value={`${data.summary.completed}/${data.summary.assignments}`} />
        <Metric label="Plan / actual" value={`${data.summary.planned_minutes}/${data.summary.actual_minutes}m`} />
        <Metric label="Quiz average" value={data.summary.average_quiz_percent == null ? '—' : `${data.summary.average_quiz_percent}%`} />
      </View>
      <PressableCard style={styles.recommendation}><Text style={styles.eyebrow}>RECOMMENDATION FOR TOMORROW</Text><Text style={styles.robotText}>{data.summary.recommendation}</Text></PressableCard>
      <Text style={styles.section}>Assignments & quizzes</Text>
      <View style={{ gap: spacing.sm }}>{data.reports.map((report) => <AssignmentAnalysis key={report.assignment_id} report={report} expanded={expanded === report.assignment_id} onPress={() => setExpanded((current) => current === report.assignment_id ? null : report.assignment_id)} />)}</View>
      {data.reports.length === 0 ? <View style={styles.empty}><Text style={styles.reportTitle}>No activity yet</Text><Text style={styles.analysisText}>Assigned study and quiz reports will appear here.</Text></View> : null}
    </> : null}
    {error ? <View style={styles.empty}><Text style={styles.reportTitle}>Student unavailable</Text><Text style={styles.analysisText}>{error}</Text></View> : null}
  </ScreenShell>;
}

const styles = StyleSheet.create({
  robotCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.brandSoft }, eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1, color: colors.brandDeep }, robotText: { marginTop: 6, fontSize: 13, lineHeight: 19, color: colors.onSurface }, summaryMetrics: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }, metric: { flex: 1, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }, metricValue: { fontSize: 16, fontWeight: '800', color: colors.onSurface }, metricLabel: { marginTop: 3, fontSize: 10, color: colors.onSurfaceMuted, fontWeight: '600' }, recommendation: { marginTop: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border }, section: { marginTop: spacing.lg, marginBottom: spacing.md, fontSize: 17, fontWeight: '800', color: colors.onSurface }, report: { padding: spacing.md, borderWidth: 1, borderColor: colors.border }, reportHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, reportTitle: { fontSize: 15, fontWeight: '800', color: colors.onSurface }, meta: { marginTop: 3, fontSize: 11, color: colors.onSurfaceMuted }, pill: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.brandSoft }, pillWarn: { backgroundColor: colors.yellowSoft }, pillText: { fontSize: 10, fontWeight: '800', color: colors.onSurface }, reportMetrics: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }, expanded: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }, analysisText: { fontSize: 12, lineHeight: 18, color: colors.onSurfaceMuted }, subheading: { marginTop: spacing.md, marginBottom: spacing.sm, fontSize: 13, fontWeight: '800', color: colors.onSurface }, conceptRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.border }, conceptName: { flex: 1, fontSize: 12, color: colors.onSurface }, conceptScore: { fontSize: 12, fontWeight: '800', color: colors.brandDeep }, mistake: { marginTop: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary }, mistakeConcept: { fontSize: 9, fontWeight: '800', letterSpacing: 1, color: colors.orange }, mistakeQuestion: { marginTop: 5, fontSize: 12, lineHeight: 18, fontWeight: '700', color: colors.onSurface }, wrong: { marginTop: 7, fontSize: 11, color: '#9A4A32' }, correct: { marginTop: 3, fontSize: 11, color: colors.brandDeep, fontWeight: '700' }, explanation: { marginTop: 6, fontSize: 11, lineHeight: 16, color: colors.onSurfaceMuted }, empty: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
});
