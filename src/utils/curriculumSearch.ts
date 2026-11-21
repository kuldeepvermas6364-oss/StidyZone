import type {
  ChapterProgressStatus,
  CurriculumChapter,
  CurriculumSubject,
  CurriculumTopic,
} from '../types/curriculum';
import { getChapterProgress, type ProgressMap } from './curriculumProgress';

export interface AcademicSearchHit {
  kind: 'subject' | 'chapter';
  subject: CurriculumSubject;
  chapter?: CurriculumChapter;
  matchedTopic?: CurriculumTopic;
  routePath: string;
}

export function searchCurriculum(
  subjects: CurriculumSubject[],
  rawQuery: string,
  limit = 20
): AcademicSearchHit[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return [];

  const hits: AcademicSearchHit[] = [];

  for (const subject of subjects) {
    const subjectMatches =
      subject.name.en.toLowerCase().includes(query) ||
      subject.name.hi.toLowerCase().includes(query) ||
      subject.code.toLowerCase().includes(query) ||
      subject.overview.en.toLowerCase().includes(query) ||
      subject.overview.hi.toLowerCase().includes(query);

    if (subjectMatches) {
      hits.push({
        kind: 'subject',
        subject,
        routePath: `/syllabus/${subject.examTrack}/${subject.id}`,
      });
    }

    for (const chapter of subject.chapters) {
      const matchedTopic = chapter.topics.find(
        (topic) =>
          topic.title.en.toLowerCase().includes(query) ||
          topic.title.hi.toLowerCase().includes(query) ||
          topic.subtopics.some(
            (st) => st.en.toLowerCase().includes(query) || st.hi.toLowerCase().includes(query)
          )
      );

      const chapterMatches =
        chapter.title.en.toLowerCase().includes(query) ||
        chapter.title.hi.toLowerCase().includes(query) ||
        chapter.overview.en.toLowerCase().includes(query) ||
        chapter.overview.hi.toLowerCase().includes(query) ||
        Boolean(matchedTopic);

      if (chapterMatches) {
        hits.push({
          kind: 'chapter',
          subject,
          chapter,
          matchedTopic,
          routePath: `/syllabus/${subject.examTrack}/${subject.id}/${chapter.id}`,
        });
      }
    }
  }

  return hits.slice(0, limit);
}

export function filterChaptersByStatus(
  chapters: CurriculumChapter[],
  progressMap: ProgressMap,
  statusFilter: 'all' | ChapterProgressStatus
): CurriculumChapter[] {
  if (statusFilter === 'all') return chapters;
  return chapters.filter((ch) => {
    const prog = getChapterProgress(progressMap, ch.examTrack, ch.subjectId, ch.id);
    return prog.status === statusFilter;
  });
}
