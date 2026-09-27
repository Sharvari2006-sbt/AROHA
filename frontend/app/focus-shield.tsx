import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, AppState, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import BackButton from '@/src/components/BackButton';
import PressableCard from '@/src/components/PressableCard';
import PrimaryButton from '@/src/components/PrimaryButton';
import ScreenShell from '@/src/components/ScreenShell';
import { colors, radius, spacing } from '@/src/theme';
import {
  BlockableApp,
  FocusShieldStatus,
  getFocusShieldStatus,
  getSelectedBlockedApps,
  listBlockableApps,
  openFocusOverlaySettings,
  openFocusUsageSettings,
  saveBlockedApps,
  endFocusShieldSession,
} from '@/src/native/focus-shield';

const EMPTY_STATUS: FocusShieldStatus = { available: false, overlay: false, usageStats: false, notifications: false, allGranted: false };

export default function FocusShieldScreen() {
  const [status, setStatus] = useState<FocusShieldStatus>(EMPTY_STATUS);
  const [apps, setApps] = useState<BlockableApp[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const nextStatus = await getFocusShieldStatus();
      setStatus(nextStatus);
      if (nextStatus.available) {
        // Importing the native module initializes its service. Setup must never
        // enforce blocks; actual study and assessment screens start it.
        endFocusShieldSession();
        setSelected(new Set(getSelectedBlockedApps()));
        setApps(await listBlockableApps());
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') refresh(); });
    return () => sub.remove();
  }, [refresh]);

  const visibleApps = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return apps;
    return apps.filter((app) => `${app.name} ${app.packageName}`.toLowerCase().includes(normalized));
  }, [apps, query]);

  const toggle = (packageName: string) => {
    setSaved(false);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(packageName)) next.delete(packageName); else next.add(packageName);
      return next;
    });
  };

  const save = () => {
    saveBlockedApps([...selected]);
    endFocusShieldSession();
    setSaved(true);
  };

  return (
    <ScreenShell greeting="FOCUS MODE" title="Focus Shield" subtitle="Pause distracting apps only while you study." right={<BackButton />} testID="focus-shield-screen">
      {loading ? <ActivityIndicator color={colors.brandDeep} /> : Platform.OS !== 'android' ? (
        <PressableCard style={styles.info}><Text style={styles.title}>Android first</Text><Text style={styles.body}>The current Focus Shield build supports Android. iPhone support needs Apple Family Controls approval.</Text></PressableCard>
      ) : !status.available ? (
        <PressableCard style={styles.info}><Text style={styles.title}>Install the Aroha development build</Text><Text style={styles.body}>Expo Go cannot control other apps. Your study features still work in Expo Go, but Focus Shield needs the Aroha APK.</Text></PressableCard>
      ) : (
        <>
          <PressableCard style={styles.info}>
            <View style={styles.headingRow}><View style={styles.icon}><Feather name="shield" size={18} color="#FFF" /></View><View style={{ flex: 1 }}><Text style={styles.title}>{status.allGranted ? 'Shield ready' : 'Two permissions needed'}</Text><Text style={styles.body}>{status.allGranted ? 'Selected apps will pause when an Aroha study session begins.' : 'Android asks for these permissions once on this device.'}</Text></View></View>
            <View style={styles.permissionRow}><Text style={styles.permissionText}>Usage access</Text><Text style={[styles.state, status.usageStats && styles.stateReady]}>{status.usageStats ? 'Enabled' : 'Needed'}</Text></View>
            {!status.usageStats ? <PrimaryButton label="Enable usage access" onPress={openFocusUsageSettings} /> : null}
            <View style={styles.permissionRow}><Text style={styles.permissionText}>Display over apps</Text><Text style={[styles.state, status.overlay && styles.stateReady]}>{status.overlay ? 'Enabled' : 'Needed'}</Text></View>
            {!status.overlay ? <PrimaryButton label="Enable display permission" onPress={openFocusOverlaySettings} variant="secondary" /> : null}
          </PressableCard>

          <Text style={styles.section}>Apps to pause</Text>
          <TextInput value={query} onChangeText={setQuery} placeholder="Search installed apps" placeholderTextColor={colors.onSurfaceMuted} style={styles.search} autoCapitalize="none" />
          <View style={styles.list}>
            {visibleApps.map((app) => {
              const checked = selected.has(app.packageName);
              return <Pressable key={app.packageName} onPress={() => toggle(app.packageName)} style={styles.appRow}>
                <View style={[styles.checkbox, checked && styles.checkboxChecked]}>{checked ? <Feather name="check" size={14} color="#FFF" /> : null}</View>
                <View style={{ flex: 1 }}><Text style={styles.appName}>{app.name}</Text><Text style={styles.packageName}>{app.packageName}</Text></View>
              </Pressable>;
            })}
          </View>
          <PrimaryButton label={saved ? 'Saved' : `Save ${selected.size} blocked app${selected.size === 1 ? '' : 's'}`} onPress={save} disabled={saved} style={{ marginTop: spacing.lg }} />
          <Text style={styles.footnote}>For supervised accounts, set this up on the child&apos;s phone with the parent present. Aroha never blocks calling, settings, or emergency access automatically.</Text>
        </>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  info: { padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand },
  title: { fontSize: 16, fontWeight: '800', color: colors.onSurface },
  body: { marginTop: 5, fontSize: 12, lineHeight: 18, color: colors.onSurfaceMuted },
  permissionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.sm },
  permissionText: { fontSize: 13, fontWeight: '700', color: colors.onSurface },
  state: { fontSize: 11, fontWeight: '800', color: colors.orange },
  stateReady: { color: colors.brandDeep },
  section: { marginTop: spacing.lg, marginBottom: spacing.sm, fontSize: 17, fontWeight: '800', color: colors.onSurface },
  search: { height: 48, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: '#FFF', color: colors.onSurface },
  list: { marginTop: spacing.sm, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  appRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: colors.border },
  checkbox: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: '#FFF' },
  checkboxChecked: { backgroundColor: colors.brand, borderColor: colors.brand },
  appName: { fontSize: 13, fontWeight: '700', color: colors.onSurface },
  packageName: { marginTop: 2, fontSize: 9, color: colors.onSurfaceMuted },
  footnote: { marginTop: spacing.md, textAlign: 'center', fontSize: 11, lineHeight: 16, color: colors.onSurfaceMuted },
});
