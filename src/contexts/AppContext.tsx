import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { translate } from '../i18n/translations';
import type { ExamTrack, LanguageCode } from '../types/database';
import type { AppPreferences, PlatformNotification, ThemeMode } from '../types/platform';
import { clampDailyTargetHours, DEFAULT_EXAM_DATES, isValidISODateString } from '../utils/countdown';
import { readStorageJSON, writeStorageJSON } from '../utils/storage';

const PREFS_STORAGE_KEY = 'prepzone_preferences_v1';
const NOTIFS_STORAGE_KEY = 'prepzone_notifications_v1';

const DEFAULT_PREFERENCES: AppPreferences = {
  language: 'en',
  theme: 'light',
  primaryExam: 'up-board-12',
  dailyTargetHours: 4,
  countdowns: { ...DEFAULT_EXAM_DATES },
};

const INITIAL_NOTIFICATIONS: PlatformNotification[] = [
  {
    id: 'notif-bilingual',
    titleEn: 'Bilingual Study Mode Ready',
    titleHi: 'द्विभाषी अध्ययन मोड तैयार है',
    bodyEn: 'Switch anytime between English and Hindi using the header toggle or Settings.',
    bodyHi: 'हेडर टॉगल या सेटिंग्स से कभी भी अंग्रेज़ी और हिंदी के बीच भाषा बदलें।',
    createdAtISO: '2026-11-21T07:00:00Z',
    category: 'platform',
    read: false,
    actionPath: '/settings',
  },
  {
    id: 'notif-countdown',
    titleEn: 'Customize Your Exam Dates',
    titleHi: 'अपनी परीक्षा तिथियाँ सेट करें',
    bodyEn: 'Review and adjust UP Board Class 12 and JEE Main countdown dates in Settings.',
    bodyHi: 'सेटिंग्स में यूपी बोर्ड कक्षा 12 और जेईई मेन काउंटडाउन तिथियाँ अपडेट करें।',
    createdAtISO: '2026-11-21T06:45:00Z',
    category: 'exam',
    read: false,
    actionPath: '/settings',
  },
  {
    id: 'notif-roadmap',
    titleEn: 'Prompt 2 Syllabus Rollout Next',
    titleHi: 'अगला चरण: पाठ्यक्रम मॉड्यूल',
    bodyEn: 'UP Board Class 12 & JEE Main chapter syllabi are scheduled for the next milestone.',
    bodyHi: 'यूपी बोर्ड कक्षा 12 व जेईई मेन अध्याय पाठ्यक्रम अगले चरण में जोड़े जाएँगे।',
    createdAtISO: '2026-11-21T06:30:00Z',
    category: 'platform',
    read: true,
    actionPath: '/up-board-class-12',
  },
];

interface AppContextValue {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  toggleLanguage: () => void;
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: ThemeMode) => void;
  primaryExam: ExamTrack;
  setPrimaryExam: (track: ExamTrack) => void;
  dailyTargetHours: number;
  setDailyTargetHours: (hours: number) => void;
  countdowns: Record<ExamTrack, string>;
  updateCountdowns: (next: Record<ExamTrack, string>) => void;
  resetCountdowns: () => void;
  notifications: PlatformNotification[];
  unreadCount: number;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [prefs, setPrefs] = useState<AppPreferences>(() => {
    const stored = readStorageJSON<Partial<AppPreferences>>(PREFS_STORAGE_KEY, {});
    return {
      language: stored.language === 'hi' ? 'hi' : 'en',
      theme: stored.theme === 'dark' || stored.theme === 'system' ? stored.theme : 'light',
      primaryExam:
        stored.primaryExam === 'jee-main' || stored.primaryExam === 'jee-advanced'
          ? stored.primaryExam
          : 'up-board-12',
      dailyTargetHours: clampDailyTargetHours(stored.dailyTargetHours ?? 4),
      countdowns: {
        'up-board-12': isValidISODateString(stored.countdowns?.['up-board-12'] ?? '')
          ? stored.countdowns!['up-board-12']
          : DEFAULT_EXAM_DATES['up-board-12'],
        'jee-main': isValidISODateString(stored.countdowns?.['jee-main'] ?? '')
          ? stored.countdowns!['jee-main']
          : DEFAULT_EXAM_DATES['jee-main'],
        'jee-advanced': isValidISODateString(stored.countdowns?.['jee-advanced'] ?? '')
          ? stored.countdowns!['jee-advanced']
          : DEFAULT_EXAM_DATES['jee-advanced'],
      },
    };
  });

  const [notifications, setNotifications] = useState<PlatformNotification[]>(() =>
    readStorageJSON<PlatformNotification[]>(NOTIFS_STORAGE_KEY, INITIAL_NOTIFICATIONS)
  );

  const [systemDark, setSystemDark] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const resolvedTheme: 'light' | 'dark' =
    prefs.theme === 'system' ? (systemDark ? 'dark' : 'light') : prefs.theme;

  useEffect(() => {
    writeStorageJSON(PREFS_STORAGE_KEY, prefs);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = prefs.language;
      document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
    }
  }, [prefs, resolvedTheme]);

  useEffect(() => {
    writeStorageJSON(NOTIFS_STORAGE_KEY, notifications);
  }, [notifications]);

  const setLanguage = useCallback((language: LanguageCode) => {
    setPrefs((prev) => ({ ...prev, language }));
  }, []);

  const toggleLanguage = useCallback(() => {
    setPrefs((prev) => ({ ...prev, language: prev.language === 'en' ? 'hi' : 'en' }));
  }, []);

  const setTheme = useCallback((theme: ThemeMode) => {
    setPrefs((prev) => ({ ...prev, theme }));
  }, []);

  const setPrimaryExam = useCallback((primaryExam: ExamTrack) => {
    setPrefs((prev) => ({ ...prev, primaryExam }));
  }, []);

  const setDailyTargetHours = useCallback((hours: number) => {
    setPrefs((prev) => ({ ...prev, dailyTargetHours: clampDailyTargetHours(hours) }));
  }, []);

  const updateCountdowns = useCallback((next: Record<ExamTrack, string>) => {
    setPrefs((prev) => ({
      ...prev,
      countdowns: {
        'up-board-12': isValidISODateString(next['up-board-12'])
          ? next['up-board-12']
          : prev.countdowns['up-board-12'],
        'jee-main': isValidISODateString(next['jee-main'])
          ? next['jee-main']
          : prev.countdowns['jee-main'],
        'jee-advanced': isValidISODateString(next['jee-advanced'])
          ? next['jee-advanced']
          : prev.countdowns['jee-advanced'],
      },
    }));
  }, []);

  const resetCountdowns = useCallback(() => {
    setPrefs((prev) => ({ ...prev, countdowns: { ...DEFAULT_EXAM_DATES } }));
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(prefs.language, key, vars),
    [prefs.language]
  );

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const value = useMemo<AppContextValue>(
    () => ({
      language: prefs.language,
      setLanguage,
      toggleLanguage,
      theme: prefs.theme,
      resolvedTheme,
      setTheme,
      primaryExam: prefs.primaryExam,
      setPrimaryExam,
      dailyTargetHours: prefs.dailyTargetHours,
      setDailyTargetHours,
      countdowns: prefs.countdowns,
      updateCountdowns,
      resetCountdowns,
      notifications,
      unreadCount,
      markNotificationRead,
      markAllNotificationsRead,
      t,
    }),
    [
      prefs,
      resolvedTheme,
      setLanguage,
      toggleLanguage,
      setTheme,
      setPrimaryExam,
      setDailyTargetHours,
      updateCountdowns,
      resetCountdowns,
      notifications,
      unreadCount,
      markNotificationRead,
      markAllNotificationsRead,
      t,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used inside AppProvider');
  }
  return ctx;
}
