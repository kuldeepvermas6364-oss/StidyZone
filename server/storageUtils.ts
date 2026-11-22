import crypto from 'node:crypto';
import path from 'node:path';

export interface SignedTokenPayload {
  materialId: string;
  mode: 'view' | 'download';
  uid: string;
  exp: number;
}

const SAFE_KEY_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9._\-]{2,140}\.pdf$/i;

/**
 * Resolves a relative storage key inside baseDir with strict traversal confinement.
 * Throws if path escapes baseDir, contains directory segments, or fails safe filename rules.
 */
export function resolveSafeStoragePath(baseDir: string, storageKey: string): string {
  const trimmed = (storageKey ?? '').trim();
  if (!trimmed || !SAFE_KEY_REGEX.test(trimmed)) {
    throw new Error('INVALID_STORAGE_KEY');
  }
  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) {
    throw new Error('PATH_TRAVERSAL_BLOCKED');
  }

  const normalizedBase = path.resolve(baseDir);
  const resolved = path.resolve(normalizedBase, trimmed);
  if (!resolved.startsWith(normalizedBase + path.sep)) {
    throw new Error('PATH_CONFINEMENT_VIOLATION');
  }
  return resolved;
}

/**
 * Produces a safe Content-Disposition filename preserving readable alphanumeric names.
 */
export function sanitizeDownloadFilename(rawName: string, fallback = 'prepzone-material.pdf'): string {
  const base = (rawName ?? '')
    .trim()
    .replace(/[\r\n"\\/:*?<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!base) return fallback;
  const limited = base.slice(0, 120);
  return limited.toLowerCase().endsWith('.pdf') ? limited : `${limited}.pdf`;
}

/**
 * Checks standard PDF magic header (%PDF-).
 */
export function hasPdfMagicHeader(buffer: Uint8Array): boolean {
  if (!buffer || buffer.length < 5) return false;
  return (
    buffer[0] === 0x25 && // %
    buffer[1] === 0x50 && // P
    buffer[2] === 0x44 && // D
    buffer[3] === 0x46 && // F
    buffer[4] === 0x2d // -
  );
}

/**
 * Validates candidate uploads for Prompt 6 admin readiness (PDF only, max 25 MB).
 */
export function validateMaterialUploadCandidate(input: {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  maxSizeBytes?: number;
}): { ok: true; sanitizedFilename: string } | { ok: false; reason: string } {
  const maxBytes = input.maxSizeBytes ?? 25 * 1024 * 1024;
  if (input.mimeType !== 'application/pdf') {
    return { ok: false, reason: 'UNSUPPORTED_MIME_TYPE' };
  }
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    return { ok: false, reason: 'EMPTY_FILE' };
  }
  if (input.sizeBytes > maxBytes) {
    return { ok: false, reason: 'FILE_TOO_LARGE' };
  }
  const sanitizedFilename = sanitizeDownloadFilename(input.filename);
  if (!SAFE_KEY_REGEX.test(sanitizedFilename)) {
    return { ok: false, reason: 'INVALID_FILENAME' };
  }
  return { ok: true, sanitizedFilename };
}

export function createSignedMaterialToken(
  payload: Omit<SignedTokenPayload, 'exp'>,
  secret: string,
  ttlSeconds = 300,
  nowMs = Date.now()
): string {
  const full: SignedTokenPayload = {
    ...payload,
    exp: Math.floor(nowMs / 1000) + ttlSeconds,
  };
  const encoded = Buffer.from(JSON.stringify(full), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySignedMaterialToken(
  token: string,
  expectedMaterialId: string,
  secret: string,
  nowMs = Date.now()
): SignedTokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SignedTokenPayload;
    if (!parsed || parsed.materialId !== expectedMaterialId) return null;
    if (parsed.mode !== 'view' && parsed.mode !== 'download') return null;
    if (typeof parsed.exp !== 'number' || Math.floor(nowMs / 1000) > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}
