import React, { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Bookmark, BookOpen, FilterX, History, Search, Trash2 } from 'lucide-react';
import { EmptyState } from '../components/common/EmptyState';
import { MaterialCard } from '../components/materials/MaterialCard';
import { useApp } from '../contexts/AppContext';
import { useMaterials } from '../contexts/MaterialsContext';
import { ALL_CURRICULUM_SUBJECTS, UP_BOARD_STREAMS } from '../data/curriculum';
import {
  MATERIAL_CATEGORIES,
  STUDY_MATERIALS_CATALOG,
  getMaterialById,
} from '../data/materials/studyMaterialsCatalog';
import type { UPBoardStream } from '../types/curriculum';
import type { ExamTrack } from '../types/database';
import type { MaterialFilterState, MaterialLanguage, MaterialType } from '../types/materials';
import {
  DEFAULT_MATERIAL_FILTER_STATE,
  filterStudyMaterials,
  paginateMaterials,
  parseFiltersFromSearchParams,
  serializeFiltersToSearchParams,
} from '../utils/materialsSearch';

const PdfLibraryPage: React.FC = () => {
  const { language, t } = useApp();
  const { bookmarks, readingHistory, clearReadingHistory } = useMaterials();
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => parseFiltersFromSearchParams(searchParams), [searchParams]);

  const updateFilters = (patch: Partial<MaterialFilterState>, resetPage = true) => {
    const next: MaterialFilterState = {
      ...filters,
      ...patch,
      page: resetPage ? 1 : (patch.page ?? filters.page),
    };
    setSearchParams(serializeFiltersToSearchParams(next), { replace: true });
  };

  const clearAllFilters = () => {
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  // Available subjects & chapters scoped by selected exam/stream
  const availableSubjects = useMemo(() => {
    return ALL_CURRICULUM_SUBJECTS.filter((s) => {
      if (filters.examTrack !== 'all' && s.examTrack !== filters.examTrack) return false;
      if (
        filters.examTrack === 'up-board-12' &&
        filters.streamId !== 'all' &&
        s.streams &&
        !s.streams.includes(filters.streamId)
      ) {
        return false;
      }
      return true;
    });
  }, [filters.examTrack, filters.streamId]);

  const selectedSubject = useMemo(
    () => ALL_CURRICULUM_SUBJECTS.find((s) => s.id === filters.subjectId),
    [filters.subjectId]
  );

  const availableChapters = useMemo(() => selectedSubject?.chapters ?? [], [selectedSubject]);

  const availableSessions = useMemo(() => {
    const set = new Set<string>();
    for (const item of STUDY_MATERIALS_CATALOG) {
      if (item.materialType !== 'video_lecture') set.add(item.academicSession);
    }
    return Array.from(set).sort();
  }, []);

  const filteredMaterials = useMemo(
    () =>
      filterStudyMaterials(STUDY_MATERIALS_CATALOG, filters, ALL_CURRICULUM_SUBJECTS, {
        excludeVideoLectures: true,
      }),
    [filters]
  );

  const { pageItems, totalPages, currentPage, totalCount } = useMemo(
    () => paginateMaterials(filteredMaterials, filters.page, 6),
    [filteredMaterials, filters.page]
  );

  // Popular non-empty PDF/portal categories
  const activePdfCategories = useMemo(() => {
    const counts = new Map<MaterialType, number>();
    for (const m of STUDY_MATERIALS_CATALOG) {
      if (!m.isPublished || m.materialType === 'video_lecture') continue;
      counts.set(m.materialType, (counts.get(m.materialType) ?? 0) + 1);
    }
    return MATERIAL_CATEGORIES.filter((cat) => cat.group === 'pdf' && (counts.get(cat.id) ?? 0) > 0).map(
      (cat) => ({ ...cat, count: counts.get(cat.id) ?? 0 })
    );
  }, []);

  const hasActiveFilter =
    Boolean(filters.query.trim()) ||
    filters.examTrack !== 'all' ||
    filters.streamId !== 'all' ||
    filters.subjectId !== 'all' ||
    filters.chapterId !== 'all' ||
    filters.materialType !== 'all' ||
    filters.language !== 'all' ||
    filters.academicSession !== 'all' ||
    filters.sourceFilter !== 'all';

  const recentPdfEntries = useMemo(
    () =>
      readingHistory
        .map((entry) => ({ entry, material: getMaterialById(entry.materialId) }))
        .filter((pair) => Boolean(pair.material))
        .slice(0, 4),
    [readingHistory]
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-1.5">
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              {t('materials.library.eyebrow')}
            </p>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {t('materials.library.title')}
            </h1>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {t('materials.library.subtitle')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link
              to="/bookmarks"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              <Bookmark className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              <span>
                {t('materials.library.openBookmarkList')} ({bookmarks.length})
              </span>
            </Link>
            <Link
              to="/video-lectures"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 transition-colors whitespace-nowrap dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              <BookOpen className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              <span>{t('nav.videoLectures')}</span>
            </Link>
          </div>
        </div>

        {/* Popular Categories Bar */}
        <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
          <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            {t('materials.library.popularCategories')}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {activePdfCategories.map((cat) => {
              const active = filters.materialType === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() =>
                    updateFilters({ materialType: active ? 'all' : cat.id })
                  }
                  aria-pressed={active}
                  className={`h-8 rounded-lg border px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                    active
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  {cat.label[language]} ({cat.count})
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Search & Multi-Facet Filter Bar */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="relative lg:col-span-5">
            <label htmlFor="library-search-input" className="sr-only">
              {t('materials.library.searchLabel')}
            </label>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="library-search-input"
              type="search"
              value={filters.query}
              onChange={(e) => updateFilters({ query: e.target.value })}
              placeholder={t('materials.library.searchPlaceholder')}
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:bg-slate-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:col-span-7">
            <select
              aria-label={t('materials.library.allExams')}
              value={filters.examTrack}
              onChange={(e) =>
                updateFilters({
                  examTrack: e.target.value as 'all' | ExamTrack,
                  streamId: 'all',
                  subjectId: 'all',
                  chapterId: 'all',
                })
              }
              className="h-10 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="all">{t('materials.library.allExams')}</option>
              <option value="up-board-12">{t('nav.upBoard12')}</option>
              <option value="jee-main">{t('nav.jeeMain')}</option>
              <option value="jee-advanced">{t('nav.jeeAdvanced')}</option>
            </select>

            <select
              aria-label={t('materials.library.allSubjects')}
              value={filters.subjectId}
              onChange={(e) =>
                updateFilters({ subjectId: e.target.value, chapterId: 'all' })
              }
              className="h-10 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="all">{t('materials.library.allSubjects')}</option>
              {availableSubjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name[language]}
                </option>
              ))}
            </select>

            <select
              aria-label={t('materials.type.all')}
              value={filters.materialType}
              onChange={(e) =>
                updateFilters({ materialType: e.target.value as 'all' | MaterialType })
              }
              className="h-10 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="all">{t('materials.type.all')}</option>
              {MATERIAL_CATEGORIES.filter((c) => c.group === 'pdf').map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label[language]}
                </option>
              ))}
            </select>

            <select
              aria-label={t('materials.lang.all')}
              value={filters.language}
              onChange={(e) =>
                updateFilters({ language: e.target.value as 'all' | MaterialLanguage })
              }
              className="h-10 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="all">{t('materials.lang.all')}</option>
              <option value="en">{t('materials.lang.en')}</option>
              <option value="hi">{t('materials.lang.hi')}</option>
              <option value="bilingual">{t('materials.lang.bilingual')}</option>
            </select>
          </div>
        </div>

        {/* Secondary Filter Row: Stream (UP Board), Chapter, Session, Source, Clear */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-100 pt-3 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            {filters.examTrack === 'up-board-12' && (
              <select
                aria-label={t('materials.library.allStreams')}
                value={filters.streamId}
                onChange={(e) =>
                  updateFilters({
                    streamId: e.target.value as 'all' | UPBoardStream,
                    subjectId: 'all',
                    chapterId: 'all',
                  })
                }
                className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="all">{t('materials.library.allStreams')}</option>
                {UP_BOARD_STREAMS.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name[language]}
                  </option>
                ))}
              </select>
            )}

            {availableChapters.length > 0 && (
              <select
                aria-label={t('materials.library.allChapters')}
                value={filters.chapterId}
                onChange={(e) => updateFilters({ chapterId: e.target.value })}
                className="h-9 max-w-[240px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="all">{t('materials.library.allChapters')}</option>
                {availableChapters.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.order}. {ch.title[language]}
                  </option>
                ))}
              </select>
            )}

            <select
              aria-label={t('materials.library.allSessions')}
              value={filters.academicSession}
              onChange={(e) => updateFilters({ academicSession: e.target.value })}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="all">{t('materials.library.allSessions')}</option>
              {availableSessions.map((sess) => (
                <option key={sess} value={sess}>
                  {sess}
                </option>
              ))}
            </select>

            <select
              aria-label={t('materials.source.all')}
              value={filters.sourceFilter}
              onChange={(e) =>
                updateFilters({
                  sourceFilter: e.target.value as MaterialFilterState['sourceFilter'],
                })
              }
              className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="all">{t('materials.source.all')}</option>
              <option value="official">{t('materials.source.official')}</option>
              <option value="supplementary">{t('materials.source.supplementary')}</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <span
              data-testid="materials-count-label"
              className="text-xs font-semibold text-slate-600 dark:text-slate-300"
            >
              {t('materials.library.resultsCount', { count: totalCount })}
            </span>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <FilterX className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                <span>{t('materials.library.clearFilters')}</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Recently Viewed Strip (when populated) */}
      {recentPdfEntries.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                {t('materials.library.recentlyViewed')}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => void clearReadingHistory()}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t('materials.library.clearHistory')}</span>
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {recentPdfEntries.map(({ entry, material }) =>
              material ? (
                <Link
                  key={entry.id}
                  to={
                    material.materialType === 'video_lecture'
                      ? `/video-lectures/${material.id}`
                      : `/pdf-library/view/${material.id}`
                  }
                  className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 transition-colors hover:border-blue-300 dark:border-slate-800 dark:bg-slate-800/40 dark:hover:border-blue-700"
                >
                  <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                    {material.title[language]}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-blue-600 dark:text-blue-400">
                    {entry.totalPages
                      ? t('materials.library.pageProgress', {
                          page: entry.lastViewedPage,
                          total: entry.totalPages,
                        })
                      : t(`materials.type.${material.materialType}`)}
                  </p>
                </Link>
              ) : null
            )}
          </div>
        </section>
      )}

      {/* Results Grid */}
      {pageItems.length > 0 ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {pageItems.map((mat) => (
              <MaterialCard key={mat.id} material={mat} />
            ))}
          </div>

          {totalPages > 1 && (
            <nav
              aria-label="Library pagination"
              className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-3.5 dark:border-slate-800 dark:bg-slate-900"
            >
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => updateFilters({ page: currentPage - 1 }, false)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                {t('materials.library.prevPage')}
              </button>
              <span className="font-mono text-xs font-semibold text-slate-600 tabular-nums dark:text-slate-300">
                {t('materials.library.pagination', { current: currentPage, total: totalPages })}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => updateFilters({ page: currentPage + 1 }, false)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                {t('materials.library.nextPage')}
              </button>
            </nav>
          )}
        </div>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <EmptyState
            icon={<BookOpen className="h-6 w-6" aria-hidden="true" />}
            title={t('materials.library.emptyTitle')}
            body={t('materials.library.emptyBody')}
          />
          {hasActiveFilter && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => updateFilters(DEFAULT_MATERIAL_FILTER_STATE)}
                className="h-9 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700"
              >
                {t('materials.library.clearFilters')}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default PdfLibraryPage;
