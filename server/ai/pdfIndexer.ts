import fs from 'node:fs';
import path from 'node:path';
import type { DocumentChunkRecord, PdfIndexStatus } from '../../src/types/ai.ts';
import type { LibraryMaterial } from '../../src/types/materials.ts';
import {
  chunkPdfPages,
  retrieveRelevantPdfChunks,
  type PdfPageText,
  type RetrievedPdfChunk,
} from '../../src/utils/aiTutorEngine.ts';

interface CachedPdfIndex {
  status: PdfIndexStatus;
  chunks: DocumentChunkRecord[];
  sourceMtimeMs: number;
}

export class PdfIndexerError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class ServerPdfIndexer {
  private readonly storageRoot: string;
  private readonly cacheFile: string;
  private readonly maxPdfBytes: number;
  private readonly maxPdfPages: number;
  private cache: Record<string, CachedPdfIndex> = {};

  constructor(storageRoot: string) {
    this.storageRoot = path.resolve(storageRoot);
    const aiDir = path.resolve(process.cwd(), 'storage', 'ai');
    fs.mkdirSync(aiDir, { recursive: true });
    this.cacheFile = path.join(aiDir, 'pdf-chunks-cache.json');
    this.maxPdfBytes = Math.min(25 * 1024 * 1024, Number(process.env.AI_MAX_PDF_BYTES || 10485760));
    this.maxPdfPages = Math.min(200, Math.max(5, Number(process.env.AI_MAX_PDF_PAGES || 80)));
    this.loadCache();
  }

  private loadCache(): void {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const raw = fs.readFileSync(this.cacheFile, 'utf8');
        const parsed = JSON.parse(raw) as Record<string, CachedPdfIndex>;
        if (parsed && typeof parsed === 'object') {
          this.cache = parsed;
        }
      }
    } catch {
      this.cache = {};
    }
  }

  private saveCache(): void {
    try {
      const tmp = `${this.cacheFile}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.cache, null, 2), 'utf8');
      fs.renameSync(tmp, this.cacheFile);
    } catch {
      // Ignore cache persistence errors gracefully
    }
  }

  private resolveSafePdfPath(storageKey: string): string {
    const resolved = path.resolve(this.storageRoot, storageKey);
    if (!resolved.startsWith(this.storageRoot + path.sep)) {
      throw new PdfIndexerError('INVALID_STORAGE_PATH', 'Invalid PDF storage path.', 400);
    }
    return resolved;
  }

  public async ensureIndexed(
    material: LibraryMaterial,
    isAuthenticated: boolean
  ): Promise<{ status: PdfIndexStatus; chunks: DocumentChunkRecord[] }> {
    if (!material.isPublished || material.publicationStatus !== 'published') {
      throw new PdfIndexerError('MATERIAL_UNAVAILABLE', 'This study material is not published.', 404);
    }

    if (material.accessLevel === 'authenticated' && !isAuthenticated) {
      throw new PdfIndexerError(
        'AUTH_REQUIRED',
        'Sign in with a PrepZone student account to use AI tutoring on protected documents.',
        401
      );
    }

    if (material.storageProvider !== 'local-signed-storage' || !material.storagePath) {
      throw new PdfIndexerError(
        'EXTERNAL_PORTAL_NOT_INDEXABLE',
        'External official portals are linked directly to respect publisher copyright and are not copied for PDF text extraction.',
        422
      );
    }

    const filePath = this.resolveSafePdfPath(material.storagePath);
    if (!fs.existsSync(filePath)) {
      throw new PdfIndexerError('FILE_NOT_FOUND', 'PDF file could not be found on server storage.', 404);
    }

    const stat = fs.statSync(filePath);
    if (stat.size > this.maxPdfBytes) {
      throw new PdfIndexerError(
        'PDF_TOO_LARGE',
        `PDF exceeds the ${Math.round(this.maxPdfBytes / (1024 * 1024))} MB indexing limit.`,
        413
      );
    }

    const cached = this.cache[material.id];
    if (cached && cached.sourceMtimeMs === stat.mtimeMs && cached.chunks.length > 0) {
      return { status: cached.status, chunks: cached.chunks };
    }

    const buffer = fs.readFileSync(filePath);
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const standardFontDir = path.resolve(process.cwd(), 'node_modules/pdfjs-dist/standard_fonts');
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      verbosity: 0,
      ...(fs.existsSync(standardFontDir)
        ? { standardFontDataUrl: `${standardFontDir}${path.sep}` }
        : {}),
    });
    const pdfDoc = await loadingTask.promise;

    try {
      const totalPages = pdfDoc.numPages;
      const pagesToRead = Math.min(totalPages, this.maxPdfPages);
      const pages: PdfPageText[] = [];

      for (let p = 1; p <= pagesToRead; p += 1) {
        const page = await pdfDoc.getPage(p);
        const content = await page.getTextContent();
        const text = content.items
          .map((item) => ('str' in item && typeof item.str === 'string' ? item.str : ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        pages.push({ pageNumber: p, text });
      }

      const chunks = chunkPdfPages(material.id, pages);
      const status: PdfIndexStatus = {
        materialId: material.id,
        title: material.title.en,
        pageCount: totalPages,
        chunkCount: chunks.length,
        indexedAt: new Date().toISOString(),
        maxPagesTruncated: totalPages > this.maxPdfPages,
      };

      this.cache[material.id] = {
        status,
        chunks,
        sourceMtimeMs: stat.mtimeMs,
      };
      this.saveCache();

      return { status, chunks };
    } finally {
      const destroyable = pdfDoc as unknown as { destroy?: () => Promise<void> };
      if (typeof destroyable.destroy === 'function') {
        await destroyable.destroy();
      } else if (typeof loadingTask.destroy === 'function') {
        await loadingTask.destroy();
      }
    }
  }

  public async searchMaterial(params: {
    material: LibraryMaterial;
    query: string;
    isAuthenticated: boolean;
    topK?: number;
  }): Promise<{ status: PdfIndexStatus; retrieved: RetrievedPdfChunk[] }> {
    const { status, chunks } = await this.ensureIndexed(params.material, params.isAuthenticated);
    const retrieved = retrieveRelevantPdfChunks(params.query, chunks, params.topK ?? 4);
    return { status, retrieved };
  }
}
