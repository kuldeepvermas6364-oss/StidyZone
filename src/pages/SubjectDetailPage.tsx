import React, { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookmarkCheck,
  ChevronDown,
  ChevronRight,
  Search,
} from 'lucide-react';
import { GuestSaveBanner } from '../components/curriculum/GuestSaveBanner';
import { VerificationNotice } from '../components/curriculum/VerificationNotice';
import { getSubjectById } from '../data/curriculum';
import { useApp } from '../contexts/AppContext';
import { useProgress } from '../contexts/ProgressContext';
import type { ChapterProgressStatus } from '../types/curriculum';
import type { ExamTrack } from '../types/database';
import { computeSubjectStats, getChapterProgress } from '../utils/curriculumProgress';
import { filterChaptersByStatus } from '../utils/curriculumSearch';

const TRACK_ROUTES: Record<ExamTrack, { path: string; labelKey: string }> = {
  'up-board-12': { path: '/up-board-class-12', labelKey: 'nav.upBoard12' },
  'jee-main': { path: '/jee-main', labelKey: 'nav.jeeMain' },
  'jee-advanced': { path: '/jee-advanced', labelKey: 'nav.jeeAdvanced' },
};

const ALL_STATUSES: ChapterProgressStatus[] = [
  'not_started',
  'in_progress',
  'completed',
  'needs_revision',
];

const SubjectDetailPage: React.FC = () => {
  const { examTrack, subjectId } = useParams<{
    examTrack: string;
    subjectId: string;
  }>();
  const { language, t } = useApp();
  const { progressMap, setChapterStatus } = useProgress();

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ChapterProgressStatus>('all');
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});

  const validTrack =
    examTrack === 'up-board-12' || examTrack === 'jee-main' || examTrack === 'jee-advanced'
      ? examTrack
      : null;

  const subject = validTrack && subjectId ? getSubjectById(validTrack, subjectId) : undefined;

  const stats = useMemo(
    () => (subject ? computeSubjectStats(subject, progressMap) : null),
    [subject, progressMap]
  );

  const visibleChapters = useMemo(() => {
    if (!subject) return [];
    const q = query.trim().toLowerCase();
    const matched = subject.chapters.filter((ch) => {
      if (!q) return true;
      if (ch.title.en.toLowerCase().includes(q) || ch.title.hi.toLowerCase().includes(q)) {
        return true;
      }
      if (ch.overview.en.toLowerCase().includes(q) || ch.overview.hi.toLowerCase().includes(q)) {
        return true;
      }
      return ch.topics.some(
        (tp) =>
          tp.title.en.toLowerCase().includes(q) ||
          tp.title.hi.toLowerCase().includes(q) ||
          tp.subtopics.some(
            (st) => st.en.toLowerCase().includes(q) || st.hi.toLowerCase().includes(q)
          )
      );
    });
    return filterChaptersByStatus(matched, progressMap, statusFilter);
  }, [subject, query, progressMap, statusFilter]);

  if (!validTrack || !subject || !stats) {
    return <Navigate to="/up-board-class-12" replace />;
  }

  const trackMeta = TRACK_ROUTES[validTrack];

  return (
    <div className="space-y-6">
      <GuestSaveBanner />

      <div>
        <Link
          to={trackMeta.path}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{t('syllabus.backToTrack', { track: t(trackMeta.labelKey) })}</span>
        </Link>
      </div>

      {/* Subject Overview Header */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              {t(trackMeta.labelKey)} · {subject.code} · {t('syllabus.chaptersCount', { count: stats.totalChapters })}
            </p>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {subject.name[language]}
            </h1>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {subject.overview[language]}
            </p>
          </div>

          <div className="grid grid-cols-3 divide-x divide-slate-200 rounded-xl border border-slate-200 bg-slate-50/70 sm:min-w-[320px] dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-800/40">
            <div className="p-3.5 text-center">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {t('dashboard.progress.overall')}
              </p>
              <p className="mt-1 font-mono text-xl font-bold text-blue-600 tabular-nums dark:text-blue-400">
                {stats.completionPercent}%
              </p>
            </div>
            <div className="p-3.5 text-center">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {t('dashboard.progress.completedChapters')}
              </p>
              <p className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums dark:text-white">
                {stats.completedChapters}/{stats.totalChapters}
              </p>
            </div>
            <div className="p-3.5 text-center">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {t('dashboard.progress.needsRevision')}
              </p>
              <p className="mt-1 font-mono text-xl font-bold text-amber-600 tabular-nums dark:text-amber-400">
                {stats.needsRevisionChapters}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full bg-blue-600 transition-all"
            style={{ width: `${stats.completionPercent}%` }}
          />
        </div>
      </section>

      {/* Important Topics & Removed Topics Section */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <section
          className={`rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 ${
            subject.removedOrReducedTopics.length > 0 ? 'lg:col-span-7' : 'lg:col-span-12'
          }`}
        >
          <div className="flex items-center gap-2">
            <BookmarkCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
              {t('syllabus.importantTopics')}
            </h2>
          </div>
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {subject.importantTopics.map((topic, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2 text-xs leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300"
              >
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <span>{topic[language]}</span>
              </li>
            ))}
          </ul>
        </section>

        {subject.removedOrReducedTopics.length > 0 && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-6 lg:col-span-5 dark:border-amber-900/70 dark:bg-amber-950/25">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-400" aria-hidden="true" />
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                {t('syllabus.tabRemoved', { count: subject.removedOrReducedTopics.length })}
              </h2>
            </div>
            <ul className="mt-3 space-y-2.5">
              {subject.removedOrReducedTopics.map((rem) => (
                <li key={rem.id} className="space-y-0.5 text-xs">
                  <p className="font-semibold text-amber-900 dark:text-amber-300">
                    {rem.unitOrChapterTitle[language]}
                  </p>
                  <p className="leading-relaxed text-slate-700 dark:text-slate-300">
                    {rem.removedDetail[language]}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* Chapter List & Filter Bar */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
            {t('syllabus.chapterListHeading')}
          </h2>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <label htmlFor="subject-chapter-search" className="sr-only">
                {t('syllabus.searchPlaceholder')}
              </label>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="subject-chapter-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('syllabus.searchPlaceholder')}
                className="h-9 w-full sm:w-64 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex flex-wrap gap-1">
              {(['all', ...ALL_STATUSES] as const).map((statusKey) => (
                <button
                  key={statusKey}
                  type="button"
                  onClick={() => setStatusFilter(statusKey)}
                  aria-pressed={statusFilter === statusKey}
                  className={`h-9 rounded-lg border px-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                    statusFilter === statusKey
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {statusKey === 'all' ? t('syllabus.filterAll') : t(`syllabus.status.${statusKey}`)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {visibleChapters.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            {t('syllabus.noChaptersMatch')}
          </div>
        ) : (
          <div className="space-y-3">
            {visibleChapters.map((ch) => {
              const prog = getChapterProgress(progressMap, ch.examTrack, ch.subjectId, ch.id);
              const topicsOpen = Boolean(expandedChapters[ch.id]);

              return (
                <article
                  key={ch.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                          Ch. {String(ch.order).padStart(2, '0')}
                        </span>
                        <span>·</span>
                        <span>{t('syllabus.topicsCount', { count: ch.topics.length })}</span>
                        {ch.weightageLabel && (
                          <>
                            <span>·</span>
                            <span>{ch.weightageLabel[language]}</span>
                          </>
                        )}
                      </div>

                      <Link
                        to={`/syllabus/${validTrack}/${subject.id}/${ch.id}`}
                        className="block font-display text-base font-bold text-slate-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400"
                      >
                        {ch.title[language]}
                      </Link>
                      <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        {ch.overview[language]}
                      </p>

                      {/* Expandable Topic List */}
                      <div className="pt-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedChapters((prev) => ({ ...prev, [ch.id]: !prev[ch.id] }))
                          }
                          aria-expanded={topicsOpen}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400"
                        >
                          {topicsOpen ? (
                            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          <span>
                            {topicsOpen ? t('syllabus.hideTopics') : t('syllabus.expandTopics')} (
                            {ch.topics.length})
                          </span>
                        </button>

                        {topicsOpen && (
                          <ul className="mt-2.5 space-y-1.5 border-t border-slate-100 pt-2.5 dark:border-slate-800">
                            {ch.topics.map((tp) => (
                              <li
                                key={tp.id}
                                className="flex items-start justify-between gap-2 text-xs text-slate-700 dark:text-slate-300"
                              >
                                <span>• {tp.title[language]}</span>
                                {tp.inclusionStatus === 'advanced_only' && (
                                  <span className="shrink-0 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                                    {t('syllabus.advancedRetainedTag')}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    {/* Right Side Controls: Quick Status Switcher + Open Chapter */}
                    <div className="flex flex-col items-start gap-3 lg:items-end shrink-0">
                      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('syllabus.markStatusLabel')}>
                        {ALL_STATUSES.map((st) => {
                          const isCurrent = prog.status === st;
                          return (
                            <button
                              key={st}
                              type="button"
                              onClick={() => void setChapterStatus(ch, st)}
                              aria-pressed={isCurrent}
                              className={`h-8 rounded-lg border px-2.5 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                                isCurrent
                                  ? 'border-blue-600 bg-blue-600 text-white'
                                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                              }`}
                            >
                              {t(`syllabus.status.${st}`)}
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-semibold text-slate-500 tabular-nums dark:text-slate-400">
                          {prog.completionPercent}%
                        </span>
                        <Link
                          to={`/syllabus/${validTrack}/${subject.id}/${ch.id}`}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          <span>{t('syllabus.openChapter')}</span>
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <VerificationNotice verification={subject.verification} />
    </div>
  );
};

export default SubjectDetailPage;
