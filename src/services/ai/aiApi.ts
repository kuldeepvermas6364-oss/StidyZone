import type { AuthSession } from '../auth/authService';
import { getActiveBearerToken } from '../auth/serverAuthToken';
import type {
  AiCitation,
  AiConversation,
  AiFeedbackRating,
  AiLanguageMode,
  AiMessage,
  AiProviderStatus,
  AiQuizGenerateParams,
  AiStudyPlan,
  AiStudyRecommendation,
  AiSummaryMode,
  AiUsageSummary,
  AiWorkflowMode,
  GeneratedChapterSummary,
  GeneratedQuizDraft,
  PdfIndexStatus,
} from '../../types/ai';
import type { StudentPerformanceAnalytics } from '../../types/assessment';
import type { ExamTrack } from '../../types/database';
import type { ProgressMap } from '../../utils/curriculumProgress';

export class AiApiError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function buildHeaders(session: AuthSession | null): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (!session) return headers;
  const token = await getActiveBearerToken(session.mode, session.user.uid, session.user.email);
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  if (res.ok) return res.json() as Promise<T>;
  const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
  throw new AiApiError(
    body.error || 'AI_REQUEST_FAILED',
    body.message || `Request failed (${res.status})`,
    res.status
  );
}

export async function fetchAiStatusApi(session: AuthSession | null): Promise<AiProviderStatus> {
  const headers = await buildHeaders(session);
  const res = await fetch('/api/ai/status', { headers });
  return parseJsonOrThrow<AiProviderStatus>(res);
}

export async function fetchConversationsApi(
  session: AuthSession | null,
  conversationId?: string
): Promise<{ conversations: AiConversation[]; messages: AiMessage[] }> {
  const headers = await buildHeaders(session);
  const qs = conversationId ? `?conversationId=${encodeURIComponent(conversationId)}` : '';
  const res = await fetch(`/api/ai/conversations${qs}`, { headers });
  return parseJsonOrThrow(res);
}

export async function createConversationApi(
  session: AuthSession | null,
  payload: {
    title?: string;
    examTrack: ExamTrack;
    subjectId?: string;
    chapterId?: string;
    materialId?: string;
    languageMode: AiLanguageMode;
  }
): Promise<{ conversation: AiConversation }> {
  const headers = await buildHeaders(session);
  const res = await fetch('/api/ai/conversations', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(res);
}

export async function updateConversationApi(
  session: AuthSession | null,
  id: string,
  payload: Partial<{
    title: string;
    examTrack: ExamTrack;
    subjectId: string;
    chapterId: string;
    materialId: string;
    languageMode: AiLanguageMode;
  }>
): Promise<{ conversation: AiConversation }> {
  const headers = await buildHeaders(session);
  const res = await fetch(`/api/ai/conversations/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(res);
}

export async function deleteConversationApi(
  session: AuthSession | null,
  id: string
): Promise<{ deletedId: string }> {
  const headers = await buildHeaders(session);
  const res = await fetch(`/api/ai/conversations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers,
  });
  return parseJsonOrThrow(res);
}

export async function clearConversationsApi(
  session: AuthSession | null
): Promise<{ clearedCount: number }> {
  const headers = await buildHeaders(session);
  const res = await fetch('/api/ai/conversations', {
    method: 'DELETE',
    headers,
  });
  return parseJsonOrThrow(res);
}

export async function submitAiFeedbackApi(
  session: AuthSession | null,
  payload: { conversationId: string; messageId: string; rating: AiFeedbackRating; note?: string }
): Promise<{ ok: boolean }> {
  const headers = await buildHeaders(session);
  const res = await fetch('/api/ai/feedback', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(res);
}

export async function indexPdfForAiApi(
  session: AuthSession | null,
  materialId: string,
  consentAccepted: boolean
): Promise<{ status: PdfIndexStatus }> {
  const headers = await buildHeaders(session);
  const res = await fetch('/api/ai/pdf/index', {
    method: 'POST',
    headers,
    body: JSON.stringify({ materialId, consentAccepted }),
  });
  return parseJsonOrThrow(res);
}

export interface StreamChatHandlers {
  onMeta?: (meta: {
    conversation: AiConversation;
    userMessage: AiMessage | null;
    citations: AiCitation[];
    uncertaintyNotice?: string;
  }) => void;
  onChunk?: (text: string) => void;
  onDone?: (result: {
    conversation: AiConversation;
    assistantMessage: AiMessage;
    usage: AiUsageSummary;
  }) => void;
}

export async function streamAiChatApi(
  session: AuthSession | null,
  payload: {
    conversationId?: string;
    prompt: string;
    examTrack: ExamTrack;
    subjectId?: string;
    chapterId?: string;
    materialId?: string;
    languageMode: AiLanguageMode;
    workflowMode: AiWorkflowMode;
    stepByStep?: boolean;
    imageBase64?: string;
    imageMimeType?: string;
    imageName?: string;
    isRetry?: boolean;
  },
  handlers: StreamChatHandlers,
  signal?: AbortSignal
): Promise<void> {
  const headers = await buildHeaders(session);
  const res = await fetch('/api/ai/chat/stream', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok || !res.body) {
    const errBody = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new AiApiError(
      errBody.error || 'STREAM_START_FAILED',
      errBody.message || `AI stream failed (${res.status})`,
      res.status
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sepIdx = buffer.indexOf('\n\n');
    while (sepIdx !== -1) {
      const rawBlock = buffer.slice(0, sepIdx);
      buffer = buffer.slice(sepIdx + 2);
      sepIdx = buffer.indexOf('\n\n');

      const lines = rawBlock.split('\n');
      let eventName = 'message';
      let dataRaw = '';
      for (const line of lines) {
        if (line.startsWith('event:')) eventName = line.slice(6).trim();
        else if (line.startsWith('data:')) dataRaw += line.slice(5).trim();
      }
      if (!dataRaw) continue;

      const parsed = JSON.parse(dataRaw) as Record<string, unknown>;
      if (eventName === 'meta') {
        handlers.onMeta?.(
          parsed as {
            conversation: AiConversation;
            userMessage: AiMessage | null;
            citations: AiCitation[];
            uncertaintyNotice?: string;
          }
        );
      } else if (eventName === 'chunk') {
        if (typeof parsed.text === 'string') handlers.onChunk?.(parsed.text);
      } else if (eventName === 'done') {
        handlers.onDone?.(
          parsed as {
            conversation: AiConversation;
            assistantMessage: AiMessage;
            usage: AiUsageSummary;
          }
        );
      } else if (eventName === 'error') {
        throw new AiApiError(
          String(parsed.error || 'AI_STREAM_ERROR'),
          String(parsed.message || 'AI stream error'),
          502
        );
      }
    }
  }
}

export async function generateAiQuizApi(
  session: AuthSession | null,
  params: AiQuizGenerateParams
): Promise<{ draft: GeneratedQuizDraft; usage: AiUsageSummary }> {
  const headers = await buildHeaders(session);
  const res = await fetch('/api/ai/quiz/generate', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  return parseJsonOrThrow(res);
}

export async function saveAiQuizApi(
  session: AuthSession | null,
  draftId: string
): Promise<{ saved: boolean; draft: GeneratedQuizDraft; questionIds: string[] }> {
  const headers = await buildHeaders(session);
  const res = await fetch('/api/ai/quiz/save', {
    method: 'POST',
    headers,
    body: JSON.stringify({ draftId }),
  });
  return parseJsonOrThrow(res);
}

export async function fetchSavedAiQuizzesApi(
  session: AuthSession | null
): Promise<{ quizzes: GeneratedQuizDraft[] }> {
  const headers = await buildHeaders(session);
  const res = await fetch('/api/ai/quizzes', { headers });
  return parseJsonOrThrow(res);
}

export async function generateAiSummaryApi(
  session: AuthSession | null,
  payload: {
    examTrack: ExamTrack;
    subjectId: string;
    chapterId: string;
    summaryMode: AiSummaryMode;
    languageMode: AiLanguageMode;
    materialId?: string;
    forceRefresh?: boolean;
  }
): Promise<{ summary: GeneratedChapterSummary; usage?: AiUsageSummary }> {
  const headers = await buildHeaders(session);
  const res = await fetch('/api/ai/summary', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(res);
}

export async function fetchRecommendationsApi(
  session: AuthSession | null,
  payload: {
    examTrack: ExamTrack;
    language: 'en' | 'hi';
    progressMap: ProgressMap;
    selectedSubjectIds?: string[];
  }
): Promise<{
  authenticated: boolean;
  hasRealActivity: boolean;
  analytics: StudentPerformanceAnalytics;
  recommendations: AiStudyRecommendation[];
}> {
  const headers = await buildHeaders(session);
  const res = await fetch('/api/ai/recommendations', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(res);
}

export async function fetchStudyPlansApi(
  session: AuthSession | null
): Promise<{ plans: AiStudyPlan[] }> {
  const headers = await buildHeaders(session);
  const res = await fetch('/api/ai/study-plans', { headers });
  return parseJsonOrThrow(res);
}

export async function generateStudyPlanApi(
  session: AuthSession | null,
  payload: {
    examTrack: ExamTrack;
    examDateISO: string;
    dailyHours: number;
    selectedSubjectIds: string[];
    languageMode: AiLanguageMode;
    progressMap: ProgressMap;
  }
): Promise<{ plan: AiStudyPlan; usage: AiUsageSummary }> {
  const headers = await buildHeaders(session);
  const res = await fetch('/api/ai/study-plan/generate', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(res);
}

export async function approveStudyPlanApi(
  session: AuthSession | null,
  plan: AiStudyPlan
): Promise<{ plan: AiStudyPlan }> {
  const headers = await buildHeaders(session);
  const res = await fetch('/api/ai/study-plan/approve', {
    method: 'POST',
    headers,
    body: JSON.stringify({ plan }),
  });
  return parseJsonOrThrow(res);
}
