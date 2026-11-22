import { getActiveBearerToken } from '../auth/serverAuthToken';
import type { AuthSession } from '../auth/authService';
import type {
  AssessmentAttempt,
  ExamConfiguration,
  PracticeHistoryEntry,
  QuestionAnswerKey,
  QuestionBookmarkItem,
  QuestionImportBatch,
  QuestionImportMapping,
  QuestionImportPreviewResult,
  QuestionPublic,
  QuestionScoreDetail,
  QuizCategory,
  QuizDefinition,
  StudentAnswerValue,
  StudentPerformanceAnalytics,
} from '../../types/assessment';
import type { ExamTrack } from '../../types/database';
import type { QuestionFilterParams } from '../../utils/examScoring';
import { readStorageJSON, removeStorageKey, writeStorageJSON } from '../../utils/storage';

async function authHeaders(session: AuthSession | null): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (!session) return headers;
  const token = await getActiveBearerToken(session.mode, session.user.uid, session.user.email);
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function fetchConfigsApi(): Promise<{
  examConfigurations: ExamConfiguration[];
  quizzes: QuizDefinition[];
  importBatches: QuestionImportBatch[];
  totalQuestionCount: number;
}> {
  const res = await fetch('/api/assessments/configs');
  if (!res.ok) throw new Error('FAILED_TO_FETCH_CONFIGS');
  return res.json();
}

export async function fetchQuestionsApi(
  session: AuthSession | null,
  params: QuestionFilterParams & { page?: number; pageSize?: number }
): Promise<{
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  questions: QuestionPublic[];
}> {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).trim() !== '' && v !== 'all') {
      sp.set(k, String(v));
    }
  });
  const headers = await authHeaders(session);
  const res = await fetch(`/api/assessments/questions?${sp.toString()}`, { headers });
  if (!res.ok) throw new Error('FAILED_TO_FETCH_QUESTIONS');
  return res.json();
}

export async function revealQuestionSolutionApi(
  session: AuthSession | null,
  questionId: string
): Promise<{ answerKey: QuestionAnswerKey }> {
  const headers = await authHeaders(session);
  const res = await fetch(`/api/assessments/questions/${encodeURIComponent(questionId)}/reveal`, {
    headers,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(err.message || err.error || 'FAILED_TO_REVEAL_SOLUTION');
  }
  return res.json();
}

export async function checkPracticeQuestionApi(
  session: AuthSession | null,
  payload: {
    questionId: string;
    answer: StudentAnswerValue;
    markedForRevision?: boolean;
    savedDifficult?: boolean;
  }
): Promise<{
  evaluation: QuestionScoreDetail;
  answerKey: QuestionAnswerKey;
  historyEntry: PracticeHistoryEntry | null;
  persisted: boolean;
}> {
  const headers = await authHeaders(session);
  const res = await fetch('/api/assessments/practice/check', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(err.message || err.error || 'FAILED_TO_CHECK_PRACTICE');
  }
  return res.json();
}

export async function startAssessmentAttemptApi(
  session: AuthSession | null,
  payload: {
    kind: AssessmentAttempt['kind'];
    configId?: string;
    forceNew?: boolean;
    customQuiz?: {
      examTrack?: ExamTrack;
      quizType?: QuizCategory;
      subjectId?: string;
      chapterId?: string;
      topicId?: string;
      difficulty?: string;
      questionCount?: number;
      durationMinutes?: number;
      title?: { en: string; hi: string };
      questionIds?: string[];
    };
  }
): Promise<{ attempt: AssessmentAttempt; questions: QuestionPublic[]; resumed: boolean }> {
  const headers = await authHeaders(session);
  const res = await fetch('/api/assessments/attempts/start', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(err.message || err.error || 'FAILED_TO_START_ATTEMPT');
  }
  return res.json();
}

export async function autosaveAttemptApi(
  session: AuthSession | null,
  attemptId: string,
  draft: {
    answers: Record<string, StudentAnswerValue>;
    visitedIds: string[];
    markedForReviewIds: string[];
    currentQuestionIndex: number;
    timeSpentSeconds: number;
    questionTimeSeconds?: Record<string, number>;
  }
): Promise<{ ok: boolean }> {
  const headers = await authHeaders(session);
  const res = await fetch(`/api/assessments/attempts/${encodeURIComponent(attemptId)}/autosave`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(draft),
  });
  if (!res.ok) throw new Error('AUTOSAVE_FAILED');
  return res.json();
}

export async function submitAttemptApi(
  session: AuthSession | null,
  attemptId: string,
  payload: {
    answers: Record<string, StudentAnswerValue>;
    timeSpentSeconds: number;
    autoSubmitted?: boolean;
  }
): Promise<{
  alreadySubmitted: boolean;
  attempt: AssessmentAttempt;
  answerKeys: Record<string, QuestionAnswerKey>;
}> {
  const headers = await authHeaders(session);
  const res = await fetch(`/api/assessments/attempts/${encodeURIComponent(attemptId)}/submit`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(err.message || err.error || 'SUBMIT_FAILED');
  }
  return res.json();
}

export async function submitSelfReviewApi(
  session: AuthSession | null,
  attemptId: string,
  payload: { questionId: string; marks: number; note?: string }
): Promise<{ attempt: AssessmentAttempt }> {
  const headers = await authHeaders(session);
  const res = await fetch(`/api/assessments/attempts/${encodeURIComponent(attemptId)}/self-review`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('SELF_REVIEW_FAILED');
  return res.json();
}

export async function fetchAttemptDetailsApi(
  session: AuthSession | null,
  attemptId: string
): Promise<{
  attempt: AssessmentAttempt;
  questions: QuestionPublic[];
  answerKeys: Record<string, QuestionAnswerKey>;
}> {
  const headers = await authHeaders(session);
  const res = await fetch(`/api/assessments/attempts/${encodeURIComponent(attemptId)}`, { headers });
  if (!res.ok) throw new Error('ATTEMPT_NOT_FOUND');
  return res.json();
}

export async function fetchAnalyticsApi(session: AuthSession | null): Promise<{
  authenticated: boolean;
  analytics: StudentPerformanceAnalytics;
  attempts: AssessmentAttempt[];
  practiceHistory: PracticeHistoryEntry[];
  questionBookmarks: QuestionBookmarkItem[];
}> {
  const headers = await authHeaders(session);
  const res = await fetch('/api/assessments/analytics', { headers });
  if (!res.ok) throw new Error('ANALYTICS_FETCH_FAILED');
  return res.json();
}

export async function toggleQuestionBookmarkApi(
  session: AuthSession | null,
  payload: { questionId: string; tag: QuestionBookmarkItem['tag']; note?: string }
): Promise<{ saved: boolean; bookmarks: QuestionBookmarkItem[] }> {
  const headers = await authHeaders(session);
  const res = await fetch('/api/assessments/bookmarks/toggle', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('BOOKMARK_TOGGLE_FAILED');
  return res.json();
}

export async function previewImportQuestionsApi(
  session: AuthSession | null,
  payload: { rows: Record<string, unknown>[]; mapping: QuestionImportMapping }
): Promise<{ preview: QuestionImportPreviewResult }> {
  const headers = await authHeaders(session);
  const res = await fetch('/api/assessments/import/preview', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('IMPORT_PREVIEW_FAILED');
  return res.json();
}

export async function confirmImportQuestionsApi(
  session: AuthSession | null,
  payload: {
    rows: Record<string, unknown>[];
    mapping: QuestionImportMapping;
    sourceKind: QuestionImportBatch['sourceKind'];
    skipDuplicates?: boolean;
  }
): Promise<{ batch: QuestionImportBatch; insertedCount: number; totalQuestionCount: number }> {
  const headers = await authHeaders(session);
  const res = await fetch('/api/assessments/import/confirm', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || 'IMPORT_CONFIRM_FAILED');
  }
  return res.json();
}

export async function rollbackImportBatchApi(
  session: AuthSession | null,
  batchId: string
): Promise<{ rolledBackBatchId: string; removedCount: number; totalQuestionCount: number }> {
  const headers = await authHeaders(session);
  const res = await fetch(`/api/assessments/import/rollback/${encodeURIComponent(batchId)}`, {
    method: 'POST',
    headers,
  });
  if (!res.ok) throw new Error('IMPORT_ROLLBACK_FAILED');
  return res.json();
}

// Local resilient draft storage for active timed attempts across browser refreshes / network drops
export interface LocalAttemptDraft {
  attemptId: string;
  answers: Record<string, StudentAnswerValue>;
  visitedIds: string[];
  markedForReviewIds: string[];
  currentQuestionIndex: number;
  timeSpentSeconds: number;
  questionTimeSeconds: Record<string, number>;
  updatedAtMs: number;
}

function draftKey(uid: string, attemptId: string): string {
  return `prepzone_draft_${uid}_${attemptId}`;
}

export function saveLocalAttemptDraft(uid: string, draft: LocalAttemptDraft): void {
  if (!uid || !draft.attemptId) return;
  writeStorageJSON(draftKey(uid, draft.attemptId), draft);
}

export function readLocalAttemptDraft(uid: string, attemptId: string): LocalAttemptDraft | null {
  if (!uid || !attemptId) return null;
  return readStorageJSON<LocalAttemptDraft | null>(draftKey(uid, attemptId), null);
}

export function clearLocalAttemptDraft(uid: string, attemptId: string): void {
  if (!uid || !attemptId) return;
  removeStorageKey(draftKey(uid, attemptId));
}
