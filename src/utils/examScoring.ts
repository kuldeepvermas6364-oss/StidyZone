import type {
  AssessmentAttempt,
  AttemptResultSummary,
  ChapterBreakdownStat,
  DifficultyBreakdownStat,
  DifficultyLevel,
  FullQuestionRecord,
  QuestionEvaluationStatus,
  QuestionOption,
  QuestionPublic,
  QuestionScoreDetail,
  QuestionType,
  StudentAnswerValue,
  SubjectBreakdownStat,
  TopicBreakdownStat,
} from '../types/assessment';
import type { ExamTrack, LanguageCode } from '../types/database';

export function isSubjectiveQuestionType(questionType: QuestionType): boolean {
  return (
    questionType === 'short_answer' ||
    questionType === 'long_answer' ||
    questionType === 'subjective_descriptive'
  );
}

export function isStudentAnswerProvided(
  questionType: QuestionType,
  answer?: StudentAnswerValue
): boolean {
  if (!answer) return false;
  switch (questionType) {
    case 'mcq_single':
    case 'mcq_multi':
    case 'assertion_reason':
      return Array.isArray(answer.selectedOptionIds) && answer.selectedOptionIds.length > 0;
    case 'numerical':
    case 'integer':
      return typeof answer.numericValue === 'string' && answer.numericValue.trim().length > 0;
    case 'fill_blank':
    case 'short_answer':
    case 'long_answer':
    case 'subjective_descriptive':
      return (
        (typeof answer.textValue === 'string' && answer.textValue.trim().length > 0) ||
        Boolean(answer.attachedImageDataUrl)
      );
    case 'true_false':
      return typeof answer.booleanValue === 'boolean';
    case 'match_following':
      return Boolean(answer.matchMapping && Object.keys(answer.matchMapping).length > 0);
    default:
      return false;
  }
}

function normalizeTextAnswer(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/ε/g, 'e')
    .replace(/epsilon_0|epsilon0|epsilon naught/g, 'e0');
}

function formatCorrectSummary(q: FullQuestionRecord): string {
  const key = q.answerKey;
  switch (q.questionType) {
    case 'mcq_single':
    case 'mcq_multi':
    case 'assertion_reason':
      return (key.correctOptionIds ?? []).join(', ');
    case 'numerical':
      return key.correctNumeric !== undefined ? String(key.correctNumeric) : 'N/A';
    case 'integer':
      return key.correctInteger !== undefined ? String(key.correctInteger) : 'N/A';
    case 'fill_blank':
      return key.correctTextAnswers?.[0] ?? 'N/A';
    case 'true_false':
      return key.correctBool === true ? 'True' : key.correctBool === false ? 'False' : 'N/A';
    case 'match_following':
      return key.correctMatchMap
        ? Object.entries(key.correctMatchMap)
            .map(([k, v]) => `${k}-${v}`)
            .join(', ')
        : 'N/A';
    case 'short_answer':
    case 'long_answer':
    case 'subjective_descriptive':
      return 'Rubric / Self-Review';
    default:
      return 'N/A';
  }
}

export function evaluateSingleQuestion(
  question: FullQuestionRecord,
  answer?: StudentAnswerValue,
  timeSpentSeconds?: number
): QuestionScoreDetail {
  const provided = isStudentAnswerProvided(question.questionType, answer);
  const key = question.answerKey;
  const maxMarks = Math.max(0, question.marks);
  const neg = Math.max(0, question.negativeMarks);
  const correctSummary = formatCorrectSummary(question);

  if (!provided) {
    return {
      questionId: question.id,
      subjectId: question.subjectId,
      chapterId: question.chapterId,
      topicId: question.topicId,
      questionType: question.questionType,
      difficulty: question.difficulty,
      maxMarks,
      awardedMarks: 0,
      negativeDeducted: 0,
      status: 'unanswered',
      studentAnswer: answer,
      correctSummary,
      timeSpentSeconds,
    };
  }

  let awardedMarks = 0;
  let negativeDeducted = 0;
  let status: QuestionEvaluationStatus = 'incorrect';

  switch (question.questionType) {
    case 'mcq_single':
    case 'assertion_reason': {
      const selected = answer?.selectedOptionIds?.[0];
      const expected = key.correctOptionIds?.[0];
      if (selected && expected && selected === expected) {
        awardedMarks = maxMarks;
        status = 'correct';
      } else {
        awardedMarks = -neg;
        negativeDeducted = neg;
        status = 'incorrect';
      }
      break;
    }

    case 'mcq_multi': {
      const selectedSet = new Set(answer?.selectedOptionIds ?? []);
      const expectedList = key.correctOptionIds ?? [];
      const expectedSet = new Set(expectedList);

      const hasAnyWrong = [...selectedSet].some((id) => !expectedSet.has(id));
      if (hasAnyWrong) {
        awardedMarks = -neg;
        negativeDeducted = neg;
        status = 'incorrect';
      } else if (selectedSet.size === expectedSet.size) {
        awardedMarks = maxMarks;
        status = 'correct';
      } else if (question.partialMarking && selectedSet.size > 0 && expectedSet.size > 0) {
        // Configurable proportional partial marking (JEE Advanced pattern)
        const perOption = Math.floor(maxMarks / expectedSet.size) || maxMarks / expectedSet.size;
        awardedMarks = Math.round(selectedSet.size * perOption * 100) / 100;
        status = 'partial';
      } else {
        awardedMarks = -neg;
        negativeDeducted = neg;
        status = 'incorrect';
      }
      break;
    }

    case 'numerical': {
      const parsed = Number(answer?.numericValue?.trim());
      const target = key.correctNumeric;
      const tol = key.numericTolerance ?? 0.01;
      if (Number.isFinite(parsed) && typeof target === 'number' && Math.abs(parsed - target) <= tol) {
        awardedMarks = maxMarks;
        status = 'correct';
      } else {
        awardedMarks = -neg;
        negativeDeducted = neg;
        status = 'incorrect';
      }
      break;
    }

    case 'integer': {
      const trimmed = answer?.numericValue?.trim() ?? '';
      const parsed = Number(trimmed);
      const target = key.correctInteger;
      if (
        trimmed.length > 0 &&
        Number.isInteger(parsed) &&
        typeof target === 'number' &&
        parsed === target
      ) {
        awardedMarks = maxMarks;
        status = 'correct';
      } else {
        awardedMarks = -neg;
        negativeDeducted = neg;
        status = 'incorrect';
      }
      break;
    }

    case 'fill_blank': {
      const studentNorm = normalizeTextAnswer(answer?.textValue ?? '');
      const validAnswers = (key.correctTextAnswers ?? []).map(normalizeTextAnswer);
      if (studentNorm.length > 0 && validAnswers.includes(studentNorm)) {
        awardedMarks = maxMarks;
        status = 'correct';
      } else {
        awardedMarks = -neg;
        negativeDeducted = neg;
        status = 'incorrect';
      }
      break;
    }

    case 'true_false': {
      if (typeof answer?.booleanValue === 'boolean' && answer.booleanValue === key.correctBool) {
        awardedMarks = maxMarks;
        status = 'correct';
      } else {
        awardedMarks = -neg;
        negativeDeducted = neg;
        status = 'incorrect';
      }
      break;
    }

    case 'match_following': {
      const expectedMap = key.correctMatchMap ?? {};
      const studentMap = answer?.matchMapping ?? {};
      const keys = Object.keys(expectedMap);
      const allMatched =
        keys.length > 0 && keys.every((k) => studentMap[k] && studentMap[k] === expectedMap[k]);
      if (allMatched) {
        awardedMarks = maxMarks;
        status = 'correct';
      } else {
        awardedMarks = -neg;
        negativeDeducted = neg;
        status = 'incorrect';
      }
      break;
    }

    case 'short_answer':
    case 'long_answer':
    case 'subjective_descriptive': {
      if (
        typeof answer?.selfEvaluatedMarks === 'number' &&
        Number.isFinite(answer.selfEvaluatedMarks)
      ) {
        const clamped = Math.max(0, Math.min(maxMarks, answer.selfEvaluatedMarks));
        awardedMarks = Math.round(clamped * 100) / 100;
        status = 'self_evaluated';
      } else {
        awardedMarks = 0;
        status = 'pending_review';
      }
      break;
    }
  }

  return {
    questionId: question.id,
    subjectId: question.subjectId,
    chapterId: question.chapterId,
    topicId: question.topicId,
    questionType: question.questionType,
    difficulty: question.difficulty,
    maxMarks,
    awardedMarks,
    negativeDeducted,
    status,
    studentAnswer: answer,
    correctSummary,
    timeSpentSeconds,
  };
}

export function scoreAssessmentAttempt(
  questions: FullQuestionRecord[],
  answers: Record<string, StudentAnswerValue>,
  timeSpentSeconds: number,
  questionTimeSeconds?: Record<string, number>
): AttemptResultSummary {
  const details: QuestionScoreDetail[] = questions.map((q) =>
    evaluateSingleQuestion(q, answers[q.id], questionTimeSeconds?.[q.id])
  );

  let attemptedCount = 0;
  let correctCount = 0;
  let partialCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;
  let pendingReviewCount = 0;
  let score = 0;
  let maxMarks = 0;
  let autoGradedMaxMarks = 0;
  let negativeMarksDeducted = 0;

  const subjectMap = new Map<string, SubjectBreakdownStat>();
  const chapterMap = new Map<string, ChapterBreakdownStat>();
  const topicMap = new Map<string, TopicBreakdownStat>();
  const diffMap = new Map<DifficultyLevel, DifficultyBreakdownStat>();

  for (const d of details) {
    maxMarks += d.maxMarks;
    if (!isSubjectiveQuestionType(d.questionType) || d.status === 'self_evaluated') {
      autoGradedMaxMarks += d.maxMarks;
    }
    score += d.awardedMarks;
    negativeMarksDeducted += d.negativeDeducted;

    if (d.status !== 'unanswered') attemptedCount += 1;
    if (d.status === 'correct') correctCount += 1;
    else if (d.status === 'partial') partialCount += 1;
    else if (d.status === 'incorrect') incorrectCount += 1;
    else if (d.status === 'unanswered') unansweredCount += 1;
    else if (d.status === 'pending_review') pendingReviewCount += 1;
    else if (d.status === 'self_evaluated' && d.awardedMarks >= d.maxMarks * 0.6) {
      correctCount += 1;
    }

    // Subject aggregation
    const sub = subjectMap.get(d.subjectId) ?? {
      subjectId: d.subjectId,
      totalQuestions: 0,
      attempted: 0,
      correct: 0,
      partial: 0,
      incorrect: 0,
      unanswered: 0,
      pendingReview: 0,
      score: 0,
      maxMarks: 0,
      negativeDeducted: 0,
      accuracyPercent: 0,
    };
    sub.totalQuestions += 1;
    if (d.status !== 'unanswered') sub.attempted += 1;
    if (d.status === 'correct') sub.correct += 1;
    if (d.status === 'partial') sub.partial += 1;
    if (d.status === 'incorrect') sub.incorrect += 1;
    if (d.status === 'unanswered') sub.unanswered += 1;
    if (d.status === 'pending_review') sub.pendingReview += 1;
    sub.score = Math.round((sub.score + d.awardedMarks) * 100) / 100;
    sub.maxMarks += d.maxMarks;
    sub.negativeDeducted = Math.round((sub.negativeDeducted + d.negativeDeducted) * 100) / 100;
    const subGradedAttempted = sub.correct + sub.partial + sub.incorrect;
    sub.accuracyPercent =
      subGradedAttempted > 0 ? Math.round((sub.correct / subGradedAttempted) * 100) : 0;
    subjectMap.set(d.subjectId, sub);

    // Chapter aggregation
    const chKey = `${d.subjectId}::${d.chapterId}`;
    const ch = chapterMap.get(chKey) ?? {
      chapterId: d.chapterId,
      subjectId: d.subjectId,
      attempted: 0,
      correct: 0,
      incorrect: 0,
      accuracyPercent: 0,
      score: 0,
      maxMarks: 0,
    };
    if (d.status !== 'unanswered') ch.attempted += 1;
    if (d.status === 'correct') ch.correct += 1;
    if (d.status === 'incorrect') ch.incorrect += 1;
    ch.score = Math.round((ch.score + d.awardedMarks) * 100) / 100;
    ch.maxMarks += d.maxMarks;
    const chDenom = ch.correct + ch.incorrect;
    ch.accuracyPercent = chDenom > 0 ? Math.round((ch.correct / chDenom) * 100) : 0;
    chapterMap.set(chKey, ch);

    // Topic aggregation
    const topKey = `${d.chapterId}::${d.topicId}`;
    const top = topicMap.get(topKey) ?? {
      topicId: d.topicId,
      chapterId: d.chapterId,
      subjectId: d.subjectId,
      attempted: 0,
      correct: 0,
      incorrect: 0,
      accuracyPercent: 0,
    };
    if (d.status !== 'unanswered') top.attempted += 1;
    if (d.status === 'correct') top.correct += 1;
    if (d.status === 'incorrect') top.incorrect += 1;
    const topDenom = top.correct + top.incorrect;
    top.accuracyPercent = topDenom > 0 ? Math.round((top.correct / topDenom) * 100) : 0;
    topicMap.set(topKey, top);

    // Difficulty aggregation
    const diff = diffMap.get(d.difficulty) ?? {
      difficulty: d.difficulty,
      attempted: 0,
      correct: 0,
      incorrect: 0,
      accuracyPercent: 0,
      score: 0,
      maxMarks: 0,
    };
    if (d.status !== 'unanswered') diff.attempted += 1;
    if (d.status === 'correct') diff.correct += 1;
    if (d.status === 'incorrect') diff.incorrect += 1;
    diff.score = Math.round((diff.score + d.awardedMarks) * 100) / 100;
    diff.maxMarks += d.maxMarks;
    const diffDenom = diff.correct + diff.incorrect;
    diff.accuracyPercent = diffDenom > 0 ? Math.round((diff.correct / diffDenom) * 100) : 0;
    diffMap.set(d.difficulty, diff);
  }

  const roundedScore = Math.round(score * 100) / 100;
  const percentage =
    autoGradedMaxMarks > 0
      ? Math.max(0, Math.round((roundedScore / autoGradedMaxMarks) * 1000) / 10)
      : maxMarks > 0
      ? Math.max(0, Math.round((roundedScore / maxMarks) * 1000) / 10)
      : 0;

  return {
    totalQuestions: details.length,
    attemptedCount,
    correctCount,
    partialCount,
    incorrectCount,
    unansweredCount,
    pendingReviewCount,
    score: roundedScore,
    maxMarks,
    autoGradedMaxMarks,
    percentage,
    negativeMarksDeducted: Math.round(negativeMarksDeducted * 100) / 100,
    timeSpentSeconds: Math.max(0, Math.round(timeSpentSeconds)),
    subjectBreakdown: Array.from(subjectMap.values()),
    chapterBreakdown: Array.from(chapterMap.values()),
    topicBreakdown: Array.from(topicMap.values()),
    difficultyBreakdown: Array.from(diffMap.values()),
    questionResults: details,
  };
}

/**
 * Deterministic LCG seeded shuffle so randomized quizzes & shuffled options remain consistent across page refreshes for the same attemptId/seed.
 */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const arr = [...items];
  let s = (Math.abs(Math.floor(seed)) || 1337) % 2147483647;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 48271) % 2147483647;
    const j = s % (i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

export function getSeededOptions(
  question: Pick<QuestionPublic, 'id' | 'options' | 'questionType'>,
  seed: number,
  shouldShuffle: boolean
): QuestionOption[] {
  if (!question.options) return [];
  if (!shouldShuffle || question.questionType === 'assertion_reason') {
    return question.options;
  }
  let qHash = seed;
  for (let i = 0; i < question.id.length; i++) {
    qHash = (qHash * 31 + question.id.charCodeAt(i)) % 2147483647;
  }
  return seededShuffle(question.options, qHash);
}

export interface QuestionFilterParams {
  query?: string;
  examTrack?: ExamTrack | 'all';
  academicSession?: string | 'all';
  classLevel?: 'class-12' | 'entrance-ug' | 'all';
  subjectId?: string | 'all';
  chapterId?: string | 'all';
  topicId?: string | 'all';
  difficulty?: DifficultyLevel | 'all';
  questionType?: QuestionType | 'all';
  sourceType?: QuestionPublic['sourceType'] | 'all';
  academicYear?: string | 'all';
  attemptFilter?: 'all' | 'attempted' | 'unattempted' | 'correct' | 'incorrect';
  language?: LanguageCode;
}

export function filterQuestionBank(
  questions: readonly QuestionPublic[],
  filters: QuestionFilterParams,
  attemptStatsByQuestion?: Map<string, { attempted: boolean; lastCorrect?: boolean }>
): QuestionPublic[] {
  const qLower = (filters.query ?? '').trim().toLowerCase();

  return questions.filter((item) => {
    if (!item.isPublished) return false;
    if (filters.examTrack && filters.examTrack !== 'all' && item.examTrack !== filters.examTrack) {
      return false;
    }
    if (
      filters.academicSession &&
      filters.academicSession !== 'all' &&
      item.academicSession !== filters.academicSession
    ) {
      return false;
    }
    if (filters.classLevel && filters.classLevel !== 'all' && item.classLevel !== filters.classLevel) {
      return false;
    }
    if (filters.subjectId && filters.subjectId !== 'all' && item.subjectId !== filters.subjectId) {
      return false;
    }
    if (filters.chapterId && filters.chapterId !== 'all' && item.chapterId !== filters.chapterId) {
      return false;
    }
    if (filters.topicId && filters.topicId !== 'all' && item.topicId !== filters.topicId) {
      return false;
    }
    if (filters.difficulty && filters.difficulty !== 'all' && item.difficulty !== filters.difficulty) {
      return false;
    }
    if (
      filters.questionType &&
      filters.questionType !== 'all' &&
      item.questionType !== filters.questionType
    ) {
      return false;
    }
    if (filters.sourceType && filters.sourceType !== 'all' && item.sourceType !== filters.sourceType) {
      return false;
    }
    if (
      filters.academicYear &&
      filters.academicYear !== 'all' &&
      String(item.academicYear ?? '') !== filters.academicYear
    ) {
      return false;
    }

    if (filters.attemptFilter && filters.attemptFilter !== 'all' && attemptStatsByQuestion) {
      const stat = attemptStatsByQuestion.get(item.id);
      if (filters.attemptFilter === 'attempted' && !stat?.attempted) return false;
      if (filters.attemptFilter === 'unattempted' && stat?.attempted) return false;
      if (filters.attemptFilter === 'correct' && stat?.lastCorrect !== true) return false;
      if (filters.attemptFilter === 'incorrect' && stat?.lastCorrect !== false) return false;
    }

    if (qLower.length > 0) {
      const hay = `${item.id} ${item.prompt.en} ${item.prompt.hi} ${item.subjectId} ${item.chapterId}`.toLowerCase();
      if (!hay.includes(qLower)) return false;
    }

    return true;
  });
}

export function validateAttemptSubmissionWindow(attempt: Pick<AssessmentAttempt, 'startedAtServerMs' | 'expiresAtServerMs'>, nowMs: number, graceMs = 90_000): {
  allowed: boolean;
  lateFlag: boolean;
  elapsedSeconds: number;
} {
  const elapsedSeconds = Math.max(0, Math.round((nowMs - attempt.startedAtServerMs) / 1000));
  if (nowMs <= attempt.expiresAtServerMs) {
    return { allowed: true, lateFlag: false, elapsedSeconds };
  }
  if (nowMs <= attempt.expiresAtServerMs + graceMs) {
    return { allowed: true, lateFlag: true, elapsedSeconds };
  }
  return { allowed: false, lateFlag: true, elapsedSeconds };
}
