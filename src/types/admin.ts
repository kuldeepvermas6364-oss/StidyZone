import type { ExamClassLevel, UPBoardStream, VerificationStatus } from './curriculum';
import type { BilingualText, ExamTrack } from './database';
import type { MaterialLanguage, MaterialType } from './materials';

export type AdminRoleType = 'super_admin' | 'content_admin';

export type AdminPermissionKey =
  | 'view_dashboard'
  | 'view_students'
  | 'export_students'
  | 'manage_students_status'
  | 'manage_curriculum'
  | 'manage_materials'
  | 'bulk_upload'
  | 'manage_questions'
  | 'manage_mock_tests'
  | 'manage_ai_settings'
  | 'view_audit_logs'
  | 'manage_integrations';

export const ALL_CONTENT_ADMIN_PERMISSIONS: AdminPermissionKey[] = [
  'view_dashboard',
  'view_students',
  'export_students',
  'manage_students_status',
  'manage_curriculum',
  'manage_materials',
  'bulk_upload',
  'manage_questions',
  'manage_mock_tests',
  'manage_ai_settings',
  'view_audit_logs',
  'manage_integrations',
];

export const DEFAULT_CONTENT_ADMIN_PERMISSIONS: AdminPermissionKey[] = [
  'view_dashboard',
  'manage_curriculum',
  'manage_materials',
  'bulk_upload',
  'manage_questions',
  'manage_mock_tests',
  'view_audit_logs',
];

export interface AdminUserRecord {
  uid: string;
  email: string;
  displayName: string;
  role: AdminRoleType;
  permissions: AdminPermissionKey[];
  active: boolean;
  grantedByUid: string;
  grantedAt: string;
  updatedAt: string;
}

export interface AdminAuditLogEntry {
  id: string;
  adminUid: string;
  adminEmail: string;
  adminRole: AdminRoleType | 'system';
  action: string;
  targetType:
    | 'auth'
    | 'student'
    | 'curriculum'
    | 'material'
    | 'bulk_upload'
    | 'question'
    | 'mock_test'
    | 'ai_settings'
    | 'admin_role'
    | 'system_settings'
    | 'integration';
  targetId: string;
  summary: string;
  status: 'success' | 'failure' | 'denied';
  createdAt: string;
}

export interface StudentRegistryEntry {
  uid: string;
  email: string;
  displayName: string;
  primaryExam: ExamTrack;
  selectedStream?: UPBoardStream;
  studyMedium: 'hindi' | 'english' | 'bilingual';
  preferredLanguage: 'en' | 'hi';
  provider: 'firebase' | 'local-foundation';
  emailVerified: boolean;
  disabled: boolean;
  disabledReason?: string;
  createdAt: string;
  lastActiveAt: string;
}

export interface StudentAdminView extends StudentRegistryEntry {
  attemptsCount: number;
  submittedMockCount: number;
  practiceCount: number;
  overallAccuracyPercent: number;
  aiRequestsToday: number;
}

export interface SmartCategorizationPrediction {
  examTrack: ExamTrack;
  academicSession: string;
  classLevel: ExamClassLevel;
  streamId?: UPBoardStream;
  subjectId: string;
  chapterId?: string;
  topicId?: string;
  materialType: MaterialType;
  language: MaterialLanguage;
  confidence: 'high' | 'medium' | 'low';
  matchedHints: string[];
  autoCategorized: true;
  requiresConfirmation: true;
}

export interface BulkUploadItemRecord {
  itemId: string;
  originalFilename: string;
  sourceArchive?: string;
  fileSizeBytes: number;
  sha256: string;
  tempStorageKey?: string;
  status: 'ready' | 'duplicate' | 'error' | 'imported';
  errorMessage?: string;
  duplicateOfId?: string;
  titleEn: string;
  titleHi: string;
  descriptionEn: string;
  descriptionHi: string;
  examTrack: ExamTrack;
  academicSession: string;
  classLevel: ExamClassLevel;
  streamId?: UPBoardStream;
  subjectId: string;
  chapterId?: string;
  topicId?: string;
  materialType: MaterialType;
  language: MaterialLanguage;
  downloadAllowed: boolean;
  isOfficial: boolean;
  verificationStatus: VerificationStatus;
  externalSourceUrl: string;
  prediction?: SmartCategorizationPrediction;
  importedMaterialId?: string;
}

export interface UploadJobRecord {
  jobId: string;
  adminUid: string;
  adminEmail: string;
  status: 'preview' | 'completed' | 'partial' | 'failed';
  totalFiles: number;
  readyCount: number;
  duplicateCount: number;
  failedCount: number;
  importedCount: number;
  items: BulkUploadItemRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface AiAdminSettings {
  enabled: boolean;
  model: 'gemini-4-hydrogen' | 'gemini-2.5-flash' | 'gemini-2.5-pro';
  dailyRequestLimit: number;
  dailyTokenLimit: number;
  rateLimitPerMin: number;
  features: {
    chat: boolean;
    pdfRag: boolean;
    quizGenerator: boolean;
    chapterSummary: boolean;
    studyPlanner: boolean;
  };
  updatedByUid: string;
  updatedAt: string;
}

export interface SystemSecuritySettings {
  siteTitle: string;
  maintenanceMode: boolean;
  allowNewRegistrations: boolean;
  requireAdminConfirmForBulkPublish: boolean;
  defaultAcademicSession: string;
  maxBulkUploadFiles: number;
  maxPdfUploadMb: number;
  updatedByUid: string;
  updatedAt: string;
}

export interface AdminDashboardStats {
  totalStudents: number;
  activeStudents7d: number;
  suspendedStudents: number;
  totalMaterials: number;
  publishedMaterials: number;
  pendingVerificationMaterials: number;
  storedPdfCount: number;
  totalQuestions: number;
  publishedQuestions: number;
  totalMockTests: number;
  publishedMockTests: number;
  totalSubjects: number;
  publishedSubjects: number;
  totalAttemptsSubmitted: number;
  aiRequestsToday: number;
  aiTokensToday: number;
  recentAuditLogs: AdminAuditLogEntry[];
  recentUploadJobs: Array<Omit<UploadJobRecord, 'items'>>;
  integrationSummary: {
    connectedCount: number;
    setupRequiredCount: number;
    unavailableCount: number;
  };
}

export interface AdminIntegrationDiagnostic {
  id: string;
  name: string;
  category: 'Firebase' | 'Google Workspace' | 'Google Cloud & AI';
  status: 'connected' | 'setup_required' | 'unavailable';
  statusReason: string;
  configHint: string;
  lastCheckedAt: string;
}

export interface AdminSessionStatus {
  authenticated: boolean;
  isAdmin: boolean;
  role: AdminRoleType | null;
  permissions: AdminPermissionKey[];
  bootstrapClaimed: boolean;
  canClaimBootstrap: boolean;
  bootstrapSecretRequired: boolean;
  adminEmail: string | null;
  adminUid: string | null;
}

export interface CurriculumSubjectPayload {
  id?: string;
  examTrack: ExamTrack;
  classLevel: ExamClassLevel;
  academicSession: string;
  streams?: UPBoardStream[];
  code: string;
  name: BilingualText;
  overview: BilingualText;
  order: number;
  isPublished: boolean;
  sourceName?: BilingualText;
  sourceUrl?: string;
  verificationStatus?: VerificationStatus;
}
