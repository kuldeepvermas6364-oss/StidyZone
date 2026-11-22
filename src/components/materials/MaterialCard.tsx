import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bookmark,
  BookOpen,
  Download,
  ExternalLink,
  FileText,
  Lock,
  PlayCircle,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { useMaterials } from '../../contexts/MaterialsContext';
import { ALL_CURRICULUM_SUBJECTS } from '../../data/curriculum';
import { getActiveBearerToken } from '../../services/auth/serverAuthToken';
import type { LibraryMaterial } from '../../types/materials';
import { formatBytesCompact, formatDurationClock } from '../../utils/materialsSearch';

interface MaterialCardProps {
  material: LibraryMaterial;
  onRequireAuth?: () => void;
}

export const MaterialCard: React.FC<MaterialCardProps> = ({ material, onRequireAuth }) => {
  const { language, t } = useApp();
  const { session } = useAuth();
  const { isBookmarked, toggleBookmark, getMaterialProgress, recordMaterialOpen } = useMaterials();
  const navigate = useNavigate();

  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [bookmarkGuestHint, setBookmarkGuestHint] = useState(false);

  const saved = isBookmarked('studyMaterial', material.id);
  const progress = getMaterialProgress(material.id);
  const subjectObj = ALL_CURRICULUM_SUBJECTS.find((s) => s.id === material.subjectId);

  const examLabel =
    material.examTrack === 'up-board-12'
      ? t('nav.upBoard12')
      : material.examTrack === 'jee-main'
      ? t('nav.jeeMain')
      : t('nav.jeeAdvanced');

  const sizeOrDuration =
    material.fileFormat === 'VIDEO'
      ? formatDurationClock(material.durationSeconds)
      : material.fileSizeBytes
      ? formatBytesCompact(material.fileSizeBytes)
      : material.fileFormat;

  const langLabel = t(`materials.lang.${material.language}`);

  const handleBookmarkClick = async () => {
    const res = await toggleBookmark({
      itemType: 'studyMaterial',
      itemId: material.id,
      examTrack: material.examTrack,
    });
    if (res.requiresAuth) {
      setBookmarkGuestHint(true);
      onRequireAuth?.();
    } else {
      setBookmarkGuestHint(false);
    }
  };

  const handleAuthorizedDownload = async () => {
    if (downloading) return;
    setDownloadError(null);
    setDownloading(true);
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
        navigate(`/login?next=${encodeURIComponent(`/pdf-library/view/${material.id}`)}`);
        return;
      }
      if (!resp.ok) {
        const body = (await resp.json().catch(() => ({}))) as { message?: string };
        setDownloadError(body.message || t('pdfViewer.errorGeneric'));
        return;
      }
      const data = (await resp.json()) as { downloadUrl?: string | null };
      if (!data.downloadUrl) {
        setDownloadError(t('pdfViewer.errorGeneric'));
        return;
      }
      void recordMaterialOpen(material, progress?.lastViewedPage ?? 1, material.pageCount);
      const a = document.createElement('a');
      a.href = data.downloadUrl;
      a.download = `${material.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      setDownloadError(t('pdfViewer.errorGeneric'));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <article
      data-testid={`material-card-${material.id}`}
      className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700"
    >
      <div className="space-y-3">
        {/* Top Metadata Row & Bookmark Button */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              {examLabel} · {subjectObj ? subjectObj.name[language] : material.subjectId} ·{' '}
              {t(`materials.type.${material.materialType}`)}
            </p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              <span
                className={
                  material.isOfficial
                    ? 'font-semibold text-emerald-700 dark:text-emerald-400'
                    : 'font-semibold text-slate-600 dark:text-slate-300'
                }
              >
                {material.isOfficial
                  ? t('materials.badge.official')
                  : t('materials.badge.supplementary')}
              </span>
              <span>· {material.fileFormat}</span>
              {sizeOrDuration !== '—' && <span>· {sizeOrDuration}</span>}
              {material.pageCount && <span>· {t('materials.meta.pages', { count: material.pageCount })}</span>}
              <span>· {langLabel}</span>
              <span>· {material.academicSession}</span>
              {material.accessLevel === 'authenticated' && (
                <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-400">
                  · <Lock className="h-3 w-3" aria-hidden="true" />
                  {t('materials.badge.signInRequired')}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleBookmarkClick()}
            aria-pressed={saved}
            aria-label={`${saved ? t('materials.action.savedBookmark') : t('materials.action.saveBookmark')}: ${material.title[language]}`}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors ${
              saved
                ? 'border-blue-600 bg-blue-50 text-blue-600 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-400'
                : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100'
            }`}
          >
            <Bookmark className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} aria-hidden="true" />
          </button>
        </div>

        {/* Title & Description */}
        <div>
          <h3 className="font-display text-base font-bold leading-snug text-slate-900 dark:text-white">
            {material.title[language]}
          </h3>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {material.description[language]}
          </p>
        </div>

        {/* Attribution & Verification Note */}
        <div className="space-y-1 border-t border-slate-100 pt-2.5 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
              <ShieldCheck
                className={`h-3.5 w-3.5 ${
                  material.verificationStatus === 'verified'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
                aria-hidden="true"
              />
              {material.publisher[language]}
            </span>
            <span>· {material.author[language]}</span>
            <span>
              · {t('materials.meta.verifiedOn')}: {material.verifiedDate}
            </span>
          </div>
          <p className="leading-relaxed text-slate-500 dark:text-slate-400">
            {material.licenseOrDistributionNote[language]}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 space-y-2 border-t border-slate-100 pt-3.5 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          {material.storageProvider === 'local-signed-storage' && (
            <Link
              to={`/pdf-library/view/${material.id}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {progress && progress.lastViewedPage > 1
                  ? t('materials.action.resumePdf', { page: progress.lastViewedPage })
                  : t('materials.action.previewPdf')}
              </span>
            </Link>
          )}

          {material.storageProvider === 'local-signed-storage' && material.downloadAllowed && (
            <button
              type="button"
              disabled={downloading}
              onClick={() => void handleAuthorizedDownload()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors disabled:opacity-50 whitespace-nowrap dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              <Download className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              <span>
                {downloading
                  ? t('materials.action.downloading')
                  : t('materials.action.downloadPdf')}
              </span>
            </button>
          )}

          {material.materialType === 'video_lecture' && (
            <Link
              to={`/video-lectures/${material.id}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              <PlayCircle className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t('materials.action.watchLecture')}</span>
            </Link>
          )}

          {material.distributionType === 'official_external_link' && (
            <a
              href={material.externalSourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => void recordMaterialOpen(material, 1, 1)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t('materials.action.openOfficialPortal')}</span>
            </a>
          )}

          {material.chapterId && (
            <Link
              to={`/syllabus/${material.examTrack}/${material.subjectId}/${material.chapterId}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <BookOpen className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              <span>{t('materials.action.viewChapter')}</span>
            </Link>
          )}
        </div>

        {bookmarkGuestHint && (
          <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
            <Link to="/login" className="underline hover:no-underline">
              {t('materials.action.signInToBookmark')}
            </Link>
          </p>
        )}
        {downloadError && (
          <p className="text-xs font-medium text-red-600 dark:text-red-400" role="alert">
            {downloadError}
          </p>
        )}
      </div>
    </article>
  );
};
