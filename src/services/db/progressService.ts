import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../../firebase';
import type {
  ChapterProgressStatus,
  PracticeStatus,
  StudentChapterProgress,
  UPBoardStream,
} from '../../types/curriculum';
import type { ExamTrack } from '../../types/database';
import { buildProgressKey, type ProgressMap } from '../../utils/curriculumProgress';
import { readStorageJSON, writeStorageJSON } from '../../utils/storage';

function localProgressStorageKey(uid: string): string {
  return `prepzone_progress_${uid}_v1`;
}

export function readLocalUserProgress(uid: string): ProgressMap {
  if (!uid) return {};
  return readStorageJSON<ProgressMap>(localProgressStorageKey(uid), {});
}

export function writeLocalUserProgress(uid: string, map: ProgressMap): void {
  if (!uid) return;
  writeStorageJSON(localProgressStorageKey(uid), map);
}

function normalizeTimestampToISO(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string' && val.length > 0) {
    return val;
  }
  return new Date().toISOString();
}

function parseFirestoreProgressDoc(raw: Record<string, unknown>): StudentChapterProgress | null {
  const uid = typeof raw.uid === 'string' ? raw.uid : '';
  const examTrack = raw.examTrack as ExamTrack;
  const subjectId = typeof raw.subjectId === 'string' ? raw.subjectId : '';
  const chapterId = typeof raw.chapterId === 'string' ? raw.chapterId : '';
  if (!uid || !examTrack || !subjectId || !chapterId) return null;

  return {
    id: typeof raw.id === 'string' ? raw.id : `${uid}_${examTrack}_${subjectId}_${chapterId}`,
    uid,
    examTrack,
    streamId:
      raw.streamId === 'science' || raw.streamId === 'commerce' || raw.streamId === 'arts'
        ? (raw.streamId as UPBoardStream)
        : null,
    subjectId,
    chapterId,
    status: (raw.status as ChapterProgressStatus) ?? 'not_started',
    practiceStatus: (raw.practiceStatus as PracticeStatus) ?? 'not_started',
    completedTopicIds: Array.isArray(raw.completedTopicIds)
      ? raw.completedTopicIds.map(String).slice(0, 200)
      : [],
    studyMinutesLogged: Number(raw.studyMinutesLogged ?? 0),
    completionPercent: Number(raw.completionPercent ?? 0),
    lastActivityAt: normalizeTimestampToISO(raw.lastActivityAt),
  };
}

export function subscribeFirebaseUserProgress(
  uid: string,
  onUpdate: (map: ProgressMap) => void
): () => void {
  const progressQuery = query(collection(db, 'studyProgress'), where('uid', '==', uid));
  return onSnapshot(
    progressQuery,
    (snapshot) => {
      const next: ProgressMap = {};
      snapshot.forEach((docSnap) => {
        const parsed = parseFirestoreProgressDoc(docSnap.data() as Record<string, unknown>);
        if (parsed) {
          next[buildProgressKey(parsed.examTrack, parsed.subjectId, parsed.chapterId)] = parsed;
        }
      });
      onUpdate(next);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, `studyProgress?uid=${uid}`);
    }
  );
}

export async function saveFirebaseChapterProgress(record: StudentChapterProgress): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== record.uid) {
    throw new Error('Authenticated Firebase user mismatch');
  }

  const docId = record.id.slice(0, 128);
  const docPath = `studyProgress/${docId}`;
  const ref = doc(db, 'studyProgress', docId);

  const cleanCompletedTopics = record.completedTopicIds.slice(0, 200);
  const cleanMinutes = Math.max(0, Math.min(100000, Math.round(record.studyMinutesLogged)));
  const cleanPercent = Math.max(0, Math.min(100, Math.round(record.completionPercent)));

  try {
    const existingSnap = await getDoc(ref);
    if (!existingSnap.exists()) {
      await setDoc(ref, {
        id: docId,
        uid: record.uid,
        examTrack: record.examTrack,
        streamId: record.streamId ?? null,
        subjectId: record.subjectId,
        chapterId: record.chapterId,
        status: record.status,
        practiceStatus: record.practiceStatus,
        completedTopicIds: cleanCompletedTopics,
        studyMinutesLogged: cleanMinutes,
        completionPercent: cleanPercent,
        lastActivityAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        streamId: record.streamId ?? null,
        status: record.status,
        practiceStatus: record.practiceStatus,
        completedTopicIds: cleanCompletedTopics,
        studyMinutesLogged: cleanMinutes,
        completionPercent: cleanPercent,
        lastActivityAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, docPath);
  }
}
