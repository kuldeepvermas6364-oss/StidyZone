import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type Request, type Response, type Router } from 'express';
import { EXAM_CONFIGURATIONS, QUIZ_CATALOG } from '../../src/data/assessments/examConfigurations.ts';
import { CURATED_QUESTION_BANK, toPublicQuestion } from '../../src/data/assessments/questionBankCatalog.ts';
import type {
  AssessmentAttempt,
  ExamConfiguration,
  FullQuestionRecord,
  PracticeHistoryEntry,
  QuestionAnswerKey,
  QuestionBookmarkItem,
  QuestionImportBatch,
  QuestionImportMapping,
  QuestionPublic,
  QuizCategory,
  QuizDefinition,
  StudentAnswerValue,
  StudentPerformanceAnalytics,
} from '../../src/types/assessment.ts';
import type { ExamTrack } from '../../src/types/database.ts';
import {
  evaluateSingleQuestion,
  filterQuestionBank,
  scoreAssessmentAttempt,
  seededShuffle,
  validateAttemptSubmissionWindow,
  type QuestionFilterParams,
} from '../../src/utils/examScoring.ts';
import { applyImportRollback, validateAndMapImportObjects } from '../../src/utils/questionImport.ts';
import { computeStudentAnalytics } from '../../src/utils/weakTopics.ts';

export interface VerifiedRequestUser {
  uid: string;
  email: string;
  provider: 'firebase' | 'local-foundation';
  emailVerified?: boolean;
}

export interface AssessmentBridge {
  registerAiGeneratedQuestions?: (questions: FullQuestionRecord[]) => number;
  getStudentSnapshot?: (uid: string) => {
    practiceHistory: PracticeHistoryEntry[];
    attempts: AssessmentAttempt[];
    analytics: StudentPerformanceAnalytics;
  };
  adminListQuestions?: () => FullQuestionRecord[];
  adminUpsertQuestion?: (question: FullQuestionRecord) => FullQuestionRecord;
  adminDeleteQuestion?: (questionId: string) => boolean;
  adminBulkConfirmImport?: (input: {
    rows: Record<string, unknown>[];
    mapping: QuestionImportMapping;
    sourceKind: QuestionImportBatch['sourceKind'];
    uid: string;
    skipDuplicates?: boolean;
  }) => { insertedCount: number; batch?: QuestionImportBatch; preview: ReturnType<typeof validateAndMapImportObjects> };
  adminListConfigs?: () => {
    examConfigurations: ExamConfiguration[];
    quizzes: QuizDefinition[];
    importBatches: QuestionImportBatch[];
  };
  adminUpsertExamConfig?: (config: ExamConfiguration) => ExamConfiguration;
  adminDeleteExamConfig?: (configId: string) => boolean;
  adminUpsertQuiz?: (quiz: QuizDefinition) => QuizDefinition;
  adminDeleteQuiz?: (quizId: string) => boolean;
  adminGetAllStudentMetrics?: () => {
    attemptsByUid: Record<string, AssessmentAttempt[]>;
    practiceByUid: Record<string, PracticeHistoryEntry[]>;
    totalSubmittedAttempts: number;
  };
}

interface PersistedAssessmentState {
  importedQuestions: FullQuestionRecord[];
  questionOverrides: Record<string, FullQuestionRecord>;
  deletedQuestionIds: string[];
  importBatches: QuestionImportBatch[];
  customExamConfigurations: Record<string, ExamConfiguration>;
  deletedConfigIds: string[];
  customQuizDefinitions: Record<string, QuizDefinition>;
  deletedQuizIds: string[];
  attempts: Record<string, AssessmentAttempt>;
  practiceHistoryByUid: Record<string, PracticeHistoryEntry[]>;
  bookmarksByUid: Record<string, QuestionBookmarkItem[]>;
}

const DEFAULT_STATE: PersistedAssessmentState = {
  importedQuestions: [],
  questionOverrides: {},
  deletedQuestionIds: [],
  importBatches: [],
  customExamConfigurations: {},
  deletedConfigIds: [],
  customQuizDefinitions: {},
  deletedQuizIds: [],
  attempts: {},
  practiceHistoryByUid: {},
  bookmarksByUid: {},
};

const STATE_DIR = path.resolve(process.cwd(), 'storage', 'assessments');
const STATE_FILE = path.join(STATE_DIR, 'state.json');

function loadState(): PersistedAssessmentState {
  try {
    if (!fs.existsSync(STATE_FILE)) {
      fs.mkdirSync(STATE_DIR, { recursive: true });
      return structuredClone(DEFAULT_STATE);
    }
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PersistedAssessmentState>;
    return {
      importedQuestions: Array.isArray(parsed.importedQuestions) ? parsed.importedQuestions : [],
      questionOverrides:
        parsed.questionOverrides && typeof parsed.questionOverrides === 'object'
          ? parsed.questionOverrides
          : {},
      deletedQuestionIds: Array.isArray(parsed.deletedQuestionIds) ? parsed.deletedQuestionIds : [],
      importBatches: Array.isArray(parsed.importBatches) ? parsed.importBatches : [],
      customExamConfigurations:
        parsed.customExamConfigurations && typeof parsed.customExamConfigurations === 'object'
          ? parsed.customExamConfigurations
          : {},
      deletedConfigIds: Array.isArray(parsed.deletedConfigIds) ? parsed.deletedConfigIds : [],
      customQuizDefinitions:
        parsed.customQuizDefinitions && typeof parsed.customQuizDefinitions === 'object'
          ? parsed.customQuizDefinitions
          : {},
      deletedQuizIds: Array.isArray(parsed.deletedQuizIds) ? parsed.deletedQuizIds : [],
      attempts: parsed.attempts && typeof parsed.attempts === 'object' ? parsed.attempts : {},
      practiceHistoryByUid:
        parsed.practiceHistoryByUid && typeof parsed.practiceHistoryByUid === 'object'
          ? parsed.practiceHistoryByUid
          : {},
      bookmarksByUid:
        parsed.bookmarksByUid && typeof parsed.bookmarksByUid === 'object' ? parsed.bookmarksByUid : {},
    };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function saveState(state: PersistedAssessmentState): void {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    const tmpFile = `${STATE_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), 'utf8');
    fs.renameSync(tmpFile, STATE_FILE);
  } catch {
    // Ignore disk write failure gracefully without crashing HTTP loop
  }
}

// Per-user sliding window rate limiter
const rateBuckets = new Map<string, number[]>();
function checkRateLimit(uid: string, action: string, limitPerMin: number): boolean {
  const key = `${uid}::${action}`;
  const now = Date.now();
  const windowStart = now - 60_000;
  const recent = (rateBuckets.get(key) ?? []).filter((ts) => ts > windowStart);
  if (recent.length >= limitPerMin) {
    rateBuckets.set(key, recent);
    return false;
  }
  recent.push(now);
  rateBuckets.set(key, recent);
  return true;
}

export function createAssessmentRouter(deps: {
  resolveAuthenticatedUser: (req: Request) => Promise<VerifiedRequestUser | null>;
  bridge?: AssessmentBridge;
}): Router {
  const router = express.Router();
  const state = loadState();

  function getAllQuestions(includeUnpublished = true): FullQuestionRecord[] {
    const deletedSet = new Set(state.deletedQuestionIds);
    const merged = new Map<string, FullQuestionRecord>();
    for (const q of [...CURATED_QUESTION_BANK, ...state.importedQuestions]) {
      if (!deletedSet.has(q.id)) {
        merged.set(q.id, state.questionOverrides[q.id] ?? q);
      }
    }
    for (const [id, q] of Object.entries(state.questionOverrides)) {
      if (!deletedSet.has(id) && !merged.has(id)) {
        merged.set(id, q);
      }
    }
    const all = Array.from(merged.values());
    return includeUnpublished ? all : all.filter((q) => q.isPublished);
  }

  function getAllExamConfigs(includeUnpublished = true): ExamConfiguration[] {
    const deletedSet = new Set(state.deletedConfigIds);
    const merged = new Map<string, ExamConfiguration>();
    for (const cfg of EXAM_CONFIGURATIONS) {
      if (!deletedSet.has(cfg.id)) {
        merged.set(cfg.id, state.customExamConfigurations[cfg.id] ?? cfg);
      }
    }
    for (const [id, cfg] of Object.entries(state.customExamConfigurations)) {
      if (!deletedSet.has(id) && !merged.has(id)) {
        merged.set(id, cfg);
      }
    }
    const all = Array.from(merged.values());
    return includeUnpublished ? all : all.filter((c) => c.isPublished);
  }

  function getAllQuizzes(includeUnpublished = true): QuizDefinition[] {
    const deletedSet = new Set(state.deletedQuizIds);
    const merged = new Map<string, QuizDefinition>();
    for (const q of QUIZ_CATALOG) {
      if (!deletedSet.has(q.id)) {
        merged.set(q.id, state.customQuizDefinitions[q.id] ?? q);
      }
    }
    for (const [id, q] of Object.entries(state.customQuizDefinitions)) {
      if (!deletedSet.has(id) && !merged.has(id)) {
        merged.set(id, q);
      }
    }
    const all = Array.from(merged.values());
    return includeUnpublished ? all : all.filter((q) => q.isPublished);
  }

  function getQuestionMap(): Map<string, FullQuestionRecord> {
    const map = new Map<string, FullQuestionRecord>();
    for (const q of getAllQuestions(true)) {
      map.set(q.id, q);
    }
    return map;
  }

  if (deps.bridge) {
    deps.bridge.registerAiGeneratedQuestions = (questions: FullQuestionRecord[]): number => {
      const existingIds = new Set(getAllQuestions(true).map((q) => q.id));
      const unique = questions.filter((q) => !existingIds.has(q.id));
      if (unique.length === 0) return 0;
      state.importedQuestions.push(...unique);
      saveState(state);
      return unique.length;
    };
    deps.bridge.getStudentSnapshot = (uid: string) => {
      const userAttempts = Object.values(state.attempts)
        .filter((a) => a.uid === uid)
        .sort((a, b) => b.startedAtServerMs - a.startedAtServerMs);
      const practiceHistory = state.practiceHistoryByUid[uid] ?? [];
      const analytics = computeStudentAnalytics(
        practiceHistory,
        userAttempts.filter((a) => a.status === 'submitted')
      );
      return {
        practiceHistory,
        attempts: userAttempts,
        analytics,
      };
    };
    deps.bridge.adminListQuestions = () => getAllQuestions(true);
    deps.bridge.adminUpsertQuestion = (question: FullQuestionRecord) => {
      state.deletedQuestionIds = state.deletedQuestionIds.filter((id) => id !== question.id);
      state.questionOverrides[question.id] = question;
      saveState(state);
      return question;
    };
    deps.bridge.adminDeleteQuestion = (questionId: string) => {
      const exists = getQuestionMap().has(questionId);
      if (!exists) return false;
      if (!state.deletedQuestionIds.includes(questionId)) {
        state.deletedQuestionIds.push(questionId);
      }
      delete state.questionOverrides[questionId];
      state.importedQuestions = state.importedQuestions.filter((q) => q.id !== questionId);
      saveState(state);
      return true;
    };
    deps.bridge.adminBulkConfirmImport = (input) => {
      const batchId = `imp-${Date.now()}`;
      const preview = validateAndMapImportObjects(
        input.rows,
        input.mapping,
        getAllQuestions(true),
        batchId
      );
      const dupIdSet = new Set(preview.duplicateIds);
      const dupPromptRowSet = new Set(preview.duplicatePrompts.map((d) => d.rowNumber));
      const skip = input.skipDuplicates !== false;
      const toInsert = skip
        ? preview.validQuestions.filter((q, idx) => !dupIdSet.has(q.id) && !dupPromptRowSet.has(idx + 1))
        : preview.validQuestions;
      if (toInsert.length === 0) {
        return { insertedCount: 0, preview };
      }
      state.importedQuestions.push(...toInsert);
      const batch: QuestionImportBatch = {
        batchId,
        importedAt: new Date().toISOString(),
        importedByUid: input.uid,
        sourceKind: input.sourceKind,
        questionIds: toInsert.map((q) => q.id),
        count: toInsert.length,
      };
      state.importBatches.unshift(batch);
      saveState(state);
      return { insertedCount: toInsert.length, batch, preview };
    };
    deps.bridge.adminListConfigs = () => ({
      examConfigurations: getAllExamConfigs(true),
      quizzes: getAllQuizzes(true),
      importBatches: state.importBatches,
    });
    deps.bridge.adminUpsertExamConfig = (config: ExamConfiguration) => {
      state.deletedConfigIds = state.deletedConfigIds.filter((id) => id !== config.id);
      state.customExamConfigurations[config.id] = config;
      saveState(state);
      return config;
    };
    deps.bridge.adminDeleteExamConfig = (configId: string) => {
      if (!state.deletedConfigIds.includes(configId)) {
        state.deletedConfigIds.push(configId);
      }
      delete state.customExamConfigurations[configId];
      saveState(state);
      return true;
    };
    deps.bridge.adminUpsertQuiz = (quiz: QuizDefinition) => {
      state.deletedQuizIds = state.deletedQuizIds.filter((id) => id !== quiz.id);
      state.customQuizDefinitions[quiz.id] = quiz;
      saveState(state);
      return quiz;
    };
    deps.bridge.adminDeleteQuiz = (quizId: string) => {
      if (!state.deletedQuizIds.includes(quizId)) {
        state.deletedQuizIds.push(quizId);
      }
      delete state.customQuizDefinitions[quizId];
      saveState(state);
      return true;
    };
    deps.bridge.adminGetAllStudentMetrics = () => {
      const attemptsByUid: Record<string, AssessmentAttempt[]> = {};
      let totalSubmittedAttempts = 0;
      for (const att of Object.values(state.attempts)) {
        if (!attemptsByUid[att.uid]) attemptsByUid[att.uid] = [];
        attemptsByUid[att.uid].push(att);
        if (att.status === 'submitted') totalSubmittedAttempts += 1;
      }
      return {
        attemptsByUid,
        practiceByUid: state.practiceHistoryByUid,
        totalSubmittedAttempts,
      };
    };
  }

  function getAttemptStatsMap(uid: string): Map<string, { attempted: boolean; lastCorrect?: boolean }> {
    const map = new Map<string, { attempted: boolean; lastCorrect?: boolean }>();
    const prac = state.practiceHistoryByUid[uid] ?? [];
    for (const entry of prac) {
      map.set(entry.questionId, { attempted: true, lastCorrect: entry.isCorrect });
    }
    for (const att of Object.values(state.attempts)) {
      if (att.uid !== uid || att.status !== 'submitted' || !att.result) continue;
      for (const qr of att.result.questionResults) {
        if (qr.status === 'unanswered') continue;
        map.set(qr.questionId, {
          attempted: true,
          lastCorrect: qr.status === 'correct' || (qr.status === 'self_evaluated' && qr.awardedMarks > 0),
        });
      }
    }
    return map;
  }

  function buildAnswerKeysMap(questionIds: string[]): Record<string, QuestionAnswerKey> {
    const qMap = getQuestionMap();
    const out: Record<string, QuestionAnswerKey> = {};
    for (const id of questionIds) {
      const q = qMap.get(id);
      if (q) out[id] = q.answerKey;
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // 1. Configs & Quizzes Catalog (Published only for students)
  // ---------------------------------------------------------------------------
  router.get('/configs', (_req: Request, res: Response) => {
    const publishedQuestions = getAllQuestions(false);
    res.json({
      examConfigurations: getAllExamConfigs(false),
      quizzes: getAllQuizzes(false),
      importBatches: state.importBatches,
      totalQuestionCount: publishedQuestions.length,
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Public Question Bank Search / Filter / Pagination (NO Answer Keys!)
  // ---------------------------------------------------------------------------
  router.get('/questions', async (req: Request, res: Response) => {
    const user = await deps.resolveAuthenticatedUser(req);
    const allPub: QuestionPublic[] = getAllQuestions(false).map(toPublicQuestion);

    const qStr = (name: string): string | undefined => {
      const val = req.query[name];
      return typeof val === 'string' && val.trim().length > 0 ? val.trim() : undefined;
    };

    const filters: QuestionFilterParams = {
      query: qStr('query'),
      examTrack: (qStr('examTrack') as QuestionFilterParams['examTrack']) ?? 'all',
      academicSession: qStr('academicSession') ?? 'all',
      classLevel: (qStr('classLevel') as QuestionFilterParams['classLevel']) ?? 'all',
      subjectId: qStr('subjectId') ?? 'all',
      chapterId: qStr('chapterId') ?? 'all',
      topicId: qStr('topicId') ?? 'all',
      difficulty: (qStr('difficulty') as QuestionFilterParams['difficulty']) ?? 'all',
      questionType: (qStr('questionType') as QuestionFilterParams['questionType']) ?? 'all',
      sourceType: (qStr('sourceType') as QuestionFilterParams['sourceType']) ?? 'all',
      academicYear: qStr('academicYear') ?? 'all',
      attemptFilter: (qStr('attemptFilter') as QuestionFilterParams['attemptFilter']) ?? 'all',
    };

    const attemptStats = user ? getAttemptStatsMap(user.uid) : undefined;
    const filtered = filterQuestionBank(allPub, filters, attemptStats);

    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize || 12)));
    const totalCount = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const safePage = Math.min(page, totalPages);
    const items = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

    res.json({
      totalCount,
      page: safePage,
      pageSize,
      totalPages,
      questions: items,
    });
  });

  // Reveal solution in Question Bank browse (blocked if caller has active timed exam containing this question)
  router.get('/questions/:questionId/reveal', async (req: Request, res: Response) => {
    const questionId = req.params.questionId;
    const user = await deps.resolveAuthenticatedUser(req);
    const q = getQuestionMap().get(questionId);
    if (!q || !q.isPublished) {
      res.status(404).json({ error: 'QUESTION_NOT_FOUND' });
      return;
    }

    if (user) {
      const activeCollision = Object.values(state.attempts).some(
        (att) =>
          att.uid === user.uid &&
          att.status === 'in_progress' &&
          att.questionIds.includes(questionId)
      );
      if (activeCollision) {
        res.status(403).json({
          error: 'ACTIVE_EXAM_LOCK',
          message: 'Answer keys are locked while you have an active timed test containing this question.',
        });
        return;
      }
    }

    res.json({ answerKey: q.answerKey });
  });

  // ---------------------------------------------------------------------------
  // 3. Practice Mode Immediate Verification (Server-scored, separate from Exam)
  // ---------------------------------------------------------------------------
  router.post('/practice/check', async (req: Request, res: Response) => {
    const user = await deps.resolveAuthenticatedUser(req);
    const questionId = typeof req.body?.questionId === 'string' ? req.body.questionId.trim() : '';
    const answer = (req.body?.answer ?? {}) as StudentAnswerValue;
    const markedForRevision = Boolean(req.body?.markedForRevision);
    const savedDifficult = Boolean(req.body?.savedDifficult);

    const q = getQuestionMap().get(questionId);
    if (!q || !q.isPublished) {
      res.status(404).json({ error: 'QUESTION_NOT_FOUND' });
      return;
    }

    if (user) {
      if (!checkRateLimit(user.uid, 'practice_check', 60)) {
        res.status(429).json({ error: 'RATE_LIMIT_EXCEEDED' });
        return;
      }
      const activeCollision = Object.values(state.attempts).some(
        (att) =>
          att.uid === user.uid &&
          att.status === 'in_progress' &&
          att.questionIds.includes(questionId)
      );
      if (activeCollision) {
        res.status(403).json({
          error: 'ACTIVE_EXAM_LOCK',
          message: 'Cannot check practice answers for a question currently inside an active timed test.',
        });
        return;
      }
    }

    const evaluation = evaluateSingleQuestion(q, answer);
    const isCorrect =
      evaluation.status === 'correct' ||
      (evaluation.status === 'self_evaluated' && evaluation.awardedMarks >= evaluation.maxMarks * 0.6);

    let historyEntry: PracticeHistoryEntry | null = null;
    if (user) {
      historyEntry = {
        id: `prac-${crypto.randomUUID()}`,
        uid: user.uid,
        questionId: q.id,
        examTrack: q.examTrack,
        subjectId: q.subjectId,
        chapterId: q.chapterId,
        topicId: q.topicId,
        questionType: q.questionType,
        difficulty: q.difficulty,
        isCorrect,
        status: evaluation.status,
        awardedMarks: evaluation.awardedMarks,
        maxMarks: evaluation.maxMarks,
        studentAnswer: answer,
        markedForRevision,
        savedDifficult,
        attemptedAt: new Date().toISOString(),
      };
      const existing = state.practiceHistoryByUid[user.uid] ?? [];
      state.practiceHistoryByUid[user.uid] = [historyEntry, ...existing].slice(0, 400);
      saveState(state);
    }

    res.json({
      evaluation,
      answerKey: q.answerKey,
      historyEntry,
      persisted: Boolean(user),
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Start or Resume Timed Quiz / CBT Exam / UP Board Paper (Authenticated)
  // ---------------------------------------------------------------------------
  router.post('/attempts/start', async (req: Request, res: Response) => {
    const user = await deps.resolveAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({
        error: 'AUTH_REQUIRED',
        message: 'Please sign in to start and save a timed quiz or mock exam.',
      });
      return;
    }

    if (!checkRateLimit(user.uid, 'attempt_start', 20)) {
      res.status(429).json({ error: 'RATE_LIMIT_EXCEEDED' });
      return;
    }

    const kind = req.body?.kind as AssessmentAttempt['kind'];
    const configId = typeof req.body?.configId === 'string' ? req.body.configId.trim() : '';
    const customConfig = req.body?.customQuiz as
      | {
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
        }
      | undefined;

    const allQuestions = getAllQuestions().filter((q) => q.isPublished);
    const qMap = getQuestionMap();

    // Check if caller already has an active in-progress attempt for the same configId (resume!)
    const resumeAllowed = req.body?.forceNew !== true;
    if (resumeAllowed && configId) {
      const existingActive = Object.values(state.attempts).find(
        (a) => a.uid === user.uid && a.configId === configId && a.status === 'in_progress'
      );
      if (existingActive) {
        const questions = existingActive.questionIds
          .map((id) => qMap.get(id))
          .filter((item): item is FullQuestionRecord => Boolean(item))
          .map(toPublicQuestion);
        res.json({ attempt: existingActive, questions, resumed: true });
        return;
      }
    }

    let resolvedTitle = { en: 'Custom Practice Quiz', hi: 'कस्टम अभ्यास क्विज़' };
    let resolvedTrack: ExamTrack = 'jee-main';
    let durationMinutes = 15;
    let selectedIds: string[] = [];
    let quizType: QuizCategory | undefined;
    let resolvedKind: AssessmentAttempt['kind'] = kind || 'quiz';

    const allExamConfigs = getAllExamConfigs(false);
    const allQuizzes = getAllQuizzes(false);

    if (kind === 'cbt_mock' || kind === 'up_board_exam') {
      const cfg: ExamConfiguration | undefined = allExamConfigs.find((c) => c.id === configId);
      if (!cfg) {
        res.status(404).json({ error: 'EXAM_CONFIG_NOT_FOUND' });
        return;
      }
      resolvedTitle = cfg.title;
      resolvedTrack = cfg.examTrack;
      durationMinutes = cfg.durationMinutes;
      resolvedKind = cfg.mode === 'up_board_descriptive' ? 'up_board_exam' : 'cbt_mock';
      selectedIds = (cfg.questionIds ?? []).filter((id) => qMap.has(id) && qMap.get(id)!.isPublished);
      if (cfg.shuffleQuestions) {
        selectedIds = seededShuffle(selectedIds, Date.now() % 100000);
      }
    } else if (configId && allQuizzes.some((q) => q.id === configId)) {
      const quiz: QuizDefinition = allQuizzes.find((q) => q.id === configId)!;
      resolvedTitle = quiz.title;
      resolvedTrack = quiz.examTrack;
      durationMinutes = quiz.durationMinutes;
      quizType = quiz.quizType;
      selectedIds = (quiz.questionIds ?? []).filter((id) => qMap.has(id) && qMap.get(id)!.isPublished);
      if (quiz.shuffleQuestions) {
        selectedIds = seededShuffle(selectedIds, Date.now() % 100000);
      }
    } else if (customConfig) {
      resolvedTrack = customConfig.examTrack ?? 'jee-main';
      quizType = customConfig.quizType ?? 'custom_quiz';
      durationMinutes = Math.min(180, Math.max(5, Number(customConfig.durationMinutes || 15)));
      resolvedTitle = customConfig.title ?? {
        en: 'Custom Timed Quiz',
        hi: 'कस्टम समयबद्ध क्विज़',
      };

      if (Array.isArray(customConfig.questionIds) && customConfig.questionIds.length > 0) {
        selectedIds = customConfig.questionIds.filter((id) => qMap.has(id));
      } else {
        const pool = filterQuestionBank(
          allQuestions.map(toPublicQuestion),
          {
            examTrack: customConfig.examTrack ?? 'all',
            subjectId: customConfig.subjectId ?? 'all',
            chapterId: customConfig.chapterId ?? 'all',
            topicId: customConfig.topicId ?? 'all',
            difficulty: (customConfig.difficulty as QuestionFilterParams['difficulty']) ?? 'all',
          }
        );
        const count = Math.min(30, Math.max(1, Number(customConfig.questionCount || 5)));
        selectedIds = seededShuffle(pool, Date.now() % 100000)
          .slice(0, count)
          .map((q) => q.id);
      }
    } else {
      res.status(400).json({ error: 'INVALID_START_PAYLOAD' });
      return;
    }

    if (selectedIds.length === 0) {
      res.status(400).json({
        error: 'NO_QUESTIONS_AVAILABLE',
        message: 'No published questions matched this configuration.',
      });
      return;
    }

    const nowMs = Date.now();
    const durationSeconds = durationMinutes * 60;
    const attempt: AssessmentAttempt = {
      id: `att-${crypto.randomUUID()}`,
      uid: user.uid,
      kind: resolvedKind,
      configId: configId || `custom-${quizType ?? 'quiz'}`,
      quizType,
      examTrack: resolvedTrack,
      title: resolvedTitle,
      status: 'in_progress',
      startedAtServerMs: nowMs,
      expiresAtServerMs: nowMs + durationSeconds * 1000,
      durationSeconds,
      timeSpentSeconds: 0,
      questionIds: selectedIds,
      optionSeed: (nowMs % 99991) + 17,
      currentQuestionIndex: 0,
      visitedIds: [selectedIds[0]],
      markedForReviewIds: [],
      answers: {},
      questionTimeSeconds: {},
    };

    state.attempts[attempt.id] = attempt;
    saveState(state);

    const questions = selectedIds
      .map((id) => qMap.get(id))
      .filter((item): item is FullQuestionRecord => Boolean(item))
      .map(toPublicQuestion);

    res.status(201).json({ attempt, questions, resumed: false });
  });

  // ---------------------------------------------------------------------------
  // 5. Autosave In-Progress Attempt Answers & Navigation State
  // ---------------------------------------------------------------------------
  router.put('/attempts/:attemptId/autosave', async (req: Request, res: Response) => {
    const user = await deps.resolveAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'AUTH_REQUIRED' });
      return;
    }
    const attempt = state.attempts[req.params.attemptId];
    if (!attempt || attempt.uid !== user.uid) {
      res.status(404).json({ error: 'ATTEMPT_NOT_FOUND' });
      return;
    }
    if (attempt.status !== 'in_progress') {
      res.status(409).json({
        error: 'ATTEMPT_ALREADY_SUBMITTED',
        attempt,
      });
      return;
    }

    const body = req.body as Partial<AssessmentAttempt>;
    if (body.answers && typeof body.answers === 'object') {
      attempt.answers = body.answers;
    }
    if (Array.isArray(body.visitedIds)) {
      attempt.visitedIds = Array.from(new Set(body.visitedIds.map(String))).slice(0, 200);
    }
    if (Array.isArray(body.markedForReviewIds)) {
      attempt.markedForReviewIds = Array.from(new Set(body.markedForReviewIds.map(String))).slice(0, 200);
    }
    if (typeof body.currentQuestionIndex === 'number' && body.currentQuestionIndex >= 0) {
      attempt.currentQuestionIndex = Math.min(attempt.questionIds.length - 1, body.currentQuestionIndex);
    }
    if (typeof body.timeSpentSeconds === 'number' && body.timeSpentSeconds >= 0) {
      attempt.timeSpentSeconds = Math.min(attempt.durationSeconds + 300, Math.round(body.timeSpentSeconds));
    }
    if (body.questionTimeSeconds && typeof body.questionTimeSeconds === 'object') {
      attempt.questionTimeSeconds = body.questionTimeSeconds;
    }

    saveState(state);
    res.json({ ok: true, savedAtMs: Date.now() });
  });

  // ---------------------------------------------------------------------------
  // 6. Secure Server-Side Attempt Submission & Scoring (Idempotent Guard)
  // ---------------------------------------------------------------------------
  router.post('/attempts/:attemptId/submit', async (req: Request, res: Response) => {
    const user = await deps.resolveAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'AUTH_REQUIRED' });
      return;
    }

    if (!checkRateLimit(user.uid, 'attempt_submit', 30)) {
      res.status(429).json({ error: 'RATE_LIMIT_EXCEEDED' });
      return;
    }

    const attempt = state.attempts[req.params.attemptId];
    if (!attempt || attempt.uid !== user.uid) {
      res.status(404).json({ error: 'ATTEMPT_NOT_FOUND' });
      return;
    }

    // Duplicate-submission lock: return existing locked result idempotently
    if (attempt.status === 'submitted') {
      res.json({
        alreadySubmitted: true,
        attempt,
        answerKeys: buildAnswerKeysMap(attempt.questionIds),
      });
      return;
    }

    const nowMs = Date.now();
    const autoSubmitted = Boolean(req.body?.autoSubmitted);
    const windowCheck = validateAttemptSubmissionWindow(attempt, nowMs, 180_000);

    // Apply final client answers payload if sent along with submit
    if (req.body?.answers && typeof req.body.answers === 'object') {
      attempt.answers = req.body.answers as Record<string, StudentAnswerValue>;
    }
    if (typeof req.body?.timeSpentSeconds === 'number') {
      attempt.timeSpentSeconds = Math.max(
        0,
        Math.min(attempt.durationSeconds + 180, Math.round(req.body.timeSpentSeconds))
      );
    } else {
      attempt.timeSpentSeconds = Math.min(attempt.durationSeconds, windowCheck.elapsedSeconds);
    }

    const qMap = getQuestionMap();
    const fullQuestions = attempt.questionIds
      .map((id) => qMap.get(id))
      .filter((item): item is FullQuestionRecord => Boolean(item));

    const result = scoreAssessmentAttempt(
      fullQuestions,
      attempt.answers,
      attempt.timeSpentSeconds,
      attempt.questionTimeSeconds
    );

    attempt.status = 'submitted';
    attempt.submittedAtServerMs = nowMs;
    attempt.autoSubmitted = autoSubmitted;
    attempt.lateFlag = windowCheck.lateFlag;
    attempt.result = result;

    saveState(state);

    res.json({
      alreadySubmitted: false,
      attempt,
      answerKeys: buildAnswerKeysMap(attempt.questionIds),
    });
  });

  // ---------------------------------------------------------------------------
  // 7. UP Board Descriptive Self-Review Marks Entry (Post-Submission Only)
  // ---------------------------------------------------------------------------
  router.post('/attempts/:attemptId/self-review', async (req: Request, res: Response) => {
    const user = await deps.resolveAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'AUTH_REQUIRED' });
      return;
    }
    const attempt = state.attempts[req.params.attemptId];
    if (!attempt || attempt.uid !== user.uid) {
      res.status(404).json({ error: 'ATTEMPT_NOT_FOUND' });
      return;
    }
    if (attempt.status !== 'submitted') {
      res.status(400).json({ error: 'SUBMIT_REQUIRED_BEFORE_REVIEW' });
      return;
    }

    const questionId = typeof req.body?.questionId === 'string' ? req.body.questionId : '';
    const marks = Number(req.body?.marks);
    const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 500) : undefined;

    const q = getQuestionMap().get(questionId);
    if (!q || !attempt.questionIds.includes(questionId)) {
      res.status(404).json({ error: 'QUESTION_NOT_IN_ATTEMPT' });
      return;
    }
    if (!Number.isFinite(marks) || marks < 0 || marks > q.marks) {
      res.status(400).json({ error: 'INVALID_REVIEW_MARKS' });
      return;
    }

    const prevAns = attempt.answers[questionId] ?? {};
    attempt.answers[questionId] = {
      ...prevAns,
      selfEvaluatedMarks: Math.round(marks * 100) / 100,
      selfEvaluationNote: note,
    };

    const qMap = getQuestionMap();
    const fullQuestions = attempt.questionIds
      .map((id) => qMap.get(id))
      .filter((item): item is FullQuestionRecord => Boolean(item));
    attempt.result = scoreAssessmentAttempt(
      fullQuestions,
      attempt.answers,
      attempt.timeSpentSeconds,
      attempt.questionTimeSeconds
    );
    saveState(state);

    res.json({ attempt });
  });

  // ---------------------------------------------------------------------------
  // 8. Fetch Attempt History / Specific Attempt Review (Owner-Isolated)
  // ---------------------------------------------------------------------------
  router.get('/attempts/:attemptId', async (req: Request, res: Response) => {
    const user = await deps.resolveAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'AUTH_REQUIRED' });
      return;
    }
    const attempt = state.attempts[req.params.attemptId];
    if (!attempt || attempt.uid !== user.uid) {
      res.status(404).json({ error: 'ATTEMPT_NOT_FOUND' });
      return;
    }

    const qMap = getQuestionMap();
    const questions = attempt.questionIds
      .map((id) => qMap.get(id))
      .filter((item): item is FullQuestionRecord => Boolean(item))
      .map(toPublicQuestion);

    res.json({
      attempt,
      questions,
      answerKeys: attempt.status === 'submitted' ? buildAnswerKeysMap(attempt.questionIds) : {},
    });
  });

  // ---------------------------------------------------------------------------
  // 9. Student Real Analytics, History & Question Bookmarks (Zero Fake Data)
  // ---------------------------------------------------------------------------
  router.get('/analytics', async (req: Request, res: Response) => {
    const user = await deps.resolveAuthenticatedUser(req);
    if (!user) {
      res.json({
        authenticated: false,
        analytics: computeStudentAnalytics([], []),
        attempts: [],
        practiceHistory: [],
        questionBookmarks: [],
      });
      return;
    }

    const userAttempts = Object.values(state.attempts)
      .filter((a) => a.uid === user.uid)
      .sort((a, b) => b.startedAtServerMs - a.startedAtServerMs);
    const practiceHistory = state.practiceHistoryByUid[user.uid] ?? [];
    const questionBookmarks = state.bookmarksByUid[user.uid] ?? [];

    const analytics = computeStudentAnalytics(
      practiceHistory,
      userAttempts.filter((a) => a.status === 'submitted')
    );

    res.json({
      authenticated: true,
      analytics,
      attempts: userAttempts,
      practiceHistory,
      questionBookmarks,
    });
  });

  router.post('/bookmarks/toggle', async (req: Request, res: Response) => {
    const user = await deps.resolveAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'AUTH_REQUIRED' });
      return;
    }

    const questionId = typeof req.body?.questionId === 'string' ? req.body.questionId.trim() : '';
    const tag = (req.body?.tag as QuestionBookmarkItem['tag']) ?? 'bookmark';
    const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 400) : undefined;
    const q = getQuestionMap().get(questionId);
    if (!q) {
      res.status(404).json({ error: 'QUESTION_NOT_FOUND' });
      return;
    }

    const list = state.bookmarksByUid[user.uid] ?? [];
    const existingIdx = list.findIndex((b) => b.questionId === questionId && b.tag === tag);
    let saved = false;
    if (existingIdx >= 0) {
      list.splice(existingIdx, 1);
    } else {
      list.unshift({
        id: `qbm-${crypto.randomUUID()}`,
        uid: user.uid,
        questionId: q.id,
        examTrack: q.examTrack,
        subjectId: q.subjectId,
        chapterId: q.chapterId,
        tag,
        note,
        createdAt: new Date().toISOString(),
      });
      saved = true;
    }
    state.bookmarksByUid[user.uid] = list;
    saveState(state);

    res.json({ saved, bookmarks: list });
  });

  // ---------------------------------------------------------------------------
  // 10. Question Import Architecture (Preview, Confirm, Rollback)
  // ---------------------------------------------------------------------------
  router.post('/import/preview', async (req: Request, res: Response) => {
    const user = await deps.resolveAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'AUTH_REQUIRED' });
      return;
    }

    const rows = Array.isArray(req.body?.rows) ? (req.body.rows as Record<string, unknown>[]) : [];
    const mapping = (req.body?.mapping ?? {}) as QuestionImportMapping;

    if (rows.length === 0 || rows.length > 500) {
      res.status(400).json({ error: 'INVALID_ROW_COUNT' });
      return;
    }

    const preview = validateAndMapImportObjects(rows, mapping, getAllQuestions());
    res.json({ preview });
  });

  router.post('/import/confirm', async (req: Request, res: Response) => {
    const user = await deps.resolveAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'AUTH_REQUIRED' });
      return;
    }

    const rows = Array.isArray(req.body?.rows) ? (req.body.rows as Record<string, unknown>[]) : [];
    const mapping = (req.body?.mapping ?? {}) as QuestionImportMapping;
    const sourceKind = (req.body?.sourceKind as QuestionImportBatch['sourceKind']) ?? 'csv';
    const skipDuplicates = req.body?.skipDuplicates !== false;

    if (rows.length === 0 || rows.length > 500) {
      res.status(400).json({ error: 'INVALID_ROW_COUNT' });
      return;
    }

    const batchId = `imp-${Date.now()}`;
    const preview = validateAndMapImportObjects(rows, mapping, getAllQuestions(), batchId);
    const dupIdSet = new Set(preview.duplicateIds);
    const dupPromptRowSet = new Set(preview.duplicatePrompts.map((d) => d.rowNumber));

    const toInsert = skipDuplicates
      ? preview.validQuestions.filter((q, idx) => !dupIdSet.has(q.id) && !dupPromptRowSet.has(idx + 1))
      : preview.validQuestions;

    if (toInsert.length === 0) {
      res.status(400).json({
        error: 'NO_VALID_UNIQUE_QUESTIONS',
        preview,
      });
      return;
    }

    state.importedQuestions.push(...toInsert);
    const batch: QuestionImportBatch = {
      batchId,
      importedAt: new Date().toISOString(),
      importedByUid: user.uid,
      sourceKind,
      questionIds: toInsert.map((q) => q.id),
      count: toInsert.length,
    };
    state.importBatches.unshift(batch);
    saveState(state);

    res.status(201).json({
      batch,
      insertedCount: toInsert.length,
      totalQuestionCount: getAllQuestions().length,
    });
  });

  router.post('/import/rollback/:batchId', async (req: Request, res: Response) => {
    const user = await deps.resolveAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'AUTH_REQUIRED' });
      return;
    }

    const batchIdx = state.importBatches.findIndex((b) => b.batchId === req.params.batchId);
    if (batchIdx < 0) {
      res.status(404).json({ error: 'IMPORT_BATCH_NOT_FOUND' });
      return;
    }
    const batch = state.importBatches[batchIdx];
    if (batch.importedByUid !== user.uid) {
      res.status(403).json({ error: 'FORBIDDEN_BATCH_ROLLBACK' });
      return;
    }

    state.importedQuestions = applyImportRollback(state.importedQuestions, batch);
    state.importBatches.splice(batchIdx, 1);
    saveState(state);

    res.json({
      rolledBackBatchId: batch.batchId,
      removedCount: batch.count,
      totalQuestionCount: getAllQuestions().length,
    });
  });

  return router;
}
