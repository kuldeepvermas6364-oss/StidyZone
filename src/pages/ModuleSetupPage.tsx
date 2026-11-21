import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Database, Layers } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import type { PlatformModule } from '../types/platform';
import { ModuleIcon } from '../components/common/ModuleIcon';

interface ModuleSetupPageProps {
  module: PlatformModule;
}

const ModuleSetupPage: React.FC<ModuleSetupPageProps> = ({ module }) => {
  const { language, t } = useApp();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <ModuleIcon name={module.icon} className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                {t('modules.status.scheduled')} · {module.targetPrompt}
              </p>
              <h1 className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-white">
                {t(module.titleKey)}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {t(module.subtitleKey)}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
          {t('modules.noFakeNote')}
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2">
          <div>
            <h2 className="flex items-center gap-2 font-display text-sm font-bold text-slate-900 dark:text-white">
              <Layers className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              <span>{t('modules.plannedCapabilities')}</span>
            </h2>
            <ul className="mt-4 space-y-3">
              {module.plannedCapabilities.map((cap, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300"
                >
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"
                    aria-hidden="true"
                  />
                  <span>{language === 'hi' ? cap.hi : cap.en}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="flex items-center gap-2 font-display text-sm font-bold text-slate-900 dark:text-white">
              <Database className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              <span>{t('modules.dataArchitecture')}</span>
            </h2>
            <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {module.plannedCollections.join(' · ')}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                <span>{t('modules.backToDashboard')}</span>
              </Link>
              <Link
                to="/settings"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                <span>{t('modules.configureInSettings')}</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ModuleSetupPage;
