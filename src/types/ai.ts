import type { DifficultyLevel, FullQuestionRecord, QuestionType } from './assessment';
import type { ExamTrack } from './database';

export type AiLanguageMode = 'en' | 'hi' | 'hinglish';

export type AiWorkflowMode =
  | 'chat'
  | 'doubt_solver'
  | 'pdf_tutor'
  | 'step_solver'
  | 'quiz_gen'
  | 'chapter_summary'
  | 'recommendations'
  | 'study_plan';

export type AiSummaryMode =
  | 'full'
  | 'short_revision'
  | 'definitions'
  | 'formulas'
  | 'key_concepts'
  | 'derivations'
  | 'quick_notes';

export type AiFeedbackRating = 'helpful' | 'needs_review';

export interface AiCitation {
  materialId?: string;
  materialTitle: string;
  pageNumber?: number;
  excerpt: string;
  sourceKind: 'pdf' | 'curriculum' | 'general_guidance';
}

export interface AiMessage {
  id: string;
  conversationId: string;
  uid: string;
  role: 'user' | 'assistant';
  content: string;
  workflowMode: AiWorkflowMode;
  languageMode: AiLanguageMode;
  citations?: AiCitation[];
  clarificationQuestions?: string[];
  uncertaintyNotice?: string;
  hasImageAttachment?: boolean;
  imageName?: string;
  detectedSubject?: string;
  detectedChapter?: string;
  detectedTopic?: string;
  feedback?: AiFeedbackRating;
  tokenEstimate?: number;
  status?: 'complete' | 'stopped' | 'error';
  createdAt: string;
}

export interface AiConversation {
  id: string;
  uid: string;
  title: string;
  examTrack: ExamTrack;
  subjectId?: string;
  chapterId?: string;
  topicId?: string;
  materialId?: string;
  languageMode: AiLanguageMode;
  messageCount: number;
  lastMessagePreview: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiUsageSummary {
  dateKey: string;
  requestsUsed: number;
  dailyRequestLimit: number;
  tokensUsed: number;
  dailyTokenLimit: number;
  rateLimitPerMin: number;
}

export interface AiProviderStatus {
  configured: boolean;
  model: string;
  usage: AiUsageSummary | null;
}

export interface DocumentChunkRecord {
  id: string;
  materialId: string;
  pageNumber: number;
  chunkIndex: number;
  text: string;
  tokenEstimate: number;
  embedding?: number[];
}

export interface PdfIndexStatus {
  materialId: string;
  title: string;
  pageCount: number;
  chunkCount: number;
  indexedAt: string;
  maxPagesTruncated: boolean;
}

export interface GeneratedQuizDraft {
  id: string;
  uid: string;
  title: { en: string; hi: string };
  examTrack: ExamTrack;
  subjectId: string;
  chapterId: string;
  topicId?: string;
  difficulty: DifficultyLevel | 'mixed';
  languageMode: AiLanguageMode;
  questions: FullQuestionRecord[];
  rejectedCount: number;
  warnings: string[];
  savedToBank: boolean;
  createdAt: string;
}

export interface GeneratedChapterSummary {
  id: string;
  examTrack: ExamTrack;
  subjectId: string;
  chapterId: string;
  summaryMode: AiSummaryMode;
  languageMode: AiLanguageMode;
  content: string;
  citations: AiCitation[];
  cached: boolean;
  createdAt: string;
}

export interface AiStudyRecommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  kind: 'weak_chapter' | 'revision_needed' | 'incomplete_chapter' | 'question_type_drill' | 'starter_guidance';
  examTrack: ExamTrack;
  subjectId?: string;
  chapterId?: string;
  topicId?: string;
  title: string;
  reason: string;
  accuracyPercent?: number;
  actionRoute: string;
  actionLabel: string;
}

export interface AiStudyPlanSlot {
  dayLabel: string;
  focusSubject: string;
  chapterTitle: string;
  activity: string;
  durationMinutes: number;
}

export interface AiStudyPlan {
  id: string;
  uid: string;
  title: string;
  examTrack: ExamTrack;
  examDateISO: string;
  dailyHours: number;
  selectedSubjectIds: string[];
  status: 'draft' | 'approved';
  summaryNote: string;
  dailyTargets: string[];
  weeklySchedule: AiStudyPlanSlot[];
  revisionSprints: string[];
  practiceMilestones: string[];
  createdAt: string;
  approvedAt?: string;
}

export interface AiQuizGenerateParams {
  examTrack: ExamTrack;
  subjectId: string;
  chapterId: string;
  topicId?: string;
  difficulty: DifficultyLevel | 'mixed';
  questionType: Extract<QuestionType, 'mcq_single' | 'numerical' | 'true_false' | 'short_answer'> | 'mixed';
  questionCount: number;
  languageMode: AiLanguageMode;
}
