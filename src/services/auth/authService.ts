import { isFirebaseConfigured } from '../firebase/client-check';
import type { ExamTrack, LanguageCode, StudentProfileRecord, UserRecord } from '../../types/database';
import { readStorageJSON, removeStorageKey, writeStorageJSON } from '../../utils/storage';

export interface AuthSession {
  user: UserRecord;
  profile: StudentProfileRecord;
  mode: 'firebase' | 'local-foundation';
}

export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
  primaryExam: ExamTrack;
  studyMedium: 'hindi' | 'english' | 'bilingual';
  preferredLanguage: LanguageCode;
}

export interface LoginInput {
  email: string;
  password: string;
}

export type AuthErrorCode =
  | 'INVALID_NAME'
  | 'INVALID_EMAIL'
  | 'WEAK_PASSWORD'
  | 'ACCOUNT_NOT_FOUND'
  | 'WRONG_PASSWORD'
  | 'GOOGLE_REQUIRES_FIREBASE';

export class AuthFoundationError extends Error {
  code: AuthErrorCode;
  constructor(code: AuthErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

interface StoredAccountEntry {
  user: UserRecord;
  profile: StudentProfileRecord;
  passwordHash: string;
}

const ACCOUNTS_KEY = 'prepzone_foundation_accounts_v1';
const SESSION_KEY = 'prepzone_foundation_session_v1';

export function validateEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function validatePasswordStrength(password: string): boolean {
  return password.length >= 8;
}

export function validateFullName(name: string): boolean {
  return name.trim().length >= 2;
}

/**
 * Lightweight deterministic client-side digest for local foundation mode only.
 * Real production authentication uses Firebase Auth (never client-side password storage).
 */
function encodeFoundationVerifier(raw: string): string {
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a_${(hash >>> 0).toString(16)}`;
}

export function getActiveAuthSession(): AuthSession | null {
  return readStorageJSON<AuthSession | null>(SESSION_KEY, null);
}

export function registerStudentAccount(input: RegisterInput): AuthSession {
  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();

  if (!validateFullName(fullName)) {
    throw new AuthFoundationError('INVALID_NAME');
  }
  if (!validateEmailFormat(email)) {
    throw new AuthFoundationError('INVALID_EMAIL');
  }
  if (!validatePasswordStrength(input.password)) {
    throw new AuthFoundationError('WEAK_PASSWORD');
  }

  const now = new Date().toISOString();
  const uid = `pz_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

  const user: UserRecord = {
    uid,
    email,
    displayName: fullName,
    photoURL: null,
    provider: 'password',
    emailVerified: false,
    role: 'student',
    createdAt: now,
    lastLoginAt: now,
    disabled: false,
  };

  const profile: StudentProfileRecord = {
    uid,
    fullName,
    targetExams: [input.primaryExam],
    primaryExam: input.primaryExam,
    preferredLanguage: input.preferredLanguage,
    studyMedium: input.studyMedium,
    dailyStudyTargetMinutes: 240,
    boardRollTargetYear: 2027,
    jeeTargetYear: 2027,
    updatedAt: now,
  };

  const accounts = readStorageJSON<Record<string, StoredAccountEntry>>(ACCOUNTS_KEY, {});
  accounts[email] = {
    user,
    profile,
    passwordHash: encodeFoundationVerifier(input.password),
  };
  writeStorageJSON(ACCOUNTS_KEY, accounts);

  const session: AuthSession = {
    user,
    profile,
    mode: isFirebaseConfigured() ? 'firebase' : 'local-foundation',
  };
  writeStorageJSON(SESSION_KEY, session);
  return session;
}

export function signInStudentWithEmail(input: LoginInput): AuthSession {
  const email = input.email.trim().toLowerCase();
  if (!validateEmailFormat(email)) {
    throw new AuthFoundationError('INVALID_EMAIL');
  }
  if (!validatePasswordStrength(input.password)) {
    throw new AuthFoundationError('WEAK_PASSWORD');
  }

  const accounts = readStorageJSON<Record<string, StoredAccountEntry>>(ACCOUNTS_KEY, {});
  const entry = accounts[email];
  if (!entry) {
    throw new AuthFoundationError('ACCOUNT_NOT_FOUND');
  }
  if (entry.passwordHash !== encodeFoundationVerifier(input.password)) {
    throw new AuthFoundationError('WRONG_PASSWORD');
  }

  const updatedUser: UserRecord = {
    ...entry.user,
    lastLoginAt: new Date().toISOString(),
  };
  accounts[email] = { ...entry, user: updatedUser };
  writeStorageJSON(ACCOUNTS_KEY, accounts);

  const session: AuthSession = {
    user: updatedUser,
    profile: entry.profile,
    mode: isFirebaseConfigured() ? 'firebase' : 'local-foundation',
  };
  writeStorageJSON(SESSION_KEY, session);
  return session;
}

export function signInWithGoogleFoundation(): AuthSession {
  if (!isFirebaseConfigured()) {
    throw new AuthFoundationError('GOOGLE_REQUIRES_FIREBASE');
  }
  // When Firebase SDK is attached in Prompt 2+, this delegates to signInWithPopup(auth, googleProvider).
  throw new AuthFoundationError('GOOGLE_REQUIRES_FIREBASE');
}

export function updateStudentProfileSession(
  updates: Partial<
    Pick<
      StudentProfileRecord,
      | 'fullName'
      | 'primaryExam'
      | 'selectedStream'
      | 'selectedSubjects'
      | 'studyMedium'
      | 'preferredLanguage'
      | 'schoolOrCoaching'
      | 'district'
    >
  >
): AuthSession | null {
  const session = getActiveAuthSession();
  if (!session) return null;

  const nextFullName = updates.fullName?.trim() || session.profile.fullName;
  if (!validateFullName(nextFullName)) {
    throw new AuthFoundationError('INVALID_NAME');
  }

  const updatedProfile: StudentProfileRecord = {
    ...session.profile,
    ...updates,
    fullName: nextFullName,
    updatedAt: new Date().toISOString(),
  };

  const updatedUser: UserRecord = {
    ...session.user,
    displayName: nextFullName,
  };

  const accounts = readStorageJSON<Record<string, StoredAccountEntry>>(ACCOUNTS_KEY, {});
  const key = updatedUser.email.toLowerCase();
  if (accounts[key]) {
    accounts[key] = {
      ...accounts[key],
      user: updatedUser,
      profile: updatedProfile,
    };
    writeStorageJSON(ACCOUNTS_KEY, accounts);
  }

  const nextSession: AuthSession = {
    ...session,
    user: updatedUser,
    profile: updatedProfile,
  };
  writeStorageJSON(SESSION_KEY, nextSession);
  return nextSession;
}

export function signOutStudent(): void {
  removeStorageKey(SESSION_KEY);
}
