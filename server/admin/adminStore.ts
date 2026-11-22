import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ALL_CURRICULUM_SUBJECTS } from '../../src/data/curriculum/index.ts';
import { STUDY_MATERIALS_CATALOG } from '../../src/data/materials/studyMaterialsCatalog.ts';
import {
  ALL_CONTENT_ADMIN_PERMISSIONS,
  DEFAULT_CONTENT_ADMIN_PERMISSIONS,
  type AdminAuditLogEntry,
  type AdminPermissionKey,
  type AdminRoleType,
  type AdminUserRecord,
  type StudentRegistryEntry,
  type SystemSecuritySettings,
  type UploadJobRecord,
} from '../../src/types/admin.ts';
import type { CurriculumSubject } from '../../src/types/curriculum.ts';
import type { ExamTrack } from '../../src/types/database.ts';
import type { LibraryMaterial } from '../../src/types/materials.ts';
import { hasAdminPermission, parseSuperAdminEmailAllowlist } from '../../src/utils/adminRbac.ts';

export type StoredMaterialRecord = LibraryMaterial & { sha256?: string };

interface BootstrapClaimState {
  claimed: boolean;
  claimedByUid?: string;
  claimedByEmail?: string;
  claimedAt?: string;
  passcodeSalt?: string;
  passcodeHash?: string;
}

interface PersistedAdminState {
  adminUsers: Record<string, AdminUserRecord>;
  bootstrapClaim: BootstrapClaimState;
  studentsRegistry: Record<string, StudentRegistryEntry>;
  auditLogs: AdminAuditLogEntry[];
  curriculumOverrides: Record<string, CurriculumSubject>;
  deletedSubjectIds: string[];
  materialOverrides: Record<string, StoredMaterialRecord>;
  deletedMaterialIds: string[];
  uploadJobs: Record<string, UploadJobRecord>;
  systemSettings: SystemSecuritySettings;
}

const DEFAULT_SYSTEM_SETTINGS: SystemSecuritySettings = {
  siteTitle: 'PrepZone — UP Board Class 12 & JEE Preparation',
  maintenanceMode: false,
  allowNewRegistrations: true,
  requireAdminConfirmForBulkPublish: true,
  defaultAcademicSession: '2025-26',
  maxBulkUploadFiles: 100,
  maxPdfUploadMb: 15,
  updatedByUid: 'system-default',
  updatedAt: new Date().toISOString(),
};

const DEFAULT_STATE: PersistedAdminState = {
  adminUsers: {},
  bootstrapClaim: { claimed: false },
  studentsRegistry: {},
  auditLogs: [],
  curriculumOverrides: {},
  deletedSubjectIds: [],
  materialOverrides: {},
  deletedMaterialIds: [],
  uploadJobs: {},
  systemSettings: DEFAULT_SYSTEM_SETTINGS,
};

const ADMIN_DIR = path.resolve(process.cwd(), 'storage', 'admin');
const ADMIN_STATE_FILE = path.join(ADMIN_DIR, 'admin-state.json');
const ADMIN_STAGING_DIR = path.join(ADMIN_DIR, 'staging');

function hashPasscode(passcode: string, saltHex: string): string {
  return crypto.scryptSync(passcode, Buffer.from(saltHex, 'hex'), 64).toString('hex');
}

function verifyPasscode(passcode: string, saltHex: string, expectedHashHex: string): boolean {
  const actual = Buffer.from(hashPasscode(passcode, saltHex), 'hex');
  const expected = Buffer.from(expectedHashHex, 'hex');
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

export class AdminStore {
  private state: PersistedAdminState;

  constructor() {
    this.state = this.load();
  }

  private load(): PersistedAdminState {
    try {
      if (!fs.existsSync(ADMIN_STATE_FILE)) {
        fs.mkdirSync(ADMIN_DIR, { recursive: true });
        return structuredClone(DEFAULT_STATE);
      }
      const raw = fs.readFileSync(ADMIN_STATE_FILE, 'utf8');
      const parsed = JSON.parse(raw) as Partial<PersistedAdminState>;
      return {
        adminUsers:
          parsed.adminUsers && typeof parsed.adminUsers === 'object' ? parsed.adminUsers : {},
        bootstrapClaim:
          parsed.bootstrapClaim && typeof parsed.bootstrapClaim === 'object'
            ? { claimed: Boolean(parsed.bootstrapClaim.claimed), ...parsed.bootstrapClaim }
            : { claimed: false },
        studentsRegistry:
          parsed.studentsRegistry && typeof parsed.studentsRegistry === 'object'
            ? parsed.studentsRegistry
            : {},
        auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
        curriculumOverrides:
          parsed.curriculumOverrides && typeof parsed.curriculumOverrides === 'object'
            ? parsed.curriculumOverrides
            : {},
        deletedSubjectIds: Array.isArray(parsed.deletedSubjectIds) ? parsed.deletedSubjectIds : [],
        materialOverrides:
          parsed.materialOverrides && typeof parsed.materialOverrides === 'object'
            ? parsed.materialOverrides
            : {},
        deletedMaterialIds: Array.isArray(parsed.deletedMaterialIds) ? parsed.deletedMaterialIds : [],
        uploadJobs:
          parsed.uploadJobs && typeof parsed.uploadJobs === 'object' ? parsed.uploadJobs : {},
        systemSettings: parsed.systemSettings
          ? { ...DEFAULT_SYSTEM_SETTINGS, ...parsed.systemSettings }
          : structuredClone(DEFAULT_SYSTEM_SETTINGS),
      };
    } catch {
      return structuredClone(DEFAULT_STATE);
    }
  }

  private save(): void {
    try {
      fs.mkdirSync(ADMIN_DIR, { recursive: true });
      const tmp = `${ADMIN_STATE_FILE}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2), 'utf8');
      fs.renameSync(tmp, ADMIN_STATE_FILE);
    } catch {
      // Non-fatal fallback
    }
  }

  getStagingDir(jobId: string): string {
    const cleanJob = jobId.replace(/[^a-zA-Z0-9_\-]/g, '');
    return path.join(ADMIN_STAGING_DIR, cleanJob);
  }

  // ---------------------------------------------------------------------------
  // Student Presence & Suspension Enforcement
  // ---------------------------------------------------------------------------
  recordStudentPresence(input: {
    uid: string;
    email: string;
    displayName?: string;
    primaryExam?: ExamTrack;
    provider: 'firebase' | 'local-foundation';
    emailVerified?: boolean;
  }): void {
    const key = input.uid;
    const now = new Date().toISOString();
    const existing = this.state.studentsRegistry[key];
    this.state.studentsRegistry[key] = {
      uid: input.uid,
      email: input.email.toLowerCase(),
      displayName: input.displayName?.trim() || existing?.displayName || input.email.split('@')[0],
      primaryExam: input.primaryExam ?? existing?.primaryExam ?? 'up-board-12',
      selectedStream: existing?.selectedStream,
      studyMedium: existing?.studyMedium ?? 'bilingual',
      preferredLanguage: existing?.preferredLanguage ?? 'en',
      provider: input.provider,
      emailVerified: Boolean(input.emailVerified ?? existing?.emailVerified),
      disabled: existing?.disabled ?? false,
      disabledReason: existing?.disabledReason,
      createdAt: existing?.createdAt ?? now,
      lastActiveAt: now,
    };
    this.save();
  }

  isUserDisabled(uid: string, email?: string): boolean {
    const byUid = this.state.studentsRegistry[uid];
    if (byUid?.disabled) return true;
    if (email) {
      const lower = email.toLowerCase();
      return Object.values(this.state.studentsRegistry).some(
        (s) => s.email.toLowerCase() === lower && s.disabled
      );
    }
    return false;
  }

  listRegisteredStudents(): StudentRegistryEntry[] {
    return Object.values(this.state.studentsRegistry).sort((a, b) =>
      b.lastActiveAt.localeCompare(a.lastActiveAt)
    );
  }

  setStudentDisabled(
    uid: string,
    disabled: boolean,
    reason?: string
  ): StudentRegistryEntry | null {
    const target = this.state.studentsRegistry[uid];
    if (!target) return null;
    target.disabled = disabled;
    target.disabledReason = disabled ? reason?.trim() || 'Suspended by administrator' : undefined;
    this.save();
    return target;
  }

  // ---------------------------------------------------------------------------
  // Admin Role Lookup & Secure Super Admin Bootstrap
  // ---------------------------------------------------------------------------
  getSuperAdminAllowlist(): Set<string> {
    return parseSuperAdminEmailAllowlist(process.env.SUPER_ADMIN_EMAILS);
  }

  isBootstrapClaimed(): boolean {
    return Boolean(this.state.bootstrapClaim.claimed);
  }

  hasBootstrapEnvSecret(): boolean {
    return Boolean(process.env.ADMIN_BOOTSTRAP_SECRET?.trim());
  }

  resolveAdminRecord(input: {
    uid: string;
    email: string;
    provider: 'firebase' | 'local-foundation';
    emailVerified?: boolean;
    hasVerifiedAdminSession?: boolean;
  }): AdminUserRecord | null {
    const lowerEmail = input.email.trim().toLowerCase();
    const allowlist = this.getSuperAdminAllowlist();

    // 1. Verified Firebase user matching SUPER_ADMIN_EMAILS
    if (input.provider === 'firebase' && input.emailVerified && allowlist.has(lowerEmail)) {
      const existing =
        this.state.adminUsers[lowerEmail] ??
        Object.values(this.state.adminUsers).find((a) => a.uid === input.uid);
      if (existing) {
        if (!existing.active) return null;
        return existing;
      }
      const now = new Date().toISOString();
      const record: AdminUserRecord = {
        uid: input.uid,
        email: lowerEmail,
        displayName: lowerEmail.split('@')[0],
        role: 'super_admin',
        permissions: ALL_CONTENT_ADMIN_PERMISSIONS,
        active: true,
        grantedByUid: 'firebase-super-admin-allowlist',
        grantedAt: now,
        updatedAt: now,
      };
      this.state.adminUsers[lowerEmail] = record;
      if (!this.state.bootstrapClaim.claimed) {
        this.state.bootstrapClaim.claimed = true;
        this.state.bootstrapClaim.claimedByUid = input.uid;
        this.state.bootstrapClaim.claimedByEmail = lowerEmail;
        this.state.bootstrapClaim.claimedAt = now;
      }
      this.save();
      return record;
    }

    // 2. Explicit server-stored AdminUserRecord (matched by uid, OR email when verified via Firebase/admin-passcode)
    const byEmail = this.state.adminUsers[lowerEmail];
    if (byEmail && byEmail.active) {
      const verifiedOwnership =
        byEmail.uid === input.uid ||
        (input.provider === 'firebase' && Boolean(input.emailVerified)) ||
        Boolean(input.hasVerifiedAdminSession);
      if (verifiedOwnership) {
        return byEmail;
      }
    }

    const byUid = Object.values(this.state.adminUsers).find((a) => a.uid === input.uid);
    if (byUid && byUid.active) {
      return byUid;
    }

    return null;
  }

  claimBootstrapSuperAdmin(input: {
    uid: string;
    email: string;
    displayName?: string;
    passcode: string;
    bootstrapSecret?: string;
  }): { ok: true; admin: AdminUserRecord } | { ok: false; code: string; message: string } {
    if (this.state.bootstrapClaim.claimed) {
      return {
        ok: false,
        code: 'BOOTSTRAP_ALREADY_CLAIMED',
        message: 'Super Admin bootstrap has already been claimed. Sign in as an authorized Admin instead.',
      };
    }

    const envSecret = process.env.ADMIN_BOOTSTRAP_SECRET?.trim();
    if (envSecret) {
      const provided = Buffer.from(input.bootstrapSecret?.trim() || '', 'utf8');
      const expected = Buffer.from(envSecret, 'utf8');
      if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
        return {
          ok: false,
          code: 'INVALID_BOOTSTRAP_SECRET',
          message: 'Server ADMIN_BOOTSTRAP_SECRET verification failed.',
        };
      }
    }

    const passcode = input.passcode.trim();
    if (passcode.length < 10) {
      return {
        ok: false,
        code: 'WEAK_ADMIN_PASSCODE',
        message: 'Admin security passcode must be at least 10 characters.',
      };
    }

    const lowerEmail = input.email.trim().toLowerCase();
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPasscode(passcode, salt);
    const now = new Date().toISOString();

    const admin: AdminUserRecord = {
      uid: input.uid,
      email: lowerEmail,
      displayName: input.displayName?.trim() || 'PrepZone Super Admin',
      role: 'super_admin',
      permissions: ALL_CONTENT_ADMIN_PERMISSIONS,
      active: true,
      grantedByUid: 'bootstrap-claim',
      grantedAt: now,
      updatedAt: now,
    };

    this.state.adminUsers[lowerEmail] = admin;
    this.state.bootstrapClaim = {
      claimed: true,
      claimedByUid: input.uid,
      claimedByEmail: lowerEmail,
      claimedAt: now,
      passcodeSalt: salt,
      passcodeHash: hash,
    };
    this.save();
    return { ok: true, admin };
  }

  verifyAdminPasscodeForUser(input: {
    uid: string;
    email: string;
    passcode: string;
  }): { ok: true; admin: AdminUserRecord } | { ok: false; code: string; message: string } {
    const lower = input.email.trim().toLowerCase();
    const candidate =
      this.state.adminUsers[lower] ??
      Object.values(this.state.adminUsers).find((a) => a.uid === input.uid);

    if (!candidate || !candidate.active) {
      return {
        ok: false,
        code: 'NOT_AN_ADMIN',
        message: 'This account does not hold an active Admin role.',
      };
    }

    const { passcodeSalt, passcodeHash } = this.state.bootstrapClaim;
    if (!passcodeSalt || !passcodeHash) {
      return {
        ok: false,
        code: 'PASSCODE_NOT_SET',
        message: 'Use verified Google Sign-In for your Super Admin account.',
      };
    }

    if (!verifyPasscode(input.passcode.trim(), passcodeSalt, passcodeHash)) {
      return {
        ok: false,
        code: 'INVALID_PASSCODE',
        message: 'Incorrect Admin security passcode.',
      };
    }

    return { ok: true, admin: candidate };
  }

  listAdmins(): AdminUserRecord[] {
    return Object.values(this.state.adminUsers).sort((a, b) =>
      a.role === b.role ? a.email.localeCompare(b.email) : a.role === 'super_admin' ? -1 : 1
    );
  }

  upsertAdminUser(input: {
    email: string;
    uid?: string;
    displayName: string;
    role: AdminRoleType;
    permissions?: AdminPermissionKey[];
    active: boolean;
    grantedByUid: string;
  }): AdminUserRecord {
    const lowerEmail = input.email.trim().toLowerCase();
    const existing = this.state.adminUsers[lowerEmail];
    const now = new Date().toISOString();
    const matchedStudent = Object.values(this.state.studentsRegistry).find(
      (s) => s.email.toLowerCase() === lowerEmail
    );
    const resolvedUid =
      input.uid?.trim() ||
      existing?.uid ||
      matchedStudent?.uid ||
      `adm_${crypto.createHash('sha256').update(lowerEmail).digest('hex').slice(0, 14)}`;

    const perms: AdminPermissionKey[] =
      input.role === 'super_admin'
        ? ALL_CONTENT_ADMIN_PERMISSIONS
        : Array.isArray(input.permissions) && input.permissions.length > 0
        ? input.permissions.filter((p) => ALL_CONTENT_ADMIN_PERMISSIONS.includes(p))
        : existing?.permissions ?? DEFAULT_CONTENT_ADMIN_PERMISSIONS;

    const next: AdminUserRecord = {
      uid: resolvedUid,
      email: lowerEmail,
      displayName: input.displayName.trim() || existing?.displayName || lowerEmail.split('@')[0],
      role: input.role,
      permissions: perms,
      active: Boolean(input.active),
      grantedByUid: existing?.grantedByUid ?? input.grantedByUid,
      grantedAt: existing?.grantedAt ?? now,
      updatedAt: now,
    };

    this.state.adminUsers[lowerEmail] = next;
    this.save();
    return next;
  }

  removeAdminUser(emailOrUid: string): boolean {
    const key = Object.keys(this.state.adminUsers).find((k) => {
      const a = this.state.adminUsers[k];
      return k === emailOrUid.toLowerCase() || a.uid === emailOrUid;
    });
    if (!key) return false;
    // Prevent removing the last active super_admin
    const target = this.state.adminUsers[key];
    if (target.role === 'super_admin') {
      const otherSupers = Object.values(this.state.adminUsers).filter(
        (a) => a.email !== target.email && a.role === 'super_admin' && a.active
      );
      if (otherSupers.length === 0) {
        return false;
      }
    }
    delete this.state.adminUsers[key];
    this.save();
    return true;
  }

  // ---------------------------------------------------------------------------
  // Append-Only Audit Log (Immutable — never edited or deleted)
  // ---------------------------------------------------------------------------
  appendAuditLog(entry: Omit<AdminAuditLogEntry, 'id' | 'createdAt'>): AdminAuditLogEntry {
    const full: AdminAuditLogEntry = {
      ...entry,
      id: `log-${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
    };
    this.state.auditLogs.unshift(full);
    if (this.state.auditLogs.length > 1000) {
      this.state.auditLogs = this.state.auditLogs.slice(0, 1000);
    }
    this.save();
    return full;
  }

  listAuditLogs(admin: AdminUserRecord): AdminAuditLogEntry[] {
    if (hasAdminPermission(admin, undefined, true)) {
      return this.state.auditLogs;
    }
    return this.state.auditLogs.filter((l) => l.adminUid === admin.uid);
  }

  // ---------------------------------------------------------------------------
  // Curriculum Management (Merged over Static Seed Catalog)
  // ---------------------------------------------------------------------------
  getMergedSubjects(includeUnpublished = true): CurriculumSubject[] {
    const deletedSet = new Set(this.state.deletedSubjectIds);
    const merged = new Map<string, CurriculumSubject>();
    for (const sub of ALL_CURRICULUM_SUBJECTS) {
      if (!deletedSet.has(sub.id)) {
        merged.set(sub.id, this.state.curriculumOverrides[sub.id] ?? sub);
      }
    }
    for (const [id, sub] of Object.entries(this.state.curriculumOverrides)) {
      if (!deletedSet.has(id) && !merged.has(id)) {
        merged.set(id, sub);
      }
    }
    const list = Array.from(merged.values())
      .filter((s) => includeUnpublished || s.isPublished)
      .map((sub) => ({
        ...sub,
        chapters: [...sub.chapters]
          .filter((ch) => includeUnpublished || ch.isPublished)
          .sort((a, b) => a.order - b.order)
          .map((ch) => ({
            ...ch,
            topics: [...ch.topics]
              .filter((tp) => includeUnpublished || tp.isPublished)
              .sort((a, b) => a.order - b.order),
          })),
      }))
      .sort((a, b) => a.order - b.order);
    return list;
  }

  upsertSubject(subject: CurriculumSubject): CurriculumSubject {
    this.state.deletedSubjectIds = this.state.deletedSubjectIds.filter((id) => id !== subject.id);
    this.state.curriculumOverrides[subject.id] = subject;
    this.save();
    return subject;
  }

  deleteSubject(subjectId: string): boolean {
    const exists = this.getMergedSubjects(true).some((s) => s.id === subjectId);
    if (!exists) return false;
    if (!this.state.deletedSubjectIds.includes(subjectId)) {
      this.state.deletedSubjectIds.push(subjectId);
    }
    delete this.state.curriculumOverrides[subjectId];
    this.save();
    return true;
  }

  // ---------------------------------------------------------------------------
  // Study Materials Management (Merged over Static Catalog)
  // ---------------------------------------------------------------------------
  getMergedMaterials(includeUnpublished = true): StoredMaterialRecord[] {
    const deletedSet = new Set(this.state.deletedMaterialIds);
    const merged = new Map<string, StoredMaterialRecord>();
    for (const m of STUDY_MATERIALS_CATALOG) {
      if (!deletedSet.has(m.id)) {
        merged.set(m.id, this.state.materialOverrides[m.id] ?? m);
      }
    }
    for (const [id, m] of Object.entries(this.state.materialOverrides)) {
      if (!deletedSet.has(id) && !merged.has(id)) {
        merged.set(id, m);
      }
    }
    const list = Array.from(merged.values()).filter(
      (m) => includeUnpublished || (m.isPublished && m.publicationStatus === 'published')
    );
    return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  getMaterialByIdMerged(materialId: string, includeUnpublished = false): StoredMaterialRecord | undefined {
    return this.getMergedMaterials(includeUnpublished).find((m) => m.id === materialId);
  }

  upsertMaterial(material: StoredMaterialRecord): StoredMaterialRecord {
    this.state.deletedMaterialIds = this.state.deletedMaterialIds.filter((id) => id !== material.id);
    this.state.materialOverrides[material.id] = material;
    this.save();
    return material;
  }

  deleteMaterial(materialId: string): StoredMaterialRecord | null {
    const existing = this.getMaterialByIdMerged(materialId, true);
    if (!existing) return null;
    if (!this.state.deletedMaterialIds.includes(materialId)) {
      this.state.deletedMaterialIds.push(materialId);
    }
    delete this.state.materialOverrides[materialId];
    this.save();
    return existing;
  }

  // ---------------------------------------------------------------------------
  // Bulk Upload Jobs & System Security Settings
  // ---------------------------------------------------------------------------
  saveUploadJob(job: UploadJobRecord): UploadJobRecord {
    this.state.uploadJobs[job.jobId] = job;
    this.save();
    return job;
  }

  getUploadJob(jobId: string): UploadJobRecord | undefined {
    return this.state.uploadJobs[jobId];
  }

  listUploadJobs(): UploadJobRecord[] {
    return Object.values(this.state.uploadJobs).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
  }

  getSystemSettings(): SystemSecuritySettings {
    return this.state.systemSettings;
  }

  updateSystemSettings(
    patch: Partial<SystemSecuritySettings>,
    adminUid: string
  ): SystemSecuritySettings {
    this.state.systemSettings = {
      ...this.state.systemSettings,
      siteTitle:
        typeof patch.siteTitle === 'string' && patch.siteTitle.trim().length >= 2
          ? patch.siteTitle.trim().slice(0, 120)
          : this.state.systemSettings.siteTitle,
      maintenanceMode:
        typeof patch.maintenanceMode === 'boolean'
          ? patch.maintenanceMode
          : this.state.systemSettings.maintenanceMode,
      allowNewRegistrations:
        typeof patch.allowNewRegistrations === 'boolean'
          ? patch.allowNewRegistrations
          : this.state.systemSettings.allowNewRegistrations,
      requireAdminConfirmForBulkPublish:
        typeof patch.requireAdminConfirmForBulkPublish === 'boolean'
          ? patch.requireAdminConfirmForBulkPublish
          : this.state.systemSettings.requireAdminConfirmForBulkPublish,
      defaultAcademicSession:
        typeof patch.defaultAcademicSession === 'string' && patch.defaultAcademicSession.trim()
          ? patch.defaultAcademicSession.trim().slice(0, 20)
          : this.state.systemSettings.defaultAcademicSession,
      maxBulkUploadFiles:
        typeof patch.maxBulkUploadFiles === 'number'
          ? Math.min(100, Math.max(10, Math.round(patch.maxBulkUploadFiles)))
          : this.state.systemSettings.maxBulkUploadFiles,
      maxPdfUploadMb:
        typeof patch.maxPdfUploadMb === 'number'
          ? Math.min(20, Math.max(1, Math.round(patch.maxPdfUploadMb)))
          : this.state.systemSettings.maxPdfUploadMb,
      updatedByUid: adminUid,
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return this.state.systemSettings;
  }
}
