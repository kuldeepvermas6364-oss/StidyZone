import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import { LocalSignedStorageProvider, FirebaseStorageProviderStub } from './server/storageProvider.ts';
import { createAiRouter, type AiAdminBridge } from './server/ai/aiRouter.ts';
import { createAssessmentRouter, type AssessmentBridge } from './server/assessments/assessmentEngine.ts';
import { AdminStore } from './server/admin/adminStore.ts';
import { createAdminRouter } from './server/admin/adminRouter.ts';
import {
  filterStudyMaterials,
  parseFiltersFromSearchParams,
} from './src/utils/materialsSearch.ts';

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const NODE_ENV = process.env.NODE_ENV || 'development';
const STORAGE_ROOT = path.resolve(process.cwd(), 'storage', 'materials');

// Ephemeral secure fallback per runtime instance if STORAGE_SIGNING_SECRET is not provided.
const SIGNING_SECRET =
  process.env.STORAGE_SIGNING_SECRET?.trim() || crypto.randomBytes(32).toString('hex');

const SESSION_TOKEN_SECRET =
  process.env.SESSION_SIGNING_SECRET?.trim() || crypto.createHmac('sha256', SIGNING_SECRET).update('session').digest('hex');

let firebaseProjectId = process.env.VITE_FIREBASE_PROJECT_ID || '';
try {
  const fbConfigPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(fbConfigPath)) {
    const parsed = JSON.parse(fs.readFileSync(fbConfigPath, 'utf8')) as { projectId?: string };
    if (parsed.projectId) firebaseProjectId = parsed.projectId;
  }
} catch {
  // Ignore config read errors; server remains operational in local mode.
}

const localStorageProvider = new LocalSignedStorageProvider(STORAGE_ROOT, SIGNING_SECRET);
const firebaseStorageStub = new FirebaseStorageProviderStub(process.env.FIREBASE_STORAGE_BUCKET || '');

// Cache Google public certs used to verify Firebase ID tokens cleanly without firebase-admin IAM.
let cachedGoogleCerts: { certs: Record<string, string>; expiresAt: number } = {
  certs: {},
  expiresAt: 0,
};

async function fetchGooglePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (now < cachedGoogleCerts.expiresAt && Object.keys(cachedGoogleCerts.certs).length > 0) {
    return cachedGoogleCerts.certs;
  }
  const resp = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
  );
  if (!resp.ok) {
    throw new Error('FAILED_TO_FETCH_FIREBASE_CERTS');
  }
  const certs = (await resp.json()) as Record<string, string>;
  const cacheControl = resp.headers.get('cache-control') || '';
  const maxAgeMatch = /max-age=(\d+)/i.exec(cacheControl);
  const ttlMs = maxAgeMatch ? Number(maxAgeMatch[1]) * 1000 : 3600_000;
  cachedGoogleCerts = { certs, expiresAt: now + ttlMs };
  return certs;
}

const adminStore = new AdminStore();
const lastPresenceTouchMs = new Map<string, number>();

interface VerifiedRequestUser {
  uid: string;
  email: string;
  provider: 'firebase' | 'local-foundation';
  emailVerified?: boolean;
}

function createServerSessionToken(uid: string, email: string): string {
  const payload = {
    uid,
    email,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_TOKEN_SECRET).update(encoded).digest('base64url');
  return `pz1.${encoded}.${sig}`;
}

function verifyServerSessionToken(token: string): VerifiedRequestUser | null {
  if (!token.startsWith('pz1.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', SESSION_TOKEN_SECRET)
    .update(encoded)
    .digest('base64url');
  const sigBuf = Buffer.from(sig, 'utf8');
  const expBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as {
      uid?: string;
      email?: string;
      exp?: number;
    };
    if (!payload.uid || !payload.email || typeof payload.exp !== 'number') return null;
    if (Math.floor(Date.now() / 1000) > payload.exp) return null;
    return {
      uid: payload.uid,
      email: payload.email,
      provider: 'local-foundation',
      emailVerified: false,
    };
  } catch {
    return null;
  }
}

async function verifyFirebaseIdToken(token: string): Promise<VerifiedRequestUser | null> {
  if (!firebaseProjectId) return null;
  const segments = token.split('.');
  if (segments.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = segments;

  try {
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8')) as {
      alg?: string;
      kid?: string;
    };
    if (header.alg !== 'RS256' || !header.kid) return null;

    const certs = await fetchGooglePublicCerts();
    const cert = certs[header.kid];
    if (!cert) return null;

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${headerB64}.${payloadB64}`);
    const signatureValid = verifier.verify(cert, Buffer.from(sigB64, 'base64url'));
    if (!signatureValid) return null;

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
      aud?: string;
      iss?: string;
      exp?: number;
      iat?: number;
    };

    const nowSec = Math.floor(Date.now() / 1000);
    if (
      payload.aud !== firebaseProjectId ||
      payload.iss !== `https://securetoken.google.com/${firebaseProjectId}` ||
      !payload.sub ||
      typeof payload.exp !== 'number' ||
      payload.exp <= nowSec
    ) {
      return null;
    }

    return {
      uid: payload.sub,
      email: payload.email || `${payload.sub}@firebase.user`,
      provider: 'firebase',
      emailVerified: payload.email_verified === true,
    };
  } catch {
    return null;
  }
}

async function resolveAuthenticatedUser(req: Request): Promise<VerifiedRequestUser | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return null;

  const user = token.startsWith('pz1.')
    ? verifyServerSessionToken(token)
    : await verifyFirebaseIdToken(token);

  if (!user) return null;
  if (adminStore.isUserDisabled(user.uid, user.email)) {
    return null;
  }

  const now = Date.now();
  const prevTouch = lastPresenceTouchMs.get(user.uid) ?? 0;
  if (now - prevTouch > 60_000) {
    lastPresenceTouchMs.set(user.uid, now);
    adminStore.recordStudentPresence({
      uid: user.uid,
      email: user.email,
      provider: user.provider,
      emailVerified: user.emailVerified,
    });
  }

  return user;
}

async function startServer(): Promise<void> {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'prepzone-server',
      storageProvider: localStorageProvider.providerName,
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/storage/provider-status', async (_req: Request, res: Response) => {
    const publishedMaterials = adminStore.getMergedMaterials(false);
    const localFiles = publishedMaterials.filter(
      (m) => m.storageProvider === 'local-signed-storage' && m.storagePath
    );
    let verifiedCount = 0;
    for (const item of localFiles) {
      const check = await localStorageProvider.inspectFile(item.storagePath!);
      if (check.exists && check.validPdf) verifiedCount += 1;
    }

    res.json({
      activeProvider: localStorageProvider.providerName,
      localDocumentCount: localFiles.length,
      verifiedPdfCount: verifiedCount,
      firebaseStorageReady: firebaseStorageStub.isConfigured(),
    });
  });

  // Public published curriculum feed (reflects Admin Curriculum updates safely)
  app.get('/api/curriculum', (_req: Request, res: Response) => {
    res.json({ subjects: adminStore.getMergedSubjects(false) });
  });

  // Issues short-lived in-memory signed session token for local-foundation accounts
  app.post('/api/auth/session-token', (req: Request, res: Response) => {
    const uid = typeof req.body?.uid === 'string' ? req.body.uid.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : undefined;
    if (!uid || !/^[a-zA-Z0-9_\-]{4,128}$/.test(uid) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'INVALID_ACCOUNT_PAYLOAD' });
      return;
    }
    if (adminStore.isUserDisabled(uid, email)) {
      res.status(403).json({
        error: 'ACCOUNT_SUSPENDED',
        message: 'This student account is suspended by an administrator.',
      });
      return;
    }
    adminStore.recordStudentPresence({
      uid,
      email,
      displayName,
      provider: 'local-foundation',
      emailVerified: false,
    });
    const token = createServerSessionToken(uid, email);
    res.json({ token, expiresInSeconds: 12 * 3600 });
  });

  app.get('/api/materials', async (req: Request, res: Response) => {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') searchParams.set(key, value);
    }
    const filters = parseFiltersFromSearchParams(searchParams);
    const catalog = adminStore.getMergedMaterials(false);
    const matches = filterStudyMaterials(catalog, filters);

    const enriched = await Promise.all(
      matches.map(async (item) => {
        if (item.storageProvider === 'local-signed-storage' && item.storagePath) {
          const check = await localStorageProvider.inspectFile(item.storagePath);
          return {
            ...item,
            fileAvailable: check.exists && check.validPdf,
            fileSizeBytes: check.fileSizeBytes || item.fileSizeBytes,
          };
        }
        return {
          ...item,
          fileAvailable: true,
        };
      })
    );

    res.json({
      totalCount: enriched.length,
      materials: enriched,
    });
  });

  app.post('/api/materials/:materialId/authorize', async (req: Request, res: Response) => {
    const materialId = req.params.materialId;
    const material = adminStore.getMaterialByIdMerged(materialId, false);

    if (!material) {
      res.status(404).json({
        error: 'MATERIAL_NOT_FOUND',
        message: 'Requested study material was not found or is not published.',
      });
      return;
    }

    const user = await resolveAuthenticatedUser(req);
    if (material.accessLevel === 'authenticated' && !user) {
      res.status(401).json({
        error: 'AUTH_REQUIRED',
        message: 'Please sign in with a student account to view or download this protected document.',
      });
      return;
    }

    if (material.storageProvider === 'external-official') {
      res.json({
        materialId: material.id,
        storageProvider: 'external-official',
        externalSourceUrl: material.externalSourceUrl,
        downloadAllowed: false,
      });
      return;
    }

    if (!material.storagePath) {
      res.status(404).json({
        error: 'STORAGE_KEY_MISSING',
        message: 'No PDF storage file is registered for this entry.',
      });
      return;
    }

    try {
      const signed = await localStorageProvider.authorizeDelivery({
        materialId: material.id,
        storageKey: material.storagePath,
        uid: user?.uid ?? 'guest',
        downloadAllowed: material.downloadAllowed,
        ttlSeconds: 600,
      });
      res.json(signed);
    } catch (err) {
      const code = err instanceof Error ? err.message : 'DELIVERY_ERROR';
      const status = code === 'FILE_NOT_FOUND' ? 404 : code === 'CORRUPTED_OR_INVALID_PDF' ? 422 : 500;
      res.status(status).json({
        error: code,
        message:
          code === 'FILE_NOT_FOUND'
            ? 'PDF file could not be located on server storage.'
            : code === 'CORRUPTED_OR_INVALID_PDF'
            ? 'PDF file failed integrity validation (%PDF- signature check).'
            : 'Unable to authorize document delivery.',
      });
    }
  });

  app.get('/api/materials/:materialId/stream', async (req: Request, res: Response) => {
    const materialId = req.params.materialId;
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    const mode = req.query.mode === 'download' ? 'download' : 'view';

    const material = adminStore.getMaterialByIdMerged(materialId, false);
    if (!material || material.storageProvider !== 'local-signed-storage' || !material.storagePath) {
      res.status(404).json({
        error: 'MATERIAL_NOT_FOUND',
        message: 'Requested PDF resource is unavailable.',
      });
      return;
    }

    await localStorageProvider.streamFile({
      req,
      res,
      materialId: material.id,
      storageKey: material.storagePath,
      token,
      mode,
      downloadFilename: `${material.id}.pdf`,
      downloadAllowed: material.downloadAllowed,
    });
  });

  const assessmentBridge: AssessmentBridge = {};
  const aiBridge: AiAdminBridge = {};
  app.use(
    '/api/assessments',
    express.json({ limit: '2mb' }),
    createAssessmentRouter({ resolveAuthenticatedUser, bridge: assessmentBridge })
  );
  app.use(
    '/api/ai',
    express.json({ limit: '6mb' }),
    createAiRouter({
      resolveAuthenticatedUser,
      storageRoot: STORAGE_ROOT,
      bridge: assessmentBridge,
      aiBridge,
    })
  );
  app.use(
    '/api/admin',
    express.json({ limit: '6mb' }),
    createAdminRouter({
      resolveAuthenticatedUser,
      adminStore,
      storageProvider: localStorageProvider,
      assessmentBridge,
      aiBridge,
      sessionSecret: SESSION_TOKEN_SECRET,
      firebaseProjectId,
      firebaseStorageConfigured: firebaseStorageStub.isConfigured(),
    })
  );

  // Catch unmatched /api/* cleanly as JSON instead of returning HTML index fallback
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API_ROUTE_NOT_FOUND' });
  });

  if (NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir, { index: false }));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  // Global error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Server error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PrepZone server listening on http://0.0.0.0:${PORT} (${NODE_ENV})`);
  });
}

void startServer();
