import type { UPBoardStream } from './curriculum';
import type { BilingualText, ExamTrack } from './database';

export type StreamId = UPBoardStream;

export type QuestionType =
  | 'mcq_single'
  | 'mcq_multi'
  | 'numerical'
  | 'integer'
  | 'fill_blank'
  | 'true_false'
  | 'assertion_reason'
  | 'match_following'
  | 'short_answer'
  | 'long_answer'
  | 'subjective_descriptive';

export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export type QuestionSourceType =
  | 'prepzone_curated'
  | 'official_pattern_sample'
  | 'verified_pyq'
  | 'ai_generated';

export type QuestionVerificationStatus = 'verified' | 'awaiting_verification';

export interface QuestionOption {
  id: string;
  label: string;
  text: BilingualText;
}

export interface QuestionTableDiagram {
  kind: 'table';
  caption: BilingualText;
  headers: BilingualText[];
  rows: string[][];
}

export interface QuestionSvgDiagram {
  kind: 'svg_preset';
  presetId:
    | 'wheatstone_bridge'
    | 'convex_lens_ray'
    | 'pv_carnot_cycle'
    | 'young_double_slit'
    | 'galvanometer_shunt'
    | 'cell_emf_circuit';
  caption: BilingualText;
}

export type QuestionDiagram = QuestionTableDiagram | QuestionSvgDiagram;

export interface MatchColumns {
  leftTitle: BilingualText;
  rightTitle: BilingualText;
  leftItems: Array<{ id: string; text: BilingualText }>;
  rightItems: Array<{ id: string; text: BilingualText }>;
}

export interface QuestionPublic {
  id: string;
  examTrack: ExamTrack;
  academicSession: string;
  classLevel: 'class-12' | 'entrance-ug';
  streamId?: StreamId;
  subjectId: string;
  chapterId: string;
  topicId: string;
  questionType: QuestionType;
  difficulty: DifficultyLevel;
  prompt: BilingualText;
  options?: QuestionOption[];
  assertionReason?: {
    assertion: BilingualText;
    reason: BilingualText;
  };
  matchColumns?: MatchColumns;
  diagram?: QuestionDiagram;
  marks: number;
  negativeMarks: number;
  partialMarking?: boolean;
  sourceType: QuestionSourceType;
  sourceLabel: BilingualText;
  academicYear?: number;
  verificationStatus: QuestionVerificationStatus;
  isPublished: boolean;
  importBatchId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionAnswerKey {
  questionId: string;
  correctOptionIds?: string[];
  correctNumeric?: number;
  numericTolerance?: number;
  correctInteger?: number;
  correctTextAnswers?: string[];
  correctBool?: boolean;
  correctMatchMap?: Record<string, string>;
  explanation: BilingualText;
  solutionSteps: BilingualText[];
  rubric?: BilingualText;
}

export interface FullQuestionRecord extends QuestionPublic {
  answerKey: QuestionAnswerKey;
}

export interface StudentAnswerValue {
  selectedOptionIds?: string[];
  numericValue?: string;
  textValue?: string;
  booleanValue?: boolean;
  matchMapping?: Record<string, string>;
  attachedImageName?: string;
  attachedImageDataUrl?: string;
  selfEvaluatedMarks?: number;
  selfEvaluationNote?: string;
}

export interface ExamSectionConfig {
  id: string;
  title: BilingualText;
  subjectId: string;
  questionTypes: QuestionType[];
  questionCount: number;
  marksPerQuestion: number;
  negativeMarks: number;
  optionalMaxAttempt?: number;
}

export type ExamPatternMode = 'cbt_simulator' | 'up_board_descriptive' | 'quiz';

export interface ExamConfiguration {
  id: string;
  examTrack: ExamTrack;
  academicSession: string;
  mode: ExamPatternMode;
  title: BilingualText;
  subtitle: BilingualText;
  isOfficialPattern: boolean;
  patternBadge: BilingualText;
  durationMinutes: number;
  totalMarks: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  allowImmediateFeedback: boolean;
  allowAllQuestionsView: boolean;
  sections: ExamSectionConfig[];
  questionIds?: string[];
  isPublished: boolean;
}

export type QuizCategory =
  | 'daily_quiz'
  | 'chapter_quiz'
  | 'topic_quiz'
  | 'subject_quiz'
  | 'revision_quiz'
  | 'custom_quiz'
  | 'mixed_quiz';

export interface QuizDefinition {
  id: string;
  quizType: QuizCategory;
  examTrack: ExamTrack;
  subjectId?: string;
  chapterId?: string;
  topicId?: string;
  title: BilingualText;
  description: BilingualText;
  durationMinutes: number;
  questionCount: number;
  questionIds?: string[];
  difficultyFilter?: DifficultyLevel | 'all';
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  isPublished: boolean;
  createdAt: string;
}

export type QuestionEvaluationStatus =
  | 'correct'
  | 'partial'
  | 'incorrect'
  | 'unanswered'
  | 'pending_review'
  | 'self_evaluated';

export interface QuestionScoreDetail {
  questionId: string;
  subjectId: string;
  chapterId: string;
  topicId: string;
  questionType: QuestionType;
  difficulty: DifficultyLevel;
  maxMarks: number;
  awardedMarks: number;
  negativeDeducted: number;
  status: QuestionEvaluationStatus;
  studentAnswer?: StudentAnswerValue;
  correctSummary: string;
  timeSpentSeconds?: number;
}

export interface SubjectBreakdownStat {
  subjectId: string;
  totalQuestions: number;
  attempted: number;
  correct: number;
  partial: number;
  incorrect: number;
  unanswered: number;
  pendingReview: number;
  score: number;
  maxMarks: number;
  negativeDeducted: number;
  accuracyPercent: number;
}

export interface ChapterBreakdownStat {
  chapterId: string;
  subjectId: string;
  attempted: number;
  correct: number;
  incorrect: number;
  accuracyPercent: number;
  score: number;
  maxMarks: number;
}

export interface TopicBreakdownStat {
  topicId: string;
  chapterId: string;
  subjectId: string;
  attempted: number;
  correct: number;
  incorrect: number;
  accuracyPercent: number;
}

export interface DifficultyBreakdownStat {
  difficulty: DifficultyLevel;
  attempted: number;
  correct: number;
  incorrect: number;
  accuracyPercent: number;
  score: number;
  maxMarks: number;
}

export interface AttemptResultSummary {
  totalQuestions: number;
  attemptedCount: number;
  correctCount: number;
  partialCount: number;
  incorrectCount: number;
  unansweredCount: number;
  pendingReviewCount: number;
  score: number;
  maxMarks: number;
  autoGradedMaxMarks: number;
  percentage: number;
  negativeMarksDeducted: number;
  timeSpentSeconds: number;
  subjectBreakdown: SubjectBreakdownStat[];
  chapterBreakdown: ChapterBreakdownStat[];
  topicBreakdown: TopicBreakdownStat[];
  difficultyBreakdown: DifficultyBreakdownStat[];
  questionResults: QuestionScoreDetail[];
}

export interface AssessmentAttempt {
  id: string;
  uid: string;
  kind: 'quiz' | 'cbt_mock' | 'up_board_exam';
  configId: string;
  quizType?: QuizCategory;
  examTrack: ExamTrack;
  title: BilingualText;
  status: 'in_progress' | 'submitted';
  startedAtServerMs: number;
  expiresAtServerMs: number;
  submittedAtServerMs?: number;
  autoSubmitted?: boolean;
  lateFlag?: boolean;
  durationSeconds: number;
  timeSpentSeconds: number;
  questionIds: string[];
  optionSeed: number;
  currentQuestionIndex: number;
  visitedIds: string[];
  markedForReviewIds: string[];
  answers: Record<string, StudentAnswerValue>;
  questionTimeSeconds?: Record<string, number>;
  result?: AttemptResultSummary;
}

export interface PracticeHistoryEntry {
  id: string;
  uid: string;
  questionId: string;
  examTrack: ExamTrack;
  subjectId: string;
  chapterId: string;
  topicId: string;
  questionType: QuestionType;
  difficulty: DifficultyLevel;
  isCorrect: boolean;
  status: QuestionEvaluationStatus;
  awardedMarks: number;
  maxMarks: number;
  studentAnswer: StudentAnswerValue;
  markedForRevision: boolean;
  savedDifficult: boolean;
  attemptedAt: string;
}

export interface QuestionBookmarkItem {
  id: string;
  uid: string;
  questionId: string;
  examTrack: ExamTrack;
  subjectId: string;
  chapterId: string;
  tag: 'bookmark' | 'difficult' | 'revision';
  note?: string;
  createdAt: string;
}

export interface WeakTopicDiagnostic {
  topicId: string;
  chapterId: string;
  subjectId: string;
  examTrack: ExamTrack;
  attempts: number;
  correct: number;
  accuracyPercent: number;
  negativeDrag: number;
  category: 'weak_topic' | 'needs_revision' | 'improving' | 'strong';
  recommendedPracticeCount: number;
}

export interface QuestionTypeDiagnostic {
  questionType: QuestionType;
  attempts: number;
  correct: number;
  accuracyPercent: number;
}

export interface StudentPerformanceAnalytics {
  totalPracticeQuestions: number;
  totalQuizzesSubmitted: number;
  totalExamsSubmitted: number;
  overallAccuracyPercent: number;
  averageScorePercent: number;
  weakChapters: Array<{
    chapterId: string;
    subjectId: string;
    attempts: number;
    correct: number;
    accuracyPercent: number;
  }>;
  weakTopics: WeakTopicDiagnostic[];
  revisionQueue: WeakTopicDiagnostic[];
  improvingTopics: WeakTopicDiagnostic[];
  frequentlyIncorrectTypes: QuestionTypeDiagnostic[];
}

export interface QuestionImportMapping {
  id?: string;
  examTrack: string;
  academicSession?: string;
  classLevel?: string;
  subjectId: string;
  chapterId: string;
  topicId?: string;
  questionType: string;
  difficulty: string;
  promptEn: string;
  promptHi?: string;
  optionsEn?: string;
  optionsHi?: string;
  correctAnswer: string;
  explanationEn?: string;
  explanationHi?: string;
  marks?: string;
  negativeMarks?: string;
  sourceType?: string;
  academicYear?: string;
}

export interface QuestionImportRowError {
  rowNumber: number;
  field: string;
  message: string;
}

export interface QuestionImportPreviewResult {
  totalRows: number;
  validQuestions: FullQuestionRecord[];
  rowErrors: QuestionImportRowError[];
  duplicateIds: string[];
  duplicatePrompts: Array<{ rowNumber: number; existingId: string; promptEn: string }>;
}

export interface QuestionImportBatch {
  batchId: string;
  importedAt: string;
  importedByUid: string;
  sourceKind: 'csv' | 'xlsx' | 'google_sheets' | 'json';
  questionIds: string[];
  count: number;
}
