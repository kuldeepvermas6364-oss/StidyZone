import type {
  ChapterProgressStatus,
  CurriculumChapter,
  CurriculumSubject,
  PracticeStatus,
  StudentChapterProgress,
  UPBoardStream,
} from '../types/curriculum';
import type { ExamTrack } from '../types/database';

export type ProgressMap = Record<string, StudentChapterProgress>;

export interface SubjectProgressStats {
  subjectId: string;
  totalChapters: number;
  completedChapters: number;
  inProgressChapters: number;
  needsRevisionChapters: number;
  notStartedChapters: number;
  remainingChapters: number;
  completionPercent: number;
}

export interface ExamProgressStats {
  totalChapters: number;
  completedChapters: number;
  inProgressChapters: number;
  needsRevisionChapters: number;
  notStartedChapters: number;
  remainingChapters: number;
  completionPercent: number;
}

export function buildProgressDocId(
  uid: string,
  examTrack: ExamTrack,
  subjectId: string,
  chapterId: string
): string {
  return `${uid}_${examTrack}_${subjectId}_${chapterId}`.slice(0, 128);
}

export function buildProgressKey(
  examTrack: ExamTrack,
  subjectId: string,
  chapterId: string
): string {
  return `${examTrack}::${subjectId}::${chapterId}`;
}

export function getChapterProgress(
  progressMap: ProgressMap,
  examTrack: ExamTrack,
  subjectId: string,
  chapterId: string
): Pick<
  StudentChapterProgress,
  'status' | 'practiceStatus' | 'completedTopicIds' | 'completionPercent' | 'studyMinutesLogged' | 'lastActivityAt'
> {
  const rec = progressMap[buildProgressKey(examTrack, subjectId, chapterId)];
  if (!rec) {
    return {
      status: 'not_started',
      practiceStatus: 'not_started',
      completedTopicIds: [],
      completionPercent: 0,
      studyMinutesLogged: 0,
      lastActivityAt: '',
    };
  }
  return {
    status: rec.status,
    practiceStatus: rec.practiceStatus ?? 'not_started',
    completedTopicIds: rec.completedTopicIds ?? [],
    completionPercent: rec.completionPercent ?? 0,
    studyMinutesLogged: rec.studyMinutesLogged ?? 0,
    lastActivityAt: rec.lastActivityAt,
  };
}

export function computeChapterCompletionPercent(
  chapter: CurriculumChapter,
  completedTopicIds: string[],
  status: ChapterProgressStatus
): number {
  if (status === 'completed') return 100;
  const totalTopics = chapter.topics.length;
  if (totalTopics === 0) return 0;
  const validSet = new Set(chapter.topics.map((t) => t.id));
  const doneCount = completedTopicIds.filter((id) => validSet.has(id)).length;
  return Math.min(100, Math.round((doneCount / totalTopics) * 100));
}

export function computeSubjectStats(
  subject: CurriculumSubject,
  progressMap: ProgressMap
): SubjectProgressStats {
  const totalChapters = subject.chapters.length;
  if (totalChapters === 0) {
    return {
      subjectId: subject.id,
      totalChapters: 0,
      completedChapters: 0,
      inProgressChapters: 0,
      needsRevisionChapters: 0,
      notStartedChapters: 0,
      remainingChapters: 0,
      completionPercent: 0,
    };
  }

  let completedChapters = 0;
  let inProgressChapters = 0;
  let needsRevisionChapters = 0;
  let notStartedChapters = 0;
  let percentSum = 0;

  for (const ch of subject.chapters) {
    const p = getChapterProgress(progressMap, subject.examTrack, subject.id, ch.id);
    if (p.status === 'completed') {
      completedChapters += 1;
    } else if (p.status === 'in_progress') {
      inProgressChapters += 1;
    } else if (p.status === 'needs_revision') {
      needsRevisionChapters += 1;
    } else {
      notStartedChapters += 1;
    }
    percentSum += p.completionPercent;
  }

  return {
    subjectId: subject.id,
    totalChapters,
    completedChapters,
    inProgressChapters,
    needsRevisionChapters,
    notStartedChapters,
    remainingChapters: totalChapters - completedChapters,
    completionPercent: Math.round(percentSum / totalChapters),
  };
}

export function computeExamStats(
  subjects: CurriculumSubject[],
  progressMap: ProgressMap
): ExamProgressStats {
  let totalChapters = 0;
  let completedChapters = 0;
  let inProgressChapters = 0;
  let needsRevisionChapters = 0;
  let notStartedChapters = 0;
  let weightedSum = 0;

  for (const subject of subjects) {
    const subStats = computeSubjectStats(subject, progressMap);
    totalChapters += subStats.totalChapters;
    completedChapters += subStats.completedChapters;
    inProgressChapters += subStats.inProgressChapters;
    needsRevisionChapters += subStats.needsRevisionChapters;
    notStartedChapters += subStats.notStartedChapters;
    weightedSum += subStats.completionPercent * subStats.totalChapters;
  }

  return {
    totalChapters,
    completedChapters,
    inProgressChapters,
    needsRevisionChapters,
    notStartedChapters,
    remainingChapters: Math.max(0, totalChapters - completedChapters),
    completionPercent: totalChapters > 0 ? Math.round(weightedSum / totalChapters) : 0,
  };
}

export function getRecentlyStudiedChapters(
  progressMap: ProgressMap,
  allowedSubjects: CurriculumSubject[],
  limit = 5
): Array<{
  record: StudentChapterProgress;
  subject: CurriculumSubject;
  chapter: CurriculumChapter;
}> {
  const subjectMap = new Map(allowedSubjects.map((s) => [s.id, s]));
  const items: Array<{
    record: StudentChapterProgress;
    subject: CurriculumSubject;
    chapter: CurriculumChapter;
  }> = [];

  for (const record of Object.values(progressMap)) {
    if (
      record.status === 'not_started' &&
      record.completedTopicIds.length === 0 &&
      record.practiceStatus === 'not_started'
    ) {
      continue;
    }
    const subject = subjectMap.get(record.subjectId);
    if (!subject || subject.examTrack !== record.examTrack) continue;
    const chapter = subject.chapters.find((c) => c.id === record.chapterId);
    if (!chapter) continue;
    items.push({ record, subject, chapter });
  }

  items.sort((a, b) => b.record.lastActivityAt.localeCompare(a.record.lastActivityAt));
  return items.slice(0, limit);
}

export function applyTopicToggle(params: {
  uid: string;
  chapter: CurriculumChapter;
  topicId: string;
  streamId?: UPBoardStream | null;
  existing?: StudentChapterProgress;
  nowISO: string;
}): StudentChapterProgress {
  const { uid, chapter, topicId, streamId, existing, nowISO } = params;
  const prevTopics = new Set(existing?.completedTopicIds ?? []);
  if (prevTopics.has(topicId)) {
    prevTopics.delete(topicId);
  } else {
    prevTopics.add(topicId);
  }
  const completedTopicIds = Array.from(prevTopics);
  const totalTopics = chapter.topics.length;

  let nextStatus: ChapterProgressStatus = existing?.status ?? 'not_started';
  if (nextStatus !== 'needs_revision') {
    if (completedTopicIds.length === 0) {
      nextStatus = 'not_started';
    } else if (totalTopics > 0 && completedTopicIds.length >= totalTopics) {
      nextStatus = 'completed';
    } else {
      nextStatus = 'in_progress';
    }
  }

  const completionPercent = computeChapterCompletionPercent(
    chapter,
    completedTopicIds,
    nextStatus
  );

  return {
    id: existing?.id ?? buildProgressDocId(uid, chapter.examTrack, chapter.subjectId, chapter.id),
    uid,
    examTrack: chapter.examTrack,
    streamId: streamId ?? existing?.streamId ?? null,
    subjectId: chapter.subjectId,
    chapterId: chapter.id,
    status: nextStatus,
    practiceStatus: existing?.practiceStatus ?? 'not_started',
    completedTopicIds,
    studyMinutesLogged: existing?.studyMinutesLogged ?? 0,
    completionPercent,
    lastActivityAt: nowISO,
  };
}

export function applyChapterStatusUpdate(params: {
  uid: string;
  chapter: CurriculumChapter;
  status?: ChapterProgressStatus;
  practiceStatus?: PracticeStatus;
  streamId?: UPBoardStream | null;
  existing?: StudentChapterProgress;
  nowISO: string;
}): StudentChapterProgress {
  const { uid, chapter, status, practiceStatus, streamId, existing, nowISO } = params;
  const nextStatus = status ?? existing?.status ?? 'not_started';
  let completedTopicIds = existing?.completedTopicIds ?? [];

  if (nextStatus === 'completed' && chapter.topics.length > 0) {
    completedTopicIds = chapter.topics.map((t) => t.id);
  } else if (nextStatus === 'not_started') {
    completedTopicIds = [];
  }

  const completionPercent = computeChapterCompletionPercent(
    chapter,
    completedTopicIds,
    nextStatus
  );

  return {
    id: existing?.id ?? buildProgressDocId(uid, chapter.examTrack, chapter.subjectId, chapter.id),
    uid,
    examTrack: chapter.examTrack,
    streamId: streamId ?? existing?.streamId ?? null,
    subjectId: chapter.subjectId,
    chapterId: chapter.id,
    status: nextStatus,
    practiceStatus: practiceStatus ?? existing?.practiceStatus ?? 'not_started',
    completedTopicIds,
    studyMinutesLogged: existing?.studyMinutesLogged ?? 0,
    completionPercent,
    lastActivityAt: nowISO,
  };
}
