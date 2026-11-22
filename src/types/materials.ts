import type { ExamClassLevel, UPBoardStream, VerificationStatus } from './curriculum';
import type { BilingualText, ExamTrack } from './database';

export type MaterialType =
  | 'ncert_book'
  | 'chapter_notes'
  | 'class_notes'
  | 'revision_notes'
  | 'important_questions'
  | 'pyq_paper'
  | 'sample_paper'
  | 'model_paper'
  | 'formula_sheet'
  | 'derivations'
  | 'practical_guide'
  | 'official_syllabus'
  | 'video_lecture';

export type MaterialLanguage = 'en' | 'hi' | 'bilingual';

export type MaterialFileFormat = 'PDF' | 'VIDEO' | 'WEB_PORTAL';

export type MaterialDistributionType =
  | 'authorized_pdf'
  | 'protected_pdf'
  | 'official_external_link'
  | 'authorized_video';

export type StorageProviderKind =
  | 'local-signed-storage'
  | 'firebase-storage'
  | 'external-official';

export type MaterialVisibility = 'public' | 'authenticated' | 'restricted';
export type MaterialPublicationStatus = 'published' | 'draft' | 'archived';

export interface LibraryMaterial {
  id: string;
  title: BilingualText;
  description: BilingualText;
  examTrack: ExamTrack;
  academicSession: string;
  classLevel: ExamClassLevel;
  streamId?: UPBoardStream;
  subjectId: string;
  chapterId?: string;
  topicId?: string;
  materialType: MaterialType;
  language: MaterialLanguage;
  fileFormat: MaterialFileFormat;
  fileSizeBytes?: number;
  pageCount?: number;
  durationSeconds?: number;
  storageProvider: StorageProviderKind;
  /** Relative safe storage filename/key within server-confined materials directory */
  storagePath?: string;
  externalSourceUrl: string;
  embedUrl?: string;
  isEmbeddable?: boolean;
  playlistId?: string;
  playlistTitle?: BilingualText;
  distributionType: MaterialDistributionType;
  accessLevel: 'public' | 'authenticated';
  downloadAllowed: boolean;
  publisher: BilingualText;
  author: BilingualText;
  isOfficial: boolean;
  verificationStatus: VerificationStatus;
  verifiedDate: string;
  licenseOrDistributionNote: BilingualText;
  keywords: string[];
  visibility: MaterialVisibility;
  publicationStatus: MaterialPublicationStatus;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  createdByUid: string;
}

export interface StudentReadingHistoryEntry {
  id: string; // `${uid}_${materialId}`
  uid: string;
  materialId: string;
  examTrack: ExamTrack;
  subjectId: string;
  chapterId?: string;
  materialType: MaterialType;
  lastViewedPage: number;
  totalPages?: number;
  lastAccessedAt: string;
}

export interface MaterialFilterState {
  query: string;
  examTrack: 'all' | ExamTrack;
  streamId: 'all' | UPBoardStream;
  subjectId: string; // 'all' or subjectId
  chapterId: string; // 'all' or chapterId
  materialType: 'all' | MaterialType;
  language: 'all' | MaterialLanguage;
  academicSession: string; // 'all' or session string
  sourceFilter: 'all' | 'official' | 'supplementary';
  page: number;
}
