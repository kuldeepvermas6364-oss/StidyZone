import type { BilingualText, ExamTrack } from './database';

export type UPBoardStream = 'science' | 'commerce' | 'arts';
export type ExamClassLevel = 'class-12' | 'entrance-ug';

export type VerificationStatus = 'verified' | 'awaiting_verification';

export type ChapterProgressStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'needs_revision';

export type PracticeStatus = 'not_started' | 'in_progress' | 'completed';

export type SyllabusInclusionStatus = 'included' | 'reduced' | 'removed' | 'advanced_only';

export interface VerificationMetadata {
  sourceName: BilingualText;
  sourceUrl: string;
  academicSession: string;
  lastVerifiedDate: string; // YYYY-MM-DD
  verificationStatus: VerificationStatus;
  notes: BilingualText;
}

export interface CurriculumTopic {
  id: string;
  chapterId: string;
  subjectId: string;
  title: BilingualText;
  subtopics: BilingualText[];
  syllabusCode: string;
  inclusionStatus: SyllabusInclusionStatus;
  importance: 'core' | 'high_yield' | 'standard';
  order: number;
  isPublished: boolean;
  verificationStatus: VerificationStatus;
}

export interface CurriculumChapter {
  id: string;
  subjectId: string;
  examTrack: ExamTrack;
  classLevel: ExamClassLevel;
  academicSession: string;
  unitNumber: number;
  order: number;
  title: BilingualText;
  overview: BilingualText;
  weightageLabel?: BilingualText;
  estimatedHours: number;
  isImportantUnit: boolean;
  isPublished: boolean;
  verificationStatus: VerificationStatus;
  sourceUrl: string;
  topics: CurriculumTopic[];
  /** Supplementary guide note (clearly distinct from official syllabus wording) */
  studyGuideNote?: BilingualText;
}

export interface RemovedTopicEntry {
  id: string;
  unitOrChapterTitle: BilingualText;
  removedDetail: BilingualText;
  status: 'removed' | 'reduced';
  note?: BilingualText;
}

export interface CurriculumSubject {
  id: string;
  examTrack: ExamTrack;
  classLevel: ExamClassLevel;
  academicSession: string;
  /** Applicable UP Board streams (empty/undefined for JEE Main & JEE Advanced) */
  streams?: UPBoardStream[];
  code: string;
  name: BilingualText;
  overview: BilingualText;
  order: number;
  isPublished: boolean;
  importantTopics: BilingualText[];
  chapters: CurriculumChapter[];
  /** Explicit removed/reduced syllabus entries separated from active chapters */
  removedOrReducedTopics: RemovedTopicEntry[];
  verification: VerificationMetadata;
}

export interface StudentChapterProgress {
  id: string; // `${uid}_${examTrack}_${subjectId}_${chapterId}`
  uid: string;
  examTrack: ExamTrack;
  streamId?: UPBoardStream | null;
  subjectId: string;
  chapterId: string;
  status: ChapterProgressStatus;
  practiceStatus: PracticeStatus;
  completedTopicIds: string[];
  studyMinutesLogged: number;
  completionPercent: number;
  lastActivityAt: string; // ISO string
}

export interface StreamDefinition {
  id: UPBoardStream;
  name: BilingualText;
  description: BilingualText;
  defaultSubjectIds: string[];
  availableSubjectIds: string[];
}
