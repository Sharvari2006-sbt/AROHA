import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import BackButton from '@/src/components/BackButton';
import PressableCard from '@/src/components/PressableCard';
import ScreenShell from '@/src/components/ScreenShell';
import { listRevisionNotes, RevisionNote } from '@/src/api/supervised';
import { colors, radius, spacing } from '@/src/theme';

function noteDate(value?: string | null): string {
  if (!value) return 'Saved in Aroha';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Saved in Aroha' : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function RevisionNotes() {
  const router = useRouter();
  const [notes, setNotes] = useState<RevisionNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setNotes(await listRevisionNotes()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load revision notes.'); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return <ScreenShell greeting="MY LIBRARY" title="Revision Notes" subtitle="Your highlighted notes stay safely in Aroha." right={<BackButton />} testID="revision-notes">
    {loading ? <Text style={styles.message}>Loading your notes…</Text> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {!loading && !error && notes.length === 0 ? <View style={styles.empty}><View style={styles.emptyIcon}><Feather name="file-text" size={20} color="#FFF" /></View><Text style={styles.emptyTitle}>No revision notes yet</Text><Text style={styles.message}>Highlight important lines during an assigned reading session. Reo will organise them here.</Text></View> : null}
    <View style={styles.list}>{notes.map((note) => <PressableCard key={note.assignment_id} onPress={() => router.push(`/child/revision/${note.assignment_id}` as any)} style={styles.card} testID={`revision-${note.assignment_id}`}>
      <View style={styles.icon}><Feather name="file-text" size={17} color="#FFF" /></View>
      <View style={{ flex: 1 }}><Text style={styles.subject}>{note.subject}</Text><Text style={styles.title}>{note.topic}</Text><Text style={styles.meta}>{note.highlight_count} highlight{note.highlight_count === 1 ? '' : 's'} · {noteDate(note.updated_at)}</Text></View>
      <Feather name="chevron-right" size={18} color={colors.onSurfaceMuted} />
    </PressableCard>)}</View>
  </ScreenShell>;
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  icon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.orange },
  subject: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: colors.brandDeep, textTransform: 'uppercase' },
  title: { marginTop: 3, fontSize: 14, fontWeight: '800', color: colors.onSurface },
  meta: { marginTop: 4, fontSize: 11, color: colors.onSurfaceMuted },
  empty: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  emptyIcon: { width: 40, height: 40, marginBottom: spacing.sm, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: colors.onSurface },
  message: { marginTop: spacing.sm, fontSize: 12, lineHeight: 18, color: colors.onSurfaceMuted },
  error: { marginBottom: spacing.md, fontSize: 12, fontWeight: '600', color: '#8A3B18' },
});
