import React, { useCallback, useState } from 'react';
import { Alert, View, Text, StyleSheet, Share, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

import ScreenShell from '@/src/components/ScreenShell';
import PressableCard from '@/src/components/PressableCard';
import PrimaryButton from '@/src/components/PrimaryButton';
import { decideFamilyLink, FamilyChild, getCurrentAccount, listFamilyChildren, refreshParentInvite, removeFamilyLink } from '@/src/api/auth';
import { colors, shadow, spacing } from '@/src/theme';

export default function Students() {
  const router = useRouter();
  const [code, setCode] = useState('Loading…');
  const [links, setLinks] = useState<FamilyChild[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const [account, rows] = await Promise.all([getCurrentAccount(), listFamilyChildren()]);
      setLinks(rows);
      if (!account) throw new Error('Please log in again.');
      setCode(account.inviteCode || (await refreshParentInvite()).code);
    } catch (e) {
      setCode('Unavailable');
      setError(e instanceof Error ? e.message : 'Could not load students.');
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const decide = async (linkId: string, approved: boolean) => {
    try { await decideFamilyLink(linkId, approved); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not update this request.'); }
  };
  const shareCode = () => code.startsWith('TWIN-')
    ? Share.share({ message: `Join my Aroha family with invite code ${code}` })
    : undefined;
  const remove = (item: FamilyChild) => Alert.alert(
    'Remove linked child?',
    `${item.child.name} will lose access to this family’s assignments. Their account will not be deleted.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try { await removeFamilyLink(item.link_id); await load(); }
        catch (e) { setError(e instanceof Error ? e.message : 'Could not remove this child.'); }
      } },
    ],
  );
  const active = links.filter((item) => item.status === 'approved');
  const pending = links.filter((item) => item.status === 'pending');

  return (
    <ScreenShell greeting="FAMILY" title="Students" subtitle="Everyone genuinely linked to your account." testID="parent-students">
      <PressableCard style={styles.inviteCard} testID="invite-card">
        <View style={styles.inviteIcon}><Feather name="key" size={16} color="#FFF" /></View>
        <View style={{ flex: 1 }}><Text style={styles.inviteTitle}>INVITE CODE</Text><Text style={styles.inviteCode}>{code}</Text></View>
        <PrimaryButton label="Share" onPress={shareCode} disabled={!code.startsWith('TWIN-')} style={{ height: 40, paddingHorizontal: 18 }} testID="share-invite" />
      </PressableCard>

      {pending.map((item) => (
        <PressableCard key={item.link_id} style={styles.studentCard} testID={`pending-${item.link_id}`}>
          <View style={styles.studentIcon}><Feather name="user-plus" size={17} color="#FFF" /></View>
          <View style={{ flex: 1 }}><Text style={styles.emptyTitle}>{item.child.name}</Text><Text style={styles.emptyText}>{item.child.email} · requests access</Text></View>
          <Pressable onPress={() => decide(item.link_id, false)}><Text style={styles.reject}>Reject</Text></Pressable>
          <Pressable onPress={() => decide(item.link_id, true)} style={styles.approve}><Text style={styles.approveText}>Approve</Text></Pressable>
        </PressableCard>
      ))}

      {active.map((item) => (
        <PressableCard key={item.link_id} style={styles.studentCard} onPress={() => router.push(`/parent/student/${item.child.id}` as any)} testID={`linked-${item.child.id}`}>
          <View style={styles.studentIcon}><Feather name="user" size={17} color="#FFF" /></View>
          <View style={{ flex: 1 }}><Text style={styles.emptyTitle}>{item.child.name}</Text><Text style={styles.emptyText}>{item.child.email} · linked</Text></View>
          <Pressable onPress={(event) => { event.stopPropagation(); remove(item); }} hitSlop={8}><Text style={styles.reject}>Remove</Text></Pressable>
          <Feather name="check-circle" size={18} color={colors.brandDeep} />
        </PressableCard>
      ))}

      {links.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>No students linked</Text><Text style={styles.emptyText}>A child will appear after registering with this code and receiving your approval.</Text></View> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  inviteCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.brandSoft, ...shadow.card },
  inviteIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  inviteTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: colors.brandDeep },
  inviteCode: { marginTop: 2, fontSize: 18, fontWeight: '800', color: colors.onSurface, letterSpacing: 2 },
  studentCard: { marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  studentIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  approve: { backgroundColor: colors.brand, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 999 },
  approveText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  reject: { color: colors.onSurfaceMuted, fontSize: 11, fontWeight: '700' },
  empty: { marginTop: spacing.lg, padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: 16 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: colors.onSurface },
  emptyText: { fontSize: 12, lineHeight: 18, color: colors.onSurfaceMuted, marginTop: 2 },
  error: { marginTop: spacing.md, color: '#8A3B18', fontSize: 12, fontWeight: '600' },
});
