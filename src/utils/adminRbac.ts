import type {
  AdminPermissionKey,
  AdminRoleType,
  AdminUserRecord,
  StudentAdminView,
} from '../types/admin';
import type { CurriculumSubject } from '../types/curriculum';
import type { LibraryMaterial } from '../types/materials';

/**
 * Evaluates whether an active AdminUserRecord satisfies a required role or granular permission.
 */
export function hasAdminPermission(
  admin: Pick<AdminUserRecord, 'role' | 'active' | 'permissions'> | null | undefined,
  requiredPermission?: AdminPermissionKey,
  requireSuperAdmin = false
): boolean {
  if (!admin || !admin.active) return false;
  if (admin.role === 'super_admin') return true;
  if (requireSuperAdmin) return false;
  if (!requiredPermission) return admin.role === 'content_admin';
  return admin.permissions.includes(requiredPermission);
}

/**
 * Strips any accidental sensitive fields before returning or exporting student records.
 * Passwords or password hashes must NEVER leave auth storage or appear in Admin APIs/CSV exports.
 */
export function sanitizeStudentForAdminExport(
  student: StudentAdminView & Record<string, unknown>
): Record<string, string | number | boolean> {
  return {
    uid: String(student.uid),
    email: String(student.email),
    displayName: String(student.displayName),
    primaryExam: String(student.primaryExam),
    selectedStream: student.selectedStream ?? 'n/a',
    studyMedium: String(student.studyMedium),
    preferredLanguage: String(student.preferredLanguage),
    provider: String(student.provider),
    emailVerified: Boolean(student.emailVerified),
    disabled: Boolean(student.disabled),
    attemptsCount: Number(student.attemptsCount || 0),
    submittedMockCount: Number(student.submittedMockCount || 0),
    practiceCount: Number(student.practiceCount || 0),
    overallAccuracyPercent: Number(student.overallAccuracyPercent || 0),
    createdAt: String(student.createdAt),
    lastActiveAt: String(student.lastActiveAt),
  };
}

/**
 * Safely encodes CSV cell escaping RFC-4180 quotes and neutralising CSV formula injection (=, +, -, @).
 */
export function escapeSafeCsvCell(value: unknown): string {
  let str = value === undefined || value === null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildStudentsCsvExport(students: readonly (StudentAdminView & Record<string, unknown>)[]): string {
  const headers = [
    'uid',
    'email',
    'displayName',
    'primaryExam',
    'selectedStream',
    'studyMedium',
    'preferredLanguage',
    'provider',
    'emailVerified',
    'disabled',
    'attemptsCount',
    'submittedMockCount',
    'practiceCount',
    'overallAccuracyPercent',
    'createdAt',
    'lastActiveAt',
  ];
  const lines = [headers.join(',')];
  for (const s of students) {
    const clean = sanitizeStudentForAdminExport(s);
    lines.push(headers.map((h) => escapeSafeCsvCell(clean[h])).join(','));
  }
  return lines.join('\n');
}

/**
 * Checks whether deleting a Curriculum Subject or Chapter affects linked Study Materials or Questions.
 */
export function findCurriculumDependencies(input: {
  targetType: 'subject' | 'chapter';
  targetId: string;
  materials: readonly Pick<LibraryMaterial, 'id' | 'subjectId' | 'chapterId' | 'title'>[];
  questionIdsAndRefs: readonly { id: string; subjectId: string; chapterId: string }[];
  subject?: CurriculumSubject;
}): {
  linkedMaterialsCount: number;
  linkedQuestionsCount: number;
  linkedChaptersCount: number;
  hasDependencies: boolean;
} {
  const linkedMaterialsCount = input.materials.filter((m) =>
    input.targetType === 'subject' ? m.subjectId === input.targetId : m.chapterId === input.targetId
  ).length;
  const linkedQuestionsCount = input.questionIdsAndRefs.filter((q) =>
    input.targetType === 'subject' ? q.subjectId === input.targetId : q.chapterId === input.targetId
  ).length;
  const linkedChaptersCount =
    input.targetType === 'subject' && input.subject ? input.subject.chapters.length : 0;

  return {
    linkedMaterialsCount,
    linkedQuestionsCount,
    linkedChaptersCount,
    hasDependencies: linkedMaterialsCount > 0 || linkedQuestionsCount > 0 || linkedChaptersCount > 0,
  };
}

/**
 * Validates that an admin email string matches allowed Super Admin bootstrap env configuration.
 */
export function parseSuperAdminEmailAllowlist(envValue?: string): Set<string> {
  const raw = (envValue ?? 'did78994@gmail.com')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (raw.length === 0) raw.push('did78994@gmail.com');
  return new Set(raw);
}

export function normalizeAdminRoleInput(role: unknown): AdminRoleType {
  return role === 'super_admin' ? 'super_admin' : 'content_admin';
}

export function sanitizeSlugId(raw: string, fallbackPrefix: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_\-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
  return cleaned.length >= 2 ? cleaned : `${fallbackPrefix}-${Date.now().toString(36)}`;
}
