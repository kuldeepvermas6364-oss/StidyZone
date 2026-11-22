import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import {
  getActiveAuthSession,
  registerStudentAccount,
  signInStudentWithEmail,
  signOutStudent,
  updateStudentProfileSession,
  type AuthSession,
  type LoginInput,
  type RegisterInput,
} from '../services/auth/authService';
import {
  clearServerSessionToken,
  ensureFoundationServerToken,
} from '../services/auth/serverAuthToken';
import type { StudentProfileRecord, UserRecord } from '../types/database';

interface AuthContextValue {
  session: AuthSession | null;
  authReady: boolean;
  isAuthenticated: boolean;
  signIn: (input: LoginInput) => AuthSession;
  register: (input: RegisterInput) => AuthSession;
  signInWithGoogle: () => Promise<AuthSession>;
  updateProfile: (
    updates: Partial<
      Pick<
        StudentProfileRecord,
        | 'fullName'
        | 'primaryExam'
        | 'selectedStream'
        | 'selectedSubjects'
        | 'studyMedium'
        | 'preferredLanguage'
        | 'schoolOrCoaching'
        | 'district'
      >
    >
  ) => Promise<AuthSession | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function clampString(val: string | null | undefined, max: number, fallback = ''): string {
  const s = (val ?? '').trim();
  if (!s) return fallback;
  return s.slice(0, max);
}

async function ensureFirebaseUserDocs(fbUser: FirebaseUser): Promise<AuthSession> {
  const uid = fbUser.uid;
  const email = clampString(fbUser.email, 254, `${uid}@prepzone.local`);
  const displayName = clampString(fbUser.displayName, 100, 'PrepZone Student');
  const fullName = displayName.length >= 2 ? displayName : 'PrepZone Student';
  const photoURL = fbUser.photoURL ? fbUser.photoURL.slice(0, 500) : null;

  const userPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);

  try {
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid,
        email,
        displayName,
        photoURL,
        provider: 'google.com',
        emailVerified: Boolean(fbUser.emailVerified),
        role: 'student',
        disabled: false,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userRef, {
        displayName,
        photoURL,
        emailVerified: Boolean(fbUser.emailVerified),
        lastLoginAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }

  const profilePath = `profiles/${uid}`;
  const profileRef = doc(db, 'profiles', uid);
  let profileData: StudentProfileRecord | null = null;

  try {
    const profileSnap = await getDoc(profileRef);
    if (!profileSnap.exists()) {
      await setDoc(profileRef, {
        uid,
        fullName,
        primaryExam: 'up-board-12',
        preferredLanguage: 'en',
        studyMedium: 'bilingual',
        dailyStudyTargetMinutes: 240,
        boardRollTargetYear: 2027,
        jeeTargetYear: 2027,
        updatedAt: serverTimestamp(),
      });
      profileData = {
        uid,
        fullName,
        targetExams: ['up-board-12'],
        primaryExam: 'up-board-12',
        preferredLanguage: 'en',
        studyMedium: 'bilingual',
        dailyStudyTargetMinutes: 240,
        boardRollTargetYear: 2027,
        jeeTargetYear: 2027,
        updatedAt: new Date().toISOString(),
      };
    } else {
      const raw = profileSnap.data();
      profileData = {
        uid,
        fullName: String(raw.fullName || fullName),
        targetExams: [raw.primaryExam || 'up-board-12'],
        primaryExam: raw.primaryExam || 'up-board-12',
        selectedStream:
          raw.selectedStream === 'commerce' || raw.selectedStream === 'arts'
            ? raw.selectedStream
            : 'science',
        selectedSubjects: Array.isArray(raw.selectedSubjects)
          ? raw.selectedSubjects.map(String).slice(0, 15)
          : undefined,
        preferredLanguage: raw.preferredLanguage === 'hi' ? 'hi' : 'en',
        studyMedium: raw.studyMedium || 'bilingual',
        dailyStudyTargetMinutes: Number(raw.dailyStudyTargetMinutes || 240),
        boardRollTargetYear: Number(raw.boardRollTargetYear || 2027),
        jeeTargetYear: Number(raw.jeeTargetYear || 2027),
        schoolOrCoaching: raw.schoolOrCoaching,
        district: raw.district,
        updatedAt: new Date().toISOString(),
      };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, profilePath);
  }

  const nowISO = new Date().toISOString();
  const userRecord: UserRecord = {
    uid,
    email,
    displayName,
    photoURL,
    provider: 'google.com',
    emailVerified: Boolean(fbUser.emailVerified),
    role: 'student',
    createdAt: nowISO,
    lastLoginAt: nowISO,
    disabled: false,
  };

  return {
    user: userRecord,
    profile: profileData!,
    mode: 'firebase',
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<AuthSession | null>(() => getActiveAuthSession());
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      if (!fbUser) {
        setSession((prev) => (prev?.mode === 'firebase' ? null : prev));
        setAuthReady(true);
        return;
      }

      try {
        const nextSession = await ensureFirebaseUserDocs(fbUser);
        setSession(nextSession);
        setAuthReady(true);

        const profilePath = `profiles/${fbUser.uid}`;
        unsubProfile = onSnapshot(
          doc(db, 'profiles', fbUser.uid),
          (snap) => {
            if (!snap.exists()) return;
            const raw = snap.data();
            setSession((prev) => {
              if (!prev || prev.user.uid !== fbUser.uid) return prev;
              return {
                ...prev,
                profile: {
                  ...prev.profile,
                  fullName: String(raw.fullName || prev.profile.fullName),
                  primaryExam: raw.primaryExam || prev.profile.primaryExam,
                  selectedStream:
                    raw.selectedStream === 'commerce' || raw.selectedStream === 'arts'
                      ? raw.selectedStream
                      : raw.selectedStream === 'science'
                      ? 'science'
                      : prev.profile.selectedStream,
                  selectedSubjects: Array.isArray(raw.selectedSubjects)
                    ? raw.selectedSubjects.map(String).slice(0, 15)
                    : prev.profile.selectedSubjects,
                  preferredLanguage: raw.preferredLanguage === 'hi' ? 'hi' : 'en',
                  studyMedium: raw.studyMedium || prev.profile.studyMedium,
                  dailyStudyTargetMinutes: Number(
                    raw.dailyStudyTargetMinutes || prev.profile.dailyStudyTargetMinutes
                  ),
                },
              };
            });
          },
          (err) => {
            handleFirestoreError(err, OperationType.GET, profilePath);
          }
        );
      } catch (err) {
        console.error('Auth sync error:', err);
        setAuthReady(true);
      }
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  useEffect(() => {
    if (session?.mode === 'local-foundation') {
      void ensureFoundationServerToken(session.user.uid, session.user.email);
    } else if (!session) {
      clearServerSessionToken();
    }
  }, [session]);

  const signIn = useCallback((input: LoginInput) => {
    const next = signInStudentWithEmail(input);
    setSession(next);
    if (next.mode === 'local-foundation') {
      void ensureFoundationServerToken(next.user.uid, next.user.email);
    }
    return next;
  }, []);

  const register = useCallback((input: RegisterInput) => {
    const next = registerStudentAccount(input);
    setSession(next);
    if (next.mode === 'local-foundation') {
      void ensureFoundationServerToken(next.user.uid, next.user.email);
    }
    return next;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const cred = await signInWithPopup(auth, googleProvider);
    const next = await ensureFirebaseUserDocs(cred.user);
    setSession(next);
    return next;
  }, []);

  const updateProfile = useCallback(
    async (
      updates: Partial<
        Pick<
          StudentProfileRecord,
          | 'fullName'
          | 'primaryExam'
          | 'selectedStream'
          | 'selectedSubjects'
          | 'studyMedium'
          | 'preferredLanguage'
          | 'schoolOrCoaching'
          | 'district'
        >
      >
    ) => {
      if (session?.mode === 'firebase' && auth.currentUser) {
        const uid = auth.currentUser.uid;
        const profilePath = `profiles/${uid}`;
        const cleanUpdates: Record<string, unknown> = {
          updatedAt: serverTimestamp(),
        };
        if (updates.fullName !== undefined) {
          cleanUpdates.fullName = clampString(updates.fullName, 100, session.profile.fullName);
        }
        if (updates.primaryExam !== undefined) cleanUpdates.primaryExam = updates.primaryExam;
        if (updates.selectedStream !== undefined) {
          cleanUpdates.selectedStream = updates.selectedStream;
        }
        if (updates.selectedSubjects !== undefined) {
          cleanUpdates.selectedSubjects = updates.selectedSubjects.slice(0, 15);
        }
        if (updates.studyMedium !== undefined) cleanUpdates.studyMedium = updates.studyMedium;
        if (updates.preferredLanguage !== undefined) {
          cleanUpdates.preferredLanguage = updates.preferredLanguage;
        }
        if (updates.schoolOrCoaching !== undefined) {
          cleanUpdates.schoolOrCoaching = clampString(updates.schoolOrCoaching, 150);
        }
        if (updates.district !== undefined) {
          cleanUpdates.district = clampString(updates.district, 100);
        }

        try {
          await updateDoc(doc(db, 'profiles', uid), cleanUpdates);
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, profilePath);
        }

        const nextSession: AuthSession = {
          ...session,
          profile: {
            ...session.profile,
            ...updates,
            fullName: clampString(updates.fullName, 100, session.profile.fullName),
            updatedAt: new Date().toISOString(),
          },
        };
        setSession(nextSession);
        return nextSession;
      }

      const next = updateStudentProfileSession(updates);
      setSession(next);
      return next;
    },
    [session]
  );

  const signOut = useCallback(async () => {
    clearServerSessionToken();
    signOutStudent();
    if (auth.currentUser) {
      await firebaseSignOut(auth);
    }
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      authReady,
      isAuthenticated: !!session,
      signIn,
      register,
      signInWithGoogle,
      updateProfile,
      signOut,
    }),
    [session, authReady, signIn, register, signInWithGoogle, updateProfile, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
