import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import ScreenShell from '@/src/components/ScreenShell';
import PressableCard from '@/src/components/PressableCard';
import BlobBackground from '@/src/components/BlobBackground';
import { useAccount } from '@/src/hooks/use-account';
import { FamilyChild, listFamilyChildren } from '@/src/api/auth';
import { colors, shadow, spacing } from '@/src/theme';

export default function ParentHome() {
  const router = useRouter(); const account = useAccount(); const name = account?.name ?? 'Parent';
  const [children, setChildren] = useState<FamilyChild[]>([]);
  useFocusEffect(useCallback(() => { listFamilyChildren().then((rows) => setChildren(rows.filter((row) => row.status === 'approved'))).catch(() => setChildren([])); }, []));
  return <ScreenShell greeting="Family dashboard" title={`Hello, ${name}`} subtitle="Linked learners will appear here." right={<View style={styles.avatar}><Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text></View>} testID="parent-home">
    <PressableCard style={styles.hero} onPress={() => router.push('/parent/analytics' as any)}><View style={styles.heroBlob} pointerEvents="none"><BlobBackground colorA={colors.brandSoft} colorB={colors.yellowSoft} width={200} height={180} /></View><Text style={styles.heroEyebrow}>FAMILY OVERVIEW</Text><Text style={styles.heroTitle}>{children.length} learner{children.length === 1 ? '' : 's'}{`\n`}linked</Text><Text style={styles.heroDesc}>{children.length ? 'Assignments and verified progress stay scoped to your family.' : 'Share your invite code to connect a child account.'}</Text></PressableCard>
    <View style={styles.sectionRow}><Text style={styles.section}>Your Children</Text><Text style={styles.sectionAction} onPress={() => router.push('/parent/students' as any)}>Manage</Text></View>
    <PressableCard style={styles.empty} onPress={() => router.push('/parent/students' as any)}><Text style={styles.emptyTitle}>{children.length ? children.map((item) => item.child.name).join(', ') : 'No children linked yet'}</Text><Text style={styles.emptyText}>{children.length ? 'Open Students to manage verified family links.' : 'Open Students to share your parent invite code.'}</Text></PressableCard>
    <Text style={styles.section}>Recent Activity</Text><View style={styles.empty}><Text style={styles.emptyText}>Activity will appear after a linked learner completes a real task or session.</Text></View>
  </ScreenShell>;
}
const styles=StyleSheet.create({avatar:{width:42,height:42,borderRadius:999,backgroundColor:colors.brand,alignItems:'center',justifyContent:'center',...shadow.card},avatarText:{color:'#FFF',fontWeight:'800'},hero:{padding:spacing.lg,minHeight:150,borderWidth:1,borderColor:colors.border,overflow:'hidden',marginBottom:spacing.lg},heroBlob:{position:'absolute',top:-20,right:-20},heroEyebrow:{fontSize:10,fontWeight:'800',letterSpacing:1.5,color:colors.brandDeep},heroTitle:{marginTop:6,fontSize:22,fontWeight:'800',color:colors.onSurface,lineHeight:28},heroDesc:{marginTop:6,fontSize:13,color:colors.onSurfaceMuted},sectionRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:spacing.md,marginTop:spacing.md},section:{fontSize:17,fontWeight:'800',color:colors.onSurface,marginBottom:spacing.md,marginTop:spacing.md},sectionAction:{color:colors.brandDeep,fontWeight:'700',fontSize:13},empty:{padding:spacing.lg,backgroundColor:colors.surfaceSecondary,borderWidth:1,borderColor:colors.border,borderRadius:16},emptyTitle:{fontSize:15,fontWeight:'800',color:colors.onSurface},emptyText:{fontSize:13,color:colors.onSurfaceMuted,lineHeight:19,marginTop:4}});
