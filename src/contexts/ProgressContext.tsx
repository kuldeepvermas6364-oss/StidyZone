import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { auth } from '../firebase';
import { getDefaultSubjectsForStream, getStreamDefinition } from '../data/curriculum';
import {
  readLocalUserProgress,
  saveFirebaseChapterProgress,
  subscribeFirebaseUserProgress,
  writeLocalUserProgress,
} from '../services/db/progressService';
import type {
  ChapterProgressStatus,
  CurriculumChapter,
  PracticeStatus,
  StudentChapterProgress,
  UPBoardStream,
} from '../types/curriculum';
import {
  applyChapterStatusUpdate,
  applyTopicToggle,
  buildProgressKey,
  type ProgressMap,
} from '../utils/curriculumProgress';
import { useAuth } from './AuthContext';

export interface MutationResult {
  ok: boolean;
  reason?: 'auth_required' | 'error';
}

interface ProgressContextValue {
  progressMap: ProgressMap;
  selectedStream: UPBoardStream;
  setSelectedStream: (stream: UPBoardStream) => Promise<void>;
  selectedSubjects: string[];
  toggleSubjectSelection: (subjectId: string) => Promise<void>;
  resetStreamSubjects: (stream?: UPBoardStream) => Promise<void>;
  setChapterStatus: (
    chapter: CurriculumChapter,
    status: ChapterProgressStatus
  ) => Promise<MutationResult>;
  setChapterPracticeStatus: (
    chapter: CurriculumChapter,
    practiceStatus: PracticeStatus
  ) => Promise<MutationResult>;
  toggleTopicCompletion: (
    chapter: CurriculumChapter,
    topicId: string
  ) => Promise<MutationResult>;
  guestPromptOpen: boolean;
  dismissGuestPrompt: () => void;
}

const ProgressContext = createContext<ProgressContextValue | undefined>(undefined);

export const ProgressProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, isAuthenticated, updateProfile } = useAuth();
  const [progressMap, setProgressMap] = useState<ProgressMap>({});
  const progressRef = useRef<ProgressMap>({});
  const [previewStream, setPreviewStream] = useState<UPBoardStream>('science');
  const [previewSubjects, setPreviewSubjects] = useState<string[]>(() =>
    getDefaultSubjectsForStream('science')
  );
  const [guestPromptOpen, setGuestPromptOpen] = useState(false);

  const activeUid = session?.user.uid ?? null;
  const isFirebaseSession = Boolean(
    isAuthenticated && session?.mode === 'firebase' && auth.currentUser?.uid === activeUid
  );

  // Sync per-user progress strictly isolated by uid (cleared on logout)
  useEffect(() => {
    if (!isAuthenticated || !activeUid) {
      progressRef.current = {};
      setProgressMap({});
      return;
    }

    if (isFirebaseSession) {
      const unsub = subscribeFirebaseUserProgress(activeUid, (nextMap) => {
        progressRef.current = nextMap;
        setProgressMap(nextMap);
      });
      return () => unsub();
    }

    const loaded = readLocalUserProgress(activeUid);
    progressRef.current = loaded;
    setProgressMap(loaded);
  }, [isAuthenticated, activeUid, isFirebaseSession]);

  // Keep UP Board stream & subjects synced to profile when authenticated
  const selectedStream: UPBoardStream =
    isAuthenticated && session?.profile.selectedStream
      ? session.profile.selectedStream
      : previewStream;

  const selectedSubjects: string[] = useMemo(() => {
    if (isAuthenticated && session?.profile.selectedSubjects?.length) {
      const validSet = new Set(getStreamDefinition(selectedStream).availableSubjectIds);
      const valid = session.profile.selectedSubjects.filter((id) => validSet.has(id));
      if (valid.length > 0) return valid;
    }
    const validSet = new Set(getStreamDefinition(selectedStream).availableSubjectIds);
    const validPreview = previewSubjects.filter((id) => validSet.has(id));
    return validPreview.length > 0
      ? validPreview
      : getDefaultSubjectsForStream(selectedStream);
  }, [isAuthenticated, session?.profile.selectedSubjects, selectedStream, previewSubjects]);

  const setSelectedStream = useCallback(
    async (stream: UPBoardStream) => {
      const nextDefaults = getDefaultSubjectsForStream(stream);
      setPreviewStream(stream);
      setPreviewSubjects(nextDefaults);
      if (isAuthenticated) {
        await updateProfile({
          selectedStream: stream,
          selectedSubjects: nextDefaults,
        });
      }
    },
    [isAuthenticated, updateProfile]
  );

  const toggleSubjectSelection = useCallback(
    async (subjectId: string) => {
      const streamDef = getStreamDefinition(selectedStream);
      if (!streamDef.availableSubjectIds.includes(subjectId)) return;

      const exists = selectedSubjects.includes(subjectId);
      if (exists && selectedSubjects.length <= 1) return;

      const next = exists
        ? selectedSubjects.filter((id) => id !== subjectId)
        : [...selectedSubjects, subjectId];

      setPreviewSubjects(next);
      if (isAuthenticated) {
        await updateProfile({
          selectedStream,
          selectedSubjects: next,
        });
      }
    },
    [selectedStream, selectedSubjects, isAuthenticated, updateProfile]
  );

  const resetStreamSubjects = useCallback(
    async (streamOverride?: UPBoardStream) => {
      const targetStream = streamOverride ?? selectedStream;
      const defaults = getDefaultSubjectsForStream(targetStream);
      setPreviewStream(targetStream);
      setPreviewSubjects(defaults);
      if (isAuthenticated) {
        await updateProfile({
          selectedStream: targetStream,
          selectedSubjects: defaults,
        });
      }
    },
    [selectedStream, isAuthenticated, updateProfile]
  );

  const persistProgressRecord = useCallback(
    async (nextRecord: StudentChapterProgress): Promise<MutationResult> => {
      if (!isAuthenticated || !activeUid) {
        setGuestPromptOpen(true);
        return { ok: false, reason: 'auth_required' };
      }

      const key = buildProgressKey(
        nextRecord.examTrack,
        nextRecord.subjectId,
        nextRecord.chapterId
      );

      const updated = { ...progressRef.current, [key]: nextRecord };
      progressRef.current = updated;
      setProgressMap(updated);

      if (!isFirebaseSession) {
        writeLocalUserProgress(activeUid, updated);
      } else {
        await saveFirebaseChapterProgress(nextRecord);
      }

      return { ok: true };
    },
    [isAuthenticated, activeUid, isFirebaseSession]
  );

  const setChapterStatus = useCallback(
    async (chapter: CurriculumChapter, status: ChapterProgressStatus): Promise<MutationResult> => {
      if (!isAuthenticated || !activeUid) {
        setGuestPromptOpen(true);
        return { ok: false, reason: 'auth_required' };
      }
      const key = buildProgressKey(chapter.examTrack, chapter.subjectId, chapter.id);
      const nextRecord = applyChapterStatusUpdate({
        uid: activeUid,
        chapter,
        status,
        streamId: chapter.examTrack === 'up-board-12' ? selectedStream : null,
        existing: progressRef.current[key],
        nowISO: new Date().toISOString(),
      });
      return persistProgressRecord(nextRecord);
    },
    [isAuthenticated, activeUid, selectedStream, persistProgressRecord]
  );

  const setChapterPracticeStatus = useCallback(
    async (chapter: CurriculumChapter, practiceStatus: PracticeStatus): Promise<MutationResult> => {
      if (!isAuthenticated || !activeUid) {
        setGuestPromptOpen(true);
        return { ok: false, reason: 'auth_required' };
      }
      const key = buildProgressKey(chapter.examTrack, chapter.subjectId, chapter.id);
      const nextRecord = applyChapterStatusUpdate({
        uid: activeUid,
        chapter,
        practiceStatus,
        streamId: chapter.examTrack === 'up-board-12' ? selectedStream : null,
        existing: progressRef.current[key],
        nowISO: new Date().toISOString(),
      });
      return persistProgressRecord(nextRecord);
    },
    [isAuthenticated, activeUid, selectedStream, persistProgressRecord]
  );

  const toggleTopicCompletion = useCallback(
    async (chapter: CurriculumChapter, topicId: string): Promise<MutationResult> => {
      if (!isAuthenticated || !activeUid) {
        setGuestPromptOpen(true);
        return { ok: false, reason: 'auth_required' };
      }
      const key = buildProgressKey(chapter.examTrack, chapter.subjectId, chapter.id);
      const nextRecord = applyTopicToggle({
        uid: activeUid,
        chapter,
        topicId,
        streamId: chapter.examTrack === 'up-board-12' ? selectedStream : null,
        existing: progressRef.current[key],
        nowISO: new Date().toISOString(),
      });
      return persistProgressRecord(nextRecord);
    },
    [isAuthenticated, activeUid, selectedStream, persistProgressRecord]
  );

  const dismissGuestPrompt = useCallback(() => setGuestPromptOpen(false), []);

  const value = useMemo<ProgressContextValue>(
    () => ({
      progressMap,
      selectedStream,
      setSelectedStream,
      selectedSubjects,
      toggleSubjectSelection,
      resetStreamSubjects,
      setChapterStatus,
      setChapterPracticeStatus,
      toggleTopicCompletion,
      guestPromptOpen,
      dismissGuestPrompt,
    }),
    [
      progressMap,
      selectedStream,
      setSelectedStream,
      selectedSubjects,
      toggleSubjectSelection,
      resetStreamSubjects,
      setChapterStatus,
      setChapterPracticeStatus,
      toggleTopicCompletion,
      guestPromptOpen,
      dismissGuestPrompt,
    ]
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
};

export function useProgress(): ProgressContextValue {
  const ctx = useContext(ProgressContext);
  if (!ctx) {
    throw new Error('useProgress must be used inside ProgressProvider');
  }
  return ctx;
}
