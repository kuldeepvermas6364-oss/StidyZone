import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import express, { type Request, type Response, type Router } from 'express';
import JSZip from 'jszip';
import multer from 'multer';
import type {
  AdminDashboardStats,
  AdminIntegrationDiagnostic,
  AdminPermissionKey,
  AdminSessionStatus,
  AdminUserRecord,
  BulkUploadItemRecord,
  StudentAdminView,
  UploadJobRecord,
} from '../../src/types/admin.ts';
import type {
  ExamConfiguration,
  FullQuestionRecord,
  QuestionImportBatch,
  QuestionImportMapping,
  QuizDefinition,
} from '../../src/types/assessment.ts';
import type {
  CurriculumChapter,
  CurriculumSubject,
  CurriculumTopic,
} from '../../src/types/curriculum.ts';
import type { ExamTrack } from '../../src/types/database.ts';
import {
  findDuplicateMaterial,
  humanizePdfTitle,
  predictPdfCategorization,
} from '../../src/utils/adminBulkCategorizer.ts';
import {
  buildStudentsCsvExport,
  findCurriculumDependencies,
  hasAdminPermission,
  normalizeAdminRoleInput,
  sanitizeSlugId,
  sanitizeStudentForAdminExport,
} from '../../src/utils/adminRbac.ts';
import { computeStudentAnalytics } from '../../src/utils/weakTopics.ts';
import type { AiAdminBridge } from '../ai/aiRouter.ts';
import { isGeminiConfigured } from '../ai/geminiProvider.ts';
import type { AssessmentBridge, VerifiedRequestUser } from '../assessments/assessmentEngine.ts';
import type { LocalSignedStorageProvider } from '../storageProvider.ts';
import { hasPdfMagicHeader } from '../storageUtils.ts';
import type { AdminStore, StoredMaterialRecord } from './adminStore.ts';

interface AdminSessionPayload {
  uid: string;
  email: string;
  role: 'super_admin' | 'content_admin';
  exp: number;
}

export function createAdminRouter(deps: {
  resolveAuthenticatedUser: (req: Request) => Promise<VerifiedRequestUser | null>;
  adminStore: AdminStore;
  storageProvider: LocalSignedStorageProvider;
  assessmentBridge: AssessmentBridge;
  aiBridge: AiAdminBridge;
  sessionSecret: string;
  firebaseProjectId: string;
  firebaseStorageConfigured: boolean;
}): Router {
  const router = express.Router();
  const { adminStore, storageProvider, assessmentBridge, aiBridge } = deps;

  const uploadMiddleware = multer({
    storage: multer.memoryStorage(),
    limits: {
      files: 100,
      fileSize: 25 * 1024 * 1024,
    },
  });

  function signAdminCapabilityToken(payload: AdminSessionPayload): string {
    const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const sig = crypto.createHmac('sha256', deps.sessionSecret).update(`admin:${encoded}`).digest('base64url');
    return `pza1.${encoded}.${sig}`;
  }

  function verifyAdminCapabilityToken(token: string): AdminSessionPayload | null {
    if (!token.startsWith('pza1.')) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [, encoded, sig] = parts;
    if (!encoded || !sig) return null;
    const expected = crypto
      .createHmac('sha256', deps.sessionSecret)
      .update(`admin:${encoded}`)
      .digest('base64url');
    const a = Buffer.from(sig, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
      const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as AdminSessionPayload;
      if (!parsed.uid || !parsed.email || typeof parsed.exp !== 'number') return null;
      if (Math.floor(Date.now() / 1000) > parsed.exp) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  async function resolveAdminActor(req: Request): Promise<{
    user: VerifiedRequestUser | null;
    admin: AdminUserRecord | null;
    hasCapabilityToken: boolean;
  }> {
    const user = await deps.resolveAuthenticatedUser(req);
    const adminCapHeader = req.headers['x-prepzone-admin-token'];
    const capToken = typeof adminCapHeader === 'string' ? adminCapHeader.trim() : '';
    const capPayload = capToken ? verifyAdminCapabilityToken(capToken) : null;

    if (!user) {
      return { user: null, admin: null, hasCapabilityToken: false };
    }

    const hasVerifiedCap = Boolean(
      capPayload && capPayload.uid === user.uid && capPayload.email.toLowerCase() === user.email.toLowerCase()
    );

    const admin = adminStore.resolveAdminRecord({
      uid: user.uid,
      email: user.email,
      provider: user.provider,
      emailVerified: user.emailVerified,
      hasVerifiedAdminSession: hasVerifiedCap,
    });

    return { user, admin, hasCapabilityToken: hasVerifiedCap };
  }

  async function requireAdmin(
    req: Request,
    res: Response,
    options?: { permission?: AdminPermissionKey; superAdminOnly?: boolean }
  ): Promise<{ user: VerifiedRequestUser; admin: AdminUserRecord } | null> {
    const { user, admin } = await resolveAdminActor(req);
    if (!user) {
      res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Sign in required.' });
      return null;
    }
    if (!admin) {
      adminStore.appendAuditLog({
        adminUid: user.uid,
        adminEmail: user.email,
        adminRole: 'system',
        action: `DENIED_${req.method}_${req.path}`,
        targetType: 'auth',
        targetId: user.uid,
        summary: `Unauthorized admin API attempt by non-admin user (${user.email}).`,
        status: 'denied',
      });
      res.status(403).json({
        error: 'ADMIN_ACCESS_REQUIRED',
        message: 'Access Denied: Your account does not hold Admin privileges.',
      });
      return null;
    }
    if (!hasAdminPermission(admin, options?.permission, options?.superAdminOnly)) {
      adminStore.appendAuditLog({
        adminUid: admin.uid,
        adminEmail: admin.email,
        adminRole: admin.role,
        action: `FORBIDDEN_${req.method}_${req.path}`,
        targetType: 'auth',
        targetId: options?.permission ?? 'super_admin_only',
        summary: `${admin.role} attempted restricted operation without permission.`,
        status: 'denied',
      });
      res.status(403).json({
        error: options?.superAdminOnly ? 'SUPER_ADMIN_REQUIRED' : 'INSUFFICIENT_PERMISSION',
        message: options?.superAdminOnly
          ? 'This action is restricted strictly to Super Admin.'
          : `Missing required permission: ${options?.permission}.`,
      });
      return null;
    }
    return { user, admin };
  }

  // ---------------------------------------------------------------------------
  // 1. Admin Auth Status, Secure First-Run Bootstrap Claim & Passcode Verify
  // ---------------------------------------------------------------------------
  router.get('/auth/me', async (req: Request, res: Response) => {
    const { user, admin } = await resolveAdminActor(req);
    const claimed = adminStore.isBootstrapClaimed();
    const payload: AdminSessionStatus = {
      authenticated: Boolean(user),
      isAdmin: Boolean(admin),
      role: admin?.role ?? null,
      permissions: admin?.permissions ?? [],
      bootstrapClaimed: claimed,
      canClaimBootstrap: Boolean(user && !claimed),
      bootstrapSecretRequired: adminStore.hasBootstrapEnvSecret(),
      adminEmail: admin?.email ?? null,
      adminUid: admin?.uid ?? null,
    };
    res.json(payload);
  });

  router.post('/auth/claim-bootstrap', async (req: Request, res: Response) => {
    const user = await deps.resolveAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Sign in first before claiming Super Admin.' });
      return;
    }
    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode : '';
    const bootstrapSecret =
      typeof req.body?.bootstrapSecret === 'string' ? req.body.bootstrapSecret : undefined;
    const displayName =
      typeof req.body?.displayName === 'string' ? req.body.displayName : undefined;

    const result = adminStore.claimBootstrapSuperAdmin({
      uid: user.uid,
      email: user.email,
      displayName,
      passcode,
      bootstrapSecret,
    });

    if (!result.ok) {
      adminStore.appendAuditLog({
        adminUid: user.uid,
        adminEmail: user.email,
        adminRole: 'system',
        action: 'BOOTSTRAP_CLAIM_REJECTED',
        targetType: 'auth',
        targetId: user.uid,
        summary: result.message,
        status: 'denied',
      });
      res.status(403).json({ error: result.code, message: result.message });
      return;
    }

    const adminToken = signAdminCapabilityToken({
      uid: result.admin.uid,
      email: result.admin.email,
      role: result.admin.role,
      exp: Math.floor(Date.now() / 1000) + 4 * 3600,
    });

    adminStore.appendAuditLog({
      adminUid: result.admin.uid,
      adminEmail: result.admin.email,
      adminRole: 'super_admin',
      action: 'BOOTSTRAP_SUPER_ADMIN_CLAIMED',
      targetType: 'admin_role',
      targetId: result.admin.uid,
      summary: `Super Admin initialized cleanly for ${result.admin.email}.`,
      status: 'success',
    });

    res.status(201).json({ admin: result.admin, adminToken });
  });

  router.post('/auth/verify-passcode', async (req: Request, res: Response) => {
    const user = await deps.resolveAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'AUTH_REQUIRED' });
      return;
    }
    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode : '';
    const result = adminStore.verifyAdminPasscodeForUser({
      uid: user.uid,
      email: user.email,
      passcode,
    });
    if (!result.ok) {
      adminStore.appendAuditLog({
        adminUid: user.uid,
        adminEmail: user.email,
        adminRole: 'system',
        action: 'ADMIN_PASSCODE_FAILED',
        targetType: 'auth',
        targetId: user.uid,
        summary: result.message,
        status: 'failure',
      });
      res.status(403).json({ error: result.code, message: result.message });
      return;
    }

    const adminToken = signAdminCapabilityToken({
      uid: result.admin.uid,
      email: result.admin.email,
      role: result.admin.role,
      exp: Math.floor(Date.now() / 1000) + 4 * 3600,
    });
    adminStore.appendAuditLog({
      adminUid: result.admin.uid,
      adminEmail: result.admin.email,
      adminRole: result.admin.role,
      action: 'ADMIN_SESSION_VERIFIED',
      targetType: 'auth',
      targetId: result.admin.uid,
      summary: `${result.admin.role} verified admin console session.`,
      status: 'success',
    });
    res.json({ admin: result.admin, adminToken });
  });

  // ---------------------------------------------------------------------------
  // 2. Real Integration Diagnostics Helper (No Fake Statuses!)
  // ---------------------------------------------------------------------------
  function buildIntegrationDiagnostics(): AdminIntegrationDiagnostic[] {
    const now = new Date().toISOString();
    const fbConfigured = Boolean(deps.firebaseProjectId);
    const geminiReady = isGeminiConfigured();
    const mapsKeyPresent = Boolean(process.env.VITE_GOOGLE_MAPS_API_KEY?.trim());
    const sqlConfigured = Boolean(process.env.SQL_HOST?.trim() && process.env.SQL_USER?.trim());

    const workspaceServices: Array<{ id: string; name: string; scopeHint: string; clientOAuth?: boolean }> = [
      { id: 'google-drive', name: 'Google Drive API', scopeHint: 'drive.file, drive.metadata.readonly', clientOAuth: true },
      { id: 'google-sheets', name: 'Google Sheets API', scopeHint: 'spreadsheets', clientOAuth: true },
      { id: 'gmail-send', name: 'Gmail Send API', scopeHint: 'gmail.send', clientOAuth: true },
      { id: 'google-calendar', name: 'Google Calendar API', scopeHint: 'calendar.events', clientOAuth: true },
      { id: 'google-docs', name: 'Google Docs API', scopeHint: 'documents', clientOAuth: true },
      { id: 'google-slides', name: 'Google Slides API', scopeHint: 'presentations', clientOAuth: true },
      { id: 'google-tasks', name: 'Google Tasks API', scopeHint: 'tasks', clientOAuth: true },
      { id: 'google-chat', name: 'Google Chat API', scopeHint: 'Workspace business account + Chat app setup' },
      { id: 'google-forms', name: 'Google Forms API', scopeHint: 'forms.body, forms.responses.readonly', clientOAuth: true },
      { id: 'google-keep', name: 'Google Keep API', scopeHint: 'Enterprise domain-wide delegation only' },
      { id: 'google-meet', name: 'Google Meet API', scopeHint: 'meetings.space.created', clientOAuth: true },
      { id: 'google-contacts', name: 'Google Contacts (People API)', scopeHint: 'contacts.readonly', clientOAuth: true },
      { id: 'google-picker', name: 'Google Picker API', scopeHint: 'Client Workspace OAuth + API Key', clientOAuth: true },
      { id: 'google-classroom', name: 'Google Classroom API', scopeHint: 'classroom.courses.readonly', clientOAuth: true },
    ];

    const list: AdminIntegrationDiagnostic[] = [
      {
        id: 'firebase-core',
        name: 'Firebase Auth & Cloud Firestore',
        category: 'Firebase',
        status: fbConfigured ? 'connected' : 'setup_required',
        statusReason: fbConfigured
          ? `Provisioned to Firebase project "${deps.firebaseProjectId}" with hardened firestore.rules.`
          : 'firebase-applet-config.json / VITE_FIREBASE_PROJECT_ID missing.',
        configHint: 'Configured via firebase-applet-config.json and deployed rules.',
        lastCheckedAt: now,
      },
      {
        id: 'firebase-storage',
        name: 'Document Storage & Signed Delivery',
        category: 'Firebase',
        status: deps.firebaseStorageConfigured || storageProvider.isConfigured() ? 'connected' : 'setup_required',
        statusReason: deps.firebaseStorageConfigured
          ? 'Firebase Cloud Storage bucket configured with server credentials.'
          : 'Local signed PDF storage active; Firebase Storage bucket requires GOOGLE_APPLICATION_CREDENTIALS in production.',
        configHint: 'Local HMAC signed storage is active for immediate verified PDF streaming.',
        lastCheckedAt: now,
      },
      {
        id: 'gemini-ai',
        name: 'Gemini AI Study Assistant (Server Proxy)',
        category: 'Google Cloud & AI',
        status: geminiReady ? 'connected' : 'setup_required',
        statusReason: geminiReady
          ? 'Server-side GEMINI_API_KEY detected and active (key remains hidden on server).'
          : 'GEMINI_API_KEY is not configured in server environment secrets.',
        configHint: 'Configure GEMINI_API_KEY in AI Studio Secrets (never prefix with VITE_).',
        lastCheckedAt: now,
      },
      {
        id: 'google-maps-platform',
        name: 'Google Maps Platform (Exam Centres)',
        category: 'Google Cloud & AI',
        status: mapsKeyPresent ? 'connected' : 'setup_required',
        statusReason: mapsKeyPresent
          ? 'VITE_GOOGLE_MAPS_API_KEY active for @vis.gl/react-google-maps.'
          : 'Using demo/fallback map key until VITE_GOOGLE_MAPS_API_KEY is provisioned.',
        configHint: 'Managed via Google Maps Platform setup in AI Studio.',
        lastCheckedAt: now,
      },
      {
        id: 'google-cloud-sql',
        name: 'Google Cloud SQL (Optional Relational Adapter)',
        category: 'Google Cloud & AI',
        status: sqlConfigured ? 'connected' : 'unavailable',
        statusReason: sqlConfigured
          ? 'SQL_HOST and SQL_USER configured.'
          : 'Optional adapter not configured (Firestore + server persistence active).',
        configHint: 'Provision Cloud SQL or set SQL_HOST / SQL_USER / SQL_PASSWORD if needed.',
        lastCheckedAt: now,
      },
    ];

    for (const ws of workspaceServices) {
      if (ws.id === 'google-keep') {
        list.push({
          id: ws.id,
          name: ws.name,
          category: 'Google Workspace',
          status: 'unavailable',
          statusReason: 'Google Keep API requires Enterprise Google Workspace domain-wide delegation.',
          configHint: ws.scopeHint,
          lastCheckedAt: now,
        });
      } else if (ws.id === 'google-chat') {
        list.push({
          id: ws.id,
          name: ws.name,
          category: 'Google Workspace',
          status: 'setup_required',
          statusReason: 'Requires a Google Workspace organizational domain + Chat app configuration.',
          configHint: ws.scopeHint,
          lastCheckedAt: now,
        });
      } else {
        list.push({
          id: ws.id,
          name: ws.name,
          category: 'Google Workspace',
          status: fbConfigured ? 'setup_required' : 'unavailable',
          statusReason:
            'Client-side OAuth consent scopes configured; individual user sign-in consent grants runtime Bearer access token in browser.',
          configHint: `Scopes: ${ws.scopeHint}`,
          lastCheckedAt: now,
        });
      }
    }

    return list;
  }

  // ---------------------------------------------------------------------------
  // 3. Dashboard Real Aggregated Telemetry (Zero Dummy Numbers)
  // ---------------------------------------------------------------------------
  router.get('/dashboard/stats', async (req: Request, res: Response) => {
    const authCtx = await requireAdmin(req, res, { permission: 'view_dashboard' });
    if (!authCtx) return;

    const students = adminStore.listRegisteredStudents();
    const weekAgo = Date.now() - 7 * 24 * 3600_000;
    const activeStudents7d = students.filter(
      (s) => !s.disabled && new Date(s.lastActiveAt).getTime() >= weekAgo
    ).length;

    const allMaterials = adminStore.getMergedMaterials(true);
    let storedPdfCount = 0;
    for (const m of allMaterials) {
      if (m.storageProvider === 'local-signed-storage' && m.storagePath) {
        const chk = await storageProvider.inspectFile(m.storagePath);
        if (chk.exists && chk.validPdf) storedPdfCount += 1;
      }
    }

    const allQuestions = assessmentBridge.adminListQuestions?.() ?? [];
    const configs = assessmentBridge.adminListConfigs?.() ?? { examConfigurations: [], quizzes: [] };
    const allSubjects = adminStore.getMergedSubjects(true);
    const metrics = assessmentBridge.adminGetAllStudentMetrics?.() ?? {
      attemptsByUid: {},
      practiceByUid: {},
      totalSubmittedAttempts: 0,
    };
    const aiTel = aiBridge.getTelemetry?.() ?? {
      todayRequests: 0,
      todayTokens: 0,
    };

    const integrations = buildIntegrationDiagnostics();
    const auditLogs = adminStore.listAuditLogs(authCtx.admin).slice(0, 12);
    const uploadJobs = adminStore
      .listUploadJobs()
      .slice(0, 6)
      .map(({ items: _items, ...summary }) => summary);

    const payload: AdminDashboardStats = {
      totalStudents: students.length,
      activeStudents7d,
      suspendedStudents: students.filter((s) => s.disabled).length,
      totalMaterials: allMaterials.length,
      publishedMaterials: allMaterials.filter((m) => m.isPublished && m.publicationStatus === 'published').length,
      pendingVerificationMaterials: allMaterials.filter((m) => m.verificationStatus !== 'verified').length,
      storedPdfCount,
      totalQuestions: allQuestions.length,
      publishedQuestions: allQuestions.filter((q) => q.isPublished).length,
      totalMockTests: configs.examConfigurations.length + configs.quizzes.length,
      publishedMockTests:
        configs.examConfigurations.filter((c) => c.isPublished).length +
        configs.quizzes.filter((q) => q.isPublished).length,
      totalSubjects: allSubjects.length,
      publishedSubjects: allSubjects.filter((s) => s.isPublished).length,
      totalAttemptsSubmitted: metrics.totalSubmittedAttempts,
      aiRequestsToday: aiTel.todayRequests,
      aiTokensToday: aiTel.todayTokens,
      recentAuditLogs: auditLogs,
      recentUploadJobs: uploadJobs,
      integrationSummary: {
        connectedCount: integrations.filter((i) => i.status === 'connected').length,
        setupRequiredCount: integrations.filter((i) => i.status === 'setup_required').length,
        unavailableCount: integrations.filter((i) => i.status === 'unavailable').length,
      },
    };

    res.json(payload);
  });

  // ---------------------------------------------------------------------------
  // 4. Students Management (Search, Progress/Scores, Suspend, Sanitized Export)
  // ---------------------------------------------------------------------------
  function buildStudentAdminViews(): StudentAdminView[] {
    const registry = adminStore.listRegisteredStudents();
    const metrics = assessmentBridge.adminGetAllStudentMetrics?.() ?? {
      attemptsByUid: {},
      practiceByUid: {},
      totalSubmittedAttempts: 0,
    };
    const aiTel = aiBridge.getTelemetry?.();
    const today = new Date().toISOString().slice(0, 10);

    return registry.map((s) => {
      const userAttempts = metrics.attemptsByUid[s.uid] ?? [];
      const userPractice = metrics.practiceByUid[s.uid] ?? [];
      const submittedMocks = userAttempts.filter((a) => a.status === 'submitted');
      const analytics = computeStudentAnalytics(userPractice, submittedMocks);
      const aiCounter = aiTel?.usageByUid?.[s.uid];

      return {
        ...s,
        attemptsCount: userAttempts.length,
        submittedMockCount: submittedMocks.length,
        practiceCount: userPractice.length,
        overallAccuracyPercent: analytics.overallAccuracyPercent,
        aiRequestsToday: aiCounter && aiCounter.dateKey === today ? aiCounter.requestsUsed : 0,
      };
    });
  }

  router.get('/students', async (req: Request, res: Response) => {
    const authCtx = await requireAdmin(req, res, { permission: 'view_students' });
    if (!authCtx) return;

    const query = typeof req.query.query === 'string' ? req.query.query.trim().toLowerCase() : '';
    const examTrack = typeof req.query.examTrack === 'string' ? req.query.examTrack : 'all';
    const status = typeof req.query.status === 'string' ? req.query.status : 'all';
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(50, Math.max(5, Number(req.query.pageSize || 12)));

    const filtered = buildStudentAdminViews().filter((s) => {
      if (examTrack !== 'all' && s.primaryExam !== examTrack) return false;
      if (status === 'active' && s.disabled) return false;
      if (status === 'suspended' && !s.disabled) return false;
      if (query) {
        return (
          s.displayName.toLowerCase().includes(query) ||
          s.email.toLowerCase().includes(query) ||
          s.uid.toLowerCase().includes(query)
        );
      }
      return true;
    });

    const totalCount = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const safePage = Math.min(page, totalPages);
    const students = filtered
      .slice((safePage - 1) * pageSize, safePage * pageSize)
      .map((s) => sanitizeStudentForAdminExport(s as StudentAdminView & Record<string, unknown>));

    res.json({ totalCount, page: safePage, pageSize, totalPages, students });
  });

  router.get('/students/:uid/detail', async (req: Request, res: Response) => {
    const authCtx = await requireAdmin(req, res, { permission: 'view_students' });
    if (!authCtx) return;

    const all = buildStudentAdminViews();
    const target = all.find((s) => s.uid === req.params.uid);
    if (!target) {
      res.status(404).json({ error: 'STUDENT_NOT_FOUND' });
      return;
    }

    const snapshot = assessmentBridge.getStudentSnapshot?.(target.uid);
    res.json({
      student: sanitizeStudentForAdminExport(target as StudentAdminView & Record<string, unknown>),
      attempts: (snapshot?.attempts ?? []).map((a) => ({
        id: a.id,
        title: a.title,
        examTrack: a.examTrack,
        kind: a.kind,
        status: a.status,
        timeSpentSeconds: a.timeSpentSeconds,
        result: a.result
          ? {
              totalScore: a.result.totalScore,
              maxScore: a.result.maxScore,
              accuracyPercent: a.result.accuracyPercent,
              correctCount: a.result.correctCount,
              wrongCount: a.result.wrongCount,
            }
          : null,
      })),
      analytics: snapshot?.analytics ?? null,
    });
  });

  router.patch('/students/:uid/status', async (req: Request, res: Response) => {
    const authCtx = await requireAdmin(req, res, { permission: 'manage_students_status' });
    if (!authCtx) return;

    const disabled = Boolean(req.body?.disabled);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    const updated = adminStore.setStudentDisabled(req.params.uid, disabled, reason);
    if (!updated) {
      res.status(404).json({ error: 'STUDENT_NOT_FOUND' });
      return;
    }

    adminStore.appendAuditLog({
      adminUid: authCtx.admin.uid,
      adminEmail: authCtx.admin.email,
      adminRole: authCtx.admin.role,
      action: disabled ? 'SUSPEND_STUDENT' : 'REACTIVATE_STUDENT',
      targetType: 'student',
      targetId: updated.uid,
      summary: `${disabled ? 'Suspended' : 'Reactivated'} student account ${updated.email}.`,
      status: 'success',
    });

    res.json({ student: updated });
  });

  router.get('/students/export', async (req: Request, res: Response) => {
    const authCtx = await requireAdmin(req, res, { permission: 'export_students' });
    if (!authCtx) return;

    const format = req.query.format === 'json' ? 'json' : 'csv';
    const students = buildStudentAdminViews();

    adminStore.appendAuditLog({
      adminUid: authCtx.admin.uid,
      adminEmail: authCtx.admin.email,
      adminRole: authCtx.admin.role,
      action: `EXPORT_STUDENTS_${format.toUpperCase()}`,
      targetType: 'student',
      targetId: 'bulk_export',
      summary: `Exported ${students.length} sanitized student records (${format.toUpperCase()}).`,
      status: 'success',
    });

    if (format === 'json') {
      const sanitized = students.map((s) =>
        sanitizeStudentForAdminExport(s as StudentAdminView & Record<string, unknown>)
      );
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="prepzone-students.json"');
      res.send(JSON.stringify({ exportedAt: new Date().toISOString(), count: sanitized.length, students: sanitized }, null, 2));
      return;
    }

    const csv = buildStudentsCsvExport(
      students as Array<StudentAdminView & Record<string, unknown>>
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="prepzone-students.csv"');
    res.send(csv);
  });

  // ---------------------------------------------------------------------------
  // 5. Curriculum Management (Subject / Chapter / Topic CRUD + Reorder + Publish)
  // ---------------------------------------------------------------------------
  router.get('/curriculum', async (req: Request, res: Response) => {
    const authCtx = await requireAdmin(req, res, { permission: 'manage_curriculum' });
    if (!authCtx) return;
    res.json({ subjects: adminStore.getMergedSubjects(true) });
  });

  router.post('/curriculum/subjects', async (req: Request, res: Response) => {
    const authCtx = await requireAdmin(req, res, { permission: 'manage_curriculum' });
    if (!authCtx) return;

    const body = req.body as Partial<CurriculumSubject>;
    const examTrack: ExamTrack =
      body.examTrack === 'jee-main' || body.examTrack === 'jee-advanced'
        ? body.examTrack
        : 'up-board-12';
    const nameEn = body.name?.en?.trim() || '';
    const nameHi = body.name?.hi?.trim() || nameEn;
    if (nameEn.length < 2) {
      res.status(400).json({ error: 'INVALID_SUBJECT_NAME', message: 'Subject English title required.' });
      return;
    }

    const existing = adminStore.getMergedSubjects(true);
    const id = body.id?.trim() || sanitizeSlugId(`${examTrack}-${nameEn}`, 'sub');
    const prev = existing.find((s) => s.id === id);

    // Duplicate detection on new create
    if (
      !body.id &&
      existing.some(
        (s) =>
          s.examTrack === examTrack &&
          s.name.en.trim().toLowerCase() === nameEn.toLowerCase()
      )
    ) {
      res.status(409).json({
        error: 'DUPLICATE_SUBJECT',
        message: `A subject named "${nameEn}" already exists under ${examTrack}.`,
      });
      return;
    }

    const next: CurriculumSubject = {
      id,
      examTrack,
      classLevel: examTrack === 'up-board-12' ? 'class-12' : 'entrance-ug',
      academicSession: body.academicSession?.trim() || '2025-26',
      streams: examTrack === 'up-board-12' ? body.streams ?? ['science'] : undefined,
      code: (body.code || nameEn.slice(0, 6)).toUpperCase(),
      name: { en: nameEn, hi: nameHi },
      overview: {
        en: body.overview?.en?.trim() || prev?.overview.en || `${nameEn} curriculum module`,
        hi: body.overview?.hi?.trim() || prev?.overview.hi || `${nameHi} पाठ्यक्रम`,
      },
      order: typeof body.order === 'number' ? body.order : prev?.order ?? existing.length + 1,
      isPublished: typeof body.isPublished === 'boolean' ? body.isPublished : prev?.isPublished ?? true,
      importantTopics: prev?.importantTopics ?? [],
      chapters: prev?.chapters ?? [],
      removedOrReducedTopics: prev?.removedOrReducedTopics ?? [],
      verification: {
        sourceName: body.verification?.sourceName ?? prev?.verification.sourceName ?? {
          en: 'PrepZone Academic Desk',
          hi: 'PrepZone शैक्षणिक डेस्क',
        },
        sourceUrl: body.verification?.sourceUrl?.trim() || prev?.verification.sourceUrl || 'https://upmsp.edu.in/',
        academicSession: body.academicSession?.trim() || '2025-26',
        lastVerifiedDate: new Date().toISOString().slice(0, 10),
        verificationStatus: body.verification?.verificationStatus ?? 'verified',
        notes: body.verification?.notes ?? prev?.verification.notes ?? {
          en: 'Verified in Admin Curriculum Manager.',
          hi: 'एडमिन पाठ्यक्रम प्रबंधक में सत्यापित।',
        },
      },
    };

    const saved = adminStore.upsertSubject(next);
    adminStore.appendAuditLog({
      adminUid: authCtx.admin.uid,
      adminEmail: authCtx.admin.email,
      adminRole: authCtx.admin.role,
      action: prev ? 'UPDATE_SUBJECT' : 'CREATE_SUBJECT',
      targetType: 'curriculum',
      targetId: saved.id,
      summary: `${prev ? 'Updated' : 'Created'} subject "${saved.name.en}" (${saved.examTrack}).`,
      status: 'success',
    });
    res.status(prev ? 200 : 201).json({ subject: saved });
  });

  router.delete('/curriculum/subjects/:subjectId', async (req: Request, res: Response) => {
    const authCtx = await requireAdmin(req, res, { permission: 'manage_curriculum' });
    if (!authCtx) return;

    const subjectId = req.params.subjectId;
    const subject = adminStore.getMergedSubjects(true).find((s) => s.id === subjectId);
    if (!subject) {
      res.status(404).json({ error: 'SUBJECT_NOT_FOUND' });
      return;
    }

    const depsCheck = findCurriculumDependencies({
      targetType: 'subject',
      targetId: subjectId,
      materials: adminStore.getMergedMaterials(true),
      questionIdsAndRefs: assessmentBridge.adminListQuestions?.() ?? [],
      subject,
    });

    if (depsCheck.hasDependencies && req.query.force !== 'true') {
      res.status(409).json({
        error: 'DEPENDENCIES_EXIST',
        dependencies: depsCheck,
        message: `Cannot delete: linked to ${depsCheck.linkedChaptersCount} chapters, ${depsCheck.linkedMaterialsCount} materials, and ${depsCheck.linkedQuestionsCount} questions.`,
      });
      return;
    }

    adminStore.deleteSubject(subjectId);
    adminStore.appendAuditLog({
      adminUid: authCtx.admin.uid,
      adminEmail: authCtx.admin.email,
      adminRole: authCtx.admin.role,
      action: 'DELETE_SUBJECT',
      targetType: 'curriculum',
      targetId: subjectId,
      summary: `Deleted subject "${subject.name.en}" (${subjectId}).`,
      status: 'success',
    });
    res.json({ deleted: true, subjectId });
  });

  router.post('/curriculum/subjects/:subjectId/chapters', async (req: Request, res: Response) => {
    const authCtx = await requireAdmin(req, res, { permission: 'manage_curriculum' });
    if (!authCtx) return;

    const subject = adminStore.getMergedSubjects(true).find((s) => s.id === req.params.subjectId);
    if (!subject) {
      res.status(404).json({ error: 'SUBJECT_NOT_FOUND' });
      return;
    }

    const body = req.body as Partial<CurriculumChapter>;
    const titleEn = body.title?.en?.trim() || '';
    const titleHi = body.title?.hi?.trim() || titleEn;
    if (titleEn.length < 2) {
      res.status(400).json({ error: 'INVALID_CHAPTER_TITLE' });
      return;
    }

    const chapterId = body.id?.trim() || sanitizeSlugId(`${subject.id}-${titleEn}`, 'ch');
    const existingIdx = subject.chapters.findIndex((c) => c.id === chapterId);
    const prev = existingIdx >= 0 ? subject.chapters[existingIdx] : undefined;

    if (
      existingIdx < 0 &&
      subject.chapters.some((c) => c.title.en.trim().toLowerCase() === titleEn.toLowerCase())
    ) {
      res.status(409).json({ error: 'DUPLICATE_CHAPTER', message: `Chapter "${titleEn}" already exists.` });
      return;
    }

    const nextChapter: CurriculumChapter = {
      id: chapterId,
      subjectId: subject.id,
      examTrack: subject.examTrack,
      classLevel: subject.classLevel,
      academicSession: body.academicSession?.trim() || subject.academicSession,
      unitNumber: Number(body.unitNumber || prev?.unitNumber || subject.chapters.length + 1),
      order: Number(body.order ?? prev?.order ?? subject.chapters.length + 1),
      title: { en: titleEn, hi: titleHi },
      overview: {
        en: body.overview?.en?.trim() || prev?.overview.en || titleEn,
        hi: body.overview?.hi?.trim() || prev?.overview.hi || titleHi,
      },
      estimatedHours: Number(body.estimatedHours || prev?.estimatedHours || 6),
      isImportantUnit: Boolean(body.isImportantUnit ?? prev?.isImportantUnit ?? false),
      isPublished: typeof body.isPublished === 'boolean' ? body.isPublished : prev?.isPublished ?? true,
      verificationStatus: body.verificationStatus ?? prev?.verificationStatus ?? 'verified',
      sourceUrl: body.sourceUrl?.trim() || prev?.sourceUrl || subject.verification.sourceUrl,
      topics: prev?.topics ?? [],
    };

    const nextChapters = [...subject.chapters];
    if (existingIdx >= 0) nextChapters[existingIdx] = nextChapter;
    else nextChapters.push(nextChapter);

    const updatedSubject = adminStore.upsertSubject({ ...subject, chapters: nextChapters });
    adminStore.appendAuditLog({
      adminUid: authCtx.admin.uid,
      adminEmail: authCtx.admin.email,
      adminRole: authCtx.admin.role,
      action: existingIdx >= 0 ? 'UPDATE_CHAPTER' : 'CREATE_CHAPTER',
      targetType: 'curriculum',
      targetId: chapterId,
      summary: `${existingIdx >= 0 ? 'Updated' : 'Created'} chapter "${titleEn}" in ${subject.name.en}.`,
      status: 'success',
    });

    res.status(existingIdx >= 0 ? 200 : 201).json({ subject: updatedSubject, chapter: nextChapter });
  });

  router.put('/curriculum/subjects/:subjectId/chapters/reorder', async (req: Request, res: Response) => {
    const authCtx = await requireAdmin(req, res, { permission: 'manage_curriculum' });
    if (!authCtx) return;

    const subject = adminStore.getMergedSubjects(true).find((s) => s.id === req.params.subjectId);
    if (!subject) {
      res.status(404).json({ error: 'SUBJECT_NOT_FOUND' });
      return;
    }
    const orderedIds = Array.isArray(req.body?.orderedChapterIds)
      ? req.body.orderedChapterIds.map(String)
      : [];
    const orderLookup = new Map(orderedIds.map((id, idx) => [id, idx + 1]));
    const reordered = subject.chapters.map((ch) => ({
      ...ch,
      order: orderLookup.get(ch.id) ?? ch.order,
    }));
    const saved = adminStore.upsertSubject({ ...subject, chapters: reordered });
    adminStore.appendAuditLog({
      adminUid: authCtx.admin.uid,
      adminEmail: authCtx.admin.email,
      adminRole: authCtx.admin.role,
      action: 'REORDER_CHAPTERS',
      targetType: 'curriculum',
      targetId: subject.id,
      summary: `Reordered chapters in ${subject.name.en}.`,
      status: 'success',
    });
    res.json({ subject: saved });
  });

  router.delete('/curriculum/subjects/:subjectId/chapters/:chapterId', async (req: Request, res: Response) => {
    const authCtx = await requireAdmin(req, res, { permission: 'manage_curriculum' });
    if (!authCtx) return;

    const subject = adminStore.getMergedSubjects(true).find((s) => s.id === req.params.subjectId);
    if (!subject) {
      res.status(404).json({ error: 'SUBJECT_NOT_FOUND' });
      return;
    }
    const chapterId = req.params.chapterId;
    const depsCheck = findCurriculumDependencies({
      targetType: 'chapter',
      targetId: chapterId,
      materials: adminStore.getMergedMaterials(true),
      questionIdsAndRefs: assessmentBridge.adminListQuestions?.() ?? [],
    });
    if (depsCheck.hasDependencies && req.query.force !== 'true') {
      res.status(409).json({
        error: 'DEPENDENCIES_EXIST',
        dependencies: depsCheck,
        message: `Linked to ${depsCheck.linkedMaterialsCount} materials and ${depsCheck.linkedQuestionsCount} questions.`,
      });
      return;
    }
    const nextChapters = subject.chapters.filter((c) => c.id !== chapterId);
    const saved = adminStore.upsertSubject({ ...subject, chapters: nextChapters });
    adminStore.appendAuditLog({
      adminUid: authCtx.admin.uid,
      adminEmail: authCtx.admin.email,
      adminRole: authCtx.admin.role,
      action: 'DELETE_CHAPTER',
      targetType: 'curriculum',
      targetId: chapterId,
      summary: `Removed chapter ${chapterId} from ${subject.name.en}.`,
      status: 'success',
    });
    res.json({ subject: saved });
  });

  router.post(
    '/curriculum/subjects/:subjectId/chapters/:chapterId/topics',
    async (req: Request, res: Response) => {
      const authCtx = await requireAdmin(req, res, { permission: 'manage_curriculum' });
      if (!authCtx) return;

      const subject = adminStore.getMergedSubjects(true).find((s) => s.id === req.params.subjectId);
      if (!subject) {
        res.status(404).json({ error: 'SUBJECT_NOT_FOUND' });
        return;
      }
      const chIdx = subject.chapters.findIndex((c) => c.id === req.params.chapterId);
      if (chIdx < 0) {
        res.status(404).json({ error: 'CHAPTER_NOT_FOUND' });
        return;
      }

      const ch = subject.chapters[chIdx];
      const body = req.body as Partial<CurriculumTopic>;
      const titleEn = body.title?.en?.trim() || '';
      const titleHi = body.title?.hi?.trim() || titleEn;
      if (titleEn.length < 2) {
        res.status(400).json({ error: 'INVALID_TOPIC_TITLE' });
        return;
      }

      const topicId = body.id?.trim() || sanitizeSlugId(`${ch.id}-${titleEn}`, 'tp');
      const existingTopicIdx = ch.topics.findIndex((t) => t.id === topicId);
      const nextTopic: CurriculumTopic = {
        id: topicId,
        chapterId: ch.id,
        subjectId: subject.id,
        title: { en: titleEn, hi: titleHi },
        subtopics: Array.isArray(body.subtopics) ? body.subtopics : [],
        syllabusCode: body.syllabusCode?.trim() || `U${ch.unitNumber}.${ch.topics.length + 1}`,
        inclusionStatus: body.inclusionStatus ?? 'included',
        importance: body.importance ?? 'core',
        order: Number(body.order ?? ch.topics.length + 1),
        isPublished: typeof body.isPublished === 'boolean' ? body.isPublished : true,
        verificationStatus: body.verificationStatus ?? 'verified',
      };

      const nextTopics = [...ch.topics];
      if (existingTopicIdx >= 0) nextTopics[existingTopicIdx] = nextTopic;
      else nextTopics.push(nextTopic);

      const nextChapters = [...subject.chapters];
      nextChapters[chIdx] = { ...ch, topics: nextTopics };
      const saved = adminStore.upsertSubject({ ...subject, chapters: nextChapters });
      adminStore.appendAuditLog({
        adminUid: authCtx.admin.uid,
        adminEmail: authCtx.admin.email,
        adminRole: authCtx.admin.role,
        action: existingTopicIdx >= 0 ? 'UPDATE_TOPIC' : 'CREATE_TOPIC',
        targetType: 'curriculum',
        targetId: topicId,
        summary: `${existingTopicIdx >= 0 ? 'Updated' : 'Added'} topic "${titleEn}" under ${ch.title.en}.`,
        status: 'success',
      });
      res.status(existingTopicIdx >= 0 ? 200 : 201).json({ subject: saved, topic: nextTopic });
    }
  );

  // ---------------------------------------------------------------------------
  // 6. Study Materials Catalog CRUD + Verification Workflow
  // ---------------------------------------------------------------------------
  router.get('/materials', async (req: Request, res: Response) => {
    const authCtx = await requireAdmin(req, res, { permission: 'manage_materials' });
    if (!authCtx) return;

    const all = adminStore.getMergedMaterials(true);
    const enriched = await Promise.all(
      all.map(async (m) => {
        if (m.storageProvider === 'local-signed-storage' && m.storagePath) {
          const chk = await storageProvider.inspectFile(m.storagePath);
          return { ...m, fileAvailable: chk.exists && chk.validPdf, fileSizeBytes: chk.fileSizeBytes || m.fileSizeBytes };
        }
        return { ...m, fileAvailable: true };
      })
    );
    res.json({ totalCount: enriched.length, materials: enriched });
  });

  router.post('/materials', async (req: Request, res: Response) => {
    const authCtx = await requireAdmin(req, res, { permission: 'manage_materials' });
    if (!authCtx) return;

    const body = req.body as Partial<StoredMaterialRecord>;
    const titleEn = body.title?.en?.trim() || '';
    const titleHi = body.title?.hi?.trim() || titleEn;
    if (titleEn.length < 3 || !body.subjectId) {
      res.status(400).json({ error: 'INVALID_MATERIAL_PAYLOAD', message: 'Title and subjectId are required.' });
      return;
    }

    const now = new Date().toISOString();
    const id = body.id?.trim() || sanitizeSlugId(`${body.subjectId}-${titleEn}`, 'mat');
    const existing = adminStore.getMaterialByIdMerged(id, true);

    const record: StoredMaterialRecord = {
      id,
      title: { en: titleEn, hi: titleHi },
      description: {
        en: body.description?.en?.trim() || existing?.description.en || titleEn,
        hi: body.description?.hi?.trim() || existing?.description.hi || titleHi,
      },
      examTrack: body.examTrack ?? existing?.examTrack ?? 'up-board-12',
      academicSession: body.academicSession?.trim() || existing?.academicSession || '2025-26',
      classLevel: body.examTrack === 'up-board-12' ? 'class-12' : 'entrance-ug',
      streamId: body.streamId ?? existing?.streamId,
      subjectId: body.subjectId,
      chapterId: body.chapterId || undefined,
      topicId: body.topicId || undefined,
      materialType: body.materialType ?? existing?.materialType ?? 'chapter_notes',
      language: body.language ?? existing?.language ?? 'en',
      fileFormat: body.fileFormat ?? existing?.fileFormat ?? (body.materialType === 'video_lecture' ? 'VIDEO' : 'PDF'),
      fileSizeBytes: body.fileSizeBytes ?? existing?.fileSizeBytes,
      pageCount: body.pageCount ?? existing?.pageCount,
      storageProvider: body.storageProvider ?? existing?.storageProvider ?? 'external-official',
      storagePath: body.storagePath ?? existing?.storagePath,
      externalSourceUrl: body.externalSourceUrl?.trim() || existing?.externalSourceUrl || 'https://upmsp.edu.in/',
      distributionType: body.distributionType ?? existing?.distributionType ?? 'official_external_link',
      accessLevel: body.accessLevel ?? existing?.accessLevel ?? 'public',
      downloadAllowed: typeof body.downloadAllowed === 'boolean' ? body.downloadAllowed : existing?.downloadAllowed ?? false,
      publisher: body.publisher ?? existing?.publisher ?? { en: 'PrepZone Verified Resource', hi: 'PrepZone सत्यापित संसाधन' },
      author: body.author ?? existing?.author ?? { en: authCtx.admin.displayName, hi: authCtx.admin.displayName },
      isOfficial: Boolean(body.isOfficial ?? existing?.isOfficial ?? false),
      verificationStatus: body.verificationStatus ?? existing?.verificationStatus ?? 'verified',
      verifiedDate: new Date().toISOString().slice(0, 10),
      licenseOrDistributionNote: body.licenseOrDistributionNote ?? existing?.licenseOrDistributionNote ?? {
        en: 'Reviewed and approved in PrepZone Admin Study Materials Studio.',
        hi: 'PrepZone एडमिन सामग्री प्रबंधन में समीक्षित व स्वीकृत।',
      },
      keywords: Array.isArray(body.keywords) ? body.keywords : existing?.keywords ?? [],
      visibility: body.visibility ?? existing?.visibility ?? 'public',
      publicationStatus: body.publicationStatus ?? (body.isPublished === false ? 'draft' : 'published'),
      isPublished: typeof body.isPublished === 'boolean' ? body.isPublished : existing?.isPublished ?? true,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      createdByUid: existing?.createdByUid ?? authCtx.admin.uid,
    };

    const saved = adminStore.upsertMaterial(record);
    adminStore.appendAuditLog({
      adminUid: authCtx.admin.uid,
      adminEmail: authCtx.admin.email,
      adminRole: authCtx.admin.role,
      action: existing ? 'UPDATE_MATERIAL' : 'CREATE_MATERIAL',
      targetType: 'material',
      targetId: saved.id,
      summary: `${existing ? 'Updated' : 'Created'} study material "${saved.title.en}" (${saved.publicationStatus}).`,
      status: 'success',
    });
    res.status(existing ? 200 : 201).json({ material: saved });
  });

  router.delete('/materials/:materialId', async (req: Request, res: Response) => {
    const authCtx = await requireAdmin(req, res, { permission: 'manage_materials' });
    if (!authCtx) return;

    const removed = adminStore.deleteMaterial(req.params.materialId);
    if (!removed) {
      res.status(404).json({ error: 'MATERIAL_NOT_FOUND' });
      return;
    }

    if (removed.storageProvider === 'local-signed-storage' && removed.storagePath) {
      await storageProvider.deletePdfFile(removed.storagePath);
    }

    adminStore.appendAuditLog({
      adminUid: authCtx.admin.uid,
      adminEmail: authCtx.admin.email,
      adminRole: authCtx.admin.role,
      action: 'DELETE_MATERIAL',
      targetType: 'material',
      targetId: removed.id,
      summary: `Deleted material "${removed.title.en}".`,
      status: 'success',
    });
    res.json({ deleted: true, materialId: removed.id });
  });

  // ---------------------------------------------------------------------------
  // 7. Bulk PDF + ZIP Upload Pipeline (50–100 PDFs, Smart Auto-Categorization Preview)
  // ---------------------------------------------------------------------------
  router.post(
    '/uploads/bulk-prepare',
    uploadMiddleware.array('files', 100),
    async (req: Request, res: Response) => {
      const authCtx = await requireAdmin(req, res, { permission: 'bulk_upload' });
      if (!authCtx) return;

      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      if (files.length === 0) {
        res.status(400).json({ error: 'NO_FILES_UPLOADED', message: 'Select one or more PDF or ZIP files.' });
        return;
      }

      const sysSettings = adminStore.getSystemSettings();
      const maxPdfBytes = sysSettings.maxPdfUploadMb * 1024 * 1024;
      const jobId = `job-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
      const stagingDir = adminStore.getStagingDir(jobId);
      await fs.mkdir(stagingDir, { recursive: true });

      const subjects = adminStore.getMergedSubjects(true);
      const existingMaterials = adminStore.getMergedMaterials(true);
      const seenHashesInJob = new Set<string>();
      const items: BulkUploadItemRecord[] = [];

      const processPdfCandidate = async (
        filename: string,
        bytes: Buffer,
        sourceArchive?: string
      ) => {
        if (items.length >= sysSettings.maxBulkUploadFiles) {
          items.push({
            itemId: `item-${crypto.randomUUID().slice(0, 8)}`,
            originalFilename: filename,
            sourceArchive,
            fileSizeBytes: bytes.byteLength,
            sha256: '',
            status: 'error',
            errorMessage: `Exceeded maximum batch limit of ${sysSettings.maxBulkUploadFiles} files.`,
            titleEn: humanizePdfTitle(filename),
            titleHi: humanizePdfTitle(filename),
            descriptionEn: '',
            descriptionHi: '',
            examTrack: 'up-board-12',
            academicSession: sysSettings.defaultAcademicSession,
            classLevel: 'class-12',
            subjectId: 'up12-physics',
            materialType: 'chapter_notes',
            language: 'en',
            downloadAllowed: true,
            isOfficial: false,
            verificationStatus: 'awaiting_verification',
            externalSourceUrl: 'https://upmsp.edu.in/',
          });
          return;
        }

        const itemId = `item-${crypto.randomUUID().slice(0, 8)}`;
        const baseName = path.basename(filename);
        const cleanTitle = humanizePdfTitle(baseName) || `Study Material ${items.length + 1}`;
        const prediction = predictPdfCategorization(baseName, subjects);

        if (bytes.byteLength === 0 || bytes.byteLength > maxPdfBytes) {
          items.push({
            itemId,
            originalFilename: baseName,
            sourceArchive,
            fileSizeBytes: bytes.byteLength,
            sha256: '',
            status: 'error',
            errorMessage:
              bytes.byteLength === 0
                ? 'Empty file rejected.'
                : `File exceeds max ${sysSettings.maxPdfUploadMb} MB limit.`,
            titleEn: cleanTitle,
            titleHi: cleanTitle,
            descriptionEn: `Uploaded via PrepZone bulk ingestion (${baseName}).`,
            descriptionHi: `${cleanTitle} अध्ययन सामग्री।`,
            ...prediction,
            downloadAllowed: true,
            isOfficial: false,
            verificationStatus: 'awaiting_verification',
            externalSourceUrl: 'https://upmsp.edu.in/',
            prediction,
          });
          return;
        }

        if (!hasPdfMagicHeader(bytes.subarray(0, 8))) {
          items.push({
            itemId,
            originalFilename: baseName,
            sourceArchive,
            fileSizeBytes: bytes.byteLength,
            sha256: '',
            status: 'error',
            errorMessage: 'Invalid PDF header (%PDF- signature missing).',
            titleEn: cleanTitle,
            titleHi: cleanTitle,
            descriptionEn: `Rejected invalid PDF candidate (${baseName}).`,
            descriptionHi: `${cleanTitle}`,
            ...prediction,
            downloadAllowed: true,
            isOfficial: false,
            verificationStatus: 'awaiting_verification',
            externalSourceUrl: 'https://upmsp.edu.in/',
            prediction,
          });
          return;
        }

        const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
        const dupCatalog = findDuplicateMaterial({ filename: baseName, sha256 }, existingMaterials);
        const dupBatch = seenHashesInJob.has(sha256);

        let tempStorageKey: string | undefined;
        if (!dupCatalog.isDuplicate && !dupBatch) {
          seenHashesInJob.add(sha256);
          tempStorageKey = `${itemId}.pdf`;
          await fs.writeFile(path.join(stagingDir, tempStorageKey), bytes);
        }

        items.push({
          itemId,
          originalFilename: baseName,
          sourceArchive,
          fileSizeBytes: bytes.byteLength,
          sha256,
          tempStorageKey,
          status: dupCatalog.isDuplicate || dupBatch ? 'duplicate' : 'ready',
          errorMessage: dupCatalog.isDuplicate
            ? dupCatalog.reason
            : dupBatch
            ? 'Duplicate file within this upload batch.'
            : undefined,
          duplicateOfId: dupCatalog.existingId,
          titleEn: cleanTitle,
          titleHi: cleanTitle,
          descriptionEn: `PrepZone study PDF (${prediction.examTrack} · ${prediction.subjectId}). Pending admin confirmation.`,
          descriptionHi: `${cleanTitle} — एडमिन समीक्षा के बाद प्रकाशित।`,
          examTrack: prediction.examTrack,
          academicSession: prediction.academicSession,
          classLevel: prediction.classLevel,
          streamId: prediction.streamId,
          subjectId: prediction.subjectId,
          chapterId: prediction.chapterId,
          topicId: prediction.topicId,
          materialType: prediction.materialType,
          language: prediction.language,
          downloadAllowed: true,
          isOfficial: false,
          verificationStatus: 'awaiting_verification',
          externalSourceUrl:
            prediction.examTrack === 'up-board-12' ? 'https://upmsp.edu.in/' : 'https://jeemain.nta.nic.in/',
          prediction,
        });
      };

      for (const file of files) {
        const lower = file.originalname.toLowerCase();
        if (lower.endsWith('.zip') || file.mimetype === 'application/zip') {
          try {
            const zip = await JSZip.loadAsync(file.buffer);
            const entries = Object.values(zip.files).slice(0, 120);
            for (const entry of entries) {
              if (entry.dir) continue;
              if (entry.name.includes('__MACOSX') || entry.name.includes('..')) continue;
              if (!entry.name.toLowerCase().endsWith('.pdf')) continue;
              const extracted = await entry.async('nodebuffer');
              await processPdfCandidate(entry.name, extracted, file.originalname);
            }
          } catch {
            items.push({
              itemId: `item-${crypto.randomUUID().slice(0, 8)}`,
              originalFilename: file.originalname,
              fileSizeBytes: file.size,
              sha256: '',
              status: 'error',
              errorMessage: 'Corrupted or unsupported ZIP archive.',
              titleEn: file.originalname,
              titleHi: file.originalname,
              descriptionEn: 'ZIP archive extraction failed.',
              descriptionHi: 'ZIP निष्कर्षण विफल।',
              examTrack: 'up-board-12',
              academicSession: sysSettings.defaultAcademicSession,
              classLevel: 'class-12',
              subjectId: 'up12-physics',
              materialType: 'chapter_notes',
              language: 'en',
              downloadAllowed: true,
              isOfficial: false,
              verificationStatus: 'awaiting_verification',
              externalSourceUrl: 'https://upmsp.edu.in/',
            });
          }
        } else {
          await processPdfCandidate(file.originalname, file.buffer);
        }
      }

      const now = new Date().toISOString();
      const job: UploadJobRecord = {
        jobId,
        adminUid: authCtx.admin.uid,
        adminEmail: authCtx.admin.email,
        status: 'preview',
        totalFiles: items.length,
        readyCount: items.filter((i) => i.status === 'ready').length,
        duplicateCount: items.filter((i) => i.status === 'duplicate').length,
        failedCount: items.filter((i) => i.status === 'error').length,
        importedCount: 0,
        items,
        createdAt: now,
        updatedAt: now,
      };
      adminStore.saveUploadJob(job);

      adminStore.appendAuditLog({
        adminUid: authCtx.admin.uid,
        adminEmail: authCtx.admin.email,
        adminRole: authCtx.admin.role,
        action: 'BULK_PDF_PREPARE',
        targetType: 'bulk_upload',
        targetId: jobId,
        summary: `Prepared bulk upload preview: ${job.readyCount} ready, ${job.duplicateCount} duplicates, ${job.failedCount} errors.`,
        status: 'success',
      });

      res.status(201).json({ job });
    }
  );

  router.post('/uploads/:jobId/commit', async (req: Request, res: Response) => {
    const authCtx = await requireAdmin(req, res, { permission: 'bulk_upload' });
    if (!authCtx) return;

    const job = adminStore.getUploadJob(req.params.jobId);
    if (!job) {
      res.status(404).json({ error: 'UPLOAD_JOB_NOT_FOUND' });
      return;
    }

    const editedItems = Array.isArray(req.body?.items)
      ? (req.body.items as BulkUploadItemRecord[])
      : job.items;
    const publishImmediately = req.body?.publishImmediately === true;
    const stagingDir = adminStore.getStagingDir(job.jobId);
    const now = new Date().toISOString();

    let importedNow = 0;
    const updatedItems: BulkUploadItemRecord[] = [];

    for (const orig of job.items) {
      const patch = editedItems.find((e) => e.itemId === orig.itemId) ?? orig;
      if (orig.status !== 'ready' || !orig.tempStorageKey) {
        updatedItems.push(orig);
        continue;
      }

      try {
        const stagedPath = path.join(stagingDir, path.basename(orig.tempStorageKey));
        const bytes = await fs.readFile(stagedPath);
        const safeBase = sanitizeSlugId(patch.titleEn || orig.originalFilename.replace(/\.pdf$/i, ''), 'pdf');
        const materialId = `${safeBase}-${orig.itemId}`;
        const storageKey = `bulk/${job.jobId}/${materialId}.pdf`;
        await storageProvider.savePdfBytes(storageKey, bytes);

        const material: StoredMaterialRecord = {
          id: materialId,
          title: {
            en: patch.titleEn?.trim() || orig.titleEn,
            hi: patch.titleHi?.trim() || patch.titleEn?.trim() || orig.titleHi,
          },
          description: {
            en: patch.descriptionEn?.trim() || orig.descriptionEn,
            hi: patch.descriptionHi?.trim() || orig.descriptionHi,
          },
          examTrack: patch.examTrack ?? orig.examTrack,
          academicSession: patch.academicSession?.trim() || orig.academicSession,
          classLevel: (patch.examTrack ?? orig.examTrack) === 'up-board-12' ? 'class-12' : 'entrance-ug',
          streamId: patch.streamId ?? orig.streamId,
          subjectId: patch.subjectId || orig.subjectId,
          chapterId: patch.chapterId || undefined,
          topicId: patch.topicId || undefined,
          materialType: patch.materialType ?? orig.materialType,
          language: patch.language ?? orig.language,
          fileFormat: 'PDF',
          fileSizeBytes: bytes.byteLength,
          storageProvider: 'local-signed-storage',
          storagePath: storageKey,
          externalSourceUrl: patch.externalSourceUrl || orig.externalSourceUrl,
          distributionType: 'authorized_pdf',
          accessLevel: 'public',
          downloadAllowed: typeof patch.downloadAllowed === 'boolean' ? patch.downloadAllowed : true,
          publisher: { en: 'PrepZone Study Material Library', hi: 'PrepZone अध्ययन सामग्री पुस्तकालय' },
          author: { en: authCtx.admin.displayName, hi: authCtx.admin.displayName },
          isOfficial: Boolean(patch.isOfficial),
          verificationStatus: publishImmediately ? 'verified' : 'awaiting_verification',
          verifiedDate: now.slice(0, 10),
          licenseOrDistributionNote: {
            en: 'Admin bulk-ingested and verified study PDF.',
            hi: 'एडमिन द्वारा थोक अपलोड व सत्यापित पीडीएफ।',
          },
          keywords: [patch.subjectId, patch.materialType, patch.examTrack].filter(Boolean) as string[],
          visibility: 'public',
          publicationStatus: publishImmediately ? 'published' : 'draft',
          isPublished: publishImmediately,
          createdAt: now,
          updatedAt: now,
          createdByUid: authCtx.admin.uid,
          sha256: orig.sha256,
        };

        adminStore.upsertMaterial(material);
        await fs.unlink(stagedPath).catch(() => {});
        importedNow += 1;
        updatedItems.push({
          ...patch,
          itemId: orig.itemId,
          status: 'imported',
          importedMaterialId: materialId,
        });
      } catch (err) {
        updatedItems.push({
          ...orig,
          status: 'error',
          errorMessage: err instanceof Error ? err.message : 'Failed to commit PDF.',
        });
      }
    }

    const totalImported = updatedItems.filter((i) => i.status === 'imported').length;
    const failedCount = updatedItems.filter((i) => i.status === 'error').length;
    const nextJob: UploadJobRecord = {
      ...job,
      status: failedCount === 0 && totalImported > 0 ? 'completed' : totalImported > 0 ? 'partial' : 'failed',
      importedCount: totalImported,
      failedCount,
      readyCount: updatedItems.filter((i) => i.status === 'ready').length,
      items: updatedItems,
      updatedAt: new Date().toISOString(),
    };
    adminStore.saveUploadJob(nextJob);

    adminStore.appendAuditLog({
      adminUid: authCtx.admin.uid,
      adminEmail: authCtx.admin.email,
      adminRole: authCtx.admin.role,
      action: 'BULK_PDF_COMMIT',
      targetType: 'bulk_upload',
      targetId: job.jobId,
      summary: `Committed ${importedNow} PDFs (${publishImmediately ? 'Published' : 'Saved as Draft'}); ${failedCount} errors.`,
      status: importedNow > 0 ? 'success' : 'failure',
    });

    res.json({ job: nextJob, importedNow });
  });

  router.get('/uploads/jobs', async (req: Request, res: Response) => {
    const authCtx = await requireAdmin(req, res, { permission: 'bulk_upload' });
    if (!authCtx) return;
    res.json({ jobs: adminStore.listUploadJobs() });
  });

  // ---------------------------------------------------------------------------
  // 8. Question Bank CRUD & Bulk Import (Admin Authorized)
  // ---------------------------------------------------------------------------
  router.get('/questions', async (req: Request, res: Response) => {
    const authCtx = await requireAdmin(req, res, { permission: 'manage_questions' });
    if (!authCtx) return;

    const all = assessmentBridge.adminListQuestions?.() ?? [];
    const examTrack = typeof req.query.examTrack === 'string' ? req.query.examTrack : 'all';
    const status = typeof req.query.status === 'string' ? req.query.status : 'all';
    const qStr = typeof req.query.query === 'string' ? req.query.query.trim().toLowerCase() : '';

    const filtered = all.filter((item) => {
      if (examTrack !== 'all' && item.examTrack !== examTrack) return false;
      if (status === 'published' && !item.isPublished) return false;
      if (status === 'draft' && item.isPublished) return false;
      if (qStr) {
        return (
          item.id.toLowerCase().includes(qStr) ||
          item.prompt.en.toLowerCase().includes(qStr) ||
          item.subjectId.toLowerCase().includes(qStr)
        );
      }
      return true;
    });

    res.json({ totalCount: filtered.length, questions: filtered });
  });

  router.post('/questions', async (req: Request, res: Response) => {
    const authCtx = await requireAdmin(req, res, { permission: 'manage_questions' });
    if (!authCtx) return;

    const body = req.body as Partial<FullQuestionRecord>;
    const promptEn = body.prompt?.en?.trim() || '';
    if (promptEn.length < 4 || !body.subjectId || !body.chapterId) {
      res.status(400).json({ error: 'INVALID_QUESTION_PAYLOAD', message: 'Question prompt, subjectId, and chapterId are required.' });
      return;
    }

    const now = new Date().toISOString();
    const id = body.id?.trim() || `qb-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;
    const sourceType = body.sourceType ?? 'prepzone_curated';
    const record: FullQuestionRecord = {
      id,
      examTrack: body.examTrack ?? 'up-board-12',
      academicSession: body.academicSession?.trim() || '2025-26',
      classLevel: body.examTrack === 'up-board-12' ? 'class-12' : 'entrance-ug',
      subjectId: body.subjectId,
      chapterId: body.chapterId,
      topicId: body.topicId || `${body.chapterId}-t1`,
      questionType: body.questionType ?? 'mcq_single',
      difficulty: body.difficulty ?? 'medium',
      prompt: { en: promptEn, hi: body.prompt?.hi?.trim() || promptEn },
      options: body.options,
      diagramUrl: body.diagramUrl,
      marks: Number(body.marks ?? 4),
      negativeMarks: Number(body.negativeMarks ?? 1),
      partialMarking: Boolean(body.partialMarking),
      sourceType,
      sourceLabel: body.sourceLabel ?? {
        en: sourceType === 'verified_pyq' ? 'Verified PYQ' : 'PrepZone Curated Question',
        hi: sourceType === 'verified_pyq' ? 'सत्यापित PYQ' : 'PrepZone संकलित प्रश्न',
      },
      academicYear: body.academicYear,
      verificationStatus: body.verificationStatus ?? 'verified',
      isPublished: typeof body.isPublished === 'boolean' ? body.isPublished : true,
      createdAt: body.createdAt ?? now,
      updatedAt: now,
      answerKey: {
        questionId: id,
        correctOptionIds: body.answerKey?.correctOptionIds,
        correctNumeric: body.answerKey?.correctNumeric,
        numericTolerance: body.answerKey?.numericTolerance,
        correctInteger: body.answerKey?.correctInteger,
        correctBool: body.answerKey?.correctBool,
        correctTextAnswers: body.answerKey?.correctTextAnswers,
        correctMatchMap: body.answerKey?.correctMatchMap,
        rubric: body.answerKey?.rubric,
        explanation: body.answerKey?.explanation ?? {
          en: 'Verified step-by-step solution.',
          hi: 'सत्यापित चरणबद्ध हल।',
        },
        solutionSteps: body.answerKey?.solutionSteps ?? [
          body.answerKey?.explanation ?? { en: 'Verified solution.', hi: 'सत्यापित हल।' },
        ],
      },
    };

    const saved = assessmentBridge.adminUpsertQuestion?.(record);
    adminStore.appendAuditLog({
      adminUid: authCtx.admin.uid,
      adminEmail: authCtx.admin.email,
      adminRole: authCtx.admin.role,
      action: 'UPSERT_QUESTION',
      targetType: 'question',
      targetId: id,
      summary: `Saved question ${id} (${record.examTrack} · ${record.isPublished ? 'Published' : 'Draft'}).`,
      status: 'success',
    });
    res.json({ question: saved });
  });

  router.delete('/questions/:questionId', async (req: Request, res: Response) => {
    const authCtx = await requireAdmin(req, res, { permission: 'manage_questions' });
    if (!authCtx) return;

    const ok = assessmentBridge.adminDeleteQuestion?.(req.params.questionId) ?? false;
    if (!ok) {
      res.status(404).json({ error: 'QUESTION_NOT_FOUND' });
      return;
    }
    adminStore.appendAuditLog({
      adminUid: authCtx.admin.uid,
      adminEmail: authCtx.admin.email,
      adminRole: authCtx.admin.role,
      action: 'DELETE_QUESTION',
      targetType: 'question',
      targetId: req.params.questionId,
      summary: `Deleted question ${req.params.questionId}.`,
      status: 'success',
    });
    res.json({ deleted: true, questionId: req.params.questionId });
  });

  router.post('/questions/bulk-import', async (req: Request, res: Response) => {
    const authCtx = await requireAdmin(req, res, { permission: 'manage_questions' });
    if (!authCtx) return;

    const rows = Array.isArray(req.body?.rows) ? (req.body.rows as Record<string, unknown>[]) : [];
    const mapping = (req.body?.mapping ?? {}) as QuestionImportMapping;
    const sourceKind = (req.body?.sourceKind as QuestionImportBatch['sourceKind']) ?? 'csv';
    const skipDuplicates = req.body?.skipDuplicates !== false;

    if (rows.length === 0 || rows.length > 500) {
      res.status(400).json({ error: 'INVALID_ROW_COUNT' });
      return;
    }

    const result = assessmentBridge.adminBulkConfirmImport?.({
      rows,
      mapping,
      sourceKind,
      uid: authCtx.admin.uid,
      skipDuplicates,
    });
    if (!result || result.insertedCount === 0) {
      res.status(400).json({ error: 'NO_VALID_UNIQUE_QUESTIONS', preview: result?.preview });
      return;
    }

    adminStore.appendAuditLog({
      adminUid: authCtx.admin.uid,
      adminEmail: authCtx.admin.email,
      adminRole: authCtx.admin.role,
      action: 'BULK_IMPORT_QUESTIONS',
      targetType: 'question',
      targetId: result.batch?.batchId ?? 'import',
      summary: `Imported ${result.insertedCount} questions via ${sourceKind.toUpperCase()}.`,
      status: 'success',
    });

    res.status(201).json(result);
  });

  // ---------------------------------------------------------------------------
  // 9. Mock Tests & Quizzes Configuration CRUD
  // ---------------------------------------------------------------------------
  router.get('/mock-tests', async (req: Request, res: Response) => {
    const authCtx = await requireAdmin(req, res, { permission: 'manage_mock_tests' });
    if (!authCtx) return;

    const data = assessmentBridge.adminListConfigs?.() ?? {
      examConfigurations: [],
      quizzes: [],
      importBatches: [],
    };
    res.json(data);
  });

  router.post('/mock-tests/exams', async (req: Request, res: Response) => {
    const authCtx = await requireAdmin(req, res, { permission: 'manage_mock_tests' });
    if (!authCtx) return;

    const body = req.body as Partial<ExamConfiguration>;
    const titleEn = body.title?.en?.trim() || '';
    if (titleEn.length < 3 || !Array.isArray(body.questionIds) || body.questionIds.length === 0) {
      res.status(400).json({
        error: 'INVALID_MOCK_CONFIG',
        message: 'Title and at least one selected question ID are required.',
      });
      return;
    }

    const id = body.id?.trim() || sanitizeSlugId(`mock-${body.examTrack ?? 'jee-main'}-${titleEn}`, 'mock');
    const cfg: ExamConfiguration = {
      id,
      examTrack: body.examTrack ?? 'jee-main',
      mode: body.mode ?? (body.examTrack === 'up-board-12' ? 'up_board_descriptive' : 'jee_cbt'),
      title: { en: titleEn, hi: body.title?.hi?.trim() || titleEn },
      description: {
        en: body.description?.en?.trim() || titleEn,
        hi: body.description?.hi?.trim() || titleEn,
      },
      durationMinutes: Math.min(300, Math.max(5, Number(body.durationMinutes || 60))),
      totalMarks: Math.max(1, Number(body.totalMarks || body.questionIds.length * 4)),
      negativeMarkingEnabled: Boolean(body.negativeMarkingEnabled ?? true),
      shuffleQuestions: Boolean(body.shuffleQuestions ?? true),
      shuffleOptions: Boolean(body.shuffleOptions ?? false),
      calculatorAllowed: Boolean(body.calculatorAllowed ?? false),
      attemptLimit: Math.max(1, Number(body.attemptLimit || 3)),
      showResultImmediately: Boolean(body.showResultImmediately ?? true),
      sections: body.sections ?? [
        {
          id: 'sec-1',
          title: { en: 'Main Section', hi: 'मुख्य खंड' },
          subjectId: 'all',
          questionCount: body.questionIds.length,
          maxAttempts: body.questionIds.length,
        },
      ],
      questionIds: body.questionIds,
      isPublished: typeof body.isPublished === 'boolean' ? body.isPublished : false,
    };

    const saved = assessmentBridge.adminUpsertExamConfig?.(cfg);
    adminStore.appendAuditLog({
      adminUid: authCtx.admin.uid,
      adminEmail: authCtx.admin.email,
      adminRole: authCtx.admin.role,
      action: 'UPSERT_MOCK_TEST',
      targetType: 'mock_test',
      targetId: id,
      summary: `Saved mock test "${titleEn}" (${cfg.isPublished ? 'Published' : 'Draft'}).`,
      status: 'success',
    });
    res.json({ examConfiguration: saved });
  });

  router.delete('/mock-tests/exams/:configId', async (req: Request, res: Response) => {
    const authCtx = await requireAdmin(req, res, { permission: 'manage_mock_tests' });
    if (!authCtx) return;

    assessmentBridge.adminDeleteExamConfig?.(req.params.configId);
    adminStore.appendAuditLog({
      adminUid: authCtx.admin.uid,
      adminEmail: authCtx.admin.email,
      adminRole: authCtx.admin.role,
      action: 'DELETE_MOCK_TEST',
      targetType: 'mock_test',
      targetId: req.params.configId,
      summary: `Deleted mock test config ${req.params.configId}.`,
      status: 'success',
    });
    res.json({ deleted: true });
  });

  router.post('/mock-tests/quizzes', async (req: Request, res: Response) => {
    const authCtx = await requireAdmin(req, res, { permission: 'manage_mock_tests' });
    if (!authCtx) return;

    const body = req.body as Partial<QuizDefinition>;
    const titleEn = body.title?.en?.trim() || '';
    if (titleEn.length < 3 || !Array.isArray(body.questionIds) || body.questionIds.length === 0) {
      res.status(400).json({ error: 'INVALID_QUIZ_CONFIG', message: 'Title and question IDs required.' });
      return;
    }
    const id = body.id?.trim() || sanitizeSlugId(`quiz-${titleEn}`, 'quiz');
    const quiz: QuizDefinition = {
      id,
      examTrack: body.examTrack ?? 'up-board-12',
      quizType: body.quizType ?? 'chapter_quiz',
      subjectId: body.subjectId,
      chapterId: body.chapterId,
      title: { en: titleEn, hi: body.title?.hi?.trim() || titleEn },
      description: {
        en: body.description?.en?.trim() || titleEn,
        hi: body.description?.hi?.trim() || titleEn,
      },
      durationMinutes: Math.min(180, Math.max(5, Number(body.durationMinutes || 15))),
      questionCount: body.questionIds.length,
      negativeMarkingEnabled: Boolean(body.negativeMarkingEnabled ?? false),
      shuffleQuestions: Boolean(body.shuffleQuestions ?? true),
      shuffleOptions: Boolean(body.shuffleOptions ?? false),
      questionIds: body.questionIds,
      isPublished: typeof body.isPublished === 'boolean' ? body.isPublished : false,
    };

    const saved = assessmentBridge.adminUpsertQuiz?.(quiz);
    adminStore.appendAuditLog({
      adminUid: authCtx.admin.uid,
      adminEmail: authCtx.admin.email,
      adminRole: authCtx.admin.role,
      action: 'UPSERT_QUIZ',
      targetType: 'mock_test',
      targetId: id,
      summary: `Saved quiz "${titleEn}" (${quiz.isPublished ? 'Published' : 'Draft'}).`,
      status: 'success',
    });
    res.json({ quiz: saved });
  });

  // ---------------------------------------------------------------------------
  // 10. AI Management (Settings, Quotas, Generated Quiz Review, Error Logs)
  // ---------------------------------------------------------------------------
  router.get('/ai', async (req: Request, res: Response) => {
    const authCtx = await requireAdmin(req, res, { permission: 'manage_ai_settings' });
    if (!authCtx) return;

    res.json({
      settings: aiBridge.getSettings?.() ?? null,
      telemetry: aiBridge.getTelemetry?.() ?? null,
    });
  });

  router.put('/ai/settings', async (req: Request, res: Response) => {
    const authCtx = await requireAdmin(req, res, { permission: 'manage_ai_settings' });
    if (!authCtx) return;

    const updated = aiBridge.updateSettings?.(req.body ?? {}, authCtx.admin.uid);
    adminStore.appendAuditLog({
      adminUid: authCtx.admin.uid,
      adminEmail: authCtx.admin.email,
      adminRole: authCtx.admin.role,
      action: 'UPDATE_AI_SETTINGS',
      targetType: 'ai_settings',
      targetId: 'global-ai-config',
      summary: `Updated AI config (enabled=${updated?.enabled}, model=${updated?.model}, dailyLimit=${updated?.dailyRequestLimit}).`,
      status: 'success',
    });
    res.json({ settings: updated });
  });

  // ---------------------------------------------------------------------------
  // 11. Integrations Diagnostics Overview
  // ---------------------------------------------------------------------------
  router.get('/integrations/status', async (req: Request, res: Response) => {
    const authCtx = await requireAdmin(req, res, { permission: 'manage_integrations' });
    if (!authCtx) return;

    res.json({ integrations: buildIntegrationDiagnostics() });
  });

  // ---------------------------------------------------------------------------
  // 12. Append-Only Audit Logs (Strictly Read-Only — Zero Update/Delete Routes!)
  // ---------------------------------------------------------------------------
  router.get('/audit-logs', async (req: Request, res: Response) => {
    const authCtx = await requireAdmin(req, res, { permission: 'view_audit_logs' });
    if (!authCtx) return;

    const actionFilter = typeof req.query.action === 'string' ? req.query.action.trim().toLowerCase() : '';
    const statusFilter = typeof req.query.status === 'string' ? req.query.status : 'all';

    const logs = adminStore.listAuditLogs(authCtx.admin).filter((log) => {
      if (statusFilter !== 'all' && log.status !== statusFilter) return false;
      if (actionFilter) {
        return (
          log.action.toLowerCase().includes(actionFilter) ||
          log.summary.toLowerCase().includes(actionFilter) ||
          log.adminEmail.toLowerCase().includes(actionFilter)
        );
      }
      return true;
    });

    res.json({ totalCount: logs.length, logs: logs.slice(0, 200) });
  });

  // ---------------------------------------------------------------------------
  // 13. Super Admin Exclusive: Manage Admin Roles, Permissions & System Settings
  // ---------------------------------------------------------------------------
  router.get('/settings/overview', async (req: Request, res: Response) => {
    const authCtx = await requireAdmin(req, res, { superAdminOnly: true });
    if (!authCtx) return;

    res.json({
      admins: adminStore.listAdmins(),
      systemSettings: adminStore.getSystemSettings(),
    });
  });

  router.post('/settings/admins', async (req: Request, res: Response) => {
    const authCtx = await requireAdmin(req, res, { superAdminOnly: true });
    if (!authCtx) return;

    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'INVALID_EMAIL', message: 'Valid admin email required.' });
      return;
    }

    const role = normalizeAdminRoleInput(req.body?.role);
    const permissions = Array.isArray(req.body?.permissions)
      ? (req.body.permissions as AdminPermissionKey[])
      : undefined;
    const active = req.body?.active !== false;

    const saved = adminStore.upsertAdminUser({
      email,
      displayName: displayName || email.split('@')[0],
      role,
      permissions,
      active,
      grantedByUid: authCtx.admin.uid,
    });

    adminStore.appendAuditLog({
      adminUid: authCtx.admin.uid,
      adminEmail: authCtx.admin.email,
      adminRole: 'super_admin',
      action: 'UPSERT_ADMIN_ROLE',
      targetType: 'admin_role',
      targetId: saved.uid,
      summary: `Set ${saved.email} as ${saved.role} (active=${saved.active}).`,
      status: 'success',
    });

    res.json({ admin: saved, admins: adminStore.listAdmins() });
  });

  router.delete('/settings/admins/:identifier', async (req: Request, res: Response) => {
    const authCtx = await requireAdmin(req, res, { superAdminOnly: true });
    if (!authCtx) return;

    const removed = adminStore.removeAdminUser(req.params.identifier);
    if (!removed) {
      res.status(400).json({
        error: 'CANNOT_REMOVE_ADMIN',
        message: 'Admin not found or cannot remove the last active Super Admin.',
      });
      return;
    }

    adminStore.appendAuditLog({
      adminUid: authCtx.admin.uid,
      adminEmail: authCtx.admin.email,
      adminRole: 'super_admin',
      action: 'REMOVE_ADMIN_ROLE',
      targetType: 'admin_role',
      targetId: req.params.identifier,
      summary: `Removed admin privileges for ${req.params.identifier}.`,
      status: 'success',
    });

    res.json({ removed: true, admins: adminStore.listAdmins() });
  });

  router.put('/settings/system', async (req: Request, res: Response) => {
    const authCtx = await requireAdmin(req, res, { superAdminOnly: true });
    if (!authCtx) return;

    const updated = adminStore.updateSystemSettings(req.body ?? {}, authCtx.admin.uid);
    adminStore.appendAuditLog({
      adminUid: authCtx.admin.uid,
      adminEmail: authCtx.admin.email,
      adminRole: 'super_admin',
      action: 'UPDATE_SYSTEM_SETTINGS',
      targetType: 'system_settings',
      targetId: 'global-system-settings',
      summary: `Updated system settings (maintenance=${updated.maintenanceMode}, allowReg=${updated.allowNewRegistrations}).`,
      status: 'success',
    });

    res.json({ systemSettings: updated });
  });

  return router;
}
