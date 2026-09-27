import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { clearUserId, setUserId } from '@/src/api/twin';
import { ACCESS_TOKEN_KEY } from '@/src/api/session-keys';
import { storage } from '@/src/utils/storage';

export type AccountRole = 'student' | 'parent' | 'child';
export type MockAccount = {
  id: string;
  role: AccountRole;
  name: string;
  email: string;
  inviteCode?: string;
  inviteExpiresAt?: string;
  linkStatus?: 'pending' | 'approved' | 'rejected' | 'unlinked';
};

export type FamilyChild = {
  link_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'removed';
  created_at: string;
  child: { id: string; name: string; email: string };
};

const CURRENT_ACCOUNT_KEY = 'aroha:current_account';

export function backendBase(): string {
  const configured = process.env.EXPO_PUBLIC_BACKEND_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  const host = (Constants.expoConfig?.hostUri ?? '').replace(/^https?:\/\//, '').split(':')[0];
  if (host) return `http://${host}:8000`;
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `http://${window.location.hostname}:8000`;
  return 'http://127.0.0.1:8000';
}

export async function getAccessToken(): Promise<string> {
  return (await storage.secureGet(ACCESS_TOKEN_KEY, '')) || '';
}

async function api<T>(path: string, init?: RequestInit, authenticated = false): Promise<T> {
  const token = authenticated ? await storage.secureGet(ACCESS_TOKEN_KEY, '') : '';
  let response: Response;
  try {
    response = await fetch(`${backendBase()}/api${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new Error('Cannot connect to Aroha. Make sure the backend is running.');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { detail?: string };
    throw new Error(body.detail || 'Something went wrong. Please try again.');
  }
  return response.json() as Promise<T>;
}

export async function authenticatedRequest<T>(path: string, init?: RequestInit): Promise<T> {
  return api<T>(path, init, true);
}

export async function authenticatedUpload<T>(path: string, form: FormData): Promise<T> {
  const token = await storage.secureGet(ACCESS_TOKEN_KEY, '');
  let response: Response;
  try {
    response = await fetch(`${backendBase()}/api${path}`, {
      method: 'POST', body: form,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    throw new Error('Cannot connect to Aroha. Make sure the backend is running.');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { detail?: string };
    throw new Error(body.detail || 'Upload failed. Please try again.');
  }
  return response.json() as Promise<T>;
}

async function saveSession(result: { access_token: string; account: MockAccount }): Promise<MockAccount> {
  const tokenSaved = await storage.secureSet(ACCESS_TOKEN_KEY, result.access_token);
  if (!tokenSaved) {
    throw new Error('Could not securely save your login. Please try again.');
  }
  await storage.setItem(CURRENT_ACCOUNT_KEY, JSON.stringify(result.account));
  await setUserId(result.account.id);
  return result.account;
}

export async function registerAccount(
  role: AccountRole,
  name: string,
  email: string,
  password: string,
  inviteCode?: string,
): Promise<MockAccount> {
  const result = await api<{ access_token: string; account: MockAccount }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ role, name, email, password, invite_code: inviteCode || null }),
  });
  return saveSession(result);
}

export async function loginAccount(role: AccountRole, email: string, password: string): Promise<MockAccount> {
  const result = await api<{ access_token: string; account: MockAccount }>('/auth/login', {
    method: 'POST', body: JSON.stringify({ role, email, password }),
  });
  return saveSession(result);
}

export async function getCurrentAccount(): Promise<MockAccount | null> {
  const token = await storage.secureGet(ACCESS_TOKEN_KEY, '');
  if (!token) return null;
  try {
    const account = await api<MockAccount>('/auth/me', undefined, true);
    await storage.setItem(CURRENT_ACCOUNT_KEY, JSON.stringify(account));
    return account;
  } catch {
    return null;
  }
}

export async function listFamilyChildren(): Promise<FamilyChild[]> {
  return api('/family/children', undefined, true);
}

export async function decideFamilyLink(linkId: string, approved: boolean): Promise<void> {
  await api(`/family/links/${linkId}`, { method: 'PATCH', body: JSON.stringify({ approved }) }, true);
}

export async function removeFamilyLink(linkId: string): Promise<void> {
  await api(`/family/links/${linkId}`, { method: 'DELETE' }, true);
}

export async function refreshParentInvite(): Promise<{ code: string; expires_at: string }> {
  return api('/family/invite/refresh', { method: 'POST' }, true);
}

export async function logoutAccount(): Promise<void> {
  await storage.removeItem(CURRENT_ACCOUNT_KEY);
  await storage.secureRemove(ACCESS_TOKEN_KEY);
  await clearUserId();
}
