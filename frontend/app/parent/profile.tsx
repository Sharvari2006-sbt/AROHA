import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import ProfileScreen from '@/src/components/ProfileScreen';
import { useAccount } from '@/src/hooks/use-account';
import { listFamilyChildren } from '@/src/api/auth';
import { listAssignments } from '@/src/api/supervised';

export default function ParentProfile() {
  const account = useAccount();
  const [stats, setStats] = useState({ children: 0, plans: 0, completed: 0 });
  useFocusEffect(useCallback(() => { Promise.all([listFamilyChildren(), listAssignments()]).then(([links, plans]) => setStats({ children: links.filter((item) => item.status === 'approved').length, plans: plans.length, completed: plans.filter((item) => item.status === 'completed').length })).catch(() => undefined); }, []));
  return <ProfileScreen role="parent" name={account?.name ?? 'Parent'} email={account?.email ?? ''} stats={[{ label: 'Children', value: String(stats.children) }, { label: 'Plans', value: String(stats.plans) }, { label: 'Completed', value: String(stats.completed) }]} testID="parent-profile" />;
}
