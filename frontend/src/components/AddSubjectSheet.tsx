import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, KeyboardAvoidingView, Platform } from 'react-native';

import Input from '@/src/components/Input';
import PrimaryButton from '@/src/components/PrimaryButton';
import { colors, radius, shadow, spacing } from '@/src/theme';
import { createSubject } from '@/src/api/twin';

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
  userId: string;
};

const SUGGESTIONS = ['Data Structures', 'Operating Systems', 'Calculus', 'Physics', 'Chemistry', 'DBMS', 'Networks'];

export default function AddSubjectSheet({ visible, onClose, onCreated, userId }: Props) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setErr(null);
    const trimmed = name.trim();
    if (trimmed.length < 2) { setErr('Please enter a subject name.'); return; }
    if (!userId) { setErr('Please try again in a moment.'); return; }
    setSaving(true);
    try {
      await createSubject(userId, trimmed);
      setName('');
      onCreated();
    } catch {
      setErr('Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet} testID="add-subject-sheet">
            <View style={styles.grabber} />
            <Text style={styles.title}>Add a subject</Text>
            <Text style={styles.desc}>Your Digital Twin will build a separate profile for every subject.</Text>

            <Input
              label="Subject name"
              icon="book-open"
              placeholder="e.g. Data Structures"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              testID="new-subject-name"
            />

            <View style={styles.chips}>
              {SUGGESTIONS.map((s) => (
                <Pressable key={s} onPress={() => setName(s)} style={styles.chip} testID={`suggest-${s}`}>
                  <Text style={styles.chipText}>{s}</Text>
                </Pressable>
              ))}
            </View>

            {err ? <Text style={styles.err}>{err}</Text> : null}

            <PrimaryButton label="Add subject" onPress={save} loading={saving} testID="save-subject-btn" style={{ marginTop: spacing.md }} />
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    ...shadow.soft,
  },
  grabber: {
    alignSelf: 'center',
    width: 44, height: 5, borderRadius: 999,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.onSurface },
  desc: { marginTop: spacing.xs, marginBottom: spacing.lg, color: colors.onSurfaceMuted, fontSize: 13, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.sm },
  chip: {
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: radius.pill,
  },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.onSurface },
  err: { marginTop: spacing.sm, color: '#8A3B18', fontSize: 12, fontWeight: '600' },
});
