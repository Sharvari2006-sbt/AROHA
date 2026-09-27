import React, { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import BackButton from '@/src/components/BackButton';
import PressableCard from '@/src/components/PressableCard';
import ScreenShell from '@/src/components/ScreenShell';
import { storage } from '@/src/utils/storage';
import { colors, spacing } from '@/src/theme';

const LABELS: Record<string, [string, string]> = { preferences:['Preferences','Shape how Aroha feels while you learn.'],notifications:['Notifications','Choose the gentle reminders you receive.'],privacy:['Privacy & Data','Control how your learning data is used.'],help:['Help Center','Quick answers for using Aroha.'],about:['About Aroha','A calm Digital Twin for learning.'] };

export default function SettingsSection() {
  const { section = 'preferences' } = useLocalSearchParams<{ section: string }>(); const [title, subtitle] = LABELS[section] ?? LABELS.preferences;
  return <ScreenShell greeting="SETTINGS" title={title} subtitle={subtitle} right={<BackButton />} testID={`settings-${section}`}>{section === 'help' ? <Help /> : section === 'about' ? <About /> : <ToggleList section={section} />}</ScreenShell>;
}

const OPTIONS: Record<string, { id:string; title:string; desc:string; initial:boolean }[]> = {
  preferences:[{id:'haptics',title:'Gentle haptics',desc:'Small feedback when you complete an action.',initial:true},{id:'reducedMotion',title:'Reduce motion',desc:'Use calmer, simpler transitions.',initial:false},{id:'studySounds',title:'Study sounds',desc:'Play subtle focus and completion sounds.',initial:true}],
  notifications:[{id:'daily',title:'Daily learning reminder',desc:'One reminder at your chosen study time.',initial:true},{id:'streak',title:'Streak reminder',desc:'A nudge before a streak is about to end.',initial:true},{id:'parent',title:'Family updates',desc:'Weekly progress notes for linked family.',initial:false}],
  privacy:[{id:'personalise',title:'Personalise my Twin',desc:'Use session patterns for predictions and coaching.',initial:true},{id:'analytics',title:'Usage analytics',desc:'Share anonymous app reliability information.',initial:false}],
};
function ToggleList({ section }:{section:string}) { return <View style={{ gap: spacing.sm }}>{(OPTIONS[section] ?? OPTIONS.preferences).map((x) => <SettingToggle key={x.id} section={section} {...x} />)}</View>; }
function SettingToggle({ section, id, title, desc, initial }:{section:string;id:string;title:string;desc:string;initial:boolean}) { const [value,setValue]=useState(initial); const storageKey=`aroha:setting:${section}:${id}`; useEffect(()=>{storage.getItem(storageKey,initial).then((v)=>setValue(v ?? initial));},[storageKey,initial]); const change=(v:boolean)=>{setValue(v);storage.setItem(storageKey,v);}; return <PressableCard onPress={()=>change(!value)} style={styles.row}><View style={{flex:1}}><Text style={styles.title}>{title}</Text><Text style={styles.desc}>{desc}</Text></View><Switch value={value} onValueChange={change} trackColor={{false:colors.surfaceTertiary,true:colors.brandSoft}} thumbColor={value?colors.brand:colors.onSurfaceMuted} /></PressableCard>; }
function Help() { const [open,setOpen]=useState<number|null>(null); const items=[['How does the Twin learn?','It learns from session timing, goals, focus and distractions. Each subject keeps its own profile.'],['Can I use Aroha offline?','Tasks, quizzes, flashcards and saved reading notes work locally. Twin responses and synced session insights need the server.'],['How do parent invite codes work?','A parent shares the code shown on Students. A child enters it while creating their supervised account.']]; return <View style={{gap:spacing.sm}}>{items.map((x,i)=><PressableCard key={x[0]} onPress={()=>setOpen(open===i?null:i)} style={styles.row}><View style={{flex:1}}><Text style={styles.title}>{x[0]}</Text>{open===i?<Text style={styles.answer}>{x[1]}</Text>:null}</View></PressableCard>)}</View>; }
function About(){return <PressableCard style={styles.about}><Text style={styles.logo}>AROHA</Text><Text style={styles.version}>Version 1.0.0</Text><Text style={styles.answer}>Aroha is a warm learning companion that helps students understand their habits, build calmer study rhythms, and grow with a Digital Twin.</Text></PressableCard>;}
const styles=StyleSheet.create({row:{padding:spacing.md,flexDirection:'row',alignItems:'center',gap:spacing.md,borderWidth:1,borderColor:colors.border},title:{fontSize:14,fontWeight:'800',color:colors.onSurface},desc:{fontSize:12,lineHeight:17,color:colors.onSurfaceMuted,marginTop:3},answer:{fontSize:13,lineHeight:20,color:colors.onSurfaceMuted,marginTop:spacing.sm},about:{padding:spacing.xl,alignItems:'center',borderWidth:1,borderColor:colors.border},logo:{fontSize:26,fontWeight:'800',letterSpacing:4,color:colors.brandDeep},version:{fontSize:11,color:colors.onSurfaceMuted,marginTop:4}});
