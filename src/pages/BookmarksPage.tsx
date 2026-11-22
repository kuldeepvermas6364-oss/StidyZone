import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bookmark, Lock, Trash2 } from 'lucide-react';
import { EmptyState } from '../components/common/EmptyState';
import { MaterialCard } from '../components/materials/MaterialCard';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useAssessments } from '../contexts/AssessmentContext';
import { useMaterials } from '../contexts/MaterialsContext';
import { QUESTION_PUBLIC_CATALOG } from '../data/assessments/questionBankCatalog';
import { ALL_CURRICULUM_SUBJECTS } from '../data/curriculum';
import { getMaterialById } from '../data/materials/studyMaterialsCatalog';
import { MathText } from '../components/assessments/MathText';

const BookmarksPage: React.FC = () => {
  const { language, t } = useApp();
  const { isAuthenticated } = useAuth();
  const { bookmarks, removeBookmarkById } = useMaterials();
  const { questionBookmarks, toggleQuestionTag } = useAssessments();

  const { pdfAndPortalMaterials, videoLectures, chapterItems } = useMemo(() => {
    const pdfs: Array<{ bookmarkId: string; material: NonNullable<ReturnType<typeof getMaterialById>> }> = [];
    const videos: Array<{ bookmarkId: string; material: NonNullable<ReturnType<typeof getMaterialById>> }> = [];
    const chapters: Array<{
      bookmarkId: string;
      examTrack: string;
      subjectName: string;
      chapterTitle: string;
      routePath: string;
    }> = [];

    for (const bm of bookmarks) {
      if (bm.itemType === 'studyMaterial') {
        const mat = getMaterialById(bm.itemId);
        if (!mat) continue;
        if (mat.materialType === 'video_lecture') {
          videos.push({ bookmarkId: bm.id, material: mat });
        } else {
          pdfs.push({ bookmarkId: bm.id, material: mat });
        }
      } else if (bm.itemType === 'chapter') {
        for (const sub of ALL_CURRICULUM_SUBJECTS) {
          const ch = sub.chapters.find((c) => c.id === bm.itemId);
          if (ch) {
            chapters.push({
              bookmarkId: bm.id,
              examTrack: sub.examTrack,
              subjectName: sub.name[language],
              chapterTitle: ch.title[language],
              routePath: `/syllabus/${sub.examTrack}/${sub.id}/${ch.id}`,
            });
            break;
          }
        }
      }
    }

    return {
      pdfAndPortalMaterials: pdfs,
      videoLectures: videos,
      chapterItems: chapters,
    };
  }, [bookmarks, language]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-2 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
          {t('bookmarks.eyebrow')}
        </p>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {t('bookmarks.title')}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {t('bookmarks.subtitle')}
        </p>
      </section>

      {!isAuthenticated ? (
        <section className="rounded-2xl border border-blue-200 bg-blue-50/70 p-8 text-center space-y-3 dark:border-blue-900/50 dark:bg-blue-950/30">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
            <Lock className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
            {t('bookmarks.guestTitle')}
          </h2>
          <p className="mx-auto max-w-md text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {t('bookmarks.guestBody')}
          </p>
          <div className="flex flex-wrap justify-center gap-2.5 pt-1">
            <Link
              to="/login?next=/bookmarks"
              className="inline-flex h-9 items-center rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700"
            >
              {t('nav.signIn')}
            </Link>
            <Link
              to="/register"
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              {t('nav.register')}
            </Link>
          </div>
        </section>
      ) : bookmarks.length === 0 && questionBookmarks.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <EmptyState
            icon={<Bookmark className="h-6 w-6" aria-hidden="true" />}
            title={t('bookmarks.emptyTitle')}
            body={t('bookmarks.emptyBody')}
            actionLabel={t('dashboard.recentMaterials.browseLibrary')}
            actionTo="/pdf-library"
          />
        </section>
      ) : (
        <div className="space-y-6">
          {pdfAndPortalMaterials.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                {t('bookmarks.sectionMaterials', { count: pdfAndPortalMaterials.length })}
              </h2>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {pdfAndPortalMaterials.map(({ material }) => (
                  <MaterialCard key={material.id} material={material} />
                ))}
              </div>
            </section>
          )}

          {videoLectures.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                {t('bookmarks.sectionVideos', { count: videoLectures.length })}
              </h2>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {videoLectures.map(({ material }) => (
                  <MaterialCard key={material.id} material={material} />
                ))}
              </div>
            </section>
          )}

          {chapterItems.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                {t('bookmarks.sectionChapters', { count: chapterItems.length })}
              </h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {chapterItems.map((ch) => (
                  <div
                    key={ch.bookmarkId}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <Link to={ch.routePath} className="min-w-0 flex-1 group">
                      <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                        {ch.subjectName}
                      </p>
                      <p className="mt-0.5 truncate text-sm font-bold text-slate-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                        {ch.chapterTitle}
                      </p>
                    </Link>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Link
                        to={ch.routePath}
                        aria-label={ch.chapterTitle}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                      >
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => void removeBookmarkById(ch.bookmarkId)}
                        aria-label={`${t('bookmarks.remove')}: ${ch.chapterTitle}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-red-600 dark:border-slate-700 dark:text-slate-400 dark:hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
          {questionBookmarks.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                {t('bookmarks.sectionQuestions', { count: questionBookmarks.length })}
              </h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {questionBookmarks.map((qb) => {
                  const q = QUESTION_PUBLIC_CATALOG.find((item) => item.id === qb.questionId);
                  return (
                    <div
                      key={qb.id}
                      className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                          {qb.examTrack.toUpperCase()} · {qb.subjectId} · {qb.tag.toUpperCase()}
                        </p>
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100 line-clamp-2">
                          {q ? <MathText text={q.prompt[language]} /> : qb.questionId}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 dark:border-slate-800">
                        <Link
                          to={`/practice?ids=${qb.questionId}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                        >
                          <span>{language === 'hi' ? 'प्रश्न हल करें' : 'Practice Question'}</span>
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => void toggleQuestionTag(qb.questionId, qb.tag)}
                          aria-label={`${t('bookmarks.remove')}: ${qb.questionId}`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-red-600 dark:border-slate-700 dark:text-slate-400 dark:hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};

export default BookmarksPage;
