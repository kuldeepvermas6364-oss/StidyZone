import type { CurriculumSubject } from '../types/curriculum';
import type { LibraryMaterial, MaterialFilterState, MaterialType } from '../types/materials';

export const DEFAULT_MATERIAL_FILTER_STATE: MaterialFilterState = {
  query: '',
  examTrack: 'all',
  streamId: 'all',
  subjectId: 'all',
  chapterId: 'all',
  materialType: 'all',
  language: 'all',
  academicSession: 'all',
  sourceFilter: 'all',
  page: 1,
};

export function formatBytesCompact(bytes?: number): string {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

export function formatDurationClock(seconds?: number): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return '—';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function filterStudyMaterials(
  materials: LibraryMaterial[],
  filters: MaterialFilterState,
  subjects: CurriculumSubject[] = [],
  options?: { excludeVideoLectures?: boolean; onlyVideoLectures?: boolean }
): LibraryMaterial[] {
  const q = filters.query.trim().toLowerCase();

  const subjectLookup = new Map<string, CurriculumSubject>();
  for (const s of subjects) {
    subjectLookup.set(s.id, s);
  }

  return materials.filter((item) => {
    if (!item.isPublished || item.publicationStatus !== 'published') return false;
    if (options?.excludeVideoLectures && item.materialType === 'video_lecture') return false;
    if (options?.onlyVideoLectures && item.materialType !== 'video_lecture') return false;

    if (filters.examTrack !== 'all' && item.examTrack !== filters.examTrack) return false;
    if (
      filters.streamId !== 'all' &&
      item.examTrack === 'up-board-12' &&
      item.streamId &&
      item.streamId !== filters.streamId
    ) {
      return false;
    }
    if (filters.streamId !== 'all' && item.examTrack !== 'up-board-12') {
      return false;
    }
    if (filters.subjectId !== 'all' && item.subjectId !== filters.subjectId) return false;
    if (filters.chapterId !== 'all' && item.chapterId !== filters.chapterId) return false;
    if (filters.materialType !== 'all' && item.materialType !== filters.materialType) return false;
    if (filters.language !== 'all' && item.language !== filters.language) return false;
    if (
      filters.academicSession !== 'all' &&
      item.academicSession !== filters.academicSession
    ) {
      return false;
    }
    if (filters.sourceFilter === 'official' && !item.isOfficial) return false;
    if (filters.sourceFilter === 'supplementary' && item.isOfficial) return false;

    if (q) {
      const sub = subjectLookup.get(item.subjectId);
      const chap = sub?.chapters.find((c) => c.id === item.chapterId);
      const haystack = [
        item.title.en,
        item.title.hi,
        item.description.en,
        item.description.hi,
        item.publisher.en,
        item.publisher.hi,
        item.author.en,
        item.author.hi,
        ...item.keywords,
        sub?.name.en ?? '',
        sub?.name.hi ?? '',
        chap?.title.en ?? '',
        chap?.title.hi ?? '',
      ]
        .join(' ')
        .toLowerCase();

      if (!haystack.includes(q)) return false;
    }

    return true;
  });
}

export function paginateMaterials<T>(
  items: T[],
  page: number,
  pageSize = 6
): { pageItems: T[]; totalPages: number; currentPage: number; totalCount: number } {
  const totalCount = items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.max(1, Math.min(totalPages, Math.floor(page) || 1));
  const start = (currentPage - 1) * pageSize;
  return {
    pageItems: items.slice(start, start + pageSize),
    totalPages,
    currentPage,
    totalCount,
  };
}

export interface ChapterMaterialBuckets {
  chapterNotes: LibraryMaterial[];
  textbooks: LibraryMaterial[];
  previousYearPapers: LibraryMaterial[];
  sampleAndModelQuestions: LibraryMaterial[];
  formulaSheets: LibraryMaterial[];
  revisionNotes: LibraryMaterial[];
  videoLectures: LibraryMaterial[];
  otherResources: LibraryMaterial[];
}

export function groupChapterMaterials(
  materials: LibraryMaterial[],
  examTrack: string,
  subjectId: string,
  chapterId: string
): ChapterMaterialBuckets {
  const matching = materials.filter(
    (m) =>
      m.isPublished &&
      m.publicationStatus === 'published' &&
      m.examTrack === examTrack &&
      m.subjectId === subjectId &&
      m.chapterId === chapterId
  );

  const buckets: ChapterMaterialBuckets = {
    chapterNotes: [],
    textbooks: [],
    previousYearPapers: [],
    sampleAndModelQuestions: [],
    formulaSheets: [],
    revisionNotes: [],
    videoLectures: [],
    otherResources: [],
  };

  for (const item of matching) {
    const t: MaterialType = item.materialType;
    if (t === 'chapter_notes' || t === 'class_notes' || t === 'derivations') {
      buckets.chapterNotes.push(item);
    } else if (t === 'ncert_book' || t === 'official_syllabus') {
      buckets.textbooks.push(item);
    } else if (t === 'pyq_paper') {
      buckets.previousYearPapers.push(item);
    } else if (t === 'sample_paper' || t === 'model_paper' || t === 'important_questions') {
      buckets.sampleAndModelQuestions.push(item);
    } else if (t === 'formula_sheet') {
      buckets.formulaSheets.push(item);
    } else if (t === 'revision_notes') {
      buckets.revisionNotes.push(item);
    } else if (t === 'video_lecture') {
      buckets.videoLectures.push(item);
    } else {
      buckets.otherResources.push(item);
    }
  }

  return buckets;
}

export function parseFiltersFromSearchParams(params: URLSearchParams): MaterialFilterState {
  const examRaw = params.get('exam');
  const streamRaw = params.get('stream');
  const typeRaw = params.get('type');
  const langRaw = params.get('lang');
  const sourceRaw = params.get('source');
  const pageRaw = Number(params.get('page') || '1');

  return {
    query: params.get('q') ?? '',
    examTrack:
      examRaw === 'up-board-12' || examRaw === 'jee-main' || examRaw === 'jee-advanced'
        ? examRaw
        : 'all',
    streamId:
      streamRaw === 'science' || streamRaw === 'commerce' || streamRaw === 'arts'
        ? streamRaw
        : 'all',
    subjectId: params.get('subject') || 'all',
    chapterId: params.get('chapter') || 'all',
    materialType: (typeRaw as MaterialFilterState['materialType']) || 'all',
    language:
      langRaw === 'en' || langRaw === 'hi' || langRaw === 'bilingual' ? langRaw : 'all',
    academicSession: params.get('session') || 'all',
    sourceFilter:
      sourceRaw === 'official' || sourceRaw === 'supplementary' ? sourceRaw : 'all',
    page: Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1,
  };
}

export function serializeFiltersToSearchParams(filters: MaterialFilterState): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.query.trim()) params.set('q', filters.query.trim());
  if (filters.examTrack !== 'all') params.set('exam', filters.examTrack);
  if (filters.streamId !== 'all') params.set('stream', filters.streamId);
  if (filters.subjectId !== 'all') params.set('subject', filters.subjectId);
  if (filters.chapterId !== 'all') params.set('chapter', filters.chapterId);
  if (filters.materialType !== 'all') params.set('type', filters.materialType);
  if (filters.language !== 'all') params.set('lang', filters.language);
  if (filters.academicSession !== 'all') params.set('session', filters.academicSession);
  if (filters.sourceFilter !== 'all') params.set('source', filters.sourceFilter);
  if (filters.page > 1) params.set('page', String(filters.page));
  return params;
}
