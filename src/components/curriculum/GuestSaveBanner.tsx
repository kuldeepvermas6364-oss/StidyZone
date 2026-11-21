import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, X } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useProgress } from '../../contexts/ProgressContext';

export const GuestSaveBanner: React.FC = () => {
  const { t } = useApp();
  const { guestPromptOpen, dismissGuestPrompt } = useProgress();

  if (!guestPromptOpen) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50/70 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-blue-900 dark:bg-blue-950/40"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
          <Lock className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <p className="font-display text-sm font-bold text-slate-900 dark:text-white">
            {t('syllabus.guestPrompt.title')}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {t('syllabus.guestPrompt.body')}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <Link
          to="/login"
          onClick={dismissGuestPrompt}
          className="inline-flex h-9 items-center justify-center rounded-lg bg-blue-600 px-3.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap"
        >
          {t('syllabus.guestPrompt.signIn')}
        </Link>
        <Link
          to="/register"
          onClick={dismissGuestPrompt}
          className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          {t('syllabus.guestPrompt.register')}
        </Link>
        <button
          type="button"
          onClick={dismissGuestPrompt}
          aria-label={t('syllabus.guestPrompt.dismiss')}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
