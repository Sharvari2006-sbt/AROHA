import { Platform } from 'react-native';

type AppBlockerModule = typeof import('expo-app-blocker');

export type BlockableApp = {
  packageName: string;
  name: string;
};

export type FocusShieldStatus = {
  available: boolean;
  overlay: boolean;
  usageStats: boolean;
  notifications: boolean;
  allGranted: boolean;
};

let cachedModule: AppBlockerModule | null | undefined;

function getModule(): AppBlockerModule | null {
  if (Platform.OS !== 'android') return null;
  if (cachedModule !== undefined) return cachedModule;
  try {
    // Expo Go does not contain this native module. Keeping the require lazy lets
    // the rest of Aroha continue to work there while Focus Shield reports that
    // an installed development/production build is required.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedModule = require('expo-app-blocker') as AppBlockerModule;
  } catch {
    cachedModule = null;
  }
  return cachedModule;
}

export function isFocusShieldAvailable(): boolean {
  return getModule() !== null;
}

export async function getFocusShieldStatus(): Promise<FocusShieldStatus> {
  const module = getModule();
  if (!module) return { available: false, overlay: false, usageStats: false, notifications: false, allGranted: false };
  const result = await module.getPermissionStatus();
  const details = result.details.platform === 'android' ? result.details : null;
  return {
    available: true,
    overlay: details?.overlay ?? false,
    usageStats: details?.usageStats ?? false,
    notifications: details?.notifications ?? false,
    // Notifications improve the foreground-service explanation but are not
    // required for the full-screen shield itself. The two enforcement grants
    // are Usage Access and Display over other apps.
    allGranted: (details?.overlay ?? false) && (details?.usageStats ?? false),
  };
}

export async function listBlockableApps(): Promise<BlockableApp[]> {
  const module = getModule();
  if (!module) return [];
  const apps = await module.getInstalledApps();
  return apps
    .filter((app) => app.packageName && app.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getSelectedBlockedApps(): string[] {
  return getModule()?.getBlockedApps() ?? [];
}

export function saveBlockedApps(packageNames: string[]): void {
  getModule()?.setBlockedApps([...new Set(packageNames)]);
}

export function openFocusOverlaySettings(): void {
  const module = getModule();
  module?.stopMonitoring();
  module?.openOverlaySettings();
}

export function openFocusUsageSettings(): void {
  const module = getModule();
  module?.stopMonitoring();
  module?.openUsageStatsSettings();
}

export async function beginFocusShieldSession(): Promise<boolean> {
  const module = getModule();
  if (!module) return false;
  if (module.getBlockedApps().length === 0) {
    module.stopMonitoring();
    return false;
  }
  const status = await module.getPermissionStatus();
  if (status.details.platform !== 'android' || !status.details.overlay || !status.details.usageStats) {
    module.stopMonitoring();
    return false;
  }
  module.configureAndroid({
    overlayTitle: 'Pause, this is study time',
    overlayText: '{appName} is blocked while Reo keeps your focus session active.',
    overlayBackgroundColor: '#FAF8F4',
    overlayTitleColor: '#28231E',
    overlayTextColor: '#6E675F',
    overlayShowSpinner: true,
    overlaySpinnerColor: '#9EB589',
    notificationTitle: 'Aroha Focus Shield',
    notificationText: '{appName} is paused during study time.',
  });
  module.startMonitoring();
  return true;
}

export function endFocusShieldSession(): void {
  getModule()?.stopMonitoring();
}
