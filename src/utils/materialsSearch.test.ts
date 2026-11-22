import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_CURRICULUM_SUBJECTS } from '../data/curriculum';
import { STUDY_MATERIALS_CATALOG } from '../data/materials/studyMaterialsCatalog';
import {
  DEFAULT_MATERIAL_FILTER_STATE,
  filterStudyMaterials,
  groupChapterMaterials,
  paginateMaterials,
  parseFiltersFromSearchParams,
  serializeFiltersToSearchParams,
} from './materialsSearch';

test('combines exam track, stream, subject, and official/supplementary filters accurately', () => {
  const commercePdfs = filterStudyMaterials(
    STUDY_MATERIALS_CATALOG,
    {
      ...DEFAULT_MATERIAL_FILTER_STATE,
      examTrack: 'up-board-12',
      streamId: 'commerce',
    },
    ALL_CURRICULUM_SUBJECTS,
    { excludeVideoLectures: true }
  );

  assert.equal(commercePdfs.length >= 1, true);
  assert.equal(
    commercePdfs.every((m) => m.examTrack === 'up-board-12' && m.streamId === 'commerce'),
    true
  );

  const officialOnly = filterStudyMaterials(
    STUDY_MATERIALS_CATALOG,
    {
      ...DEFAULT_MATERIAL_FILTER_STATE,
      sourceFilter: 'official',
    },
    ALL_CURRICULUM_SUBJECTS,
    { excludeVideoLectures: true }
  );
  assert.equal(officialOnly.length >= 4, true);
  assert.equal(officialOnly.every((m) => m.isOfficial), true);
});

test('keeps JEE Main and JEE Advanced materials strictly separated', () => {
  const jeeMain = filterStudyMaterials(
    STUDY_MATERIALS_CATALOG,
    { ...DEFAULT_MATERIAL_FILTER_STATE, examTrack: 'jee-main' },
    ALL_CURRICULUM_SUBJECTS
  );
  const jeeAdv = filterStudyMaterials(
    STUDY_MATERIALS_CATALOG,
    { ...DEFAULT_MATERIAL_FILTER_STATE, examTrack: 'jee-advanced' },
    ALL_CURRICULUM_SUBJECTS
  );

  assert.equal(jeeMain.some((m) => m.examTrack === 'jee-advanced'), false);
  assert.equal(jeeAdv.some((m) => m.examTrack === 'jee-main'), false);
});

test('supports bilingual Hindi and English search across titles, subjects, and keywords', () => {
  const hindiMatches = filterStudyMaterials(
    STUDY_MATERIALS_CATALOG,
    { ...DEFAULT_MATERIAL_FILTER_STATE, query: 'गॉस' },
    ALL_CURRICULUM_SUBJECTS
  );
  assert.equal(hindiMatches.some((m) => m.id === 'up12-phy-c1-notes-pdf'), true);

  const englishMatches = filterStudyMaterials(
    STUDY_MATERIALS_CATALOG,
    { ...DEFAULT_MATERIAL_FILTER_STATE, query: 'Wien Law' },
    ALL_CURRICULUM_SUBJECTS
  );
  assert.equal(englishMatches.some((m) => m.id === 'jeeadv-phy-thermal-notes-pdf'), true);
});

test('groupChapterMaterials populates matching sections and leaves unrelated buckets empty', () => {
  const buckets = groupChapterMaterials(
    STUDY_MATERIALS_CATALOG,
    'up-board-12',
    'up12-physics',
    'up12-phy-c1'
  );
  assert.equal(buckets.chapterNotes.length, 1);
  assert.equal(buckets.sampleAndModelQuestions.length, 1);
  assert.equal(buckets.videoLectures.length, 1);
  assert.equal(buckets.previousYearPapers.length, 0);
});

test('pagination and URL filter serialization preserve filter state', () => {
  const paginated = paginateMaterials(STUDY_MATERIALS_CATALOG, 2, 6);
  assert.equal(paginated.currentPage, 2);
  assert.equal(paginated.pageItems.length, 6);
  assert.equal(paginated.totalCount, STUDY_MATERIALS_CATALOG.length);

  const original = {
    ...DEFAULT_MATERIAL_FILTER_STATE,
    examTrack: 'jee-main' as const,
    materialType: 'formula_sheet' as const,
    query: 'calculus',
    page: 2,
  };
  const params = serializeFiltersToSearchParams(original);
  const restored = parseFiltersFromSearchParams(params);
  assert.deepEqual(restored, original);
});
