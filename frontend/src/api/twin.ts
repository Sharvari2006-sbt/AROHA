import { storage } from '@/src/utils/storage';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL ?? '';
const USER_ID_KEY = 'aroha:user_id';

let cachedUserId: string | null = null;

function makeUserId(): string {
  // A stable pseudo-user for this iteration (mock auth). Real JWT later.
  const rand = Math.random().toString(36).slice(2, 10);
  return `student-${rand}`;
}

export async function getUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId;
  const stored = await storage.getItem(USER_ID_KEY, '');
  if (stored) {
    cachedUserId = stored as string;
    return cachedUserId;
  }
  const id = makeUserId();
  await storage.setItem(USER_ID_KEY, id);
  cachedUserId = id;
  return id;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
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
  goal_completion_rate: number;
  prediction_accuracy: number;
  consistency_score: number;
  goal_units_ratio: number;
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
  predicted_distraction_point_seconds: number;
  predicted_focus_seconds: number;
  predicted_completion_probability: number;
  confidence: number;
  is_first_session: boolean;
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
  events: SessionEvent[];
  energy_delta: number;
  distraction_points?: number[];
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
  predicted_focus_minutes: number;
  actual_focus_minutes: number;
  predicted_distraction_minute: number;
  actual_first_distraction_minute: number | null;
  beat_prediction: boolean;
  goal_completed: boolean;
  ended_early: boolean;
  energy_delta: number;
  robot: RobotState;
  stage: { stage: number; stage_progress: number; xp: number; next_stage_xp: number | null };
};

export async function endSession(sessionId: string, body: {
  ended_early: boolean;
  units_done: number | null;
  active_seconds: number;
  events: SessionEvent[];
}): Promise<{ session: SessionDoc; profile: TwinProfile; comparison: Comparison }> {
  return req(`/sessions/${sessionId}/end`, { method: 'POST', body: JSON.stringify(body) });
}

export async function listSessions(userId: string, subjectId?: string): Promise<SessionDoc[]> {
  const q = new URLSearchParams({ user_id: userId });
  if (subjectId) q.set('subject_id', subjectId);
  return req(`/sessions?${q.toString()}`);
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

// ---------------- Analytics ----------------
export type AnalyticsSummary = {
  total_minutes: number;
  sessions_count: number;
  completed_count: number;
  completion_rate: number;
  week: { date: string; seconds: number }[];
};

export async function analyticsSummary(userId: string): Promise<AnalyticsSummary> {
  return req(`/analytics/summary?user_id=${encodeURIComponent(userId)}`);
}
