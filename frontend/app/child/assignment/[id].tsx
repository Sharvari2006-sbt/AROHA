import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, AppStateStatus, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';

import ScreenShell from '@/src/components/ScreenShell';
import PressableCard from '@/src/components/PressableCard';
import PrimaryButton from '@/src/components/PrimaryButton';
import BackButton from '@/src/components/BackButton';
import { getCurrentAccount } from '@/src/api/auth';
import { askAssignmentDoubt, completeAssignmentStudy, getActiveAssessment, getAssignment, getMaterialContent, listAssignmentHighlights, listMaterials, MaterialHighlight, startAssignmentStudy, SupervisedAssignment, SupervisedMaterial, toggleAssignmentHighlight } from '@/src/api/supervised';
import { colors, radius, spacing } from '@/src/theme';
import { beginFocusShieldSession, endFocusShieldSession } from '@/src/native/focus-shield';

function clock(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function AssignmentStudy() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [assignment, setAssignment] = useState<SupervisedAssignment | null>(null);
  const [materials, setMaterials] = useState<SupervisedMaterial[]>([]);
  const [selected, setSelected] = useState<SupervisedMaterial | null>(null);
  const [materialText, setMaterialText] = useState('');
  const [materialLoading, setMaterialLoading] = useState(false);
  const [materialError, setMaterialError] = useState('');
  const [viewed, setViewed] = useState<Set<string>>(new Set());
  const [highlights, setHighlights] = useState<MaterialHighlight[]>([]);
  const [highlightMode, setHighlightMode] = useState(false);
  const [activeSeconds, setActiveSeconds] = useState(0);
  const [backgroundEvents, setBackgroundEvents] = useState(0);
  const [active, setActive] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState('');
  const [doubtOpen, setDoubtOpen] = useState(false);
  const [doubtInput, setDoubtInput] = useState('');
  const [doubtLoading, setDoubtLoading] = useState(false);
  const [doubtMessages, setDoubtMessages] = useState<{ from: 'me' | 'twin'; text: string }[]>([]);
  const stateRef = useRef<AppStateStatus>(AppState.currentState);
  const highlightQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    beginFocusShieldSession().catch(() => false);
    return () => endFocusShieldSession();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setError('');
        if (!id || id === '[id]') throw new Error('Open this study session from an assigned task.');
        const account = await getCurrentAccount();
        if (!account) throw new Error('Please log in again.');
        const activeAssessment = await getActiveAssessment();
        if (activeAssessment.active && activeAssessment.assignment_id) {
          router.replace(`/child/assessment/${activeAssessment.assignment_id}` as any);
          return;
        }
        const found = await getAssignment(id);
        setAssignment(found);
        if (found.quiz_unlocked) {
          router.replace(`/child/assessment/${found.id}` as any);
          return;
        }
        const available = await listMaterials(account.id);
        const assignedMaterials = available.filter((item) => found.material_ids.includes(item.id));
        setMaterials(assignedMaterials);
        if ((found.material_progress ?? 0) >= 1) setViewed(new Set(assignedMaterials.map((item) => item.id)));
        if ((found.active_seconds ?? 0) > 0) setActiveSeconds(found.active_seconds ?? 0);
        setHighlights(await listAssignmentHighlights(found.id));
        await startAssignmentStudy(found.id);
      } catch (e) { setError(e instanceof Error ? e.message : 'Could not open assignment.'); }
    })();
  }, [id, router]);

  useEffect(() => {
    const timer = setInterval(() => { if (active && assignment) setActiveSeconds((value) => value + 1); }, 1000);
    const subscription = AppState.addEventListener('change', (next) => {
      if (stateRef.current === 'active' && next !== 'active') setBackgroundEvents((value) => value + 1);
      stateRef.current = next; setActive(next === 'active');
    });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [active, assignment]);

  const required = (assignment?.planned_duration_minutes ?? 0) * 60;
  const progress = materials.length === 0 ? 1 : viewed.size / materials.length;
  const ready = Boolean(assignment) && activeSeconds >= required && progress >= 1;
  const earlyReady = Boolean(assignment) && !ready && progress >= 1;
  const selectedUrl = selected?.kind === 'youtube' ? selected.source_url || '' : '';
  const readableSegments = useMemo(() => (materialText.match(/[^.!?\n]+[.!?]?/g) || []).map((value) => value.replace(/\s+/g, ' ').trim()).filter(Boolean), [materialText]);
  const selectedHighlights = useMemo(() => new Set(highlights.filter((item) => item.active && item.material_id === selected?.id).map((item) => item.text)), [highlights, selected?.id]);

  const openMaterial = async (material: SupervisedMaterial) => {
    setSelected(material); setMaterialText(''); setMaterialError(''); setError(''); setHighlightMode(false);
    if (material.kind === 'youtube') {
      setViewed((current) => new Set([...current, material.id]));
      return;
    }
    setMaterialLoading(true);
    try {
      const result = await getMaterialContent(material.id);
      setMaterialText(result.content);
      setViewed((current) => new Set([...current, material.id]));
    } catch (e) {
      setMaterialError(e instanceof Error ? e.message : 'This material could not be opened.');
    } finally {
      setMaterialLoading(false);
    }
  };
  const askDoubt = async () => {
    const question = doubtInput.trim();
    if (!assignment || !question || doubtLoading) return;
    const history = doubtMessages;
    setDoubtInput('');
    setDoubtMessages((current) => [...current, { from: 'me', text: question }]);
    setDoubtLoading(true);
    try {
      const result = await askAssignmentDoubt(assignment.id, question, selected?.id ?? null, history);
      setDoubtMessages((current) => [...current, { from: 'twin', text: result.message }]);
    } catch (reason) {
      setDoubtMessages((current) => [...current, { from: 'twin', text: reason instanceof Error ? reason.message : 'I could not check the assigned material just now.' }]);
    } finally { setDoubtLoading(false); }
  };
  const toggleHighlight = (text: string) => {
    if (!assignment || !selected || !highlightMode) return;
    const assignmentId = assignment.id;
    const materialId = selected.id;
    const materialTitle = selected.title;
    const wasActive = highlights.some((item) => item.material_id === materialId && item.text === text && item.active);
    // Give instant visual feedback; persistence continues in the ordered queue.
    setHighlights((current) => wasActive
      ? current.filter((item) => !(item.material_id === materialId && item.text === text))
      : [...current.filter((item) => !(item.material_id === materialId && item.text === text)), {
          id: `pending-${materialId}-${text.slice(0, 24)}`, material_id: materialId,
          material_title: materialTitle, text, active: true,
        }]);
    highlightQueueRef.current = highlightQueueRef.current.then(async () => {
      try {
        const result = await toggleAssignmentHighlight(assignmentId, materialId, text);
        setHighlights((current) => result.active
          ? [...current.filter((item) => !(item.material_id === materialId && item.text === text)), result]
          : current.filter((item) => !(item.material_id === materialId && item.text === text)));
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Could not save this highlight.');
        try { setHighlights(await listAssignmentHighlights(assignmentId)); } catch {}
      }
    });
  };
  const finish = async (studentMarkedDone = false) => {
    if (!assignment) return;
    setFinishing(true); setError('');
    try {
      await highlightQueueRef.current;
      const savedHighlights = await listAssignmentHighlights(assignment.id);
      setHighlights(savedHighlights);
      const result = await completeAssignmentStudy(assignment.id, activeSeconds, progress, backgroundEvents, studentMarkedDone);
      if (!result.study_completed) return setError('Complete the required study time and assigned material first.');
      if (savedHighlights.some((item) => item.active)) {
        Alert.alert('Revision notes saved', 'Your highlighted notes are available in Study > Revision Notes.');
      }
      if (result.quiz_unlocked) router.replace(`/child/assessment/${assignment.id}` as any);
      else if (result.quiz_generation_error) setError(`Reading completed. Quiz needs parent action: ${result.quiz_generation_error}`);
      else router.replace('/child/tasks' as any);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not finish the study phase.'); }
    finally { setFinishing(false); }
  };

  return (
    <ScreenShell greeting="FOCUS MODE" title={assignment?.title ?? 'Assignment'} subtitle={assignment ? `${assignment.subject} · ${assignment.planned_duration_minutes} min planned` : 'Loading assignment…'} right={<BackButton />} testID="assignment-study">
      <PressableCard style={styles.timer}><View style={styles.timerIcon}><Feather name="clock" size={18} color="#FFF" /></View><View><Text style={styles.timerValue}>{clock(activeSeconds)}</Text><Text style={styles.timerMeta}>Active study · need {Math.ceil(required / 60)} minutes</Text></View></PressableCard>
      {assignment?.parent_note ? <PressableCard style={styles.note}><Text style={styles.eyebrow}>PARENT NOTE</Text><Text style={styles.noteText}>{assignment.parent_note}</Text></PressableCard> : null}
      <Text style={styles.section}>Study material</Text>
      <View style={{ gap: spacing.sm }}>{materials.map((material) => <PressableCard key={material.id} onPress={() => openMaterial(material)} style={[styles.material, viewed.has(material.id) && styles.materialViewed]}><View style={styles.materialIcon}><Feather name={material.kind === 'youtube' ? 'youtube' : 'file-text'} size={16} color="#FFF" /></View><View style={{ flex: 1 }}><Text style={styles.materialTitle}>{material.title}</Text><Text style={styles.timerMeta}>{material.kind.toUpperCase()}</Text></View>{viewed.has(material.id) ? <Feather name="check-circle" size={18} color={colors.brandDeep} /> : <Feather name="chevron-right" size={18} color={colors.onSurfaceMuted} />}</PressableCard>)}</View>
      {selected ? <View style={styles.viewer}>
        {selected.kind === 'youtube' && selectedUrl
          ? <WebView source={{ uri: selectedUrl }} javaScriptEnabled allowsFullscreenVideo onError={() => setError('This video could not be displayed inside Focus Mode.')} />
          : materialLoading
            ? <View style={styles.viewerMessage}><Text style={styles.timerMeta}>Loading material…</Text></View>
            : materialText
              ? <ScrollView nestedScrollEnabled contentContainerStyle={styles.document}>{readableSegments.map((segment, index) => <Pressable key={`${index}-${segment.slice(0, 20)}`} disabled={!highlightMode} onPress={() => toggleHighlight(segment)} style={[styles.sentence, selectedHighlights.has(segment) && styles.sentenceHighlighted]}><Text style={styles.documentText}>{segment}</Text></Pressable>)}</ScrollView>
              : <View style={styles.viewerMessage}><Text style={[styles.timerMeta, materialError ? styles.error : null]}>{materialError || 'This material has no readable content.'}</Text></View>}
      </View> : null}
      <View style={styles.studyTools}>
        {selected && selected.kind !== 'youtube' && materialText ? <Pressable onPress={() => setHighlightMode((value) => !value)} style={[styles.studyTool, highlightMode && styles.studyToolActive]}><Feather name={highlightMode ? 'check' : 'edit-3'} size={15} color={highlightMode ? '#FFF' : colors.brandDeep} /><Text style={[styles.studyToolText, highlightMode && styles.studyToolTextActive]}>{highlightMode ? 'Done highlighting' : 'Highlight lines'}</Text></Pressable> : null}
        <Pressable onPress={() => setDoubtOpen((value) => !value)} style={[styles.studyTool, doubtOpen && styles.studyToolActive]}><Feather name={doubtOpen ? 'x' : 'message-circle'} size={15} color={doubtOpen ? '#FFF' : colors.brandDeep} /><Text style={[styles.studyToolText, doubtOpen && styles.studyToolTextActive]}>{doubtOpen ? 'Close Reo' : 'Ask Reo'}</Text></Pressable>
      </View>
      {doubtOpen ? <PressableCard style={styles.doubtCard}>
        <Text style={styles.eyebrow}>ASK REO · MATERIAL-GROUNDED</Text>
        <Text style={styles.doubtHelp}>Ask Reo about the assigned chapter. Reo uses the uploaded material and stays unavailable during the quiz.</Text>
        {doubtMessages.map((message, index) => <View key={`${index}-${message.text}`} style={[styles.doubtBubble, message.from === 'me' ? styles.doubtMine : styles.doubtTwin]}>{message.from === 'twin' ? <Text style={styles.doubtName}>REO</Text> : null}<Text style={styles.doubtText}>{message.text}</Text></View>)}
        {doubtLoading ? <Text style={styles.timerMeta}>Reo is checking the assigned material…</Text> : null}
        <TextInput value={doubtInput} onChangeText={setDoubtInput} placeholder="Ask your doubt…" placeholderTextColor={colors.onSurfaceMuted} multiline style={styles.doubtInput} />
        <PrimaryButton label="Ask" onPress={askDoubt} disabled={!doubtInput.trim() || doubtLoading} loading={doubtLoading} />
      </PressableCard> : null}
      {highlights.length ? <View style={styles.highlightStatus}><Feather name="bookmark" size={14} color={colors.brandDeep} /><Text style={styles.highlightStatusText}>{highlights.length} line{highlights.length === 1 ? '' : 's'} saved for your Revision Notes PDF</Text></View> : null}
      {materials.length === 0 ? <View style={styles.empty}><Text style={styles.timerMeta}>No material attached. Keep this screen active while completing the parent’s instruction.</Text></View> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.completionPanel}>
        <View style={{ flex: 1 }}><Text style={styles.completionTitle}>{ready ? 'Study time complete' : `${Math.max(0, Math.ceil((required - activeSeconds) / 60))} min remaining`}</Text><Text style={styles.completionHint}>{ready ? 'Finish when you are ready for the next step.' : earlyReady ? 'Finished early? You can continue directly to the quiz.' : 'Open every assigned item before finishing early.'}</Text></View>
        {ready ? <View style={styles.completionAction}><PrimaryButton label="Finish" onPress={() => finish(false)} loading={finishing} style={styles.compactButton} /></View> : earlyReady ? <View style={styles.completionAction}><PrimaryButton label="Done reading" onPress={() => finish(true)} loading={finishing} variant="secondary" style={styles.compactButton} /></View> : null}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  timer: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.brandSoft }, timerIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }, timerValue: { fontSize: 26, fontWeight: '800', color: colors.onSurface }, timerMeta: { marginTop: 2, fontSize: 12, color: colors.onSurfaceMuted }, note: { marginTop: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border }, eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, color: colors.brandDeep }, noteText: { marginTop: 6, fontSize: 14, lineHeight: 20, color: colors.onSurface }, section: { marginTop: spacing.lg, marginBottom: spacing.md, fontSize: 17, fontWeight: '800', color: colors.onSurface }, material: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border }, materialViewed: { backgroundColor: colors.brandSoft }, materialIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' }, materialTitle: { fontSize: 14, fontWeight: '800', color: colors.onSurface }, viewer: { height: 380, marginTop: spacing.md, overflow: 'hidden', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: '#FFF' }, viewerMessage: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }, document: { padding: spacing.lg }, sentence: { paddingHorizontal: 4, paddingVertical: 3, borderRadius: 5, marginBottom: 3 }, sentenceHighlighted: { backgroundColor: colors.yellowSoft }, documentText: { fontSize: 14, lineHeight: 22, color: colors.onSurface }, doubtCard: { marginTop: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.border }, doubtHelp: { marginTop: 5, marginBottom: spacing.sm, fontSize: 11, lineHeight: 16, color: colors.onSurfaceMuted }, doubtBubble: { maxWidth: '90%', padding: spacing.sm, borderRadius: radius.md, marginTop: spacing.sm }, doubtMine: { alignSelf: 'flex-end', backgroundColor: colors.brandSoft }, doubtTwin: { alignSelf: 'flex-start', backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }, doubtName: { marginBottom: 3, fontSize: 9, fontWeight: '800', letterSpacing: 1, color: colors.brandDeep }, doubtText: { fontSize: 12, lineHeight: 18, color: colors.onSurface }, doubtInput: { minHeight: 58, marginTop: spacing.sm, marginBottom: spacing.sm, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, color: colors.onSurface, backgroundColor: '#FFF', textAlignVertical: 'top' }, highlights: { marginTop: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border }, highlightItem: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }, highlightMaterial: { fontSize: 10, fontWeight: '800', color: colors.orange }, highlightText: { marginTop: 4, fontSize: 12, lineHeight: 18, color: colors.onSurface }, empty: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary }, error: { marginTop: spacing.md, color: '#8A3B18', fontSize: 12, fontWeight: '600' },
  studyTools: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  studyTool: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  studyToolActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  studyToolText: { fontSize: 12, fontWeight: '700', color: colors.onSurface },
  studyToolTextActive: { color: '#FFF' },
  completionPanel: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.brandSoft, borderWidth: 1, borderColor: colors.border },
  completionTitle: { fontSize: 13, fontWeight: '800', color: colors.onSurface },
  completionHint: { marginTop: 3, fontSize: 11, lineHeight: 16, color: colors.onSurfaceMuted },
  completionAction: { minWidth: 116 },
  compactButton: { height: 42, paddingHorizontal: spacing.md },
  highlightStatus: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.yellowSoft },
  highlightStatusText: { flex: 1, fontSize: 11, fontWeight: '700', color: colors.onSurface },
});
