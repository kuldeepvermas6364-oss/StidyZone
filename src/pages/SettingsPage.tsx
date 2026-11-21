import React, { useState } from 'react';
import { Check, Database, Globe, Monitor, Moon, Sun } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { getFirebaseServiceReadiness } from '../services/firebase/client';
import type { ExamTrack as ExamTrackType } from '../types/database';
import type { ThemeMode as ThemeModeType } from '../types/platform';
import { isValidISODateString } from '../utils/countdown';

const SettingsPage: React.FC = () => {
  const {
    language,
    setLanguage,
    theme,
    setTheme,
    primaryExam,
    setPrimaryExam,
    dailyTargetHours,
    setDailyTargetHours,
    countdowns,
    updateCountdowns,
    resetCountdowns,
    t,
  } = useApp();

  const [dateInputs, setDateInputs] = useState<Record<ExamTrackType, string>>(countdowns);
  const [datesSaved, setDatesSaved] = useState(false);

  const firebaseReadiness = getFirebaseServiceReadiness();

  const handleSaveDates = (e: React.FormEvent) => {
    e.preventDefault();
    updateCountdowns(dateInputs);
    setDatesSaved(true);
    window.setTimeout(() => setDatesSaved(false), 3000);
  };

  const handleResetDates = () => {
    resetCountdowns();
    setDateInputs({
      'up-board-12': '2027-02-24',
      'jee-main': '2027-01-22',
      'jee-advanced': '2027-05-23',
    });
    setDatesSaved(true);
    window.setTimeout(() => setDatesSaved(false), 3000);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          {t('settings.title')}
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {t('modules.settings.subtitle')}
        </p>
      </div>

      {/* Language & Theme */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2.5">
            <Globe className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
              {t('settings.language.title')}
            </h2>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {t('settings.language.desc')}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setLanguage('en')}
              aria-pressed={language === 'en'}
              className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
                language === 'en'
                  ? 'bg-white text-blue-700 shadow-xs dark:bg-slate-900 dark:text-blue-300'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLanguage('hi')}
              aria-pressed={language === 'hi'}
              className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
                language === 'hi'
                  ? 'bg-white text-blue-700 shadow-xs dark:bg-slate-900 dark:text-blue-300'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              हिन्दी
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2.5">
            <Sun className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
              {t('settings.theme.title')}
            </h2>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {t('settings.theme.desc')}
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            {(
              [
                { id: 'light', label: t('settings.theme.light'), icon: <Sun className="h-3.5 w-3.5" /> },
                { id: 'dark', label: t('settings.theme.dark'), icon: <Moon className="h-3.5 w-3.5" /> },
                { id: 'system', label: t('settings.theme.system'), icon: <Monitor className="h-3.5 w-3.5" /> },
              ] as Array<{ id: ThemeModeType; label: string; icon: React.ReactNode }>
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTheme(opt.id)}
                aria-pressed={theme === opt.id}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                  theme === opt.id
                    ? 'bg-white text-blue-700 shadow-xs dark:bg-slate-900 dark:text-blue-300'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {opt.icon}
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* Study Target & Primary Exam */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
          {t('settings.study.title')}
        </h2>

        <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="settings-daily-target"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              {t('settings.study.dailyGoal')}
            </label>
            <input
              id="settings-daily-target"
              type="number"
              min={1}
              max={16}
              step={0.5}
              value={dailyTargetHours}
              onChange={(e) => setDailyTargetHours(Number(e.target.value))}
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label
              htmlFor="settings-primary-exam"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              {t('settings.study.primaryTrack')}
            </label>
            <select
              id="settings-primary-exam"
              value={primaryExam}
              onChange={(e) => setPrimaryExam(e.target.value as ExamTrackType)}
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="up-board-12">{t('nav.upBoard12')}</option>
              <option value="jee-main">{t('nav.jeeMain')}</option>
              <option value="jee-advanced">{t('nav.jeeAdvanced')}</option>
            </select>
          </div>
        </div>
      </section>

      {/* Exam Countdown Dates */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
          {t('settings.dates.title')}
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {t('settings.dates.desc')}
        </p>

        <form onSubmit={handleSaveDates} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {(
              [
                { id: 'up-board-12', label: t('nav.upBoard12') },
                { id: 'jee-main', label: t('nav.jeeMain') },
                { id: 'jee-advanced', label: t('nav.jeeAdvanced') },
              ] as Array<{ id: ExamTrackType; label: string }>
            ).map((field) => (
              <div key={field.id}>
                <label
                  htmlFor={`date-${field.id}`}
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  {field.label}
                </label>
                <input
                  id={`date-${field.id}`}
                  type="date"
                  value={dateInputs[field.id]}
                  onChange={(e) =>
                    setDateInputs((prev) => ({ ...prev, [field.id]: e.target.value }))
                  }
                  required
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={
                !isValidISODateString(dateInputs['up-board-12']) ||
                !isValidISODateString(dateInputs['jee-main']) ||
                !isValidISODateString(dateInputs['jee-advanced'])
              }
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              <span>{t('settings.dates.save')}</span>
            </button>
            <button
              type="button"
              onClick={handleResetDates}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <span>{t('settings.dates.reset')}</span>
            </button>
            {datesSaved && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                <Check className="h-4 w-4" aria-hidden="true" />
                {t('settings.dates.saved')}
              </span>
            )}
          </div>
        </form>
      </section>

      {/* Firebase & PWA Readiness */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2.5">
          <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
            {t('settings.infra.title')}
          </h2>
        </div>

        <dl className="mt-4 divide-y divide-slate-100 text-sm dark:divide-slate-800">
          <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
            <dt className="font-medium text-slate-700 dark:text-slate-300">
              {t('settings.infra.firebaseStatus')}
            </dt>
            <dd className="font-mono text-xs font-medium text-emerald-700 dark:text-emerald-400">
              {firebaseReadiness.configured
                ? t('settings.infra.configured', {
                    projectId: firebaseReadiness.projectId ?? 'configured',
                  })
                : t('settings.infra.notConfigured')}
            </dd>
          </div>
          {firebaseReadiness.firestoreDatabaseId && (
            <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
              <dt className="font-medium text-slate-700 dark:text-slate-300">
                {t('settings.infra.firestoreDbLabel')}
              </dt>
              <dd className="font-mono text-xs text-slate-600 dark:text-slate-400">
                {firebaseReadiness.firestoreDatabaseId}
              </dd>
            </div>
          )}
          <div className="flex flex-col gap-1 py-3">
            <dt className="font-medium text-slate-700 dark:text-slate-300">
              {t('settings.infra.pwaStatus')}
            </dt>
            <dd className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              {t('settings.infra.pwaDesc')}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
};

export default SettingsPage;
