export type ExamTrack = 'up-board-12' | 'jee-main' | 'jee-advanced';
export type LanguageCode = 'en' | 'hi';
export type UserRole = 'student' | 'educator' | 'moderator' | 'super_admin';
export type AuthProviderType = 'password' | 'google.com';

export interface BilingualText {
  en: string;
  hi: string;
}

/** 1. users collection */
export interface UserRecord {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  provider: AuthProviderType;
  emailVerified: boolean;
  role: UserRole;
  createdAt: string;
  lastLoginAt: string;
  disabled: boolean;
}

/** 2. profiles collection */
export interface StudentProfileRecord {
  uid: string;
  fullName: string;
  targetExams: ExamTrack[];
  primaryExam: ExamTrack;
  selectedStream?: 'science' | 'commerce' | 'arts';
  selectedSubjects?: string[];
  preferredLanguage: LanguageCode;
  studyMedium: 'hindi' | 'english' | 'bilingual';
  dailyStudyTargetMinutes: number;
  boardRollTargetYear: number;
  jeeTargetYear: number;
  schoolOrCoaching?: string;
  district?: string;
  updatedAt: string;
}

/** 3. subjects collection */
export interface SubjectRecord {
  id: string;
  examTrack: ExamTrack;
  code: string;
  name: BilingualText;
  order: number;
  isPublished: boolean;
  chapterCount: number;
  updatedAt: string;
}

/** 4. chapters collection */
export interface ChapterRecord {
  id: string;
  subjectId: string;
  examTrack: ExamTrack;
  unitNumber: number;
  title: BilingualText;
  summary: BilingualText;
  weightageMarks?: number;
  estimatedHours: number;
  isPublished: boolean;
  order: number;
}

/** 5. topics collection */
export interface TopicRecord {
  id: string;
  chapterId: string;
  subjectId: string;
  title: BilingualText;
  syllabusCode: string;
  difficulty: 'foundation' | 'standard' | 'advanced';
  order: number;
  hasNotes: boolean;
  hasVideo: boolean;
  hasPracticeSet: boolean;
}

/** 6. studyMaterials collection */
export type StudyMaterialKind = 'pdf_notes' | 'ncert_book' | 'pyq_paper' | 'formula_sheet' | 'video_lecture';

export interface StudyMaterialRecord {
  id: string;
  examTrack: ExamTrack;
  subjectId: string;
  chapterId: string;
  topicId?: string;
  kind: StudyMaterialKind;
  title: BilingualText;
  language: LanguageCode | 'bilingual';
  storagePath: string;
  fileSizeBytes?: number;
  durationSeconds?: number;
  isOfflineEligible: boolean;
  publishedAt: string;
  createdByUid: string;
}

/** 7. questions collection */
export type QuestionKind = 'mcq_single' | 'mcq_multi' | 'numerical' | 'subjective_up_board';

export interface QuestionRecord {
  id: string;
  examTrack: ExamTrack;
  subjectId: string;
  chapterId: string;
  topicId?: string;
  kind: QuestionKind;
  prompt: BilingualText;
  options?: Array<{
    key: string;
    text: BilingualText;
  }>;
  correctAnswerKey: string;
  explanation: BilingualText;
  marks: number;
  negativeMarks: number;
  yearTag?: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

/** 8. quizzes collection */
export interface QuizRecord {
  id: string;
  examTrack: ExamTrack;
  subjectId: string;
  chapterId: string;
  title: BilingualText;
  questionIds: string[];
  durationMinutes: number;
  totalMarks: number;
  isPublished: boolean;
  createdAt: string;
}

/** 9. mockTests collection */
export interface MockTestRecord {
  id: string;
  examTrack: ExamTrack;
  title: BilingualText;
  pattern: 'up-board-model' | 'jee-main-nta' | 'jee-advanced-paper';
  durationMinutes: number;
  totalMarks: number;
  sections: Array<{
    subjectId: string;
    label: BilingualText;
    questionCount: number;
    maxMarks: number;
  }>;
  scheduledWindowStart?: string;
  scheduledWindowEnd?: string;
  isPublished: boolean;
}

/** 10. bookmarks collection */
export interface BookmarkRecord {
  id: string;
  uid: string;
  itemType: 'chapter' | 'topic' | 'studyMaterial' | 'question';
  itemId: string;
  examTrack: ExamTrack;
  note?: string;
  createdAt: string;
}

/** 11. studyProgress collection */
export interface StudyProgressRecord {
  id: string;
  uid: string;
  examTrack: ExamTrack;
  subjectId: string;
  chapterId: string;
  completedTopicIds: string[];
  studyMinutesLogged: number;
  lastActivityAt: string;
  completionPercent: number;
}

/** 12. adminRoles collection */
export interface AdminRoleRecord {
  uid: string;
  role: Exclude<UserRole, 'student'>;
  permissions: Array<
    | 'manage_syllabus'
    | 'upload_materials'
    | 'bulk_import_questions'
    | 'publish_mock_tests'
    | 'manage_notifications'
    | 'manage_roles'
  >;
  grantedByUid: string;
  grantedAt: string;
  active: boolean;
}

export type CollectionName =
  | 'users'
  | 'profiles'
  | 'subjects'
  | 'chapters'
  | 'topics'
  | 'studyMaterials'
  | 'questions'
  | 'quizzes'
  | 'mockTests'
  | 'bookmarks'
  | 'studyProgress'
  | 'adminRoles';
