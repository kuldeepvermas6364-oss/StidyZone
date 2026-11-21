import type {
  AdminRoleRecord,
  BookmarkRecord,
  ChapterRecord,
  CollectionName,
  ExamTrack,
  MockTestRecord,
  QuestionRecord,
  QuizRecord,
  StudentProfileRecord,
  StudyMaterialRecord,
  StudyProgressRecord,
  SubjectRecord,
  TopicRecord,
  UserRecord,
} from '../../types/database';
import { isFirebaseConfigured } from '../firebase/client-check';

export interface RepositoryResult<T> {
  data: T;
  source: 'empty-foundation' | 'firebase';
  collection: CollectionName;
}

export interface PrepZoneRepositories {
  users: {
    getById(uid: string): Promise<RepositoryResult<UserRecord | null>>;
  };
  profiles: {
    getById(uid: string): Promise<RepositoryResult<StudentProfileRecord | null>>;
  };
  subjects: {
    listByTrack(track: ExamTrack): Promise<RepositoryResult<SubjectRecord[]>>;
  };
  chapters: {
    listBySubject(subjectId: string): Promise<RepositoryResult<ChapterRecord[]>>;
  };
  topics: {
    listByChapter(chapterId: string): Promise<RepositoryResult<TopicRecord[]>>;
  };
  studyMaterials: {
    listByChapter(chapterId: string): Promise<RepositoryResult<StudyMaterialRecord[]>>;
  };
  questions: {
    listByChapter(chapterId: string): Promise<RepositoryResult<QuestionRecord[]>>;
  };
  quizzes: {
    listByTrack(track: ExamTrack): Promise<RepositoryResult<QuizRecord[]>>;
  };
  mockTests: {
    listByTrack(track: ExamTrack): Promise<RepositoryResult<MockTestRecord[]>>;
  };
  bookmarks: {
    listByUser(uid: string): Promise<RepositoryResult<BookmarkRecord[]>>;
  };
  studyProgress: {
    listByUser(uid: string): Promise<RepositoryResult<StudyProgressRecord[]>>;
  };
  adminRoles: {
    getByUser(uid: string): Promise<RepositoryResult<AdminRoleRecord | null>>;
  };
}

function emptyResult<T>(collection: CollectionName, data: T): RepositoryResult<T> {
  return {
    data,
    source: isFirebaseConfigured() ? 'firebase' : 'empty-foundation',
    collection,
  };
}

/**
 * Scalable Data-Access Layer for future Firebase Firestore / RTDB integration.
 * Returns empty data states rather than fabricated statistics or fake content.
 */
export const prepZoneRepositories: PrepZoneRepositories = {
  users: {
    async getById() {
      return emptyResult('users', null);
    },
  },
  profiles: {
    async getById() {
      return emptyResult('profiles', null);
    },
  },
  subjects: {
    async listByTrack() {
      return emptyResult('subjects', []);
    },
  },
  chapters: {
    async listBySubject() {
      return emptyResult('chapters', []);
    },
  },
  topics: {
    async listByChapter() {
      return emptyResult('topics', []);
    },
  },
  studyMaterials: {
    async listByChapter() {
      return emptyResult('studyMaterials', []);
    },
  },
  questions: {
    async listByChapter() {
      return emptyResult('questions', []);
    },
  },
  quizzes: {
    async listByTrack() {
      return emptyResult('quizzes', []);
    },
  },
  mockTests: {
    async listByTrack() {
      return emptyResult('mockTests', []);
    },
  },
  bookmarks: {
    async listByUser() {
      return emptyResult('bookmarks', []);
    },
  },
  studyProgress: {
    async listByUser() {
      return emptyResult('studyProgress', []);
    },
  },
  adminRoles: {
    async getByUser() {
      return emptyResult('adminRoles', null);
    },
  },
};
