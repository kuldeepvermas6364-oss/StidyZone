import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  RefreshCw,
  Search,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfSearchHit {
  pageNumber: number;
  snippet: string;
}

interface PdfViewerProps {
  streamUrl: string;
  initialPage?: number;
  title: string;
  onPageChange?: (page: number, totalPages: number) => void;
  onRetryAuthorize?: () => void;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({
  streamUrl,
  initialPage = 1,
  title,
  onPageChange,
  onRetryAuthorize,
}) => {
  const { t } = useApp();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const onPageChangeRef = useRef(onPageChange);
  onPageChangeRef.current = onPageChange;

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(Math.max(1, initialPage));
  const [pageInput, setPageInput] = useState<string>(String(Math.max(1, initialPage)));
  const [scale, setScale] = useState<number>(1.25);
  const [fitWidthMode, setFitWidthMode] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [renderingPage, setRenderingPage] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [searching, setSearching] = useState<boolean>(false);
  const [searchSubmitted, setSearchSubmitted] = useState<boolean>(false);
  const [searchHits, setSearchHits] = useState<PdfSearchHit[]>([]);
  const [activeHitIndex, setActiveHitIndex] = useState<number>(0);

  // Load PDF document from signed server URL
  useEffect(() => {
    let cancelled = false;
    let loadedDoc: pdfjsLib.PDFDocumentProxy | null = null;

    setLoading(true);
    setLoadError(null);
    setPdfDoc(null);
    setSearchHits([]);
    setSearchSubmitted(false);

    const loadingTask = pdfjsLib.getDocument({ url: streamUrl });

    loadingTask.promise
      .then((doc) => {
        if (cancelled) {
          void doc.cleanup();
          return;
        }
        loadedDoc = doc;
        const safeInitial = Math.min(Math.max(1, initialPage), doc.numPages);
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setCurrentPage(safeInitial);
        setPageInput(String(safeInitial));
        setLoading(false);
        onPageChangeRef.current?.(safeInitial, doc.numPages);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoading(false);
        setLoadError(err instanceof Error ? err.message : t('pdfViewer.errorGeneric'));
      });

    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
      }
      if (loadedDoc) {
        void loadedDoc.cleanup();
      }
      void loadingTask.destroy();
    };
  }, [streamUrl, initialPage, t]);

  // Render active page onto canvas
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;

    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch {
        // ignore cancel rejection
      }
    }

    setRenderingPage(true);
    try {
      const page = await pdfDoc.getPage(currentPage);
      let effectiveScale = scale;

      if (fitWidthMode && canvasWrapperRef.current) {
        const availableWidth = Math.max(280, canvasWrapperRef.current.clientWidth - 32);
        const baseViewport = page.getViewport({ scale: 1 });
        effectiveScale = Math.max(0.5, Math.min(2.6, availableWidth / baseViewport.width));
      }

      const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
      const viewport = page.getViewport({ scale: effectiveScale });
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const transform = dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined;
      const task = page.render({
        canvasContext: ctx,
        canvas,
        transform,
        viewport,
      });
      renderTaskRef.current = task;
      await task.promise;
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      if (name !== 'RenderingCancelledException') {
        setLoadError(t('pdfViewer.errorGeneric'));
      }
    } finally {
      setRenderingPage(false);
    }
  }, [pdfDoc, currentPage, scale, fitWidthMode, t]);

  useEffect(() => {
    void renderPage();
  }, [renderPage]);

  // Recompute fit-to-width on window resize when enabled
  useEffect(() => {
    if (!fitWidthMode) return;
    const onResize = () => {
      void renderPage();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [fitWidthMode, renderPage]);

  // Track Fullscreen API state
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const goToPage = (target: number) => {
    if (!numPages) return;
    const clamped = Math.max(1, Math.min(numPages, Math.floor(target)));
    setCurrentPage(clamped);
    setPageInput(String(clamped));
    onPageChangeRef.current?.(clamped, numPages);
  };

  const handlePageJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(pageInput);
    if (Number.isFinite(num)) {
      goToPage(num);
    }
  };

  const handleToggleFullscreen = async () => {
    try {
      if (document.fullscreenElement === containerRef.current) {
        await document.exitFullscreen();
      } else if (containerRef.current?.requestFullscreen) {
        await containerRef.current.requestFullscreen();
      }
    } catch {
      // Headless or sandboxed browsers may deny fullscreen quietly; no crash
    }
  };

  const handleSearchDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfDoc) return;
    const q = searchTerm.trim().toLowerCase();
    if (!q) {
      setSearchHits([]);
      setSearchSubmitted(true);
      return;
    }

    setSearching(true);
    setSearchSubmitted(false);
    try {
      const hits: PdfSearchHit[] = [];
      for (let p = 1; p <= pdfDoc.numPages; p++) {
        const page = await pdfDoc.getPage(p);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ');
        const idx = pageText.toLowerCase().indexOf(q);
        if (idx !== -1) {
          const start = Math.max(0, idx - 32);
          const end = Math.min(pageText.length, idx + q.length + 52);
          hits.push({
            pageNumber: p,
            snippet: pageText.slice(start, end).trim(),
          });
        }
      }
      setSearchHits(hits);
      setActiveHitIndex(0);
      setSearchSubmitted(true);
      if (hits.length > 0) {
        goToPage(hits[0].pageNumber);
      }
    } finally {
      setSearching(false);
    }
  };

  const cycleMatch = (dir: 1 | -1) => {
    if (searchHits.length === 0) return;
    const nextIdx = (activeHitIndex + dir + searchHits.length) % searchHits.length;
    setActiveHitIndex(nextIdx);
    goToPage(searchHits[nextIdx].pageNumber);
  };

  if (loadError) {
    return (
      <div
        data-testid="pdf-error-box"
        className="rounded-2xl border border-red-200 bg-red-50/70 p-6 text-center space-y-3 dark:border-red-900/50 dark:bg-red-950/30"
      >
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
          {t('pdfViewer.errorTitle')}
        </h2>
        <p className="mx-auto max-w-md text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          {loadError}
        </p>
        {onRetryAuthorize && (
          <button
            type="button"
            onClick={onRetryAuthorize}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('pdfViewer.retry')}</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-200 bg-slate-50 px-3 py-2.5 sm:px-4 dark:border-slate-800 dark:bg-slate-950">
        {/* Page Navigation */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => goToPage(currentPage - 1)}
            disabled={loading || currentPage <= 1}
            aria-label={t('materials.library.prevPage')}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>

          <form onSubmit={handlePageJumpSubmit} className="flex items-center gap-1.5">
            <label htmlFor="pdf-page-jump" className="sr-only">
              {t('pdfViewer.jumpToPage')}
            </label>
            <input
              id="pdf-page-jump"
              type="number"
              min={1}
              max={Math.max(1, numPages)}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              disabled={loading}
              className="h-9 w-14 rounded-lg border border-slate-200 bg-white px-2 text-center font-mono text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            <span
              data-testid="pdf-page-indicator"
              className="font-mono text-xs font-semibold text-slate-600 tabular-nums whitespace-nowrap dark:text-slate-300"
            >
              {numPages > 0 ? t('pdfViewer.pageOf', { current: currentPage, total: numPages }) : '—'}
            </span>
          </form>

          <button
            type="button"
            onClick={() => goToPage(currentPage + 1)}
            disabled={loading || currentPage >= numPages}
            aria-label={t('materials.library.nextPage')}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Search Within PDF */}
        <form onSubmit={(e) => void handleSearchDocument(e)} className="flex flex-1 min-w-[200px] max-w-xs items-center gap-1.5">
          <div className="relative flex-1">
            <label htmlFor="pdf-in-doc-search" className="sr-only">
              {t('pdfViewer.searchPlaceholder')}
            </label>
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="pdf-in-doc-search"
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('pdfViewer.searchPlaceholder')}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2.5 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <button
            type="submit"
            disabled={loading || searching}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {t('pdfViewer.searchAction')}
          </button>
        </form>

        {/* Zoom & Fullscreen */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setFitWidthMode(false);
              setScale((s) => Math.max(0.6, Number((s - 0.15).toFixed(2))));
            }}
            disabled={loading}
            aria-label={t('pdfViewer.zoomOut')}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <ZoomOut className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="w-12 text-center font-mono text-xs font-semibold text-slate-700 tabular-nums dark:text-slate-300">
            {fitWidthMode ? 'Fit' : `${Math.round(scale * 100)}%`}
          </span>
          <button
            type="button"
            onClick={() => {
              setFitWidthMode(false);
              setScale((s) => Math.min(2.5, Number((s + 0.15).toFixed(2))));
            }}
            disabled={loading}
            aria-label={t('pdfViewer.zoomIn')}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <ZoomIn className="h-4 w-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => setFitWidthMode((prev) => !prev)}
            aria-pressed={fitWidthMode}
            className={`h-9 rounded-lg border px-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              fitWidthMode
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {t('pdfViewer.fitWidth')}
          </button>

          <button
            type="button"
            onClick={() => void handleToggleFullscreen()}
            aria-label={isFullscreen ? t('pdfViewer.exitFullscreen') : t('pdfViewer.fullscreen')}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Maximize2 className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Search Matches Strip */}
      {searchSubmitted && (
        <div
          data-testid="pdf-search-status"
          className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-blue-50/70 px-4 py-2 text-xs dark:border-slate-800 dark:bg-blue-950/30"
        >
          {searchHits.length > 0 ? (
            <>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="font-semibold text-blue-800 dark:text-blue-300">
                  {t('pdfViewer.searchMatches', { count: searchHits.length })} · Page{' '}
                  {searchHits[activeHitIndex]?.pageNumber}
                </p>
                <p className="truncate text-[11px] text-slate-600 dark:text-slate-300">
                  ...{searchHits[activeHitIndex]?.snippet}...
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {searchHits.map((hit, idx) => (
                  <button
                    key={hit.pageNumber}
                    type="button"
                    onClick={() => {
                      setActiveHitIndex(idx);
                      goToPage(hit.pageNumber);
                    }}
                    className={`rounded px-2 py-1 font-mono text-[11px] font-semibold ${
                      idx === activeHitIndex
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200'
                    }`}
                  >
                    P.{hit.pageNumber}
                  </button>
                ))}
                {searchHits.length > 1 && (
                  <button
                    type="button"
                    onClick={() => cycleMatch(1)}
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {t('materials.library.nextPage')}
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="font-medium text-slate-600 dark:text-slate-300">
              {t('pdfViewer.searchNoMatches')}
            </p>
          )}
        </div>
      )}

      {/* Canvas Viewport */}
      <div
        ref={canvasWrapperRef}
        className="relative flex min-h-[540px] items-start justify-center overflow-auto bg-slate-100 p-4 sm:p-6 dark:bg-slate-950/90"
      >
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {t('pdfViewer.loading')}
            </p>
          </div>
        )}

        <canvas
          ref={canvasRef}
          data-testid="pdf-canvas"
          aria-label={title}
          className={`rounded-lg bg-white shadow-md transition-opacity ${
            loading ? 'hidden' : renderingPage ? 'opacity-70' : 'opacity-100'
          }`}
        />
      </div>
    </div>
  );
};
