import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import ProfileScreen from '@/src/components/ProfileScreen';
import { getRobotState, getUserId, listSubjects } from '@/src/api/twin';
import { useAccount } from '@/src/hooks/use-account';

export default function StudentProfile() {
  const account = useAccount();
  const [stats, setStats] = useState({ streak: 0, subjects: 0, xp: 0 });
  useFocusEffect(useCallback(() => { (async () => { try { const uid = await getUserId(); const [subjects, robot] = await Promise.all([listSubjects(uid), getRobotState(uid)]); setStats({ streak: robot.streak_days, subjects: subjects.length, xp: robot.xp }); } catch {} })(); }, []));
  return <ProfileScreen role="student" name={account?.name ?? 'Student'} email={account?.email ?? ''} stats={[{ label: 'Streak', value: `${stats.streak}d` }, { label: 'Subjects', value: String(stats.subjects) }, { label: 'XP', value: String(stats.xp) }]} testID="student-profile" />;
}
