import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import ProfileScreen from '@/src/components/ProfileScreen';
import { useAccount } from '@/src/hooks/use-account';
import { getRobotState } from '@/src/api/twin';

export default function ChildProfile() {
  const account = useAccount();
  const [stats, setStats] = useState({ xp: 0, streak: 0, stage: 1 });
  useFocusEffect(useCallback(() => { if (account?.id) getRobotState(account.id).then((robot) => setStats({ xp: robot.xp, streak: robot.streak_days, stage: robot.stage })).catch(() => undefined); }, [account?.id]));
  return <ProfileScreen role="child" name={account?.name ?? 'Learner'} email={account?.email ?? ''} stats={[{ label: 'Stage', value: String(stats.stage) }, { label: 'XP', value: String(stats.xp) }, { label: 'Streak', value: `${stats.streak}d` }]} testID="child-profile" />;
}
