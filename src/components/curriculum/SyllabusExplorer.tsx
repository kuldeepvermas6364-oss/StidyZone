import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import {
  ALL_CURRICULUM_SUBJECTS,
  getStreamDefinition,
  getSubjectsForExam,
  UP_BOARD_STREAMS,
} from '../../data/curriculum';
import { useApp } from '../../contexts/AppContext';
import { useProgress } from '../../contexts/ProgressContext';
import type { ChapterProgressStatus, UPBoardStream } from '../../types/curriculum';
import type { ExamTrack } from '../../types/database';
import {
  computeExamStats,
  computeSubjectStats,
  getChapterProgress,
} from '../../utils/curriculumProgress';
import { filterChaptersByStatus } from '../../utils/curriculumSearch';
import { GuestSaveBanner } from './GuestSaveBanner';
import { VerificationNotice } from './VerificationNotice';

interface SyllabusExplorerProps {
  examTrack: ExamTrack;
}

const TRACK_ROUTES: Record<ExamTrack, string> = {
  'up-board-12': '/up-board-class-12',
  'jee-main': '/jee-main',
  'jee-advanced': '/jee-advanced',
};

const STATUS_BADGE_STYLES: Record<ChapterProgressStatus, string> = {
  not_started:
    'text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-slate-800',
  in_progress:
    'text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-950/60',
  completed:
    'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/60',
  needs_revision:
    'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/60',
};

export const SyllabusExplorer: React.FC<SyllabusExplorerProps> = ({ examTrack }) => {
  const { language, t } = useApp();
  const {
    progressMap,
    selectedStream,
    setSelectedStream,
    selectedSubjects,
    toggleSubjectSelection,
    resetStreamSubjects,
  } = useProgress();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ChapterProgressStatus>('all');
  const [jeeMainViewTab, setJeeMainViewTab] = useState<'included' | 'removed'>('included');
  const [subjectPickerOpen, setSubjectPickerOpen] = useState(false);
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});

  const activeSubjects = useMemo(
    () =>
      getSubjectsForExam(
        examTrack,
        examTrack === 'up-board-12' ? selectedStream : undefined,
        examTrack === 'up-board-12' ? selectedSubjects : undefined
      ),
    [examTrack, selectedStream, selectedSubjects]
  );

  const availableStreamSubjects = useMemo(() => {
    if (examTrack !== 'up-board-12') return [];
    const def = getStreamDefinition(selectedStream);
    return def.availableSubjectIds
      .map((id) => ALL_CURRICULUM_SUBJECTS.find((s) => s.id === id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s));
  }, [examTrack, selectedStream]);

  const examStats = useMemo(
    () => computeExamStats(activeSubjects, progressMap),
    [activeSubjects, progressMap]
  );

  const removedCount = useMemo(
    () =>
      activeSubjects.reduce(
        (sum, s) => sum + s.removedOrReducedTopics.length,
        0
      ),
    [activeSubjects]
  );

  const filteredSubjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeSubjects
      .map((subject) => {
        const subjectMatch =
          !q ||
          subject.name.en.toLowerCase().includes(q) ||
          subject.name.hi.toLowerCase().includes(q) ||
          subject.code.toLowerCase().includes(q);

        const matchingChaptersBySearch = subject.chapters.filter((ch) => {
          if (!q || subjectMatch) return true;
          if (ch.title.en.toLowerCase().includes(q)) return true;
          if (ch.title.hi.toLowerCase().includes(q)) return true;
          return ch.topics.some(
            (tp) =>
              tp.title.en.toLowerCase().includes(q) ||
              tp.title.hi.toLowerCase().includes(q) ||
              tp.subtopics.some(
                (st) =>
                  st.en.toLowerCase().includes(q) ||
                  st.hi.toLowerCase().includes(q)
              )
          );
        });

        const chaptersAfterStatus = filterChaptersByStatus(
          matchingChaptersBySearch,
          progressMap,
          statusFilter
        );

        return {
          subject,
          matchingChapters: chaptersAfterStatus,
          visible:
            (subjectMatch && statusFilter === 'all') ||
            chaptersAfterStatus.length > 0,
        };
      })
      .filter((item) => item.visible);
  }, [activeSubjects, searchQuery, statusFilter, progressMap]);

  const primaryVerification = activeSubjects[0]?.verification;

  const examTracks: Array<{ id: ExamTrack; label: string; shortLabel: string }> = [
    { id: 'up-board-12', label: t('nav.upBoard12'), shortLabel: 'UP Board 12' },
    { id: 'jee-main', label: t('nav.jeeMain'), shortLabel: 'JEE Main' },
    { id: 'jee-advanced', label: t('nav.jeeAdvanced'), shortLabel: 'JEE Adv' },
  ];

  const toggleExpandSubject = (subjectId: string) => {
    setExpandedSubjects((prev) => ({ ...prev, [subjectId]: !prev[subjectId] }));
  };

  return (
    <div className="space-y-6">
      <GuestSaveBanner />

      {/* Exam & Stream Header Card */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
              <span>{t('syllabus.explorerTitle')}</span>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <span className="text-slate-600 dark:text-slate-400">
                {t('syllabus.classLevelLabel')}:{' '}
                {examTrack === 'up-board-12'
                  ? t('syllabus.class12Label')
                  : t('syllabus.entranceUgLabel')}
              </span>
            </div>

            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {examTracks.find((e) => e.id === examTrack)?.label}
            </h1>

            {/* Exam Track Switcher */}
            <div
              role="group"
              aria-label={t('syllabus.examSelector')}
              className="grid w-full grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 sm:inline-flex sm:w-auto dark:bg-slate-800"
            >
              {examTracks.map((track) => (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => navigate(TRACK_ROUTES[track.id])}
                  aria-pressed={examTrack === track.id}
                  className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap sm:px-3 ${
                    examTrack === track.id
                      ? 'bg-white text-blue-700 shadow-xs dark:bg-slate-900 dark:text-blue-300'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  <span className="sm:hidden">{track.shortLabel}</span>
                  <span className="hidden sm:inline">{track.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Exam Track Progress Summary Metrics */}
          <div className="grid grid-cols-3 divide-x divide-slate-200 rounded-xl border border-slate-200 bg-slate-50/70 sm:min-w-[320px] dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-800/40">
            <div className="p-3.5 text-center">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {t('dashboard.progress.overall')}
              </p>
              <p className="mt-1 font-mono text-xl font-bold text-blue-600 tabular-nums dark:text-blue-400">
                {examStats.completionPercent}%
              </p>
            </div>
            <div className="p-3.5 text-center">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {t('dashboard.progress.completedChapters')}
              </p>
              <p className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums dark:text-white">
                {examStats.completedChapters}/{examStats.totalChapters}
              </p>
            </div>
            <div className="p-3.5 text-center">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {t('dashboard.progress.needsRevision')}
              </p>
              <p className="mt-1 font-mono text-xl font-bold text-amber-600 tabular-nums dark:text-amber-400">
                {examStats.needsRevisionChapters}
              </p>
            </div>
          </div>
        </div>

        {/* UP Board Stream Selector & Subject Configurator */}
        {examTrack === 'up-board-12' && (
          <div className="mt-6 border-t border-slate-200 pt-5 space-y-4 dark:border-slate-800">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t('syllabus.streamSelector')}
                </p>
                <div
                  role="group"
                  aria-label={t('syllabus.streamSelector')}
                  className="flex flex-wrap gap-2"
                >
                  {UP_BOARD_STREAMS.map((stream) => {
                    const active = selectedStream === stream.id;
                    return (
                      <button
                        key={stream.id}
                        type="button"
                        onClick={() => void setSelectedStream(stream.id as UPBoardStream)}
                        aria-pressed={active}
                        className={`inline-flex h-9 items-center rounded-lg border px-3.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                          active
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {stream.name[language]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSubjectPickerOpen((prev) => !prev)}
                aria-expanded={subjectPickerOpen}
                className="inline-flex h-9 items-center gap-2 self-start sm:self-end rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                <SlidersHorizontal className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                <span>{t('syllabus.customizeSubjects')}</span>
              </button>
            </div>

            {subjectPickerOpen && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {t('syllabus.customizeSubjectsHint')}
                  </p>
                  <button
                    type="button"
                    onClick={() => void resetStreamSubjects(selectedStream)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t('syllabus.resetSubjects')}</span>
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {availableStreamSubjects.map((subj) => {
                    const checked = selectedSubjects.includes(subj.id);
                    return (
                      <button
                        key={subj.id}
                        type="button"
                        onClick={() => void toggleSubjectSelection(subj.id)}
                        aria-pressed={checked}
                        className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                          checked
                            ? 'border-blue-600 bg-blue-50 text-blue-800 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-200'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded border ${
                            checked
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-slate-300 dark:border-slate-600'
                          }`}
                        >
                          {checked && <Check className="h-3 w-3" aria-hidden="true" />}
                        </span>
                        <span>{subj.name[language]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('syllabus.upBoardDisclaimer')}
            </p>
          </div>
        )}

        {/* JEE Advanced Distinct Syllabus Banner */}
        {examTrack === 'jee-advanced' && (
          <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900 dark:bg-blue-950/40">
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              {t('syllabus.jeeAdvBannerTitle')}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
              {t('syllabus.jeeAdvBannerBody')}
            </p>
          </div>
        )}
      </section>

      {/* JEE Main Included vs Removed Tabs */}
      {examTrack === 'jee-main' && (
        <div
          role="tablist"
          aria-label="JEE Main Syllabus Inclusion"
          className="inline-flex rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900"
        >
          <button
            type="button"
            role="tab"
            aria-selected={jeeMainViewTab === 'included'}
            onClick={() => setJeeMainViewTab('included')}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              jeeMainViewTab === 'included'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            {t('syllabus.tabIncluded')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={jeeMainViewTab === 'removed'}
            onClick={() => setJeeMainViewTab('removed')}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              jeeMainViewTab === 'removed'
                ? 'bg-amber-600 text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            {t('syllabus.tabRemoved', { count: removedCount })}
          </button>
        </div>
      )}

      {/* Removed / Reduced Syllabus Dedicated Panel for JEE Main */}
      {examTrack === 'jee-main' && jeeMainViewTab === 'removed' ? (
        <section className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/70 dark:bg-amber-950/30">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
            <p className="text-xs leading-relaxed text-amber-900 dark:text-amber-200">
              {t('syllabus.removedNotice')}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {activeSubjects.map((subject) => (
              <div
                key={subject.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 dark:border-slate-800 dark:bg-slate-900"
              >
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  {subject.name[language]}
                </h2>
                {subject.removedOrReducedTopics.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t('syllabus.noRemovedTopics')}
                  </p>
                ) : (
                  <ul className="space-y-3 divide-y divide-slate-100 dark:divide-slate-800">
                    {subject.removedOrReducedTopics.map((rem) => (
                      <li key={rem.id} className="pt-3 first:pt-0 space-y-1">
                        <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                          {rem.unitOrChapterTitle[language]}
                        </p>
                        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                          {rem.removedDetail[language]}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : (
        <>
          {/* Search & Completion Status Filter Toolbar */}
          <section
            aria-label="Syllabus filters"
            className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="relative flex-1 max-w-md">
              <label htmlFor="syllabus-explorer-search" className="sr-only">
                {t('syllabus.searchPlaceholder')}
              </label>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="syllabus-explorer-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('syllabus.searchPlaceholder')}
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-blue-400"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(
                ['all', 'not_started', 'in_progress', 'completed', 'needs_revision'] as const
              ).map((filterKey) => {
                const active = statusFilter === filterKey;
                const label =
                  filterKey === 'all'
                    ? t('syllabus.filterAll')
                    : t(`syllabus.status.${filterKey}`);
                return (
                  <button
                    key={filterKey}
                    type="button"
                    onClick={() => setStatusFilter(filterKey)}
                    aria-pressed={active}
                    className={`h-9 rounded-lg border px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                      active
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Subject Cards */}
          {filteredSubjects.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              {t('syllabus.noChaptersMatch')}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {filteredSubjects.map(({ subject, matchingChapters }) => {
                const stats = computeSubjectStats(subject, progressMap);
                const isExpanded = Boolean(expandedSubjects[subject.id]) || searchQuery.trim().length > 0;
                const previewChapters =
                  matchingChapters.length > 0 ? matchingChapters : subject.chapters;

                return (
                  <article
                    key={subject.id}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                            {subject.code} · {t('syllabus.chaptersCount', { count: stats.totalChapters })}
                          </p>
                          <h2 className="mt-1 font-display text-lg font-bold text-slate-900 dark:text-white">
                            {subject.name[language]}
                          </h2>
                        </div>
                        <span className="font-mono text-lg font-bold text-slate-900 tabular-nums shrink-0 dark:text-white">
                          {stats.completionPercent}%
                        </span>
                      </div>

                      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full bg-blue-600 transition-all"
                          style={{ width: `${stats.completionPercent}%` }}
                        />
                      </div>

                      <p className="mt-2.5 text-xs font-medium text-slate-500 tabular-nums dark:text-slate-400">
                        {t('syllabus.completedOf', {
                          done: stats.completedChapters,
                          total: stats.totalChapters,
                        })}{' '}
                        ·{' '}
                        {t('syllabus.revisionCount', {
                          count: stats.needsRevisionChapters,
                        })}
                      </p>

                      <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                        {subject.overview[language]}
                      </p>

                      {/* Expandable Chapter & Topic Preview List */}
                      <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => toggleExpandSubject(subject.id)}
                          aria-expanded={isExpanded}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                          )}
                          <span>
                            {isExpanded
                              ? t('syllabus.hideTopics')
                              : t('syllabus.expandTopics')}{' '}
                            ({previewChapters.length})
                          </span>
                        </button>

                        {isExpanded && (
                          <ul className="mt-3 space-y-2 max-h-64 overflow-y-auto pr-1">
                            {previewChapters.map((ch) => {
                              const chProg = getChapterProgress(
                                progressMap,
                                ch.examTrack,
                                ch.subjectId,
                                ch.id
                              );
                              return (
                                <li
                                  key={ch.id}
                                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800/50"
                                >
                                  <Link
                                    to={`/syllabus/${subject.examTrack}/${subject.id}/${ch.id}`}
                                    className="min-w-0 flex-1 truncate font-medium text-slate-800 hover:text-blue-600 dark:text-slate-200 dark:hover:text-blue-400"
                                  >
                                    {ch.order}. {ch.title[language]}
                                  </Link>
                                  <span
                                    className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${STATUS_BADGE_STYLES[chProg.status]}`}
                                  >
                                    {t(`syllabus.status.${chProg.status}`)}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                        {subject.verification.verificationStatus === 'verified'
                          ? t('syllabus.verification.verified')
                          : t('syllabus.verification.awaiting')}
                      </span>
                      <Link
                        to={`/syllabus/${subject.examTrack}/${subject.id}`}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        <span>{t('syllabus.openSubject')}</span>
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {primaryVerification && <VerificationNotice verification={primaryVerification} />}
    </div>
  );
};
