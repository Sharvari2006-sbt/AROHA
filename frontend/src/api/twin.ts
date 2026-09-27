import { storage } from '@/src/utils/storage';
import { ACCESS_TOKEN_KEY } from '@/src/api/session-keys';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

function resolveBackendBase(): string {
  const configured = process.env.EXPO_PUBLIC_BACKEND_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');

  // Expo Go publishes the development computer's address in hostUri. Reusing
  // that host means the phone keeps reaching FastAPI after every QR/restart,
  // without somebody having to remember to export an environment variable.
  const expoHostUri = Constants.expoConfig?.hostUri ?? '';
  const expoHost = expoHostUri.replace(/^https?:\/\//, '').split(':')[0];
  if (expoHost) return `http://${expoHost}:8000`;

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `http://${window.location.hostname}:8000`;
  }

  // This is useful for a locally served web build. A physical phone should
  // normally use hostUri above, or EXPO_PUBLIC_BACKEND_URL for tunnel mode.
  return 'http://127.0.0.1:8000';
}

const BASE = resolveBackendBase();
const USER_ID_KEY = 'aroha:user_id';
const CURRENT_ACCOUNT_KEY = 'aroha:current_account';

let cachedUserId: string | null = null;

function makeUserId(): string {
  // A stable pseudo-user for this iteration (mock auth). Real JWT later.
  const rand = Math.random().toString(36).slice(2, 10);
  return `student-${rand}`;
}

export async function getUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId;
  const accountRaw = await storage.getItem(CURRENT_ACCOUNT_KEY, '');
  if (accountRaw) {
    try {
      const account = JSON.parse(accountRaw) as { id?: string };
      if (account.id) {
        cachedUserId = account.id;
        await storage.setItem(USER_ID_KEY, account.id);
        return cachedUserId;
      }
    } catch { /* Invalid legacy account state is cleared below. */ }
  }
  await storage.removeItem(USER_ID_KEY);
  const id = makeUserId();
  cachedUserId = id;
  return id;
}

export async function setUserId(userId: string): Promise<void> {
  cachedUserId = userId;
  await storage.setItem(USER_ID_KEY, userId);
}

export async function clearUserId(): Promise<void> {
  cachedUserId = null;
  await storage.removeItem(USER_ID_KEY);
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    const token = await storage.secureGet(ACCESS_TOKEN_KEY, '');
    res = await fetch(`${BASE}/api${path}`, {
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...init,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'network request failed';
    throw new Error(`Cannot reach Aroha backend at ${BASE} (${detail})`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status} ${path}: ${body}`);
  }
  return (await res.json()) as T;
}

// ---------------- Subjects ----------------
export type TwinProfile = {
  id: string;
  user_id: string;
  subject_id: string;
  sessions_count: number;
  avg_focus_seconds: number;
  avg_duration_seconds: number;
  avg_distraction_point_seconds: number;
  avg_distractions_per_session: number;
  distraction_sessions_count: number;
  post_distraction_completion_rate: number;
  avg_post_distraction_focus_seconds: number;
  goal_completion_rate: number;
  prediction_accuracy: number;
  predictions_count: number;
  consistency_score: number;
  daily_consistency_score: number;
  weekly_consistency_score: number;
  goal_units_ratio: number;
  goal_unit_sessions_count: number;
  last_session_at: string | null;
  updated_at: string;
};

export type Subject = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string;
  created_at: string;
  profile?: TwinProfile;
};

export async function listSubjects(userId: string): Promise<Subject[]> {
  return req(`/subjects?user_id=${encodeURIComponent(userId)}`);
}

export async function createSubject(userId: string, name: string): Promise<Subject> {
  return req('/subjects', { method: 'POST', body: JSON.stringify({ user_id: userId, name }) });
}

export async function getSubject(userId: string, subjectId: string): Promise<{
  subject: Subject;
  profile: TwinProfile;
  recent_sessions: SessionDoc[];
}> {
  return req(`/subjects/${subjectId}?user_id=${encodeURIComponent(userId)}`);
}

// ---------------- Sessions ----------------
export type Prediction = {
  predicted_units: number | null;
  predicted_distraction_point_seconds: number | null;
  predicted_focus_seconds: number | null;
  predicted_completion_probability: number;
  confidence: number;
  is_first_session: boolean;
  has_enough_data: boolean;
  reasoning: string[];
};

export type SessionDoc = {
  id: string;
  user_id: string;
  subject_id: string;
  subject_name: string;
  topic: string | null;
  goal: string;
  goal_units_target: number | null;
  planned_duration_minutes: number;
  planned_duration_seconds: number;
  started_at: string;
  ended_at: string | null;
  active_seconds: number;
  distractions: number;
  breaks: number;
  first_distraction_at: number | null;
  units_done: number | null;
  goal_completed: boolean;
  ended_early: boolean;
  prediction_snapshot: Prediction;
  subject_profile_snapshot?: Pick<TwinProfile, 'sessions_count' | 'avg_focus_seconds' | 'avg_duration_seconds' | 'avg_distraction_point_seconds' | 'avg_distractions_per_session' | 'distraction_sessions_count' | 'post_distraction_completion_rate' | 'avg_post_distraction_focus_seconds' | 'goal_completion_rate' | 'goal_units_ratio' | 'weekly_consistency_score'>;
  events: SessionEvent[];
  energy_delta: number;
  distraction_points?: number[];
  elapsed_seconds?: number;
  total_break_seconds?: number;
  total_background_seconds?: number;
  comparison?: Comparison;
};

export type SessionEvent = {
  kind: 'distraction' | 'break_start' | 'break_end' | 'unit_progress' | 'background' | 'foreground';
  at_seconds: number;
  payload?: Record<string, unknown> | null;
};

export async function predictSession(userId: string, subjectId: string, goal: string, plannedMinutes: number): Promise<{
  prediction: Prediction;
  profile: TwinProfile;
  parsed_goal_units: number | null;
}> {
  return req('/sessions/predict', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, subject_id: subjectId, goal, planned_duration_minutes: plannedMinutes }),
  });
}

export async function startSession(userId: string, subjectId: string, goal: string, plannedMinutes: number, topic?: string): Promise<{ session: SessionDoc }> {
  return req('/sessions', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, subject_id: subjectId, goal, planned_duration_minutes: plannedMinutes, topic }),
  });
}

export type Comparison = {
  predicted_units: number | null;
  actual_units: number | null;
  predicted_focus_minutes: number | null;
  actual_focus_minutes: number;
  predicted_distraction_minute: number | null;
  actual_first_distraction_minute: number | null;
  beat_prediction: boolean;
  goal_completed: boolean;
  ended_early: boolean;
  actual_duration_seconds: number;
  distractions: number;
  distraction_points: number[];
  breaks: number;
  energy_delta: number;
  robot: RobotState;
  stage: { stage: number; stage_progress: number; xp: number; next_stage_xp: number | null };
};

export async function endSession(sessionId: string, body: {
  ended_early: boolean;
  units_done: number | null;
  active_seconds: number;
  elapsed_seconds: number;
  events: SessionEvent[];
}): Promise<{ session: SessionDoc; profile: TwinProfile; comparison: Comparison }> {
  return req(`/sessions/${sessionId}/end`, { method: 'POST', body: JSON.stringify(body) });
}

export async function listSessions(userId: string, subjectId?: string): Promise<SessionDoc[]> {
  const q = new URLSearchParams({ user_id: userId });
  if (subjectId) q.set('subject_id', subjectId);
  return req(`/sessions?${q.toString()}`);
}

export async function getSession(userId: string, sessionId: string): Promise<SessionDoc> {
  return req(`/sessions/${sessionId}?user_id=${encodeURIComponent(userId)}`);
}

// ---------------- Robot ----------------
export type RobotState = {
  id: string;
  user_id: string;
  xp: number;
  streak_days: number;
  last_session_date: string | null;
  updated_at: string;
  stage: number;
  stage_progress: number;
  next_stage_xp: number | null;
  daily_xp?: number;
  daily_xp_cap?: number;
  inactivity_days?: number;
};

export async function getRobotState(userId: string): Promise<RobotState> {
  return req(`/robot/state?user_id=${encodeURIComponent(userId)}`);
}

// ---------------- Voice ----------------
export type VoiceContext =
  | 'greeting'
  | 'pre_session'
  | 'mid_session_encourage'
  | 'distraction_help'
  | 'session_end'
  | 'evolution'
  | 'analytics'
  | 'generic';

export async function twinVoice(context: VoiceContext, facts: Record<string, unknown>, tone: string = 'warm', maxSentences = 2): Promise<string> {
  const res = await req<{ message: string }>('/twin/voice', {
    method: 'POST',
    body: JSON.stringify({ context, facts, tone, max_sentences: maxSentences }),
  });
  return res.message;
}

export async function twinChat(userId: string, question: string, history: { from: 'me' | 'twin'; text: string }[] = []): Promise<string> {
  const res = await req<{ message: string }>('/twin/chat', {
    method: 'POST', body: JSON.stringify({ user_id: userId, question, history: history.slice(-8) }),
  });
  return res.message;
}

// ---------------- Analytics ----------------
export type AnalyticsSummary = {
  total_minutes: number;
  sessions_count: number;
  completed_count: number;
  completion_rate: number;
  active_days: number;
  weekly_consistency: number;
  week: { date: string; seconds: number }[];
};

export async function analyticsSummary(userId: string): Promise<AnalyticsSummary> {
  return req(`/analytics/summary?user_id=${encodeURIComponent(userId)}`);
}
