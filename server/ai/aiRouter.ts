import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type Request, type Response, type Router } from 'express';
import {
  ALL_CURRICULUM_SUBJECTS,
  getChapterById,
  getSubjectById,
  getSubjectsForExam,
} from '../../src/data/curriculum/index.ts';
import { getMaterialById } from '../../src/data/materials/studyMaterialsCatalog.ts';
import type {
  AiCitation,
  AiConversation,
  AiFeedbackRating,
  AiLanguageMode,
  AiMessage,
  AiQuizGenerateParams,
  AiStudyPlan,
  AiSummaryMode,
  AiUsageSummary,
  AiWorkflowMode,
  GeneratedChapterSummary,
  GeneratedQuizDraft,
} from '../../src/types/ai.ts';
import type { ExamTrack } from '../../src/types/database.ts';
import {
  buildChapterSummaryPrompt,
  buildDoubtSolverPrompt,
  buildPdfCitationsFromChunks,
  buildPdfGroundedPrompt,
  buildQuizGenPrompt,
  buildStudyPlanPrompt,
  buildTutorSystemPrompt,
  computeRealStudyRecommendations,
  estimateTokens,
  normalizeGeneratedStudyPlan,
  validateAndSanitizeAiQuiz,
  validateImageAttachment,
  validatePromptInput,
  validateStudyPlanInputs,
} from '../../src/utils/aiTutorEngine.ts';
import type { ProgressMap } from '../../src/utils/curriculumProgress.ts';
import { getChapterProgress } from '../../src/utils/curriculumProgress.ts';
import { computeStudentAnalytics } from '../../src/utils/weakTopics.ts';
import type { AssessmentBridge, VerifiedRequestUser } from '../assessments/assessmentEngine.ts';
import {
  AiProviderError,
  extractReadableGeminiError,
  generateStructuredQuizJson,
  generateStructuredStudyPlanJson,
  generateTutorText,
  getConfiguredModel,
  isGeminiConfigured,
  streamTutorChat,
  type GeminiHistoryTurn,
} from './geminiProvider.ts';
import { PdfIndexerError, ServerPdfIndexer } from './pdfIndexer.ts';

import type { AiAdminSettings } from '../../src/types/admin.ts';

interface FeedbackRecord {
  id: string;
  uid: string;
  conversationId: string;
  messageId: string;
  rating: AiFeedbackRating;
  note?: string;
  createdAt: string;
}

interface DailyUsageCounter {
  dateKey: string;
  requestsUsed: number;
  tokensUsed: number;
}

export interface AiErrorLogEntry {
  id: string;
  code: string;
  message: string;
  occurredAt: string;
}

export interface AiAdminBridge {
  getSettings?: () => AiAdminSettings;
  updateSettings?: (next: Partial<AiAdminSettings>, adminUid: string) => AiAdminSettings;
  getTelemetry?: () => {
    configured: boolean;
    model: string;
    todayRequests: number;
    todayTokens: number;
    totalConversations: number;
    totalFeedbackCount: number;
    needsReviewCount: number;
    quizDrafts: GeneratedQuizDraft[];
    errorLogs: AiErrorLogEntry[];
    usageByUid: Record<string, DailyUsageCounter>;
  };
}

interface PersistedAiState {
  conversations: Record<string, AiConversation>;
  messagesByConversation: Record<string, AiMessage[]>;
  feedbackByUid: Record<string, FeedbackRecord[]>;
  usageByUid: Record<string, DailyUsageCounter>;
  summaryCache: Record<string, GeneratedChapterSummary>;
  quizDraftsById: Record<string, GeneratedQuizDraft>;
  studyPlansByUid: Record<string, AiStudyPlan[]>;
  adminSettings?: AiAdminSettings;
  errorLogs?: AiErrorLogEntry[];
}

const DEFAULT_AI_STATE: PersistedAiState = {
  conversations: {},
  messagesByConversation: {},
  feedbackByUid: {},
  usageByUid: {},
  summaryCache: {},
  quizDraftsById: {},
  studyPlansByUid: {},
  errorLogs: [],
};

const AI_STATE_DIR = path.resolve(process.cwd(), 'storage', 'ai');
const AI_STATE_FILE = path.join(AI_STATE_DIR, 'ai-state.json');

function loadAiState(): PersistedAiState {
  try {
    if (!fs.existsSync(AI_STATE_FILE)) {
      fs.mkdirSync(AI_STATE_DIR, { recursive: true });
      return structuredClone(DEFAULT_AI_STATE);
    }
    const raw = fs.readFileSync(AI_STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PersistedAiState>;
    return {
      conversations:
        parsed.conversations && typeof parsed.conversations === 'object' ? parsed.conversations : {},
      messagesByConversation:
        parsed.messagesByConversation && typeof parsed.messagesByConversation === 'object'
          ? parsed.messagesByConversation
          : {},
      feedbackByUid:
        parsed.feedbackByUid && typeof parsed.feedbackByUid === 'object' ? parsed.feedbackByUid : {},
      usageByUid: parsed.usageByUid && typeof parsed.usageByUid === 'object' ? parsed.usageByUid : {},
      summaryCache:
        parsed.summaryCache && typeof parsed.summaryCache === 'object' ? parsed.summaryCache : {},
      quizDraftsById:
        parsed.quizDraftsById && typeof parsed.quizDraftsById === 'object' ? parsed.quizDraftsById : {},
      studyPlansByUid:
        parsed.studyPlansByUid && typeof parsed.studyPlansByUid === 'object' ? parsed.studyPlansByUid : {},
      adminSettings: parsed.adminSettings,
      errorLogs: Array.isArray(parsed.errorLogs) ? parsed.errorLogs.slice(0, 100) : [],
    };
  } catch {
    return structuredClone(DEFAULT_AI_STATE);
  }
}

function saveAiState(state: PersistedAiState): void {
  try {
    fs.mkdirSync(AI_STATE_DIR, { recursive: true });
    const tmp = `${AI_STATE_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
    fs.renameSync(tmp, AI_STATE_FILE);
  } catch {
    // Graceful non-fatal persistence fallback
  }
}

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getDefaultAdminSettings(): AiAdminSettings {
  const configuredModel = getConfiguredModel();
  const model: AiAdminSettings['model'] =
    configuredModel === 'gemini-2.5-flash' || configuredModel === 'gemini-2.5-pro'
      ? configuredModel
      : 'gemini-4-hydrogen';
  return {
    enabled: true,
    model,
    dailyRequestLimit: Math.max(5, Number(process.env.AI_DAILY_REQUEST_LIMIT || 40)),
    dailyTokenLimit: Math.max(5000, Number(process.env.AI_DAILY_TOKEN_LIMIT || 120000)),
    rateLimitPerMin: Math.max(2, Number(process.env.AI_RATE_LIMIT_PER_MIN || 12)),
    features: {
      chat: true,
      pdfRag: true,
      quizGenerator: true,
      chapterSummary: true,
      studyPlanner: true,
    },
    updatedByUid: 'system-default',
    updatedAt: new Date().toISOString(),
  };
}

// Per-user sliding window rate limiter
const aiRateBuckets = new Map<string, number[]>();
function allowRateWindow(uid: string, limitPerMin: number): boolean {
  const now = Date.now();
  const windowStart = now - 60_000;
  const recent = (aiRateBuckets.get(uid) ?? []).filter((ts) => ts > windowStart);
  if (recent.length >= limitPerMin) {
    aiRateBuckets.set(uid, recent);
    return false;
  }
  recent.push(now);
  aiRateBuckets.set(uid, recent);
  return true;
}

function normalizeTrack(raw: unknown): ExamTrack {
  return raw === 'up-board-12' || raw === 'jee-main' || raw === 'jee-advanced'
    ? raw
    : 'jee-main';
}

function normalizeLangMode(raw: unknown): AiLanguageMode {
  return raw === 'hi' || raw === 'hinglish' || raw === 'en' ? raw : 'en';
}

export function createAiRouter(deps: {
  resolveAuthenticatedUser: (req: Request) => Promise<VerifiedRequestUser | null>;
  storageRoot: string;
  bridge: AssessmentBridge;
  aiBridge?: AiAdminBridge;
}): Router {
  const router = express.Router();
  const state = loadAiState();
  if (!state.adminSettings) {
    state.adminSettings = getDefaultAdminSettings();
  }
  const pdfIndexer = new ServerPdfIndexer(deps.storageRoot);

  function recordAiError(code: string, message: string): void {
    const entry: AiErrorLogEntry = {
      id: `aierr-${crypto.randomUUID()}`,
      code: String(code).slice(0, 60),
      message: String(message).slice(0, 320),
      occurredAt: new Date().toISOString(),
    };
    state.errorLogs = [entry, ...(state.errorLogs ?? [])].slice(0, 100);
    saveAiState(state);
  }

  function sendAiError(res: Response, err: unknown): void {
    if (err instanceof AiProviderError) {
      const clean = extractReadableGeminiError(err);
      recordAiError(err.code, clean.message);
      res.status(err.statusCode).json({ error: err.code, message: clean.message });
      return;
    }
    if (err instanceof PdfIndexerError) {
      recordAiError(err.code, err.message);
      res.status(err.statusCode).json({ error: err.code, message: err.message });
      return;
    }
    const clean = extractReadableGeminiError(err);
    recordAiError('AI_INTERNAL_ERROR', clean.message);
    res.status(clean.statusCode || 500).json({ error: 'AI_INTERNAL_ERROR', message: clean.message });
  }

  function getQuotaConfig() {
    const s = state.adminSettings ?? getDefaultAdminSettings();
    return {
      dailyRequestLimit: s.dailyRequestLimit,
      dailyTokenLimit: s.dailyTokenLimit,
      rateLimitPerMin: s.rateLimitPerMin,
    };
  }

  if (deps.aiBridge) {
    deps.aiBridge.getSettings = () => state.adminSettings ?? getDefaultAdminSettings();
    deps.aiBridge.updateSettings = (next, adminUid) => {
      const prev = state.adminSettings ?? getDefaultAdminSettings();
      const allowedModels: AiAdminSettings['model'][] = [
        'gemini-4-hydrogen',
        'gemini-2.5-flash',
        'gemini-2.5-pro',
      ];
      const model = next.model && allowedModels.includes(next.model) ? next.model : prev.model;
      state.adminSettings = {
        enabled: typeof next.enabled === 'boolean' ? next.enabled : prev.enabled,
        model,
        dailyRequestLimit:
          typeof next.dailyRequestLimit === 'number'
            ? Math.min(500, Math.max(1, Math.round(next.dailyRequestLimit)))
            : prev.dailyRequestLimit,
        dailyTokenLimit:
          typeof next.dailyTokenLimit === 'number'
            ? Math.min(2_000_000, Math.max(1000, Math.round(next.dailyTokenLimit)))
            : prev.dailyTokenLimit,
        rateLimitPerMin:
          typeof next.rateLimitPerMin === 'number'
            ? Math.min(120, Math.max(1, Math.round(next.rateLimitPerMin)))
            : prev.rateLimitPerMin,
        features: {
          chat: next.features?.chat ?? prev.features.chat,
          pdfRag: next.features?.pdfRag ?? prev.features.pdfRag,
          quizGenerator: next.features?.quizGenerator ?? prev.features.quizGenerator,
          chapterSummary: next.features?.chapterSummary ?? prev.features.chapterSummary,
          studyPlanner: next.features?.studyPlanner ?? prev.features.studyPlanner,
        },
        updatedByUid: adminUid,
        updatedAt: new Date().toISOString(),
      };
      saveAiState(state);
      return state.adminSettings;
    };
    deps.aiBridge.getTelemetry = () => {
      const today = todayDateKey();
      let todayRequests = 0;
      let todayTokens = 0;
      for (const u of Object.values(state.usageByUid)) {
        if (u.dateKey === today) {
          todayRequests += u.requestsUsed;
          todayTokens += u.tokensUsed;
        }
      }
      const allFeedback = Object.values(state.feedbackByUid).flat();
      return {
        configured: isGeminiConfigured(),
        model: state.adminSettings?.model ?? getConfiguredModel(),
        todayRequests,
        todayTokens,
        totalConversations: Object.keys(state.conversations).length,
        totalFeedbackCount: allFeedback.length,
        needsReviewCount: allFeedback.filter((f) => f.rating === 'needs_review').length,
        quizDrafts: Object.values(state.quizDraftsById),
        errorLogs: state.errorLogs ?? [],
        usageByUid: state.usageByUid,
      };
    };
  }

  function getUserUsage(uid: string): AiUsageSummary {
    const quota = getQuotaConfig();
    const today = todayDateKey();
    const current = state.usageByUid[uid];
    if (!current || current.dateKey !== today) {
      state.usageByUid[uid] = { dateKey: today, requestsUsed: 0, tokensUsed: 0 };
    }
    const entry = state.usageByUid[uid];
    return {
      dateKey: entry.dateKey,
      requestsUsed: entry.requestsUsed,
      dailyRequestLimit: quota.dailyRequestLimit,
      tokensUsed: entry.tokensUsed,
      dailyTokenLimit: quota.dailyTokenLimit,
      rateLimitPerMin: quota.rateLimitPerMin,
    };
  }

  function recordUsage(uid: string, tokensDelta: number): AiUsageSummary {
    const today = todayDateKey();
    if (!state.usageByUid[uid] || state.usageByUid[uid].dateKey !== today) {
      state.usageByUid[uid] = { dateKey: today, requestsUsed: 0, tokensUsed: 0 };
    }
    state.usageByUid[uid].requestsUsed += 1;
    state.usageByUid[uid].tokensUsed += Math.max(1, tokensDelta);
    saveAiState(state);
    return getUserUsage(uid);
  }

  function enforceRateAndQuota(uid: string, res: Response): boolean {
    if (state.adminSettings && !state.adminSettings.enabled) {
      res.status(503).json({
        error: 'AI_DISABLED_BY_ADMIN',
        message: 'AI Study Assistant is temporarily paused by an administrator.',
      });
      return false;
    }
    const usage = getUserUsage(uid);
    if (!allowRateWindow(uid, usage.rateLimitPerMin)) {
      res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: `Too many AI requests in one minute (limit: ${usage.rateLimitPerMin}/min). Please wait a moment and retry.`,
      });
      return false;
    }
    if (usage.requestsUsed >= usage.dailyRequestLimit || usage.tokensUsed >= usage.dailyTokenLimit) {
      res.status(429).json({
        error: 'DAILY_QUOTA_EXCEEDED',
        message: 'Daily AI study quota reached for today. Your existing conversations, saved quizzes, and study plans remain accessible.',
      });
      return false;
    }
    return true;
  }

  // ---------------------------------------------------------------------------
  // 1. Provider Readiness & Usage Status (never exposes API key)
  // ---------------------------------------------------------------------------
  router.get('/status', async (req: Request, res: Response) => {
    const user = await deps.resolveAuthenticatedUser(req);
    const settings = state.adminSettings ?? getDefaultAdminSettings();
    res.json({
      configured: isGeminiConfigured(),
      enabled: settings.enabled,
      model: settings.model || getConfiguredModel(),
      features: settings.features,
      usage: user ? getUserUsage(user.uid) : null,
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Conversations CRUD (Owner-Isolated)
  // ---------------------------------------------------------------------------
  router.get('/conversations', async (req: Request, res: Response) => {
    const user = await deps.resolveAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Sign in to access saved AI conversations.' });
      return;
    }
    const list = Object.values(state.conversations)
      .filter((c) => c.uid === user.uid)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    const convId = typeof req.query.conversationId === 'string' ? req.query.conversationId : '';
    let messages: AiMessage[] = [];
    if (convId) {
      const target = state.conversations[convId];
      if (target && target.uid === user.uid) {
        messages = state.messagesByConversation[convId] ?? [];
      }
    }

    res.json({ conversations: list, messages });
  });

  router.post('/conversations', async (req: Request, res: Response) => {
    const user = await deps.resolveAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'AUTH_REQUIRED' });
      return;
    }

    const nowISO = new Date().toISOString();
    const conv: AiConversation = {
      id: `conv-${crypto.randomUUID()}`,
      uid: user.uid,
      title:
        typeof req.body?.title === 'string' && req.body.title.trim()
          ? req.body.title.trim().slice(0, 90)
          : 'New Study Session',
      examTrack: normalizeTrack(req.body?.examTrack),
      subjectId: typeof req.body?.subjectId === 'string' && req.body.subjectId !== 'all' ? req.body.subjectId : undefined,
      chapterId: typeof req.body?.chapterId === 'string' && req.body.chapterId !== 'all' ? req.body.chapterId : undefined,
      topicId: typeof req.body?.topicId === 'string' ? req.body.topicId : undefined,
      materialId: typeof req.body?.materialId === 'string' && req.body.materialId ? req.body.materialId : undefined,
      languageMode: normalizeLangMode(req.body?.languageMode),
      messageCount: 0,
      lastMessagePreview: '',
      createdAt: nowISO,
      updatedAt: nowISO,
    };

    state.conversations[conv.id] = conv;
    state.messagesByConversation[conv.id] = [];
    saveAiState(state);
    res.status(201).json({ conversation: conv });
  });

  router.patch('/conversations/:id', async (req: Request, res: Response) => {
    const user = await deps.resolveAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'AUTH_REQUIRED' });
      return;
    }
    const conv = state.conversations[req.params.id];
    if (!conv || conv.uid !== user.uid) {
      res.status(404).json({ error: 'CONVERSATION_NOT_FOUND' });
      return;
    }

    if (typeof req.body?.title === 'string' && req.body.title.trim()) {
      conv.title = req.body.title.trim().slice(0, 90);
    }
    if (req.body?.examTrack) conv.examTrack = normalizeTrack(req.body.examTrack);
    if (req.body?.languageMode) conv.languageMode = normalizeLangMode(req.body.languageMode);
    if (typeof req.body?.subjectId === 'string') {
      conv.subjectId = req.body.subjectId === 'all' ? undefined : req.body.subjectId;
    }
    if (typeof req.body?.chapterId === 'string') {
      conv.chapterId = req.body.chapterId === 'all' ? undefined : req.body.chapterId;
    }
    if (typeof req.body?.materialId === 'string') {
      conv.materialId = req.body.materialId || undefined;
    }
    conv.updatedAt = new Date().toISOString();
    saveAiState(state);
    res.json({ conversation: conv });
  });

  router.delete('/conversations/:id', async (req: Request, res: Response) => {
    const user = await deps.resolveAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'AUTH_REQUIRED' });
      return;
    }
    const conv = state.conversations[req.params.id];
    if (!conv || conv.uid !== user.uid) {
      res.status(404).json({ error: 'CONVERSATION_NOT_FOUND' });
      return;
    }
    delete state.conversations[conv.id];
    delete state.messagesByConversation[conv.id];
    saveAiState(state);
    res.json({ deletedId: conv.id });
  });

  router.delete('/conversations', async (req: Request, res: Response) => {
    const user = await deps.resolveAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'AUTH_REQUIRED' });
      return;
    }
    let removed = 0;
    for (const [id, conv] of Object.entries(state.conversations)) {
      if (conv.uid === user.uid) {
        delete state.conversations[id];
        delete state.messagesByConversation[id];
        removed += 1;
      }
    }
    saveAiState(state);
    res.json({ clearedCount: removed });
  });

  // ---------------------------------------------------------------------------
  // 3. Feedback on AI Messages
  // ---------------------------------------------------------------------------
  router.post('/feedback', async (req: Request, res: Response) => {
    const user = await deps.resolveAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'AUTH_REQUIRED' });
      return;
    }
    const conversationId = String(req.body?.conversationId || '').trim();
    const messageId = String(req.body?.messageId || '').trim();
    const rating: AiFeedbackRating =
      req.body?.rating === 'needs_review' ? 'needs_review' : 'helpful';

    const conv = state.conversations[conversationId];
    if (!conv || conv.uid !== user.uid) {
      res.status(404).json({ error: 'CONVERSATION_NOT_FOUND' });
      return;
    }

    const msgs = state.messagesByConversation[conversationId] ?? [];
    const target = msgs.find((m) => m.id === messageId && m.role === 'assistant');
    if (!target) {
      res.status(404).json({ error: 'MESSAGE_NOT_FOUND' });
      return;
    }

    target.feedback = rating;
    const record: FeedbackRecord = {
      id: `fb-${crypto.randomUUID()}`,
      uid: user.uid,
      conversationId,
      messageId,
      rating,
      note: typeof req.body?.note === 'string' ? req.body.note.slice(0, 300) : undefined,
      createdAt: new Date().toISOString(),
    };
    const list = state.feedbackByUid[user.uid] ?? [];
    state.feedbackByUid[user.uid] = [record, ...list].slice(0, 200);
    saveAiState(state);

    res.json({ ok: true, messageId, rating });
  });

  // ---------------------------------------------------------------------------
  // 4. PDF Indexing Status / Pre-Indexing (Consent + Access Checked)
  // ---------------------------------------------------------------------------
  router.post('/pdf/index', async (req: Request, res: Response) => {
    const user = await deps.resolveAuthenticatedUser(req);
    const materialId = typeof req.body?.materialId === 'string' ? req.body.materialId.trim() : '';
    const consentAccepted = Boolean(req.body?.consentAccepted);

    if (!consentAccepted) {
      res.status(400).json({
        error: 'CONSENT_REQUIRED',
        message: 'Confirm document processing consent before extracting PDF pages for AI tutoring.',
      });
      return;
    }

    const material = getMaterialById(materialId);
    if (!material) {
      res.status(404).json({ error: 'MATERIAL_NOT_FOUND', message: 'Selected PDF was not found.' });
      return;
    }

    try {
      const { status } = await pdfIndexer.ensureIndexed(material, Boolean(user));
      res.json({ status });
    } catch (err) {
      sendAiError(res, err);
    }
  });

  // ---------------------------------------------------------------------------
  // 5. SSE Streaming Chat, PDF-Grounded RAG, Doubt Solver & Step-by-Step Tutor
  // ---------------------------------------------------------------------------
  router.post('/chat/stream', async (req: Request, res: Response) => {
    const user = await deps.resolveAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Please sign in to chat with the PrepZone AI Tutor.' });
      return;
    }

    if (!enforceRateAndQuota(user.uid, res)) return;

    if (!isGeminiConfigured()) {
      res.status(503).json({
        error: 'AI_PROVIDER_NOT_CONFIGURED',
        message: 'Server-side GEMINI_API_KEY secret is pending configuration.',
      });
      return;
    }

    const promptCheck = validatePromptInput(req.body?.prompt);
    if (!promptCheck.ok) {
      res.status(400).json({ error: 'INVALID_PROMPT', message: promptCheck.error });
      return;
    }

    const imgCheck = validateImageAttachment(req.body?.imageBase64, req.body?.imageMimeType);
    if (!imgCheck.ok) {
      res.status(400).json({ error: 'INVALID_IMAGE', message: imgCheck.error });
      return;
    }

    const examTrack = normalizeTrack(req.body?.examTrack);
    const languageMode = normalizeLangMode(req.body?.languageMode);
    const workflowMode: AiWorkflowMode =
      req.body?.workflowMode === 'doubt_solver' ||
      req.body?.workflowMode === 'pdf_tutor' ||
      req.body?.workflowMode === 'step_solver'
        ? req.body.workflowMode
        : 'chat';
    const stepByStep = workflowMode === 'step_solver' || Boolean(req.body?.stepByStep);

    const subjectId = typeof req.body?.subjectId === 'string' && req.body.subjectId !== 'all' ? req.body.subjectId : undefined;
    const chapterId = typeof req.body?.chapterId === 'string' && req.body.chapterId !== 'all' ? req.body.chapterId : undefined;
    const materialId = typeof req.body?.materialId === 'string' && req.body.materialId.trim() ? req.body.materialId.trim() : undefined;

    const subject = subjectId ? getSubjectById(examTrack, subjectId) : undefined;
    const chapterMatch = subjectId && chapterId ? getChapterById(examTrack, subjectId, chapterId) : undefined;

    // Optional PDF retrieval
    let citations: AiCitation[] = [];
    let finalUserPrompt = promptCheck.prompt;
    let uncertaintyNotice: string | undefined;

    if (materialId) {
      const material = getMaterialById(materialId);
      if (!material) {
        res.status(404).json({ error: 'MATERIAL_NOT_FOUND', message: 'Selected PDF was not found.' });
        return;
      }
      try {
        const { retrieved } = await pdfIndexer.searchMaterial({
          material,
          query: promptCheck.prompt,
          isAuthenticated: true,
          topK: 4,
        });
        citations = buildPdfCitationsFromChunks(material.title.en, retrieved);
        if (retrieved.length === 0) {
          uncertaintyNotice =
            'No matching excerpt was found in the selected PDF for this question.';
        }
        finalUserPrompt = buildPdfGroundedPrompt({
          question: promptCheck.prompt,
          materialTitle: material.title.en,
          retrievedChunks: retrieved,
          languageMode,
        });
      } catch (err) {
        sendAiError(res, err);
        return;
      }
    } else if (workflowMode === 'doubt_solver') {
      finalUserPrompt = buildDoubtSolverPrompt({
        question: promptCheck.prompt,
        hasImage: Boolean(imgCheck.data),
        examTrack,
        subjectName: subject?.name.en,
        chapterTitle: chapterMatch?.chapter.title.en,
        languageMode,
      });
    }

    // Ensure or create conversation
    let conversationId = typeof req.body?.conversationId === 'string' ? req.body.conversationId.trim() : '';
    let conv = conversationId ? state.conversations[conversationId] : undefined;
    const nowISO = new Date().toISOString();

    if (!conv || conv.uid !== user.uid) {
      conversationId = `conv-${crypto.randomUUID()}`;
      conv = {
        id: conversationId,
        uid: user.uid,
        title: promptCheck.prompt.slice(0, 56) + (promptCheck.prompt.length > 56 ? '...' : ''),
        examTrack,
        subjectId,
        chapterId,
        materialId,
        languageMode,
        messageCount: 0,
        lastMessagePreview: '',
        createdAt: nowISO,
        updatedAt: nowISO,
      };
      state.conversations[conversationId] = conv;
      state.messagesByConversation[conversationId] = [];
    } else {
      conv.examTrack = examTrack;
      conv.languageMode = languageMode;
      if (subjectId) conv.subjectId = subjectId;
      if (chapterId) conv.chapterId = chapterId;
      if (materialId) conv.materialId = materialId;
      if (conv.title === 'New Study Session' && conv.messageCount === 0) {
        conv.title = promptCheck.prompt.slice(0, 56) + (promptCheck.prompt.length > 56 ? '...' : '');
      }
    }

    const existingMsgs = state.messagesByConversation[conversationId] ?? [];
    const historyTurns: GeminiHistoryTurn[] = existingMsgs.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      text: m.content,
    }));

    const userMessage: AiMessage = {
      id: `msg-${crypto.randomUUID()}`,
      conversationId,
      uid: user.uid,
      role: 'user',
      content: promptCheck.prompt,
      workflowMode,
      languageMode,
      hasImageAttachment: Boolean(imgCheck.data),
      imageName: typeof req.body?.imageName === 'string' ? req.body.imageName.slice(0, 80) : undefined,
      tokenEstimate: estimateTokens(promptCheck.prompt),
      status: 'complete',
      createdAt: nowISO,
    };

    const skipUserAppend = Boolean(req.body?.isRetry);
    if (!skipUserAppend) {
      existingMsgs.push(userMessage);
    }

    // Begin SSE stream
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const writeEvent = (event: string, payload: unknown) => {
      if (!res.writableEnded) {
        res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
      }
    };

    const abortController = new AbortController();
    req.on('close', () => {
      abortController.abort();
    });

    writeEvent('meta', {
      conversation: conv,
      userMessage: skipUserAppend ? null : userMessage,
      citations,
      uncertaintyNotice,
    });

    const systemInstruction = buildTutorSystemPrompt({
      examTrack,
      languageMode,
      subjectName: subject?.name.en,
      chapterTitle: chapterMatch?.chapter.title.en,
      stepByStep,
    });

    let accumulated = '';
    try {
      for await (const piece of streamTutorChat({
        systemInstruction,
        prompt: finalUserPrompt,
        history: historyTurns,
        image: imgCheck.data,
        signal: abortController.signal,
      })) {
        if (abortController.signal.aborted) break;
        accumulated += piece;
        writeEvent('chunk', { text: piece });
      }

      const finalContent =
        accumulated.trim() ||
        'Generation stopped before output completed. You can click Retry or adjust your question.';
      const totalTokens = estimateTokens(finalUserPrompt) + estimateTokens(finalContent);
      const usage = recordUsage(user.uid, totalTokens);

      const assistantMsg: AiMessage = {
        id: `msg-${crypto.randomUUID()}`,
        conversationId,
        uid: user.uid,
        role: 'assistant',
        content: finalContent,
        workflowMode,
        languageMode,
        citations: citations.length > 0 ? citations : undefined,
        uncertaintyNotice,
        tokenEstimate: totalTokens,
        status: abortController.signal.aborted ? 'stopped' : 'complete',
        createdAt: new Date().toISOString(),
      };

      existingMsgs.push(assistantMsg);
      state.messagesByConversation[conversationId] = existingMsgs.slice(-120);
      conv.messageCount = state.messagesByConversation[conversationId].length;
      conv.lastMessagePreview = finalContent.replace(/\s+/g, ' ').slice(0, 100);
      conv.updatedAt = assistantMsg.createdAt;
      saveAiState(state);

      writeEvent('done', {
        conversation: conv,
        assistantMessage: assistantMsg,
        usage,
      });
    } catch (err) {
      const code = err instanceof AiProviderError ? err.code : 'AI_STREAM_ERROR';
      const clean = extractReadableGeminiError(err);
      writeEvent('error', { error: code, message: clean.message });
    } finally {
      if (!res.writableEnded) res.end();
    }
  });

  // ---------------------------------------------------------------------------
  // 6. AI Quiz Generator (Preview + Explicit Confirm-to-Save to Question Pool)
  // ---------------------------------------------------------------------------
  router.post('/quiz/generate', async (req: Request, res: Response) => {
    const user = await deps.resolveAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Sign in to generate AI practice quizzes.' });
      return;
    }
    if (!enforceRateAndQuota(user.uid, res)) return;
    if (!isGeminiConfigured()) {
      res.status(503).json({
        error: 'AI_PROVIDER_NOT_CONFIGURED',
        message: 'Server-side GEMINI_API_KEY secret is pending configuration.',
      });
      return;
    }

    const examTrack = normalizeTrack(req.body?.examTrack);
    const subjectId = typeof req.body?.subjectId === 'string' ? req.body.subjectId.trim() : '';
    const chapterId = typeof req.body?.chapterId === 'string' ? req.body.chapterId.trim() : '';
    const topicId = typeof req.body?.topicId === 'string' && req.body.topicId !== 'all' ? req.body.topicId.trim() : '';
    const difficulty =
      req.body?.difficulty === 'easy' || req.body?.difficulty === 'medium' || req.body?.difficulty === 'hard'
        ? req.body.difficulty
        : 'mixed';
    const questionType =
      req.body?.questionType === 'mcq_single' ||
      req.body?.questionType === 'numerical' ||
      req.body?.questionType === 'true_false' ||
      req.body?.questionType === 'short_answer'
        ? req.body.questionType
        : 'mixed';
    const questionCount = Math.min(10, Math.max(2, Number(req.body?.questionCount || 5)));
    const languageMode = normalizeLangMode(req.body?.languageMode);

    const found = getChapterById(examTrack, subjectId, chapterId);
    if (!found) {
      res.status(400).json({
        error: 'INVALID_CURRICULUM_SCOPE',
        message: 'Select a valid Exam, Subject, and Chapter from the curriculum before generating a quiz.',
      });
      return;
    }

    const config: AiQuizGenerateParams = {
      examTrack,
      subjectId,
      chapterId,
      topicId: topicId || undefined,
      difficulty,
      questionType,
      questionCount,
      languageMode,
    };

    try {
      const prompt = buildQuizGenPrompt({
        config,
        subjectName: found.subject.name.en,
        chapter: found.chapter,
      });
      const systemInstruction = buildTutorSystemPrompt({
        examTrack,
        languageMode,
        subjectName: found.subject.name.en,
        chapterTitle: found.chapter.title.en,
      });

      const rawJson = await generateStructuredQuizJson({ systemInstruction, prompt });
      const batchId = `ai-${crypto.randomUUID().slice(0, 8)}`;
      const fallbackTopic = found.chapter.topics[0]?.id ?? `${found.chapter.id}-t1`;

      const sanitized = validateAndSanitizeAiQuiz(rawJson, {
        examTrack,
        subjectId: found.subject.id,
        chapterId: found.chapter.id,
        topicId: topicId || fallbackTopic,
        classLevel: examTrack === 'up-board-12' ? 'class-12' : 'entrance-ug',
        batchId,
      });

      if (sanitized.validQuestions.length === 0) {
        res.status(422).json({
          error: 'AI_QUIZ_VALIDATION_FAILED',
          message: 'Generated quiz failed academic quality validation. Please try again.',
          warnings: sanitized.warnings,
        });
        return;
      }

      const rawTitle = (rawJson as { title?: { en?: string; hi?: string } })?.title;
      const draft: GeneratedQuizDraft = {
        id: `quizdraft-${crypto.randomUUID()}`,
        uid: user.uid,
        title: {
          en: rawTitle?.en?.trim() || `${found.chapter.title.en} — AI Practice Set`,
          hi: rawTitle?.hi?.trim() || `${found.chapter.title.hi} — AI अभ्यास सेट`,
        },
        examTrack,
        subjectId: found.subject.id,
        chapterId: found.chapter.id,
        topicId: topicId || undefined,
        difficulty,
        languageMode,
        questions: sanitized.validQuestions,
        rejectedCount: sanitized.rejectedCount,
        warnings: sanitized.warnings,
        savedToBank: false,
        createdAt: new Date().toISOString(),
      };

      state.quizDraftsById[draft.id] = draft;
      const usage = recordUsage(user.uid, estimateTokens(prompt) + 900);

      res.json({ draft, usage });
    } catch (err) {
      sendAiError(res, err);
    }
  });

  router.post('/quiz/save', async (req: Request, res: Response) => {
    const user = await deps.resolveAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'AUTH_REQUIRED' });
      return;
    }
    const draftId = typeof req.body?.draftId === 'string' ? req.body.draftId.trim() : '';
    const draft = state.quizDraftsById[draftId];
    if (!draft || draft.uid !== user.uid) {
      res.status(404).json({ error: 'QUIZ_DRAFT_NOT_FOUND' });
      return;
    }

    if (!draft.savedToBank) {
      deps.bridge.registerAiGeneratedQuestions?.(draft.questions);
      draft.savedToBank = true;
      saveAiState(state);
    }

    res.json({
      saved: true,
      draft,
      questionIds: draft.questions.map((q) => q.id),
    });
  });

  router.get('/quizzes', async (req: Request, res: Response) => {
    const user = await deps.resolveAuthenticatedUser(req);
    if (!user) {
      res.json({ quizzes: [] });
      return;
    }
    const list = Object.values(state.quizDraftsById)
      .filter((d) => d.uid === user.uid && d.savedToBank)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ quizzes: list });
  });

  // ---------------------------------------------------------------------------
  // 7. AI Chapter Summaries & Study Notes (with Public Caching + PDF Citations)
  // ---------------------------------------------------------------------------
  router.post('/summary', async (req: Request, res: Response) => {
    const user = await deps.resolveAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Sign in to generate or open AI chapter summaries.' });
      return;
    }

    const examTrack = normalizeTrack(req.body?.examTrack);
    const subjectId = typeof req.body?.subjectId === 'string' ? req.body.subjectId.trim() : '';
    const chapterId = typeof req.body?.chapterId === 'string' ? req.body.chapterId.trim() : '';
    const languageMode = normalizeLangMode(req.body?.languageMode);
    const validModes: AiSummaryMode[] = [
      'full',
      'short_revision',
      'definitions',
      'formulas',
      'key_concepts',
      'derivations',
      'quick_notes',
    ];
    const summaryMode: AiSummaryMode = validModes.includes(req.body?.summaryMode)
      ? req.body.summaryMode
      : 'full';
    const materialId = typeof req.body?.materialId === 'string' ? req.body.materialId.trim() : '';
    const forceRefresh = Boolean(req.body?.forceRefresh);

    const found = getChapterById(examTrack, subjectId, chapterId);
    if (!found) {
      res.status(400).json({ error: 'INVALID_CURRICULUM_SCOPE', message: 'Select a valid subject and chapter.' });
      return;
    }

    const cacheKey = `${examTrack}::${subjectId}::${chapterId}::${summaryMode}::${languageMode}::${materialId || 'syllabus'}`;
    if (!forceRefresh && state.summaryCache[cacheKey]) {
      res.json({ summary: { ...state.summaryCache[cacheKey], cached: true } });
      return;
    }

    if (!enforceRateAndQuota(user.uid, res)) return;
    if (!isGeminiConfigured()) {
      res.status(503).json({
        error: 'AI_PROVIDER_NOT_CONFIGURED',
        message: 'Server-side GEMINI_API_KEY secret is pending configuration.',
      });
      return;
    }

    let pdfExcerpts;
    let citations: AiCitation[] = [
      {
        materialTitle: `${found.subject.name.en} — ${found.chapter.title.en} (${examTrack})`,
        excerpt: found.chapter.overview.en,
        sourceKind: 'curriculum',
      },
    ];
    let materialTitle: string | undefined;

    if (materialId) {
      const mat = getMaterialById(materialId);
      if (mat && mat.storageProvider === 'local-signed-storage') {
        try {
          const searchRes = await pdfIndexer.searchMaterial({
            material: mat,
            query: `${found.chapter.title.en} ${found.chapter.topics.map((t) => t.title.en).join(' ')}`,
            isAuthenticated: true,
            topK: 4,
          });
          pdfExcerpts = searchRes.retrieved;
          materialTitle = mat.title.en;
          citations = [...buildPdfCitationsFromChunks(mat.title.en, searchRes.retrieved), ...citations];
        } catch {
          // Non-fatal: fall back cleanly to syllabus context
        }
      }
    }

    try {
      const prompt = buildChapterSummaryPrompt({
        examTrack,
        subjectName: found.subject.name.en,
        chapter: found.chapter,
        summaryMode,
        languageMode,
        pdfExcerpts,
        materialTitle,
      });
      const systemInstruction = buildTutorSystemPrompt({
        examTrack,
        languageMode,
        subjectName: found.subject.name.en,
        chapterTitle: found.chapter.title.en,
      });

      const content = await generateTutorText({
        systemInstruction,
        prompt,
        thinkingLevel: 'low',
      });

      const summary: GeneratedChapterSummary = {
        id: `sum-${crypto.randomUUID()}`,
        examTrack,
        subjectId,
        chapterId,
        summaryMode,
        languageMode,
        content,
        citations,
        cached: false,
        createdAt: new Date().toISOString(),
      };

      state.summaryCache[cacheKey] = summary;
      const usage = recordUsage(user.uid, estimateTokens(prompt) + estimateTokens(content));
      res.json({ summary, usage });
    } catch (err) {
      sendAiError(res, err);
    }
  });

  // ---------------------------------------------------------------------------
  // 8. Real Analytics-Based Study Recommendations (Zero Fabricated Data)
  // ---------------------------------------------------------------------------
  router.post('/recommendations', async (req: Request, res: Response) => {
    const user = await deps.resolveAuthenticatedUser(req);
    const examTrack = normalizeTrack(req.body?.examTrack);
    const language: 'en' | 'hi' = req.body?.language === 'hi' ? 'hi' : 'en';
    const progressMap =
      req.body?.progressMap && typeof req.body.progressMap === 'object'
        ? (req.body.progressMap as ProgressMap)
        : {};
    const selectedSubjectIds = Array.isArray(req.body?.selectedSubjectIds)
      ? req.body.selectedSubjectIds.map(String)
      : undefined;

    const subjects = getSubjectsForExam(
      examTrack,
      examTrack === 'up-board-12' ? 'science' : undefined,
      selectedSubjectIds
    );

    const snapshot =
      user && deps.bridge.getStudentSnapshot
        ? deps.bridge.getStudentSnapshot(user.uid)
        : {
            practiceHistory: [],
            attempts: [],
            analytics: computeStudentAnalytics([], []),
          };

    const recommendations = computeRealStudyRecommendations({
      examTrack,
      subjects: subjects.length > 0 ? subjects : ALL_CURRICULUM_SUBJECTS.filter((s) => s.examTrack === examTrack),
      analytics: snapshot.analytics,
      practiceHistory: snapshot.practiceHistory,
      attempts: snapshot.attempts,
      progressMap,
      language,
    });

    res.json({
      authenticated: Boolean(user),
      hasRealActivity:
        snapshot.practiceHistory.length > 0 ||
        snapshot.attempts.some((a) => a.status === 'submitted') ||
        Object.keys(progressMap).length > 0,
      analytics: snapshot.analytics,
      recommendations,
    });
  });

  // ---------------------------------------------------------------------------
  // 9. Personal Study Plan Generator (Draft Preview -> Student Approve)
  // ---------------------------------------------------------------------------
  router.get('/study-plans', async (req: Request, res: Response) => {
    const user = await deps.resolveAuthenticatedUser(req);
    if (!user) {
      res.json({ plans: [] });
      return;
    }
    const plans = (state.studyPlansByUid[user.uid] ?? []).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
    res.json({ plans });
  });

  router.post('/study-plan/generate', async (req: Request, res: Response) => {
    const user = await deps.resolveAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Sign in to create a personalized study plan.' });
      return;
    }
    if (!enforceRateAndQuota(user.uid, res)) return;
    if (!isGeminiConfigured()) {
      res.status(503).json({
        error: 'AI_PROVIDER_NOT_CONFIGURED',
        message: 'Server-side GEMINI_API_KEY secret is pending configuration.',
      });
      return;
    }

    const validation = validateStudyPlanInputs({
      examTrack: req.body?.examTrack,
      examDateISO: req.body?.examDateISO,
      dailyHours: req.body?.dailyHours,
      selectedSubjectIds: req.body?.selectedSubjectIds,
    });
    if (!validation.ok) {
      res.status(400).json({ error: 'INVALID_PLAN_INPUT', message: validation.error });
      return;
    }

    const languageMode = normalizeLangMode(req.body?.languageMode);
    const progressMap =
      req.body?.progressMap && typeof req.body.progressMap === 'object'
        ? (req.body.progressMap as ProgressMap)
        : {};

    const selectedSubjects = ALL_CURRICULUM_SUBJECTS.filter(
      (s) => s.examTrack === validation.examTrack && validation.selectedSubjectIds.includes(s.id)
    );
    if (selectedSubjects.length === 0) {
      res.status(400).json({ error: 'NO_VALID_SUBJECTS', message: 'Selected subjects do not match the exam track.' });
      return;
    }

    const pendingChaptersSummary: string[] = [];
    for (const sub of selectedSubjects) {
      for (const ch of sub.chapters) {
        const prog = getChapterProgress(progressMap, validation.examTrack, sub.id, ch.id);
        if (prog.status !== 'completed') {
          pendingChaptersSummary.push(`${sub.name.en}: ${ch.title.en} (${prog.status})`);
        }
      }
    }

    const snapshot = deps.bridge.getStudentSnapshot?.(user.uid);
    const weakTopicsSummary =
      snapshot?.analytics.weakChapters.map(
        (wc) => `${wc.subjectId} / ${wc.chapterId} (${wc.accuracyPercent}% accuracy)`
      ) ?? [];

    try {
      const prompt = buildStudyPlanPrompt({
        examTrack: validation.examTrack,
        examDateISO: validation.examDateISO,
        dailyHours: validation.dailyHours,
        selectedSubjects,
        pendingChaptersSummary,
        weakTopicsSummary,
        languageMode,
      });
      const systemInstruction = buildTutorSystemPrompt({
        examTrack: validation.examTrack,
        languageMode,
      });

      const rawPlan = await generateStructuredStudyPlanJson({ systemInstruction, prompt });
      const draftPlan = normalizeGeneratedStudyPlan(rawPlan, {
        id: `plan-${crypto.randomUUID()}`,
        uid: user.uid,
        examTrack: validation.examTrack,
        examDateISO: validation.examDateISO,
        dailyHours: validation.dailyHours,
        selectedSubjectIds: validation.selectedSubjectIds,
      });

      const usage = recordUsage(user.uid, estimateTokens(prompt) + 700);
      res.json({ plan: draftPlan, usage });
    } catch (err) {
      sendAiError(res, err);
    }
  });

  router.post('/study-plan/approve', async (req: Request, res: Response) => {
    const user = await deps.resolveAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'AUTH_REQUIRED' });
      return;
    }
    const rawPlan = req.body?.plan as Partial<AiStudyPlan> | undefined;
    if (!rawPlan || !rawPlan.id || !Array.isArray(rawPlan.weeklySchedule)) {
      res.status(400).json({ error: 'INVALID_PLAN_PAYLOAD' });
      return;
    }

    const approved: AiStudyPlan = {
      id: String(rawPlan.id).slice(0, 128),
      uid: user.uid,
      title: String(rawPlan.title || 'My Study Plan').slice(0, 140),
      examTrack: normalizeTrack(rawPlan.examTrack),
      examDateISO: String(rawPlan.examDateISO || ''),
      dailyHours: Math.min(16, Math.max(0.5, Number(rawPlan.dailyHours || 4))),
      selectedSubjectIds: Array.isArray(rawPlan.selectedSubjectIds)
        ? rawPlan.selectedSubjectIds.map(String).slice(0, 15)
        : [],
      status: 'approved',
      summaryNote: String(rawPlan.summaryNote || '').slice(0, 500),
      dailyTargets: Array.isArray(rawPlan.dailyTargets)
        ? rawPlan.dailyTargets.map(String).slice(0, 10)
        : [],
      weeklySchedule: rawPlan.weeklySchedule.slice(0, 21),
      revisionSprints: Array.isArray(rawPlan.revisionSprints)
        ? rawPlan.revisionSprints.map(String).slice(0, 10)
        : [],
      practiceMilestones: Array.isArray(rawPlan.practiceMilestones)
        ? rawPlan.practiceMilestones.map(String).slice(0, 10)
        : [],
      createdAt: rawPlan.createdAt || new Date().toISOString(),
      approvedAt: new Date().toISOString(),
    };

    const existing = state.studyPlansByUid[user.uid] ?? [];
    const withoutDup = existing.filter((p) => p.id !== approved.id);
    state.studyPlansByUid[user.uid] = [approved, ...withoutDup].slice(0, 20);
    saveAiState(state);

    res.json({ plan: approved });
  });

  return router;
}
