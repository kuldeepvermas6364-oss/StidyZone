import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Bookmark,
  BookOpen,
  Download,
  ExternalLink,
  Lock,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { PdfViewer } from '../components/materials/PdfViewer';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useMaterials } from '../contexts/MaterialsContext';
import { ALL_CURRICULUM_SUBJECTS } from '../data/curriculum';
import { getMaterialById } from '../data/materials/studyMaterialsCatalog';
import { getActiveBearerToken } from '../services/auth/serverAuthToken';
import { formatBytesCompact } from '../utils/materialsSearch';

interface AuthorizeState {
  status: 'loading' | 'ready' | 'auth_required' | 'error';
  viewUrl?: string;
  downloadUrl?: string | null;
  errorMessage?: string;
}

const PdfViewerPage: React.FC = () => {
  const { materialId } = useParams<{ materialId: string }>();
  const { language, t } = useApp();
  const { isAuthenticated, session } = useAuth();
  const {
    historyReady,
    isBookmarked,
    toggleBookmark,
    getMaterialProgress,
    recordMaterialOpen,
    updatePdfPageProgress,
  } = useMaterials();
  const navigate = useNavigate();

  const material = materialId ? getMaterialById(materialId) : undefined;
  const savedProgress = material ? getMaterialProgress(material.id) : undefined;
  const [capturedInitialPage, setCapturedInitialPage] = useState<number | null>(null);
  const [authState, setAuthState] = useState<AuthorizeState>({ status: 'loading' });
  const [bookmarkHint, setBookmarkHint] = useState(false);

  useEffect(() => {
    setCapturedInitialPage(null);
  }, [material?.id]);

  useEffect(() => {
    if (historyReady && capturedInitialPage === null) {
      setCapturedInitialPage(savedProgress?.lastViewedPage ?? 1);
    }
  }, [historyReady, capturedInitialPage, savedProgress?.lastViewedPage]);

  const authorizeDocument = useCallback(async () => {
    if (!material) {
      setAuthState({ status: 'error', errorMessage: t('pdfViewer.errorMissing') });
      return;
    }

    if (material.storageProvider === 'external-official') {
      setAuthState({ status: 'ready' });
      return;
    }

    if (material.accessLevel === 'authenticated' && !isAuthenticated) {
      setAuthState({ status: 'auth_required' });
      return;
    }

    setAuthState({ status: 'loading' });
    try {
      const token = await getActiveBearerToken(
        session?.mode,
        session?.user.uid,
        session?.user.email
      );
      const resp = await fetch(`/api/materials/${encodeURIComponent(material.id)}/authorize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (resp.status === 401) {
        setAuthState({ status: 'auth_required' });
        return;
      }

      if (!resp.ok) {
        const body = (await resp.json().catch(() => ({}))) as { message?: string };
        setAuthState({
          status: 'error',
          errorMessage: body.message || t('pdfViewer.errorGeneric'),
        });
        return;
      }

      const data = (await resp.json()) as {
        viewUrl?: string;
        downloadUrl?: string | null;
      };

      if (!data.viewUrl) {
        setAuthState({ status: 'error', errorMessage: t('pdfViewer.errorGeneric') });
        return;
      }

      setAuthState({
        status: 'ready',
        viewUrl: data.viewUrl,
        downloadUrl: data.downloadUrl ?? null,
      });
    } catch {
      setAuthState({ status: 'error', errorMessage: t('pdfViewer.errorGeneric') });
    }
  }, [material, isAuthenticated, session?.mode, session?.user.uid, session?.user.email, t]);

  useEffect(() => {
    void authorizeDocument();
  }, [authorizeDocument]);

  useEffect(() => {
    if (material && authState.status === 'ready' && historyReady) {
      void recordMaterialOpen(material, undefined, material.pageCount);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [material?.id, authState.status, historyReady]);

  if (!material) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{t('pdfViewer.backToLibrary')}</span>
        </button>

        <div
          data-testid="pdf-missing-box"
          className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-3 dark:border-slate-800 dark:bg-slate-900"
        >
          <AlertTriangle className="mx-auto h-7 w-7 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <h1 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            {t('pdfViewer.errorTitle')}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {t('pdfViewer.errorMissing')}
          </p>
          <Link
            to="/pdf-library"
            className="inline-flex h-9 items-center rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700"
          >
            {t('pdfViewer.backToLibrary')}
          </Link>
        </div>
      </div>
    );
  }

  const subject = ALL_CURRICULUM_SUBJECTS.find((s) => s.id === material.subjectId);
  const saved = isBookmarked('studyMaterial', material.id);

  const handleBookmarkToggle = async () => {
    const res = await toggleBookmark({
      itemType: 'studyMaterial',
      itemId: material.id,
      examTrack: material.examTrack,
    });
    if (res.requiresAuth) setBookmarkHint(true);
    else setBookmarkHint(false);
  };

  return (
    <div className="space-y-5">
      {/* Top Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <Link
            to="/pdf-library"
            className="inline-flex items-center gap-1.5 text-blue-600 hover:underline dark:text-blue-400"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('pdfViewer.backToLibrary')}</span>
          </Link>
          {subject && (
            <>
              <span className="text-slate-300 dark:text-slate-700">/</span>
              <Link
                to={`/syllabus/${material.examTrack}/${subject.id}`}
                className="text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400"
              >
                {subject.name[language]}
              </Link>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleBookmarkToggle()}
            aria-pressed={saved}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors ${
              saved
                ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-300'
                : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <Bookmark className={`h-3.5 w-3.5 ${saved ? 'fill-current' : ''}`} aria-hidden="true" />
            <span>
              {saved ? t('materials.action.savedBookmark') : t('materials.action.saveBookmark')}
            </span>
          </button>

          {authState.status === 'ready' && authState.downloadUrl && material.downloadAllowed && (
            <a
              href={authState.downloadUrl}
              download={`${material.id}.pdf`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t('materials.action.downloadPdf')}</span>
            </a>
          )}

          {material.storageProvider === 'local-signed-storage' && (
            <Link
              to={`/ai-assistant?tab=pdf&exam=${material.examTrack}&material=${material.id}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{language === 'hi' ? 'इस PDF पर AI से पूछें' : 'Ask AI about this PDF'}</span>
            </Link>
          )}

          {material.chapterId && (
            <Link
              to={`/syllabus/${material.examTrack}/${material.subjectId}/${material.chapterId}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              <BookOpen className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              <span>{t('materials.action.viewChapter')}</span>
            </Link>
          )}
        </div>
      </div>

      {bookmarkHint && !isAuthenticated && (
        <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
          <Link to="/login" className="underline">
            {t('materials.action.signInToBookmark')}
          </Link>
        </p>
      )}

      {/* Document Info Header */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
          <span>{t(`materials.type.${material.materialType}`)}</span>
          <span>· {material.fileFormat}</span>
          {material.fileSizeBytes && <span>· {formatBytesCompact(material.fileSizeBytes)}</span>}
          <span>· {t(`materials.lang.${material.language}`)}</span>
          <span>· {material.academicSession}</span>
        </div>
        <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
          {material.title[language]}
        </h1>
        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          {material.description[language]}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            {material.publisher[language]}
          </span>
          <span>· {material.licenseOrDistributionNote[language]}</span>
        </div>
      </section>

      {/* Main Viewer Region */}
      {material.storageProvider === 'external-official' ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-3 dark:border-slate-800 dark:bg-slate-900">
          <ExternalLink className="mx-auto h-7 w-7 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
            {t('pdfViewer.externalOnlyTitle')}
          </h2>
          <p className="mx-auto max-w-lg text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {t('pdfViewer.externalOnlyBody')}
          </p>
          <a
            href={material.externalSourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <span>{t('materials.action.openOfficialPortal')}</span>
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </section>
      ) : authState.status === 'auth_required' ? (
        <section
          data-testid="pdf-auth-required-box"
          className="rounded-2xl border border-amber-200 bg-amber-50/70 p-8 text-center space-y-3 dark:border-amber-900/50 dark:bg-amber-950/30"
        >
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            <Lock className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
            {t('pdfViewer.authTitle')}
          </h2>
          <p className="mx-auto max-w-md text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {t('pdfViewer.authBody')}
          </p>
          <div className="flex flex-wrap justify-center gap-2.5 pt-1">
            <Link
              to={`/login?next=${encodeURIComponent(`/pdf-library/view/${material.id}`)}`}
              className="inline-flex h-9 items-center rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700"
            >
              {t('pdfViewer.signInCta')}
            </Link>
            <Link
              to={`/register?next=${encodeURIComponent(`/pdf-library/view/${material.id}`)}`}
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              {t('nav.register')}
            </Link>
          </div>
        </section>
      ) : authState.status === 'error' ? (
        <section
          data-testid="pdf-error-box"
          className="rounded-2xl border border-red-200 bg-red-50/70 p-8 text-center space-y-3 dark:border-red-900/50 dark:bg-red-950/30"
        >
          <AlertTriangle className="mx-auto h-7 w-7 text-red-600 dark:text-red-400" aria-hidden="true" />
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
            {t('pdfViewer.errorTitle')}
          </h2>
          <p className="mx-auto max-w-md text-xs text-slate-600 dark:text-slate-300">
            {authState.errorMessage}
          </p>
          <button
            type="button"
            onClick={() => void authorizeDocument()}
            className="inline-flex h-9 items-center rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700"
          >
            {t('pdfViewer.retry')}
          </button>
        </section>
      ) : authState.status === 'ready' && authState.viewUrl && capturedInitialPage !== null ? (
        <PdfViewer
          streamUrl={authState.viewUrl}
          initialPage={capturedInitialPage}
          title={material.title[language]}
          onPageChange={(page, totalPages) => {
            void updatePdfPageProgress(material, page, totalPages);
          }}
          onRetryAuthorize={() => void authorizeDocument()}
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white py-24 dark:border-slate-800 dark:bg-slate-900">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {t('pdfViewer.loading')}
          </p>
        </div>
      )}
    </div>
  );
};

export default PdfViewerPage;
