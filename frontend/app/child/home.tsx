import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import ScreenShell from '@/src/components/ScreenShell';
import PressableCard from '@/src/components/PressableCard';
import BlobBackground from '@/src/components/BlobBackground';
import Robot3D from '@/src/components/Robot3D';
import { useAccount } from '@/src/hooks/use-account';
import { getRobotState, RobotState } from '@/src/api/twin';
import { listAssignments } from '@/src/api/supervised';
import { colors, shadow, spacing } from '@/src/theme';

export default function ChildHome() {
  const account=useAccount(); const name=account?.name ?? 'Learner';
  const [robot, setRobot] = useState<RobotState | null>(null); const [quizCount, setQuizCount] = useState(0);
  useFocusEffect(useCallback(() => { if (!account?.id) return; Promise.all([getRobotState(account.id), listAssignments()]).then(([state, tasks]) => { setRobot(state); setQuizCount(tasks.filter((task) => task.quiz_required).length); }).catch(() => undefined); }, [account?.id]));
  const mood = (robot?.inactivity_days ?? 0) >= 3 ? 'worried' : (robot?.daily_xp ?? 0) >= 7 ? 'happy' : (robot?.daily_xp ?? 0) === 0 ? 'sleepy' : 'idle';
  return <ScreenShell greeting={`Hi, ${name}!`} title="Let's play & learn" subtitle="Assigned learning will appear here." right={<View style={styles.avatar}><Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text></View>} testID="child-home">
    <PressableCard style={styles.hero}><View style={styles.heroBlob} pointerEvents="none"><BlobBackground colorA={colors.orangeSoft} colorB={colors.yellowSoft} width={220} height={200} /></View><View style={{flex:1}}><Text style={styles.heroEyebrow}>REO SAYS</Text><Text style={styles.heroTitle}>I&apos;m Reo — ready to{`\n`}learn with you</Text><Text style={styles.heroDesc}>Stage {robot?.stage ?? 1} · {robot?.xp ?? 0} discipline XP · {robot?.streak_days ?? 0}-day streak</Text></View><View style={styles.heroMascot}><Robot3D size={100} stage={(robot?.stage ?? 1) as 1|2|3|4|5} mood={mood} /></View></PressableCard>
    <Text style={styles.section}>My Quizzes</Text><View style={styles.empty}><Text style={styles.emptyTitle}>{quizCount ? `${quizCount} assigned quiz${quizCount === 1 ? '' : 'zes'}` : 'No quizzes assigned'}</Text><Text style={styles.emptyText}>{quizCount ? 'Open Quiz after completing the required study phase.' : 'Generated quizzes will appear after a parent uploads and assigns real study material.'}</Text></View>
    <Text style={styles.section}>Rewards</Text><View style={styles.empty}><Text style={styles.emptyText}>Today: {robot?.daily_xp ?? 0}/{robot?.daily_xp_cap ?? 10} XP. Reo grows through consistent study and verified quiz mastery, never from simply opening the app.</Text></View>
  </ScreenShell>;
}
const styles=StyleSheet.create({avatar:{width:42,height:42,borderRadius:999,backgroundColor:colors.orange,alignItems:'center',justifyContent:'center',...shadow.card},avatarText:{color:'#FFF',fontWeight:'800'},hero:{flexDirection:'row',padding:spacing.lg,minHeight:180,borderWidth:1,borderColor:colors.border,overflow:'hidden',marginBottom:spacing.lg},heroBlob:{position:'absolute',top:-20,right:-20},heroEyebrow:{fontSize:10,fontWeight:'800',letterSpacing:1.5,color:colors.brandDeep},heroTitle:{marginTop:6,fontSize:22,fontWeight:'800',color:colors.onSurface,lineHeight:28},heroDesc:{marginTop:6,fontSize:13,color:colors.onSurfaceMuted,maxWidth:'75%'},heroMascot:{position:'absolute',right:6,bottom:4},section:{fontSize:17,fontWeight:'800',color:colors.onSurface,marginTop:spacing.md,marginBottom:spacing.md},empty:{padding:spacing.lg,backgroundColor:colors.surfaceSecondary,borderWidth:1,borderColor:colors.border,borderRadius:16},emptyTitle:{fontSize:15,fontWeight:'800',color:colors.onSurface},emptyText:{fontSize:13,lineHeight:19,color:colors.onSurfaceMuted,marginTop:4}});
