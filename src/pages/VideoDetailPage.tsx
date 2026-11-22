import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bookmark,
  BookOpen,
  Clock,
  ExternalLink,
  PlayCircle,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { MaterialCard } from '../components/materials/MaterialCard';
import { useApp } from '../contexts/AppContext';
import { useMaterials } from '../contexts/MaterialsContext';
import { ALL_CURRICULUM_SUBJECTS } from '../data/curriculum';
import { STUDY_MATERIALS_CATALOG, getMaterialById } from '../data/materials/studyMaterialsCatalog';
import { formatDurationClock } from '../utils/materialsSearch';

const VideoDetailPage: React.FC = () => {
  const { videoId } = useParams<{ videoId: string }>();
  const { language, t } = useApp();
  const { isBookmarked, toggleBookmark, recordMaterialOpen } = useMaterials();
  const [embedLoaded, setEmbedLoaded] = useState(false);

  const video = videoId ? getMaterialById(videoId) : undefined;

  useEffect(() => {
    setEmbedLoaded(false);
    if (video && video.materialType === 'video_lecture') {
      void recordMaterialOpen(video, 1, 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video?.id]);

  const subject = useMemo(
    () => (video ? ALL_CURRICULUM_SUBJECTS.find((s) => s.id === video.subjectId) : undefined),
    [video]
  );

  const playlistItems = useMemo(() => {
    if (!video) return [];
    return STUDY_MATERIALS_CATALOG.filter(
      (m) =>
        m.materialType === 'video_lecture' &&
        m.isPublished &&
        (video.playlistId ? m.playlistId === video.playlistId : m.examTrack === video.examTrack)
    );
  }, [video]);

  const relatedChapterMaterials = useMemo(() => {
    if (!video || !video.chapterId) return [];
    return STUDY_MATERIALS_CATALOG.filter(
      (m) =>
        m.isPublished &&
        m.materialType !== 'video_lecture' &&
        m.examTrack === video.examTrack &&
        m.subjectId === video.subjectId &&
        m.chapterId === video.chapterId
    );
  }, [video]);

  if (!video || video.materialType !== 'video_lecture') {
    return <Navigate to="/video-lectures" replace />;
  }

  const saved = isBookmarked('studyMaterial', video.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/video-lectures"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{t('videos.backToList')}</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              void toggleBookmark({
                itemType: 'studyMaterial',
                itemId: video.id,
                examTrack: video.examTrack,
              })
            }
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

          {video.chapterId && (
            <Link
              to={`/syllabus/${video.examTrack}/${video.subjectId}/${video.chapterId}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              <BookOpen className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              <span>{t('materials.action.viewChapter')}</span>
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Authorized Lecture Player / Official Portal Stage */}
        <section className="space-y-4 lg:col-span-8">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            {video.isEmbeddable && video.embedUrl && embedLoaded ? (
              <div className="aspect-video w-full bg-slate-950">
                <iframe
                  src={video.embedUrl}
                  title={video.title[language]}
                  className="h-full w-full"
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 bg-linear-to-br from-slate-900 to-blue-950 px-6 py-14 text-center text-white">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600/30 text-blue-300 ring-1 ring-blue-400/40">
                  <PlayCircle className="h-7 w-7" aria-hidden="true" />
                </div>
                <div className="max-w-lg space-y-1.5">
                  <p className="text-xs font-semibold text-blue-300">
                    {video.publisher[language]} · {formatDurationClock(video.durationSeconds)}
                  </p>
                  <h1 className="font-display text-xl font-bold text-white">
                    {video.title[language]}
                  </h1>
                  <p className="text-xs leading-relaxed text-slate-300">
                    {video.licenseOrDistributionNote[language]}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                  {video.isEmbeddable && video.embedUrl && (
                    <button
                      type="button"
                      onClick={() => setEmbedLoaded(true)}
                      className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-5 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      <PlayCircle className="h-4 w-4" aria-hidden="true" />
                      <span>{t('materials.action.watchLecture')}</span>
                    </button>
                  )}
                  <a
                    href={video.externalSourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-5 text-xs font-semibold text-slate-900 hover:bg-slate-100"
                  >
                    <span>{t('videos.launchPortal')}</span>
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </div>
              </div>
            )}

            <div className="space-y-3 p-6">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                <span className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-100">
                  <UserCheck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                  {video.author[language]}
                </span>
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  {video.publisher[language]}
                </span>
                <span className="inline-flex items-center gap-1 font-mono">
                  <Clock className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                  {formatDurationClock(video.durationSeconds)}
                </span>
                {subject && <span>· {subject.name[language]}</span>}
                <span>· {t(`materials.lang.${video.language}`)}</span>
              </div>

              <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {video.description[language]}
              </p>

              <p className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
                {t('videos.noDownloadNotice')}
              </p>
            </div>
          </div>

          {relatedChapterMaterials.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                {t('videos.relatedNotes')}
              </h2>
              <div className="grid grid-cols-1 gap-4">
                {relatedChapterMaterials.map((mat) => (
                  <MaterialCard key={mat.id} material={mat} />
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Series Playlist Sidebar */}
        <aside className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 h-fit lg:col-span-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
            {video.playlistTitle ? video.playlistTitle[language] : t('videos.playlistHeading')}
          </h2>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {playlistItems.map((ep, idx) => {
              const active = ep.id === video.id;
              return (
                <li key={ep.id} className="py-2.5 first:pt-0 last:pb-0">
                  <Link
                    to={`/video-lectures/${ep.id}`}
                    className={`block rounded-lg p-2 text-xs transition-colors ${
                      active
                        ? 'bg-blue-50 text-blue-700 font-semibold dark:bg-blue-950/60 dark:text-blue-300'
                        : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <p className="leading-snug">
                      {idx + 1}. {ep.title[language]}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {formatDurationClock(ep.durationSeconds)} · {t(`materials.lang.${ep.language}`)}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
    </div>
  );
};

export default VideoDetailPage;
