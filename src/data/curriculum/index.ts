import type {
  CurriculumChapter,
  CurriculumSubject,
  StreamDefinition,
  UPBoardStream,
} from '../../types/curriculum';
import type { ExamTrack } from '../../types/database';
import { UP_BOARD_SCIENCE_SUBJECTS } from './upBoardScience';
import { UP_BOARD_COMMERCE_ARTS_SUBJECTS } from './upBoardCommerceArts';
import { JEE_MAIN_SUBJECTS } from './jeeMain';
import { JEE_ADVANCED_SUBJECTS } from './jeeAdvanced';

export const UP_BOARD_STREAMS: StreamDefinition[] = [
  {
    id: 'science',
    name: { en: 'Science', hi: 'विज्ञान वर्ग' },
    description: {
      en: 'Physics, Chemistry, Mathematics / Biology, English & Hindi',
      hi: 'भौतिक विज्ञान, रसायन विज्ञान, गणित / जीव विज्ञान, अंग्रेज़ी व हिंदी',
    },
    defaultSubjectIds: ['up12-physics', 'up12-chemistry', 'up12-maths', 'up12-english', 'up12-hindi'],
    availableSubjectIds: [
      'up12-physics',
      'up12-chemistry',
      'up12-maths',
      'up12-biology',
      'up12-english',
      'up12-hindi',
    ],
  },
  {
    id: 'commerce',
    name: { en: 'Commerce', hi: 'वाणिज्य वर्ग' },
    description: {
      en: 'Accountancy, Business Studies, Economics, English & Hindi',
      hi: 'लेखाशास्त्र, व्यवसाय अध्ययन, अर्थशास्त्र, अंग्रेज़ी व हिंदी',
    },
    defaultSubjectIds: [
      'up12-accountancy',
      'up12-business-studies',
      'up12-economics',
      'up12-english',
      'up12-hindi',
    ],
    availableSubjectIds: [
      'up12-accountancy',
      'up12-business-studies',
      'up12-economics',
      'up12-english',
      'up12-hindi',
    ],
  },
  {
    id: 'arts',
    name: { en: 'Arts / Humanities', hi: 'कला / मानविकी वर्ग' },
    description: {
      en: 'History, Geography, Political Science, Economics, Sociology, English & Hindi',
      hi: 'इतिहास, भूगोल, नागरिक शास्त्र, अर्थशास्त्र, समाजशास्त्र, अंग्रेज़ी व हिंदी',
    },
    defaultSubjectIds: [
      'up12-history',
      'up12-geography',
      'up12-political-science',
      'up12-english',
      'up12-hindi',
    ],
    availableSubjectIds: [
      'up12-history',
      'up12-geography',
      'up12-political-science',
      'up12-economics',
      'up12-sociology',
      'up12-english',
      'up12-hindi',
    ],
  },
];

const UP_BOARD_SUBJECT_CATALOG: CurriculumSubject[] = [
  ...UP_BOARD_SCIENCE_SUBJECTS,
  ...UP_BOARD_COMMERCE_ARTS_SUBJECTS,
];

export const ALL_CURRICULUM_SUBJECTS: CurriculumSubject[] = [
  ...UP_BOARD_SUBJECT_CATALOG,
  ...JEE_MAIN_SUBJECTS,
  ...JEE_ADVANCED_SUBJECTS,
];

export function getStreamDefinition(streamId: UPBoardStream): StreamDefinition {
  return UP_BOARD_STREAMS.find((s) => s.id === streamId) ?? UP_BOARD_STREAMS[0];
}

export function getDefaultSubjectsForStream(streamId: UPBoardStream): string[] {
  return [...getStreamDefinition(streamId).defaultSubjectIds];
}

export function getSubjectsForExam(
  examTrack: ExamTrack,
  streamId?: UPBoardStream,
  selectedSubjectIds?: string[]
): CurriculumSubject[] {
  let base: CurriculumSubject[];
  if (examTrack === 'up-board-12') {
    const activeStream = streamId ?? 'science';
    const def = getStreamDefinition(activeStream);
    base = def.availableSubjectIds
      .map((id) => UP_BOARD_SUBJECT_CATALOG.find((s) => s.id === id))
      .filter((s): s is CurriculumSubject => Boolean(s));
    if (selectedSubjectIds && selectedSubjectIds.length > 0) {
      const selectedSet = new Set(selectedSubjectIds);
      const filtered = base.filter((s) => selectedSet.has(s.id));
      if (filtered.length > 0) {
        return filtered;
      }
    }
    return base;
  }

  return ALL_CURRICULUM_SUBJECTS.filter((s) => s.examTrack === examTrack).sort(
    (a, b) => a.order - b.order
  );
}

export function getSubjectById(
  examTrack: ExamTrack,
  subjectId: string
): CurriculumSubject | undefined {
  return ALL_CURRICULUM_SUBJECTS.find(
    (s) => s.examTrack === examTrack && s.id === subjectId
  );
}

export function getChapterById(
  examTrack: ExamTrack,
  subjectId: string,
  chapterId: string
): { subject: CurriculumSubject; chapter: CurriculumChapter } | undefined {
  const subject = getSubjectById(examTrack, subjectId);
  if (!subject) return undefined;
  const chapter = subject.chapters.find((c) => c.id === chapterId);
  if (!chapter) return undefined;
  return { subject, chapter };
}
