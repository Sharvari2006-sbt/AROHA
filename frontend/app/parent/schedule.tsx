import React, { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';

import ScreenShell from '@/src/components/ScreenShell';
import PressableCard from '@/src/components/PressableCard';
import PrimaryButton from '@/src/components/PrimaryButton';
import Input from '@/src/components/Input';
import { FamilyChild, listFamilyChildren } from '@/src/api/auth';
import { createAssignment, createManualQuiz, generateQuiz, listAssignments, ParentQuizQuestion, SupervisedAssignment, uploadMaterial } from '@/src/api/supervised';
import { colors, radius, shadow, spacing } from '@/src/theme';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MATERIAL_KINDS = ['pdf', 'textbook', 'worksheet', 'pyq'] as const;

function startOfWeek(): Date {
  const date = new Date();
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

export default function Schedule() {
  const weekStart = useMemo(startOfWeek, []);
  const todayIndex = Math.max(0, Math.min(6, (new Date().getDay() || 7) - 1));
  const [selectedDay, setSelectedDay] = useState(todayIndex);
  const [assignments, setAssignments] = useState<SupervisedAssignment[]>([]);
  const [children, setChildren] = useState<FamilyChild[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [note, setNote] = useState('');
  const [youtube, setYoutube] = useState('');
  const [manualQuiz, setManualQuiz] = useState('');
  const [childId, setChildId] = useState('');
  const [duration, setDuration] = useState('');
  const [materialKind, setMaterialKind] = useState<(typeof MATERIAL_KINDS)[number]>('pdf');
  const [pickedFiles, setPickedFiles] = useState<{ asset: DocumentPicker.DocumentPickerAsset; kind: (typeof MATERIAL_KINDS)[number] }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const [links, rows] = await Promise.all([listFamilyChildren(), listAssignments()]);
      const approved = links.filter((item) => item.status === 'approved');
      setChildren(approved);
      setAssignments(rows);
      if (!childId && approved[0]) setChildId(approved[0].child.id);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load schedule.'); }
  }, [childId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const dayDate = (index: number) => { const date = new Date(weekStart); date.setDate(date.getDate() + index); return date; };
  const visible = assignments.filter((assignment) => {
    if (!assignment.scheduled_start) return selectedDay === todayIndex;
    return new Date(assignment.scheduled_start).toDateString() === dayDate(selectedDay).toDateString();
  });
  const childName = (id: string) => children.find((item) => item.child.id === id)?.child.name ?? 'Learner';

  const pickMaterial = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], copyToCacheDirectory: true });
    if (!result.canceled) {
      const asset = result.assets[0];
      setPickedFiles((current) => current.some((item) => item.asset.name === asset.name && item.asset.size === asset.size)
        ? current
        : [...current, { asset, kind: materialKind }]);
    }
  };

  const save = async () => {
    if (!childId) return setError('Approve and select a child first.');
    if (title.trim().length < 2 || subject.trim().length < 2) return setError('Enter an assignment title and subject.');
    const durationMinutes = Number.parseInt(duration, 10);
    if (!Number.isFinite(durationMinutes) || durationMinutes < 5 || durationMinutes > 600) return setError('Enter a duration between 5 and 600 minutes.');
    setSaving(true); setError('');
    try {
      const uploadWarnings: string[] = [];
      const parentQuestions: ParentQuizQuestion[] = [];
      if (manualQuiz.trim()) {
        for (const [index, line] of manualQuiz.split('\n').map((value) => value.trim()).filter(Boolean).entries()) {
          const parts = line.split('|').map((value) => value.trim());
          if (parts.length !== 6 || !['A', 'B', 'C', 'D'].includes(parts[5].toUpperCase())) {
            throw new Error(`Quiz line ${index + 1}: use Question | A | B | C | D | correct letter`);
          }
          parentQuestions.push({ prompt: parts[0], choices: parts.slice(1, 5), answer: 'ABCD'.indexOf(parts[5].toUpperCase()), concept: topic.trim() || subject.trim() });
        }
        if (parentQuestions.length < 3) throw new Error('Add at least 3 parent quiz questions, one per line.');
      }
      const materialIds: string[] = [];
      for (const picked of pickedFiles) {
        const form = new FormData();
        form.append('child_id', childId); form.append('title', picked.asset.name); form.append('kind', picked.kind);
        form.append('file', { uri: picked.asset.uri, name: picked.asset.name, type: picked.asset.mimeType || 'application/octet-stream' } as any);
        const uploaded = await uploadMaterial(form);
        materialIds.push(uploaded.id);
        if (uploaded.processing_warning) uploadWarnings.push(`${uploaded.title}: ${uploaded.processing_warning}`);
      }
      if (youtube.trim()) {
        const form = new FormData();
        form.append('child_id', childId); form.append('title', `${title.trim()} video`); form.append('kind', 'youtube'); form.append('source_url', youtube.trim());
        materialIds.push((await uploadMaterial(form)).id);
      }
      const scheduled = dayDate(selectedDay); scheduled.setHours(new Date().getHours() + 1, 0, 0, 0);
      const assignment = await createAssignment({
        child_id: childId, title: title.trim(), subject: subject.trim(), topic: topic.trim() || undefined,
        parent_note: note.trim() || undefined, scheduled_start: scheduled.toISOString(),
        due_at: new Date(scheduled.getTime() + durationMinutes * 60_000).toISOString(), planned_duration_minutes: durationMinutes,
        recurrence: 'none', material_ids: materialIds, quiz_required: materialIds.length > 0 || parentQuestions.length > 0,
      });
      if (parentQuestions.length > 0) await createManualQuiz(assignment.id, parentQuestions);
      else if (materialIds.length > 0 && !youtube.trim()) generateQuiz(assignment.id).catch(() => undefined);
      setShowCreate(false); setTitle(''); setSubject(''); setTopic(''); setNote(''); setYoutube(''); setManualQuiz(''); setPickedFiles([]); setDuration('');
      setNotice(uploadWarnings.length ? `Assignment created. ${uploadWarnings.join(' ')}` : 'Assignment and study material uploaded successfully.');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create assignment.'); }
    finally { setSaving(false); }
  };

  return (
    <ScreenShell greeting="THIS WEEK" title="Schedule" subtitle="A calm plan for your family." testID="parent-schedule">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
        {DAYS.map((day, index) => <Pressable key={day} onPress={() => setSelectedDay(index)} style={[styles.dayChip, index === selectedDay && styles.dayChipActive]} testID={`schedule-day-${index}`}><Text style={[styles.dayChipLabel, index === selectedDay && styles.dayChipLabelActive]}>{day}</Text><Text style={[styles.dayChipNum, index === selectedDay && styles.dayChipNumActive]}>{dayDate(index).getDate()}</Text></Pressable>)}
      </ScrollView>
      <View style={styles.sectionRow}><Text style={styles.section}>{DAYS[selectedDay]} · {selectedDay === todayIndex ? 'Today' : dayDate(selectedDay).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</Text><Pressable onPress={() => setShowCreate(true)}><Text style={styles.add}>+ Add</Text></Pressable></View>
      <View style={{ gap: spacing.sm }}>
        {visible.map((assignment) => <PressableCard key={assignment.id} style={styles.event} testID={`event-${assignment.id}`}><View style={[styles.eventDot, { backgroundColor: colors.brand }]} /><View style={{ flex: 1 }}><Text style={styles.eventTitle}>{assignment.title}</Text><Text style={styles.eventMeta}>{childName(assignment.child_id)} · {assignment.subject}{assignment.topic ? ` · ${assignment.topic}` : ''}</Text></View><View style={styles.eventPill}><Feather name="clock" size={12} color={colors.onSurface} /><Text style={styles.eventPillText}>{assignment.planned_duration_minutes} min</Text></View></PressableCard>)}
        {visible.length === 0 ? <Pressable onPress={() => setShowCreate(true)} style={styles.empty}><Text style={styles.eventMeta}>{children.length ? 'No activities planned. Tap to assign one.' : 'Approve a child from Students before scheduling.'}</Text></Pressable> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <View style={styles.backdrop}><Pressable style={StyleSheet.absoluteFill} onPress={() => setShowCreate(false)} /><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView style={styles.sheet} keyboardShouldPersistTaps="handled"><View style={styles.grabber} /><Text style={styles.modalTitle}>Create assignment</Text>
          <Text style={styles.label}>Child</Text><View style={styles.chips}>{children.map((item) => <Pressable key={item.child.id} onPress={() => setChildId(item.child.id)} style={[styles.chip, childId === item.child.id && styles.chipActive]}><Text style={[styles.chipText, childId === item.child.id && styles.chipTextActive]}>{item.child.name}</Text></Pressable>)}</View>
          <Input label="Assignment" icon="check-square" placeholder="e.g. Read chapter 4" value={title} onChangeText={setTitle} />
          <Input label="Subject" icon="book-open" placeholder="e.g. Physics" value={subject} onChangeText={setSubject} />
          <Input label="Topic" icon="hash" placeholder="Optional topic" value={topic} onChangeText={setTopic} />
          <Input label="Note for student" icon="message-circle" placeholder="Instructions or encouragement" value={note} onChangeText={setNote} />
          <Input label="Duration (minutes)" icon="clock" placeholder="Enter exact minutes" value={duration} onChangeText={(value) => setDuration(value.replace(/\D/g, '').slice(0, 3))} keyboardType="number-pad" maxLength={3} testID="assignment-duration" />
          <Text style={styles.label}>Material type</Text><View style={styles.chips}>{MATERIAL_KINDS.map((kind) => <Pressable key={kind} onPress={() => setMaterialKind(kind)} style={[styles.chip, materialKind === kind && styles.chipActive]}><Text style={[styles.chipText, materialKind === kind && styles.chipTextActive]}>{kind.toUpperCase()}</Text></Pressable>)}</View>
          <PrimaryButton label={`Add ${materialKind.toUpperCase()} file`} onPress={pickMaterial} variant="secondary" style={{ marginTop: spacing.sm }} />
          {pickedFiles.map((picked, index) => <View key={`${picked.asset.name}-${index}`} style={styles.pickedRow}><Text style={styles.pickedText} numberOfLines={1}>{picked.kind.toUpperCase()} · {picked.asset.name}</Text><Pressable onPress={() => setPickedFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Feather name="x" size={16} color={colors.onSurfaceMuted} /></Pressable></View>)}
          <Input label="YouTube video" icon="youtube" placeholder="Optional YouTube link" value={youtube} onChangeText={setYoutube} autoCapitalize="none" />
          <Input label="Parent quiz paper (optional)" icon="edit-3" placeholder={'One per line: Question | A | B | C | D | B\nAdd at least 3 questions'} value={manualQuiz} onChangeText={setManualQuiz} multiline numberOfLines={5} textAlignVertical="top" autoCapitalize="sentences" style={styles.quizInput} />
          {error ? <Text style={styles.error}>{error}</Text> : null}<PrimaryButton label="Assign to student" onPress={save} loading={saving} style={{ marginTop: spacing.md, marginBottom: spacing.xxl }} />
        </ScrollView></KeyboardAvoidingView></View>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  days: { gap: spacing.sm, paddingRight: spacing.lg }, dayChip: { width: 56, height: 72, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', ...shadow.card }, dayChipActive: { backgroundColor: colors.brand, borderColor: colors.brand }, dayChipLabel: { fontSize: 11, fontWeight: '700', color: colors.onSurfaceMuted }, dayChipLabelActive: { color: '#FFF' }, dayChipNum: { marginTop: 4, fontSize: 18, fontWeight: '800', color: colors.onSurface }, dayChipNumActive: { color: '#FFF' },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.md }, section: { fontSize: 17, fontWeight: '800', color: colors.onSurface }, add: { color: colors.brandDeep, fontSize: 13, fontWeight: '800' },
  event: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border }, eventDot: { width: 10, height: 10, borderRadius: 999 }, eventTitle: { fontSize: 14, fontWeight: '800', color: colors.onSurface }, eventMeta: { fontSize: 12, color: colors.onSurfaceMuted, marginTop: 2 }, eventPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surfaceTertiary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill }, eventPillText: { fontSize: 11, fontWeight: '700', color: colors.onSurface }, empty: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }, error: { marginTop: spacing.sm, color: '#8A3B18', fontSize: 12, fontWeight: '600' }, notice: { marginTop: spacing.sm, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.brandSoft, color: colors.onSurface, fontSize: 12, lineHeight: 18, fontWeight: '600' }, quizInput: { height: 110, paddingVertical: spacing.sm }, pickedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary }, pickedText: { flex: 1, fontSize: 12, color: colors.onSurface, fontWeight: '600' },
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }, sheet: { maxHeight: '90%', backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: spacing.lg }, grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 999, backgroundColor: colors.border, marginBottom: spacing.md }, modalTitle: { fontSize: 22, fontWeight: '800', color: colors.onSurface, marginBottom: spacing.md }, label: { marginTop: spacing.md, marginBottom: spacing.sm, fontSize: 13, fontWeight: '700', color: colors.onSurface }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { backgroundColor: colors.surfaceTertiary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border }, chipActive: { backgroundColor: colors.brand, borderColor: colors.brand }, chipText: { fontSize: 12, fontWeight: '700', color: colors.onSurface }, chipTextActive: { color: '#FFF' },
});
