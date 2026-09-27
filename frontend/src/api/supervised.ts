import { File, Paths } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { fetch as expoFetch } from 'expo/fetch';
import { Platform } from 'react-native';

import { authenticatedRequest, authenticatedUpload, backendBase, getAccessToken } from '@/src/api/auth';
import { storage } from '@/src/utils/storage';

const HIGHLIGHT_PDF_DIRECTORY_KEY = 'aroha:highlight_pdf_directory';
const highlightPdfSavedKey = (assignmentId: string) => `aroha:highlight_pdf_saved:${assignmentId}`;
const highlightPdfUriKey = (assignmentId: string) => `aroha:highlight_pdf_uri:${assignmentId}`;

export type SupervisedMaterial = {
  id: string; child_id: string; title: string;
  kind: 'pdf' | 'textbook' | 'worksheet' | 'pyq' | 'note' | 'youtube';
  source_url?: string | null; original_name?: string | null; created_at: string;
  readable_text_available?: boolean | null; processing_warning?: string | null;
};

export type SupervisedAssignment = {
  id: string; child_id: string; parent_id: string; title: string; subject: string;
  topic?: string | null; parent_note?: string | null; scheduled_start?: string | null;
  due_at?: string | null; planned_duration_minutes: number;
  recurrence: 'none' | 'daily' | 'weekdays' | 'weekly'; material_ids: string[];
  quiz_required: boolean; quiz_status: string; quiz_unlocked: boolean;
  study_completed: boolean; material_progress?: number; active_seconds?: number;
  status: string; created_at: string;
};

export async function listAssignments(childId?: string): Promise<SupervisedAssignment[]> {
  return authenticatedRequest(`/supervised/assignments${childId ? `?child_id=${encodeURIComponent(childId)}` : ''}`);
}

export async function getAssignment(assignmentId: string): Promise<SupervisedAssignment> {
  return authenticatedRequest(`/supervised/assignments/${assignmentId}`);
}

export async function createAssignment(body: {
  child_id: string; title: string; subject: string; topic?: string; parent_note?: string;
  scheduled_start?: string; due_at?: string; planned_duration_minutes: number;
  recurrence?: string; material_ids?: string[]; quiz_required?: boolean;
}): Promise<SupervisedAssignment> {
  return authenticatedRequest('/supervised/assignments', { method: 'POST', body: JSON.stringify(body) });
}

export async function listMaterials(childId: string): Promise<SupervisedMaterial[]> {
  return authenticatedRequest(`/supervised/materials?child_id=${encodeURIComponent(childId)}`);
}

export async function getMaterialContent(materialId: string): Promise<{ id: string; title: string; kind: string; content: string; truncated: boolean }> {
  return authenticatedRequest(`/supervised/materials/${materialId}/content`);
}

export async function getActiveAssessment(): Promise<{ active: boolean; assignment_id: string | null; attempt_id: string | null }> {
  return authenticatedRequest('/supervised/assessment/active');
}

export type MaterialHighlight = { id: string; material_id: string; material_title?: string; text: string; active: boolean; created_at?: string };
export type RevisionNote = {
  assignment_id: string; title: string; subject: string; topic: string;
  highlight_count: number; updated_at?: string | null; pdf_ready: boolean;
};

export async function listRevisionNotes(): Promise<RevisionNote[]> {
  return authenticatedRequest('/supervised/revision-notes');
}

export async function listAssignmentHighlights(assignmentId: string): Promise<MaterialHighlight[]> {
  return authenticatedRequest(`/supervised/assignments/${assignmentId}/highlights`);
}

export async function toggleAssignmentHighlight(assignmentId: string, materialId: string, text: string): Promise<MaterialHighlight> {
  return authenticatedRequest(`/supervised/assignments/${assignmentId}/highlights/toggle`, {
    method: 'POST', body: JSON.stringify({ material_id: materialId, text }),
  });
}

export async function askAssignmentDoubt(
  assignmentId: string,
  question: string,
  materialId: string | null,
  history: { from: 'me' | 'twin'; text: string }[] = [],
): Promise<{ message: string; grounded: boolean; sources: string[] }> {
  return authenticatedRequest(`/supervised/assignments/${assignmentId}/doubt`, {
    method: 'POST',
    body: JSON.stringify({ question, material_id: materialId, history: history.slice(-8) }),
  });
}

export async function saveAssignmentHighlightsPdf(assignmentId: string, topic: string, highlightCount = 0): Promise<string> {
  const token = await getAccessToken();
  const response = await expoFetch(`${backendBase()}/api/supervised/assignments/${assignmentId}/highlights/pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { detail?: string };
    throw new Error(body.detail || 'Could not create the highlights PDF.');
  }
  const safeTopic = topic.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'revision';
  const date = new Date().toISOString().slice(0, 10);
  const filename = `Aroha-${safeTopic}-highlights-${date}.pdf`;
  const file = new File(Paths.document, filename);
  file.create({ overwrite: true, intermediates: true });
  file.write(await response.bytes());
  const recordSaved = async (uri: string): Promise<string> => {
    await storage.setItem(highlightPdfSavedKey(assignmentId), highlightCount);
    await storage.setItem(highlightPdfUriKey(assignmentId), uri);
    return uri;
  };

  if (Platform.OS === 'android') {
    const requestDirectory = async (): Promise<string> => {
      const permission = await LegacyFileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(
        LegacyFileSystem.StorageAccessFramework.getUriForDirectoryInRoot('Download'),
      );
      if (!permission.granted) throw new Error('Choose a folder once so Reo can save your revision PDFs directly.');
      await storage.setItem(HIGHLIGHT_PDF_DIRECTORY_KEY, permission.directoryUri);
      return permission.directoryUri;
    };
    const writeToDirectory = async (directoryUri: string): Promise<string> => {
      const base64 = await LegacyFileSystem.readAsStringAsync(file.uri, { encoding: LegacyFileSystem.EncodingType.Base64 });
      const existingUri = await storage.getItem(highlightPdfUriKey(assignmentId), '' as string);
      if (existingUri) {
        try {
          await LegacyFileSystem.StorageAccessFramework.writeAsStringAsync(existingUri, base64, {
            encoding: LegacyFileSystem.EncodingType.Base64,
          });
          return existingUri;
        } catch {
          await storage.removeItem(highlightPdfUriKey(assignmentId));
        }
      }
      const destination = await LegacyFileSystem.StorageAccessFramework.createFileAsync(
        directoryUri,
        filename.replace(/\.pdf$/i, ''),
        'application/pdf',
      );
      await LegacyFileSystem.StorageAccessFramework.writeAsStringAsync(destination, base64, {
        encoding: LegacyFileSystem.EncodingType.Base64,
      });
      return destination;
    };

    const savedDirectory = await storage.getItem(HIGHLIGHT_PDF_DIRECTORY_KEY, '' as string);
    if (savedDirectory) {
      try {
        return await recordSaved(await writeToDirectory(savedDirectory));
      } catch {
        // Android can revoke a previously granted folder URI after reinstall,
        // clearing app data, or a system update. Ask again and retry now rather
        // than making the completed assignment impossible to export.
        await storage.removeItem(HIGHLIGHT_PDF_DIRECTORY_KEY);
      }
    }
    try {
      return await recordSaved(await writeToDirectory(await requestDirectory()));
    } catch (error) {
      await storage.removeItem(HIGHLIGHT_PDF_DIRECTORY_KEY);
      throw new Error(error instanceof Error ? `Could not save the PDF: ${error.message}` : 'Could not save the PDF to the selected folder.');
    }
  }

  return recordSaved(file.uri);
}

export async function getSavedAssignmentHighlightsCount(assignmentId: string): Promise<number> {
  const uri = await storage.getItem(highlightPdfUriKey(assignmentId), '' as string);
  if (!uri) return 0;
  const value = await storage.getItem(highlightPdfSavedKey(assignmentId), 0 as number);
  return Number(value) || 0;
}

export async function uploadMaterial(form: FormData): Promise<SupervisedMaterial> {
  return authenticatedUpload('/supervised/materials', form);
}

export async function generateQuiz(assignmentId: string): Promise<void> {
  await authenticatedRequest(`/supervised/assignments/${assignmentId}/quiz/generate`, { method: 'POST' });
}

export type ParentQuizQuestion = {
  prompt: string; choices: string[]; answer: number; explanation?: string; concept?: string;
};

export async function createManualQuiz(assignmentId: string, questions: ParentQuizQuestion[]): Promise<void> {
  await authenticatedRequest(`/supervised/assignments/${assignmentId}/quiz/manual`, {
    method: 'POST', body: JSON.stringify({ questions }),
  });
}

export async function startAssignmentStudy(assignmentId: string): Promise<void> {
  await authenticatedRequest(`/supervised/assignments/${assignmentId}/study/start`, { method: 'POST' });
}

export async function completeAssignmentStudy(assignmentId: string, activeSeconds: number, materialProgress: number, backgroundEvents: number, studentMarkedDone = false): Promise<{ study_completed: boolean; quiz_unlocked: boolean; ended_early: boolean; study_points_awarded: number; quiz_generation_error?: string | null; highlight_pdf_ready?: boolean }> {
  return authenticatedRequest(`/supervised/assignments/${assignmentId}/study/complete`, {
    method: 'POST', body: JSON.stringify({ active_seconds: activeSeconds, material_progress: materialProgress, background_events: backgroundEvents, student_marked_done: studentMarkedDone }),
  });
}

export async function beginAssignedQuiz(assignmentId: string): Promise<{ attempt_id: string; assessment_locked: boolean; questions: { prompt: string; choices: string[]; concept: string }[] }> {
  return authenticatedRequest(`/supervised/assignments/${assignmentId}/quiz/begin`, { method: 'POST' });
}

export async function submitAssignedQuiz(assignmentId: string, answers: number[], backgroundEvents: number): Promise<{ score: number; total: number; score_percent: number; mastery_xp: number; concepts: Record<string, { correct: number; total: number }> }> {
  return authenticatedRequest(`/supervised/assignments/${assignmentId}/quiz/submit`, {
    method: 'POST', body: JSON.stringify({ answers, background_events: backgroundEvents }),
  });
}

export type SupervisedAnalytics = {
  children_count: number; assignments_count: number; completed_count: number; completion_rate: number;
  planned_minutes: number; actual_minutes: number; quizzes_completed: number;
  average_quiz_percent: number | null; weak_topics: { concept: string; mastery_percent: number }[];
  observation: string;
  recent_activity: { assignment_id: string; child_id: string; child_name: string; title: string; subject: string; status: string; planned_minutes: number; actual_minutes: number; quiz_percent: number | null; updated_at?: string }[];
};

export async function getSupervisedAnalytics(): Promise<SupervisedAnalytics> {
  return authenticatedRequest('/supervised/analytics');
}

export type ChildAssignmentReport = {
  assignment_id: string; title: string; subject: string; topic?: string | null; status: string;
  standing: 'ahead' | 'on_track' | 'needs_support' | 'in_progress' | 'not_started';
  planned_minutes: number; actual_minutes: number; ended_early: boolean; material_progress: number;
  study_background_events: number; study_points: number; updated_at?: string;
  quiz: null | {
    score: number; total: number; score_percent: number; background_events: number; mastery_xp: number;
    concepts: Record<string, { correct: number; total: number }>;
    mistakes: { question: string; selected: string; correct: string; concept: string; explanation: string }[];
    answers_available: boolean; source: string; submitted_at?: string;
  };
};

export type ChildSupervisedReport = {
  child: { id: string; name: string; email: string };
  summary: {
    standing: string; robot_message: string; recommendation: string; assignments: number; completed: number;
    completion_rate: number; planned_minutes: number; actual_minutes: number; average_quiz_percent: number | null;
    weak_topics: { concept: string; mastery_percent: number }[];
  };
  robot: { xp: number; streak_days: number; discipline_days: number; evolution_stage: number };
  reports: ChildAssignmentReport[];
};

export async function getChildSupervisedReport(childId: string): Promise<ChildSupervisedReport> {
  return authenticatedRequest(`/supervised/children/${encodeURIComponent(childId)}/report`);
}
