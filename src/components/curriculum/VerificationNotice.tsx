import React from 'react';
import { AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import type { VerificationMetadata } from '../../types/curriculum';

interface VerificationNoticeProps {
  verification: VerificationMetadata;
}

export const VerificationNotice: React.FC<VerificationNoticeProps> = ({ verification }) => {
  const { language, t } = useApp();
  const isVerified = verification.verificationStatus === 'verified';

  return (
    <section
      aria-label={t('syllabus.verification.title')}
      className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            {isVerified ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                {t('syllabus.verification.verified')}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                {t('syllabus.verification.awaiting')}
              </span>
            )}
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <span className="text-slate-600 dark:text-slate-400">
              {t('syllabus.verification.session')}:{' '}
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                {verification.academicSession}
              </span>
            </span>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <span className="text-slate-600 dark:text-slate-400">
              {t('syllabus.verification.lastVerified')}:{' '}
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                {verification.lastVerifiedDate}
              </span>
            </span>
          </div>

          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            {t('syllabus.verification.source')}: {verification.sourceName[language]}
          </p>
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            {verification.notes[language]}
          </p>
        </div>

        <a
          href={verification.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-50 transition-colors whitespace-nowrap dark:border-slate-700 dark:bg-slate-800 dark:text-blue-400 dark:hover:bg-slate-700"
        >
          <span>{t('syllabus.verification.viewOfficial')}</span>
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </div>
    </section>
  );
};
