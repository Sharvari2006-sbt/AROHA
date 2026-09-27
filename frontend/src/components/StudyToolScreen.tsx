import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';

import BackButton from '@/src/components/BackButton';
import PressableCard from '@/src/components/PressableCard';
import PrimaryButton from '@/src/components/PrimaryButton';
import ScreenShell from '@/src/components/ScreenShell';
import { getUserId, twinChat } from '@/src/api/twin';
import { colors, radius, spacing } from '@/src/theme';

const TITLES: Record<string, [string, string]> = {
  focus: ['Focus Timer', 'Choose the exact time you need for one task.'],
  chat: ['Chat with Reo', 'Ask Reo about your study patterns or an academic doubt.'],
  sudoku: ['Sudoku', 'Train focused reasoning at your own level.'],
};

export default function StudyToolScreen() {
  const { mode = 'focus' } = useLocalSearchParams<{ mode: string }>();
  const safeMode = mode in TITLES ? mode : 'focus';
  const [title, subtitle] = TITLES[safeMode];
  return <ScreenShell greeting="STUDY" title={title} subtitle={subtitle} right={<BackButton />} testID={`student-tool-${safeMode}`}>
    {safeMode === 'chat' ? <Chat /> : safeMode === 'sudoku' ? <Sudoku /> : <FocusTimer />}
  </ScreenShell>;
}

function FocusTimer() {
  const [minutesInput, setMinutesInput] = useState('25');
  const [totalSeconds, setTotalSeconds] = useState(25 * 60);
  const [seconds, setSeconds] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running || seconds <= 0) return;
    const timer = setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [running, seconds]);
  useEffect(() => { if (seconds === 0) setRunning(false); }, [seconds]);
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  const chosenMinutes = Number.parseInt(minutesInput, 10);
  const durationValid = Number.isFinite(chosenMinutes) && chosenMinutes >= 1 && chosenMinutes <= 600;
  const setDuration = (value: string) => {
    const clean = value.replace(/\D/g, '').slice(0, 3);
    setMinutesInput(clean);
    const parsed = Number.parseInt(clean, 10);
    if (!running && Number.isFinite(parsed) && parsed >= 1 && parsed <= 600) {
      setTotalSeconds(parsed * 60);
      setSeconds(parsed * 60);
    }
  };
  const toggle = () => {
    if (!durationValid) return;
    if (seconds === 0) {
      setSeconds(totalSeconds);
      setRunning(true);
      return;
    }
    setRunning((value) => !value);
  };
  const reset = () => {
    if (!durationValid) return;
    const next = chosenMinutes * 60;
    setRunning(false);
    setTotalSeconds(next);
    setSeconds(next);
  };
  return <>
    <View style={styles.timerDurationRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.timerDurationLabel}>FOCUS DURATION</Text>
        <Text style={styles.timerDurationHint}>Enter exact minutes</Text>
      </View>
      <View style={[styles.timerDurationField, running && styles.timerDurationFieldDisabled]}>
        <TextInput value={minutesInput} onChangeText={setDuration} editable={!running} keyboardType="number-pad" maxLength={3} selectTextOnFocus style={styles.timerDurationInput} testID="focus-duration" />
        <Text style={styles.timerDurationUnit}>min</Text>
      </View>
    </View>
    <PressableCard style={styles.timerCard}>
      <Text style={styles.eyebrow}>{seconds === 0 ? 'SESSION COMPLETE' : running ? 'FOCUSING' : 'READY WHEN YOU ARE'}</Text>
      <Text style={styles.timer}>{mm}:{ss}</Text>
      <View style={styles.progress}><View style={[styles.progressFill, { width: `${((totalSeconds - seconds) / Math.max(totalSeconds, 1)) * 100}%` }]} /></View>
    </PressableCard>
    {!durationValid ? <Text style={styles.timerError}>Enter between 1 and 600 minutes.</Text> : null}
    <PrimaryButton label={running ? 'Pause' : seconds === 0 ? 'Start again' : 'Start focus'} onPress={toggle} disabled={!durationValid} testID="focus-toggle" />
    <PrimaryButton label={`Reset to ${durationValid ? chosenMinutes : 0}:00`} variant="secondary" onPress={reset} disabled={!durationValid} style={{ marginTop: spacing.sm }} testID="focus-reset" />
  </>;
}

function Chat() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ from: 'me' | 'twin'; text: string }[]>([
    { from: 'twin', text: "Hey, I'm Reo. How's your day going? We can talk about studying, a doubt, or anything you're working through." },
  ]);
  const [loading, setLoading] = useState(false);
  const send = async () => {
    const question = input.trim();
    if (!question || loading) return;
    setInput(''); setMessages((current) => [...current, { from: 'me', text: question }]); setLoading(true);
    try {
      const uid = await getUserId();
      const reply = await twinChat(uid, question, messages);
      setMessages((current) => [...current, { from: 'twin', text: reply }]);
    } catch (reason) {
      setMessages((current) => [...current, { from: 'twin', text: reason instanceof Error ? reason.message : 'I could not load your study history just now.' }]);
    } finally { setLoading(false); }
  };
  const suggestions = ['How is my consistency?', 'When do I lose focus?', 'Which subject needs attention?'];
  return <>
    <View style={styles.suggestions}>{suggestions.map((suggestion) => <Pressable key={suggestion} onPress={() => setInput(suggestion)} style={styles.suggestion}><Text style={styles.suggestionText}>{suggestion}</Text></Pressable>)}</View>
    <View style={styles.chat}>{messages.map((message, index) => <View key={`${index}-${message.text}`} style={[styles.bubble, message.from === 'me' ? styles.mine : styles.theirs]}>{message.from === 'twin' ? <Text style={styles.chatName}>REO</Text> : null}<Text style={styles.bubbleText}>{message.text}</Text></View>)}{loading ? <Text style={styles.muted}>Reo is checking your study history…</Text> : null}</View>
    <TextInput value={input} onChangeText={setInput} placeholder="Message Reo…" placeholderTextColor={colors.onSurfaceMuted} multiline style={styles.input} testID="chat-input" />
    <PrimaryButton label="Send" onPress={send} disabled={!input.trim() || loading} loading={loading} testID="chat-send" />
  </>;
}

type Level = 'Beginner' | 'Intermediate' | 'Expert';
const BASE_SOLUTION = '534678912672195348198342567859761423426853791713924856961537284287419635345286179';
const PUZZLES: Record<Level, string[]> = {
  Beginner: [
    '034008910602000308190040567809760023400003790703920006061530200087419030340080009',
    '034000912600090008098002507059061003006800001710924006960000280280410030300200079',
    '530600912072100048090302060050761000420050791700024850001000280007000005300000000',
  ],
  Intermediate: [
    '004000002000095340190302500859760020006053090000900006001507200007000600000280009',
    '004608012600095000090300007000000420020003001000004800061037280000000635005200100',
    '004608000000005348090002000009000020000050701700900850900007204007000005340006009',
  ],
  Expert: [
    '004608010070090000008000007809000000020053000000004056000500280200010035000080109',
    '030000012070005000008002000050760000000803000710000850900507204000400030000000109',
    '000000900600005040008302000000701023400000700000024000901537000080000600040000070',
  ],
};

function shiftDigits(value: string, amount: number): string {
  return value.replace(/[1-9]/g, (digit) => String(((Number(digit) - 1 + amount * 3) % 9) + 1));
}

function peers(a: number, b: number): boolean {
  const ar = Math.floor(a / 9); const ac = a % 9; const br = Math.floor(b / 9); const bc = b % 9;
  return ar === br || ac === bc || (Math.floor(ar / 3) === Math.floor(br / 3) && Math.floor(ac / 3) === Math.floor(bc / 3));
}

function emptyNotes(): number[][] {
  return Array.from({ length: 81 }, () => [] as number[]);
}

function Sudoku() {
  const { width } = useWindowDimensions();
  const [level, setLevel] = useState<Level>('Beginner');
  const [game, setGame] = useState(0);
  const puzzle = useMemo(() => shiftDigits(PUZZLES[level][game % PUZZLES[level].length], game % 3), [game, level]);
  const solution = useMemo(() => shiftDigits(BASE_SOLUTION, game % 3), [game]);
  const givens = useMemo(() => puzzle.split(''), [puzzle]);
  const [board, setBoard] = useState<string[]>(givens);
  const [notes, setNotes] = useState<number[][]>(emptyNotes);
  const [selected, setSelected] = useState<number | null>(null);
  const [complete, setComplete] = useState(false);
  const [noteMode, setNoteMode] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [hints, setHints] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => { setBoard(givens); setNotes(emptyNotes()); setSelected(null); setComplete(false); setNoteMode(false); setMistakes(0); setHints(0); setElapsed(0); setPaused(false); }, [givens]);
  useEffect(() => {
    if (paused || complete) return;
    const timer = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [complete, paused]);
  const gridSize = Math.min(width - spacing.lg * 4, 378);
  const place = (value: string) => {
    if (selected == null || givens[selected] !== '0' || complete || paused) return;
    if (noteMode && value !== '0') {
      setNotes((current) => current.map((cell, index) => index === selected ? (cell.includes(Number(value)) ? cell.filter((item) => item !== Number(value)) : [...cell, Number(value)].sort()) : cell));
      return;
    }
    const updated = [...board]; updated[selected] = value; setBoard(updated);
    setNotes((current) => current.map((cell, index) => index === selected ? [] : cell));
    if (value !== '0' && value !== solution[selected]) setMistakes((count) => count + 1);
    if (value === solution[selected]) {
      setNotes((current) => current.map((cell, index) => peers(selected, index) ? cell.filter((item) => item !== Number(value)) : cell));
    }
    if (updated.join('') === solution) setComplete(true);
  };
  const hint = () => {
    if (hints >= 3 || complete || paused) return;
    const target = selected != null && givens[selected] === '0' && board[selected] !== solution[selected] ? selected : board.findIndex((value, index) => givens[index] === '0' && value !== solution[index]);
    if (target < 0) return;
    const updated = [...board]; updated[target] = solution[target]; setBoard(updated); setSelected(target); setHints((value) => value + 1);
    setNotes((current) => current.map((cell, index) => index === target || peers(target, index) ? cell.filter((item) => item !== Number(solution[target])) : cell));
    if (updated.join('') === solution) setComplete(true);
  };
  const reset = () => { setBoard(givens); setNotes(emptyNotes()); setSelected(null); setComplete(false); setMistakes(0); setHints(0); setElapsed(0); setPaused(false); };
  const chooseLevel = (next: Level) => { setLevel(next); setGame(0); };
  const clock = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
  return <>
    <View style={styles.levels}>{(['Beginner', 'Intermediate', 'Expert'] as Level[]).map((item) => <Pressable key={item} onPress={() => chooseLevel(item)} style={[styles.level, level === item && styles.levelActive]}><Text style={[styles.levelText, level === item && styles.levelTextActive]}>{item}</Text></Pressable>)}</View>
    <View style={styles.gameStatus}><Text style={styles.statusText}>{clock}</Text><Text style={styles.statusText}>Mistakes {mistakes}</Text><Text style={styles.statusText}>Hints {3 - hints}</Text></View>
    <Text style={styles.playInstruction}>{selected == null ? 'Select one empty cell, then tap one number.' : givens[selected] !== '0' ? 'That is a fixed clue. Select an empty cell.' : noteMode ? 'Notes are on: the number will be added only as a candidate.' : 'Selected cell ready: the number will be entered only here.'}</Text>
    <View style={[styles.sudoku, { width: gridSize, height: gridSize }]} testID="sudoku-grid">
      {board.map((value, index) => {
        const row = Math.floor(index / 9); const column = index % 9; const fixed = givens[index] !== '0'; const wrong = value !== '0' && value !== solution[index]; const related = selected != null && peers(selected, index);
        return <Pressable key={index} testID={`sudoku-cell-${index}`} accessibilityLabel={`Sudoku row ${row + 1}, column ${column + 1}${fixed ? ', fixed' : ''}`} onPress={() => !paused && setSelected(index)} style={[styles.cell, column % 3 === 0 && styles.boxLeft, row % 3 === 0 && styles.boxTop, column === 8 && styles.boxRight, row === 8 && styles.boxBottom, related && styles.cellRelated, selected === index && styles.cellSelected, wrong && styles.cellConflict]}>{value === '0' && notes[index].length ? <Text style={styles.noteText}>{[1,2,3,4,5,6,7,8,9].map((number) => notes[index].includes(number) ? number : ' ').reduce((text, item, noteIndex) => text + item + (noteIndex % 3 === 2 && noteIndex < 8 ? '\n' : ' '), '')}</Text> : <Text style={[styles.cellText, fixed && styles.fixedText, wrong && styles.conflictText]}>{value === '0' ? '' : value}</Text>}</Pressable>;
      })}
      {paused ? <Pressable onPress={() => setPaused(false)} style={styles.pauseOverlay}><Feather name="play" size={28} color="#FFF" /><Text style={styles.pauseText}>Resume</Text></Pressable> : null}
    </View>
    {complete ? <PressableCard style={styles.complete}><Feather name="award" size={20} color={colors.brandDeep} /><Text style={styles.completeText}>{level} Sudoku complete!</Text></PressableCard> : null}
    <View style={styles.numberPad}>{['1','2','3','4','5','6','7','8','9'].map((number) => { const used = solution.split('').every((value, index) => value !== number || board[index] === number); return <Pressable key={number} testID={`sudoku-number-${number}`} accessibilityLabel={`Enter ${number}`} disabled={used || paused} onPress={() => place(number)} style={[styles.number, used && styles.numberUsed]}><Text style={styles.numberText}>{number}</Text></Pressable>; })}</View>
    <View style={styles.toolRow}>
      <Pressable onPress={() => place('0')} style={styles.tool}><Feather name="delete" size={17} color={colors.onSurface} /><Text style={styles.toolText}>Erase</Text></Pressable>
      <Pressable onPress={() => setNoteMode((value) => !value)} style={[styles.tool, noteMode && styles.toolActive]}><Feather name="edit-3" size={17} color={colors.onSurface} /><Text style={styles.toolText}>Notes {noteMode ? 'On' : 'Off'}</Text></Pressable>
      <Pressable onPress={hint} disabled={hints >= 3} style={[styles.tool, hints >= 3 && styles.numberUsed]}><Feather name="zap" size={17} color={colors.onSurface} /><Text style={styles.toolText}>Hint</Text></Pressable>
      <Pressable onPress={() => setPaused((value) => !value)} style={styles.tool}><Feather name={paused ? 'play' : 'pause'} size={17} color={colors.onSurface} /><Text style={styles.toolText}>{paused ? 'Resume' : 'Pause'}</Text></Pressable>
    </View>
    <View style={styles.actions}><PrimaryButton label="Restart" variant="secondary" onPress={reset} style={{ flex: 1 }} /><PrimaryButton label="New puzzle" onPress={() => setGame((value) => value + 1)} style={{ flex: 1 }} /></View>
    <Text style={styles.sudokuHint}>Every puzzle has one verified solution. Wrong entries are marked red; use Notes to add candidates without committing an answer.</Text>
  </>;
}

const styles = StyleSheet.create({
  timerDurationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }, timerDurationLabel: { fontSize: 10, letterSpacing: 1.2, fontWeight: '800', color: colors.brandDeep }, timerDurationHint: { marginTop: 3, fontSize: 12, color: colors.onSurfaceMuted }, timerDurationField: { minWidth: 104, height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: '#FFF', borderWidth: 1, borderColor: colors.brand }, timerDurationFieldDisabled: { opacity: 0.55 }, timerDurationInput: { minWidth: 44, padding: 0, textAlign: 'right', fontSize: 19, fontWeight: '800', color: colors.onSurface, fontVariant: ['tabular-nums'] }, timerDurationUnit: { marginLeft: 5, fontSize: 12, fontWeight: '700', color: colors.onSurfaceMuted }, timerError: { marginTop: -spacing.sm, marginBottom: spacing.sm, fontSize: 12, fontWeight: '600', color: '#8A3B18' }, timerCard: { padding: spacing.xl, alignItems: 'center', borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md }, eyebrow: { fontSize: 10, letterSpacing: 1.5, fontWeight: '800', color: colors.brandDeep }, timer: { fontSize: 58, fontWeight: '800', color: colors.onSurface, marginVertical: spacing.lg, fontVariant: ['tabular-nums'] }, progress: { height: 8, width: '100%', borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, overflow: 'hidden' }, progressFill: { height: '100%', backgroundColor: colors.orange }, suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: spacing.md }, suggestion: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.brandSoft }, suggestionText: { fontSize: 11, color: colors.onSurface, fontWeight: '700' }, chat: { gap: spacing.sm, marginBottom: spacing.md }, bubble: { padding: spacing.md, borderRadius: radius.lg, maxWidth: '88%' }, mine: { alignSelf: 'flex-end', backgroundColor: colors.brandSoft }, theirs: { alignSelf: 'flex-start', backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }, chatName: { marginBottom: 4, color: colors.brandDeep, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 }, bubbleText: { color: colors.onSurface, fontSize: 14, lineHeight: 20 }, muted: { color: colors.onSurfaceMuted, fontSize: 12 }, input: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, minHeight: 64, color: colors.onSurface, fontSize: 14, marginBottom: spacing.sm, textAlignVertical: 'top' },
  levels: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }, level: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 999, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }, levelActive: { backgroundColor: colors.brand, borderColor: colors.brand }, levelText: { fontSize: 11, fontWeight: '700', color: colors.onSurface }, levelTextActive: { color: '#FFF' }, gameStatus: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5, paddingHorizontal: spacing.xs }, statusText: { fontSize: 11, fontWeight: '700', color: colors.onSurfaceMuted, fontVariant: ['tabular-nums'] }, playInstruction: { marginBottom: spacing.sm, textAlign: 'center', fontSize: 10, lineHeight: 14, fontWeight: '700', color: colors.brandDeep }, sudoku: { position: 'relative', alignSelf: 'center', flexDirection: 'row', flexWrap: 'wrap', backgroundColor: colors.surface }, cell: { width: '11.1111%', height: '11.1111%', alignItems: 'center', justifyContent: 'center', borderLeftWidth: StyleSheet.hairlineWidth, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.onSurfaceMuted }, boxLeft: { borderLeftWidth: 1.5, borderLeftColor: colors.onSurface }, boxTop: { borderTopWidth: 1.5, borderTopColor: colors.onSurface }, boxRight: { borderRightWidth: 1.5, borderRightColor: colors.onSurface }, boxBottom: { borderBottomWidth: 1.5, borderBottomColor: colors.onSurface }, cellRelated: { backgroundColor: '#F3F4EF' }, cellSelected: { backgroundColor: colors.yellowSoft, borderWidth: 2, borderColor: colors.orange }, cellConflict: { backgroundColor: '#F9DFD7' }, cellText: { fontSize: 17, fontWeight: '600', color: colors.brandDeep }, fixedText: { fontWeight: '800', color: colors.onSurface }, conflictText: { color: '#A13D2C' }, noteText: { fontSize: 7, lineHeight: 8, letterSpacing: 1.5, color: colors.brandDeep, textAlign: 'center', fontVariant: ['tabular-nums'] }, pauseOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 10, backgroundColor: 'rgba(41,37,31,0.86)', alignItems: 'center', justifyContent: 'center' }, pauseText: { color: '#FFF', fontSize: 14, fontWeight: '800', marginTop: 6 }, numberPad: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md }, number: { width: 32, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }, numberUsed: { opacity: 0.3 }, numberText: { fontSize: 16, fontWeight: '800', color: colors.onSurface }, toolRow: { flexDirection: 'row', gap: 6, marginTop: spacing.md }, tool: { flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }, toolActive: { backgroundColor: colors.yellowSoft, borderColor: colors.yellow }, toolText: { marginTop: 3, fontSize: 9, fontWeight: '700', color: colors.onSurface, textAlign: 'center' }, actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }, complete: { marginTop: spacing.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.brandSoft }, completeText: { fontSize: 13, fontWeight: '800', color: colors.onSurface }, sudokuHint: { marginTop: spacing.md, textAlign: 'center', fontSize: 11, lineHeight: 16, color: colors.onSurfaceMuted },
});
