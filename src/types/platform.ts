import type { ExamTrack, LanguageCode } from './database';

export type ThemeMode = 'light' | 'dark' | 'system';

export type ModuleCategory = 'core' | 'tracks' | 'tools' | 'account';

export type ModuleIconName =
  | 'LayoutDashboard'
  | 'GraduationCap'
  | 'Atom'
  | 'Compass'
  | 'FileText'
  | 'PlayCircle'
  | 'ClipboardCheck'
  | 'RotateCcw'
  | 'CalendarClock'
  | 'Sparkles'
  | 'BarChart3'
  | 'Bookmark'
  | 'Settings';

export interface PlatformModule {
  id: string;
  path: string;
  navOrder: number;
  category: ModuleCategory;
  icon: ModuleIconName;
  status: 'active' | 'scheduled';
  targetPrompt: string;
  titleKey: string;
  subtitleKey: string;
  plannedCapabilities: Array<{ en: string; hi: string }>;
  plannedCollections: string[];
}

export interface ExamCountdownConfig {
  id: ExamTrack;
  labelEn: string;
  labelHi: string;
  targetDateISO: string;
  noteEn: string;
  noteHi: string;
}

export interface PlatformNotification {
  id: string;
  titleEn: string;
  titleHi: string;
  bodyEn: string;
  bodyHi: string;
  createdAtISO: string;
  category: 'platform' | 'exam' | 'account';
  read: boolean;
  actionPath?: string;
}

export interface AppPreferences {
  language: LanguageCode;
  theme: ThemeMode;
  primaryExam: ExamTrack;
  dailyTargetHours: number;
  countdowns: Record<ExamTrack, string>;
}
