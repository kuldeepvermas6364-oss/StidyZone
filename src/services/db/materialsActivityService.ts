import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../../firebase';
import type { BookmarkRecord, ExamTrack } from '../../types/database';
import type { MaterialType, StudentReadingHistoryEntry } from '../../types/materials';
import { readStorageJSON, removeStorageKey, writeStorageJSON } from '../../utils/storage';

function localBookmarksKey(uid: string): string {
  return `prepzone_bookmarks_${uid}_v1`;
}

function localHistoryKey(uid: string): string {
  return `prepzone_history_${uid}_v1`;
}

export function sanitizeFirestoreId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
}

export function buildBookmarkDocId(
  uid: string,
  itemType: BookmarkRecord['itemType'],
  itemId: string
): string {
  return sanitizeFirestoreId(`${uid}_${itemType}_${itemId}`);
}

export function buildHistoryDocId(uid: string, materialId: string): string {
  return sanitizeFirestoreId(`${uid}_${materialId}`);
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

export function readLocalBookmarks(uid: string): BookmarkRecord[] {
  if (!uid) return [];
  return readStorageJSON<BookmarkRecord[]>(localBookmarksKey(uid), []);
}

export function writeLocalBookmarks(uid: string, list: BookmarkRecord[]): void {
  if (!uid) return;
  writeStorageJSON(localBookmarksKey(uid), list);
}

export function readLocalReadingHistory(uid: string): StudentReadingHistoryEntry[] {
  if (!uid) return [];
  return readStorageJSON<StudentReadingHistoryEntry[]>(localHistoryKey(uid), []);
}

export function writeLocalReadingHistory(
  uid: string,
  list: StudentReadingHistoryEntry[]
): void {
  if (!uid) return;
  writeStorageJSON(localHistoryKey(uid), list);
}

export function clearLocalReadingHistory(uid: string): void {
  if (!uid) return;
  removeStorageKey(localHistoryKey(uid));
}

export function subscribeFirebaseBookmarks(
  uid: string,
  onUpdate: (items: BookmarkRecord[]) => void
): () => void {
  const q = query(collection(db, 'bookmarks'), where('uid', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: BookmarkRecord[] = [];
      snapshot.forEach((docSnap) => {
        const raw = docSnap.data() as Record<string, unknown>;
        if (!raw.id || !raw.uid || !raw.itemType || !raw.itemId || !raw.examTrack) return;
        items.push({
          id: String(raw.id),
          uid: String(raw.uid),
          itemType: raw.itemType as BookmarkRecord['itemType'],
          itemId: String(raw.itemId),
          examTrack: raw.examTrack as ExamTrack,
          note: typeof raw.note === 'string' ? raw.note : undefined,
          createdAt: normalizeTimestampToISO(raw.createdAt),
        });
      });
      items.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
      onUpdate(items);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, `bookmarks?uid=${uid}`);
    }
  );
}

export async function saveFirebaseBookmark(record: BookmarkRecord): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== record.uid) {
    throw new Error('Authenticated Firebase user mismatch');
  }
  const docId = sanitizeFirestoreId(record.id);
  const path = `bookmarks/${docId}`;
  const ref = doc(db, 'bookmarks', docId);

  const payload: Record<string, unknown> = {
    id: docId,
    uid: record.uid,
    itemType: record.itemType,
    itemId: sanitizeFirestoreId(record.itemId),
    examTrack: record.examTrack,
    createdAt: serverTimestamp(),
  };
  if (record.note && record.note.trim()) {
    payload.note = record.note.trim().slice(0, 500);
  }

  try {
    await setDoc(ref, payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function removeFirebaseBookmark(uid: string, docId: string): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== uid) {
    throw new Error('Authenticated Firebase user mismatch');
  }
  const safeId = sanitizeFirestoreId(docId);
  const path = `bookmarks/${safeId}`;
  try {
    await deleteDoc(doc(db, 'bookmarks', safeId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export function subscribeFirebaseReadingHistory(
  uid: string,
  onUpdate: (entries: StudentReadingHistoryEntry[]) => void
): () => void {
  const q = query(collection(db, 'readingHistory'), where('uid', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: StudentReadingHistoryEntry[] = [];
      snapshot.forEach((docSnap) => {
        const raw = docSnap.data() as Record<string, unknown>;
        if (!raw.id || !raw.uid || !raw.materialId || !raw.examTrack || !raw.subjectId) return;
        items.push({
          id: String(raw.id),
          uid: String(raw.uid),
          materialId: String(raw.materialId),
          examTrack: raw.examTrack as ExamTrack,
          subjectId: String(raw.subjectId),
          chapterId: typeof raw.chapterId === 'string' ? raw.chapterId : undefined,
          materialType: String(raw.materialType || 'chapter_notes') as MaterialType,
          lastViewedPage: Math.max(1, Number(raw.lastViewedPage ?? 1)),
          totalPages: raw.totalPages ? Number(raw.totalPages) : undefined,
          lastAccessedAt: normalizeTimestampToISO(raw.lastAccessedAt),
        });
      });
      items.sort((a, b) => (b.lastAccessedAt > a.lastAccessedAt ? 1 : -1));
      onUpdate(items);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, `readingHistory?uid=${uid}`);
    }
  );
}

export async function saveFirebaseReadingHistory(
  entry: StudentReadingHistoryEntry
): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== entry.uid) {
    throw new Error('Authenticated Firebase user mismatch');
  }
  const docId = sanitizeFirestoreId(entry.id);
  const path = `readingHistory/${docId}`;
  const ref = doc(db, 'readingHistory', docId);
  const cleanPage = Math.max(1, Math.min(5000, Math.round(entry.lastViewedPage)));
  const cleanTotal =
    entry.totalPages && entry.totalPages >= 1
      ? Math.min(5000, Math.round(entry.totalPages))
      : undefined;

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const payload: Record<string, unknown> = {
        id: docId,
        uid: entry.uid,
        materialId: sanitizeFirestoreId(entry.materialId),
        examTrack: entry.examTrack,
        subjectId: sanitizeFirestoreId(entry.subjectId),
        materialType: entry.materialType.slice(0, 40),
        lastViewedPage: cleanPage,
        lastAccessedAt: serverTimestamp(),
      };
      if (entry.chapterId) payload.chapterId = sanitizeFirestoreId(entry.chapterId);
      if (cleanTotal) payload.totalPages = cleanTotal;
      await setDoc(ref, payload);
    } else {
      const updates: Record<string, unknown> = {
        lastViewedPage: cleanPage,
        lastAccessedAt: serverTimestamp(),
      };
      if (cleanTotal) updates.totalPages = cleanTotal;
      await updateDoc(ref, updates);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function clearFirebaseReadingHistory(uid: string): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== uid) {
    throw new Error('Authenticated Firebase user mismatch');
  }
  const q = query(collection(db, 'readingHistory'), where('uid', '==', uid));
  try {
    const snap = await getDocs(q);
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `readingHistory?uid=${uid}`);
  }
}
