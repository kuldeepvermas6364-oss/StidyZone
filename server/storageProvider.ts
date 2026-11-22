import fs from 'node:fs/promises';
import path from 'node:path';
import type { Request, Response } from 'express';
import {
  createSignedMaterialToken,
  hasPdfMagicHeader,
  resolveSafeStoragePath,
  sanitizeDownloadFilename,
  validateMaterialUploadCandidate,
  verifySignedMaterialToken,
} from './storageUtils.ts';

export interface AuthorizedDeliveryResult {
  materialId: string;
  viewUrl: string;
  downloadUrl: string | null;
  expiresInSeconds: number;
  fileSizeBytes: number;
  storageProvider: 'local-signed-storage' | 'firebase-storage';
}

export interface DocumentStorageProvider {
  readonly providerName: 'local-signed-storage' | 'firebase-storage';
  isConfigured: () => boolean;
  inspectFile: (storageKey: string) => Promise<{
    exists: boolean;
    validPdf: boolean;
    fileSizeBytes: number;
  }>;
  authorizeDelivery: (input: {
    materialId: string;
    storageKey: string;
    uid: string;
    downloadAllowed: boolean;
    ttlSeconds?: number;
  }) => Promise<AuthorizedDeliveryResult>;
  streamFile: (input: {
    req: Request;
    res: Response;
    materialId: string;
    storageKey: string;
    token: string;
    mode: 'view' | 'download';
    downloadFilename: string;
    downloadAllowed: boolean;
  }) => Promise<void>;
  validateUploadCandidate: typeof validateMaterialUploadCandidate;
}

export class LocalSignedStorageProvider implements DocumentStorageProvider {
  readonly providerName = 'local-signed-storage' as const;
  private readonly baseDir: string;
  private readonly signingSecret: string;

  constructor(baseDir: string, signingSecret: string) {
    this.baseDir = path.resolve(baseDir);
    this.signingSecret = signingSecret;
  }

  isConfigured(): boolean {
    return Boolean(this.baseDir && this.signingSecret);
  }

  async inspectFile(storageKey: string): Promise<{
    exists: boolean;
    validPdf: boolean;
    fileSizeBytes: number;
  }> {
    try {
      const safePath = resolveSafeStoragePath(this.baseDir, storageKey);
      const stat = await fs.stat(safePath);
      if (!stat.isFile() || stat.size <= 0) {
        return { exists: false, validPdf: false, fileSizeBytes: 0 };
      }

      const fh = await fs.open(safePath, 'r');
      try {
        const header = Buffer.alloc(8);
        const { bytesRead } = await fh.read(header, 0, 8, 0);
        const validPdf = bytesRead >= 5 && hasPdfMagicHeader(header.subarray(0, bytesRead));
        return {
          exists: true,
          validPdf,
          fileSizeBytes: stat.size,
        };
      } finally {
        await fh.close();
      }
    } catch {
      return { exists: false, validPdf: false, fileSizeBytes: 0 };
    }
  }

  async authorizeDelivery(input: {
    materialId: string;
    storageKey: string;
    uid: string;
    downloadAllowed: boolean;
    ttlSeconds?: number;
  }): Promise<AuthorizedDeliveryResult> {
    const ttl = input.ttlSeconds ?? 600;
    const inspection = await this.inspectFile(input.storageKey);
    if (!inspection.exists) {
      throw new Error('FILE_NOT_FOUND');
    }
    if (!inspection.validPdf) {
      throw new Error('CORRUPTED_OR_INVALID_PDF');
    }

    const viewToken = createSignedMaterialToken(
      { materialId: input.materialId, mode: 'view', uid: input.uid },
      this.signingSecret,
      ttl
    );

    const downloadToken = input.downloadAllowed
      ? createSignedMaterialToken(
          { materialId: input.materialId, mode: 'download', uid: input.uid },
          this.signingSecret,
          ttl
        )
      : null;

    return {
      materialId: input.materialId,
      viewUrl: `/api/materials/${encodeURIComponent(input.materialId)}/stream?token=${encodeURIComponent(viewToken)}&mode=view`,
      downloadUrl: downloadToken
        ? `/api/materials/${encodeURIComponent(input.materialId)}/stream?token=${encodeURIComponent(downloadToken)}&mode=download`
        : null,
      expiresInSeconds: ttl,
      fileSizeBytes: inspection.fileSizeBytes,
      storageProvider: this.providerName,
    };
  }

  async streamFile(input: {
    req: Request;
    res: Response;
    materialId: string;
    storageKey: string;
    token: string;
    mode: 'view' | 'download';
    downloadFilename: string;
    downloadAllowed: boolean;
  }): Promise<void> {
    const { res, materialId, storageKey, token, mode, downloadFilename, downloadAllowed } = input;

    const verified = verifySignedMaterialToken(token, materialId, this.signingSecret);
    if (!verified || verified.mode !== mode) {
      res.status(403).json({
        error: 'INVALID_OR_EXPIRED_TOKEN',
        message: 'Document access link expired or invalid. Request a fresh link.',
      });
      return;
    }

    if (mode === 'download' && !downloadAllowed) {
      res.status(403).json({
        error: 'DOWNLOAD_DISABLED',
        message: 'Downloads are disabled for this material per distribution rules.',
      });
      return;
    }

    let safePath: string;
    try {
      safePath = resolveSafeStoragePath(this.baseDir, storageKey);
    } catch {
      res.status(400).json({
        error: 'INVALID_STORAGE_KEY',
        message: 'Invalid document storage identifier.',
      });
      return;
    }

    const inspection = await this.inspectFile(storageKey);
    if (!inspection.exists) {
      res.status(404).json({
        error: 'FILE_NOT_FOUND',
        message: 'Requested PDF document was not found in server storage.',
      });
      return;
    }
    if (!inspection.validPdf) {
      res.status(422).json({
        error: 'CORRUPTED_OR_INVALID_PDF',
        message: 'Stored document failed PDF header validation.',
      });
      return;
    }

    const safeFile = sanitizeDownloadFilename(downloadFilename);
    const bytes = await fs.readFile(safePath);

    res.status(200);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', String(bytes.byteLength));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=120');
    res.setHeader(
      'Content-Disposition',
      mode === 'download'
        ? `attachment; filename="${safeFile}"`
        : `inline; filename="${safeFile}"`
    );
    res.send(bytes);
  }

  async savePdfBytes(storageKey: string, bytes: Buffer): Promise<{
    storageKey: string;
    fileSizeBytes: number;
  }> {
    if (!bytes || bytes.byteLength === 0 || bytes.byteLength > 20 * 1024 * 1024) {
      throw new Error('INVALID_PDF_SIZE');
    }
    if (!hasPdfMagicHeader(bytes.subarray(0, 8))) {
      throw new Error('CORRUPTED_OR_INVALID_PDF');
    }
    const safePath = resolveSafeStoragePath(this.baseDir, storageKey);
    await fs.mkdir(path.dirname(safePath), { recursive: true });
    await fs.writeFile(safePath, bytes);
    return { storageKey, fileSizeBytes: bytes.byteLength };
  }

  async deletePdfFile(storageKey: string): Promise<boolean> {
    try {
      const safePath = resolveSafeStoragePath(this.baseDir, storageKey);
      await fs.unlink(safePath);
      return true;
    } catch {
      return false;
    }
  }

  validateUploadCandidate = validateMaterialUploadCandidate;
}

/**
 * Production adapter placeholder for Firebase Cloud Storage signed URL delivery.
 * Requires FIREBASE_STORAGE_BUCKET and server-side service credentials in production.
 */
export class FirebaseStorageProviderStub implements DocumentStorageProvider {
  readonly providerName = 'firebase-storage' as const;
  private readonly bucketName: string;

  constructor(bucketName: string) {
    this.bucketName = bucketName;
  }

  isConfigured(): boolean {
    return Boolean(this.bucketName && process.env.GOOGLE_APPLICATION_CREDENTIALS);
  }

  async inspectFile(): Promise<{ exists: boolean; validPdf: boolean; fileSizeBytes: number }> {
    return { exists: false, validPdf: false, fileSizeBytes: 0 };
  }

  async authorizeDelivery(): Promise<AuthorizedDeliveryResult> {
    throw new Error('FIREBASE_STORAGE_NOT_PROVISIONED');
  }

  async streamFile(input: { res: Response }): Promise<void> {
    input.res.status(501).json({
      error: 'FIREBASE_STORAGE_NOT_PROVISIONED',
      message:
        'Firebase Storage provider requires server service-account credentials. Using local signed storage in this runtime.',
    });
  }

  validateUploadCandidate = validateMaterialUploadCandidate;
}
