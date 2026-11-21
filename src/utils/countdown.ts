import type { ExamTrack } from '../types/database';

export interface CountdownBreakdown {
  days: number;
  hours: number;
  minutes: number;
  isPast: boolean;
  isValid: boolean;
}

export const DEFAULT_EXAM_DATES: Record<ExamTrack, string> = {
  'up-board-12': '2027-02-24',
  'jee-main': '2027-01-22',
  'jee-advanced': '2027-05-23',
};

export function isValidISODateString(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  const parsed = new Date(Date.UTC(y, m - 1, d));
  return (
    parsed.getUTCFullYear() === y &&
    parsed.getUTCMonth() === m - 1 &&
    parsed.getUTCDate() === d
  );
}

export function calculateExamCountdown(
  targetDateISO: string,
  nowMs: number = Date.now()
): CountdownBreakdown {
  if (!isValidISODateString(targetDateISO)) {
    return { days: 0, hours: 0, minutes: 0, isPast: false, isValid: false };
  }

  const [y, m, d] = targetDateISO.split('-').map(Number);
  // Target 09:00 IST (03:30 UTC) on exam day
  const targetMs = Date.UTC(y, m - 1, d, 3, 30, 0);
  const diffMs = targetMs - nowMs;

  if (diffMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, isPast: true, isValid: true };
  }

  const totalMinutes = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  return { days, hours, minutes, isPast: false, isValid: true };
}

export function clampDailyTargetHours(hours: number): number {
  if (!Number.isFinite(hours)) return 4;
  return Math.min(16, Math.max(1, Math.round(hours * 2) / 2));
}
