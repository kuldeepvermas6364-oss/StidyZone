import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { auth } from '../firebase';
import {
  buildBookmarkDocId,
  buildHistoryDocId,
  clearFirebaseReadingHistory,
  clearLocalReadingHistory,
  readLocalBookmarks,
  readLocalReadingHistory,
  removeFirebaseBookmark,
  sanitizeFirestoreId,
  saveFirebaseBookmark,
  saveFirebaseReadingHistory,
  subscribeFirebaseBookmarks,
  subscribeFirebaseReadingHistory,
  writeLocalBookmarks,
  writeLocalReadingHistory,
} from '../services/db/materialsActivityService';
import type { BookmarkRecord, ExamTrack } from '../types/database';
import type { LibraryMaterial, StudentReadingHistoryEntry } from '../types/materials';
import { useAuth } from './AuthContext';

interface MaterialsContextValue {
  historyReady: boolean;
  bookmarks: BookmarkRecord[];
  readingHistory: StudentReadingHistoryEntry[];
  isBookmarked: (itemType: BookmarkRecord['itemType'], itemId: string) => boolean;
  toggleBookmark: (input: {
    itemType: BookmarkRecord['itemType'];
    itemId: string;
    examTrack: ExamTrack;
    note?: string;
  }) => Promise<{ ok: boolean; saved: boolean; requiresAuth?: boolean }>;
  removeBookmarkById: (bookmarkId: string) => Promise<void>;
  getMaterialProgress: (materialId: string) => StudentReadingHistoryEntry | undefined;
  recordMaterialOpen: (material: LibraryMaterial, page?: number, totalPages?: number) => Promise<void>;
  updatePdfPageProgress: (
    material: LibraryMaterial,
    page: number,
    totalPages?: number
  ) => Promise<void>;
  clearReadingHistory: () => Promise<void>;
}

const MaterialsContext = createContext<MaterialsContextValue | undefined>(undefined);

const GUEST_SESSION_HISTORY_LIMIT = 10;

export const MaterialsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, session } = useAuth();
  const uid = session?.user.uid ?? null;
  const isFirebaseSession = session?.mode === 'firebase' && !!auth.currentUser;

  const [bookmarks, setBookmarks] = useState<BookmarkRecord[]>(() =>
    uid && isAuthenticated && !isFirebaseSession ? readLocalBookmarks(uid) : []
  );
  const [readingHistory, setReadingHistory] = useState<StudentReadingHistoryEntry[]>(() =>
    uid && isAuthenticated && !isFirebaseSession ? readLocalReadingHistory(uid) : []
  );
  const [historyReady, setHistoryReady] = useState<boolean>(
    () => !(uid && isAuthenticated && isFirebaseSession)
  );

  useEffect(() => {
    if (!uid || !isAuthenticated) {
      setBookmarks([]);
      setReadingHistory([]);
      setHistoryReady(true);
      return;
    }

    if (isFirebaseSession) {
      setHistoryReady(false);
      const unsubBm = subscribeFirebaseBookmarks(uid, (items) => setBookmarks(items));
      const unsubHist = subscribeFirebaseReadingHistory(uid, (entries) => {
        setReadingHistory(entries);
        setHistoryReady(true);
      });
      return () => {
        unsubBm();
        unsubHist();
      };
    }

    setBookmarks(readLocalBookmarks(uid));
    setReadingHistory(readLocalReadingHistory(uid));
    setHistoryReady(true);
    return undefined;
  }, [uid, isAuthenticated, isFirebaseSession]);

  const isBookmarked = useCallback(
    (itemType: BookmarkRecord['itemType'], itemId: string): boolean => {
      const cleanId = sanitizeFirestoreId(itemId);
      return bookmarks.some(
        (b) => b.itemType === itemType && (b.itemId === itemId || b.itemId === cleanId)
      );
    },
    [bookmarks]
  );

  const toggleBookmark = useCallback(
    async (input: {
      itemType: BookmarkRecord['itemType'];
      itemId: string;
      examTrack: ExamTrack;
      note?: string;
    }): Promise<{ ok: boolean; saved: boolean; requiresAuth?: boolean }> => {
      if (!isAuthenticated || !uid) {
        return { ok: false, saved: false, requiresAuth: true };
      }

      const cleanItemId = sanitizeFirestoreId(input.itemId);
      const existing = bookmarks.find(
        (b) => b.itemType === input.itemType && (b.itemId === input.itemId || b.itemId === cleanItemId)
      );

      if (existing) {
        const nextList = bookmarks.filter((b) => b.id !== existing.id);
        setBookmarks(nextList);
        if (isFirebaseSession) {
          await removeFirebaseBookmark(uid, existing.id);
        } else {
          writeLocalBookmarks(uid, nextList);
        }
        return { ok: true, saved: false };
      }

      const record: BookmarkRecord = {
        id: buildBookmarkDocId(uid, input.itemType, input.itemId),
        uid,
        itemType: input.itemType,
        itemId: cleanItemId,
        examTrack: input.examTrack,
        note: input.note?.trim() || undefined,
        createdAt: new Date().toISOString(),
      };

      const nextList = [record, ...bookmarks];
      setBookmarks(nextList);
      if (isFirebaseSession) {
        await saveFirebaseBookmark(record);
      } else {
        writeLocalBookmarks(uid, nextList);
      }
      return { ok: true, saved: true };
    },
    [isAuthenticated, uid, bookmarks, isFirebaseSession]
  );

  const removeBookmarkById = useCallback(
    async (bookmarkId: string) => {
      if (!uid || !isAuthenticated) return;
      const nextList = bookmarks.filter((b) => b.id !== bookmarkId);
      setBookmarks(nextList);
      if (isFirebaseSession) {
        await removeFirebaseBookmark(uid, bookmarkId);
      } else {
        writeLocalBookmarks(uid, nextList);
      }
    },
    [uid, isAuthenticated, bookmarks, isFirebaseSession]
  );

  const getMaterialProgress = useCallback(
    (materialId: string) => {
      const cleanId = sanitizeFirestoreId(materialId);
      return readingHistory.find(
        (h) => h.materialId === materialId || h.materialId === cleanId
      );
    },
    [readingHistory]
  );

  const upsertHistory = useCallback(
    async (material: LibraryMaterial, page: number | undefined, totalPages?: number) => {
      const activeUid = uid ?? 'guest_session';
      const cleanMaterialId = sanitizeFirestoreId(material.id);
      const existing = readingHistory.find(
        (h) => h.materialId === material.id || h.materialId === cleanMaterialId
      );
      const cleanPage =
        page !== undefined ? Math.max(1, page) : (existing?.lastViewedPage ?? 1);
      const resolvedTotal = totalPages ?? existing?.totalPages ?? material.pageCount;

      const entry: StudentReadingHistoryEntry = {
        id: buildHistoryDocId(activeUid, material.id),
        uid: activeUid,
        materialId: cleanMaterialId,
        examTrack: material.examTrack,
        subjectId: sanitizeFirestoreId(material.subjectId),
        chapterId: material.chapterId ? sanitizeFirestoreId(material.chapterId) : undefined,
        materialType: material.materialType,
        lastViewedPage: cleanPage,
        totalPages: resolvedTotal,
        lastAccessedAt: new Date().toISOString(),
      };

      const nextList = [
        entry,
        ...readingHistory.filter(
          (h) => h.materialId !== material.id && h.materialId !== cleanMaterialId
        ),
      ].slice(0, isAuthenticated ? 40 : GUEST_SESSION_HISTORY_LIMIT);

      setReadingHistory(nextList);

      if (!isAuthenticated || !uid) {
        return; // Guest session only holds non-persistent in-memory list; never mutates saved accounts
      }

      if (isFirebaseSession) {
        await saveFirebaseReadingHistory(entry);
      } else {
        writeLocalReadingHistory(uid, nextList);
      }
    },
    [uid, readingHistory, isAuthenticated, isFirebaseSession]
  );

  const recordMaterialOpen = useCallback(
    async (material: LibraryMaterial, page?: number, totalPages?: number) => {
      await upsertHistory(material, page, totalPages);
    },
    [upsertHistory]
  );

  const updatePdfPageProgress = useCallback(
    async (material: LibraryMaterial, page: number, totalPages?: number) => {
      await upsertHistory(material, page, totalPages);
    },
    [upsertHistory]
  );

  const clearReadingHistory = useCallback(async () => {
    setReadingHistory([]);
    if (!uid || !isAuthenticated) return;
    if (isFirebaseSession) {
      await clearFirebaseReadingHistory(uid);
    } else {
      clearLocalReadingHistory(uid);
    }
  }, [uid, isAuthenticated, isFirebaseSession]);

  const value = useMemo<MaterialsContextValue>(
    () => ({
      historyReady,
      bookmarks,
      readingHistory,
      isBookmarked,
      toggleBookmark,
      removeBookmarkById,
      getMaterialProgress,
      recordMaterialOpen,
      updatePdfPageProgress,
      clearReadingHistory,
    }),
    [
      historyReady,
      bookmarks,
      readingHistory,
      isBookmarked,
      toggleBookmark,
      removeBookmarkById,
      getMaterialProgress,
      recordMaterialOpen,
      updatePdfPageProgress,
      clearReadingHistory,
    ]
  );

  return <MaterialsContext.Provider value={value}>{children}</MaterialsContext.Provider>;
};

export function useMaterials(): MaterialsContextValue {
  const ctx = useContext(MaterialsContext);
  if (!ctx) {
    throw new Error('useMaterials must be used inside MaterialsProvider');
  }
  return ctx;
}
