import React, { useMemo, useState } from 'react';
import { FilterX, PlayCircle, Search } from 'lucide-react';
import { EmptyState } from '../components/common/EmptyState';
import { MaterialCard } from '../components/materials/MaterialCard';
import { useApp } from '../contexts/AppContext';
import { ALL_CURRICULUM_SUBJECTS } from '../data/curriculum';
import { STUDY_MATERIALS_CATALOG } from '../data/materials/studyMaterialsCatalog';
import type { ExamTrack } from '../types/database';
import type { MaterialFilterState, MaterialLanguage } from '../types/materials';
import { DEFAULT_MATERIAL_FILTER_STATE, filterStudyMaterials } from '../utils/materialsSearch';

const VideoLecturesPage: React.FC = () => {
  const { language, t } = useApp();
  const [filters, setFilters] = useState<MaterialFilterState>(DEFAULT_MATERIAL_FILTER_STATE);
  const [playlistFilter, setPlaylistFilter] = useState<string>('all');

  const allVideos = useMemo(
    () => STUDY_MATERIALS_CATALOG.filter((m) => m.materialType === 'video_lecture' && m.isPublished),
    []
  );

  const playlists = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of allVideos) {
      if (v.playlistId && v.playlistTitle) {
        map.set(v.playlistId, v.playlistTitle[language]);
      }
    }
    return Array.from(map.entries());
  }, [allVideos, language]);

  const availableSubjects = useMemo(
    () =>
      ALL_CURRICULUM_SUBJECTS.filter(
        (s) => filters.examTrack === 'all' || s.examTrack === filters.examTrack
      ),
    [filters.examTrack]
  );

  const filteredVideos = useMemo(() => {
    const base = filterStudyMaterials(STUDY_MATERIALS_CATALOG, filters, ALL_CURRICULUM_SUBJECTS, {
      onlyVideoLectures: true,
    });
    if (playlistFilter === 'all') return base;
    return base.filter((v) => v.playlistId === playlistFilter);
  }, [filters, playlistFilter]);

  const clearAll = () => {
    setFilters(DEFAULT_MATERIAL_FILTER_STATE);
    setPlaylistFilter('all');
  };

  const hasFilter =
    Boolean(filters.query.trim()) ||
    filters.examTrack !== 'all' ||
    filters.subjectId !== 'all' ||
    filters.language !== 'all' ||
    playlistFilter !== 'all';

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-2 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
          {t('videos.eyebrow')}
        </p>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {t('videos.title')}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {t('videos.subtitle')}
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="relative lg:col-span-4">
            <label htmlFor="video-search-input" className="sr-only">
              {t('materials.library.searchLabel')}
            </label>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="video-search-input"
              type="search"
              value={filters.query}
              onChange={(e) => setFilters((p) => ({ ...p, query: e.target.value }))}
              placeholder={t('materials.library.searchPlaceholder')}
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:col-span-8">
            <select
              aria-label={t('materials.library.allExams')}
              value={filters.examTrack}
              onChange={(e) =>
                setFilters((p) => ({
                  ...p,
                  examTrack: e.target.value as 'all' | ExamTrack,
                  subjectId: 'all',
                }))
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
              onChange={(e) => setFilters((p) => ({ ...p, subjectId: e.target.value }))}
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
              aria-label={t('materials.lang.all')}
              value={filters.language}
              onChange={(e) =>
                setFilters((p) => ({ ...p, language: e.target.value as 'all' | MaterialLanguage }))
              }
              className="h-10 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="all">{t('materials.lang.all')}</option>
              <option value="en">{t('materials.lang.en')}</option>
              <option value="hi">{t('materials.lang.hi')}</option>
              <option value="bilingual">{t('materials.lang.bilingual')}</option>
            </select>

            <select
              aria-label={t('videos.allPlaylists')}
              value={playlistFilter}
              onChange={(e) => setPlaylistFilter(e.target.value)}
              className="h-10 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="all">{t('videos.allPlaylists')}</option>
              {playlists.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {t('videos.resultsCount', { count: filteredVideos.length })}
          </span>
          {hasFilter && (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <FilterX className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              <span>{t('materials.library.clearFilters')}</span>
            </button>
          )}
        </div>
      </section>

      {filteredVideos.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {filteredVideos.map((vid) => (
            <MaterialCard key={vid.id} material={vid} />
          ))}
        </div>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <EmptyState
            icon={<PlayCircle className="h-6 w-6" aria-hidden="true" />}
            title={t('videos.emptyTitle')}
            body={t('videos.emptyBody')}
          />
        </section>
      )}
    </div>
  );
};

export default VideoLecturesPage;
