import React from 'react';
import type { QuestionDiagram } from '../../types/assessment';
import type { LanguageCode } from '../../types/database';

interface QuestionDiagramViewProps {
  diagram: QuestionDiagram;
  language: LanguageCode;
}

export const QuestionDiagramView: React.FC<QuestionDiagramViewProps> = ({ diagram, language }) => {
  if (diagram.kind === 'table') {
    return (
      <figure className="my-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-800/40">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-100/80 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <tr>
                {diagram.headers.map((h, i) => (
                  <th key={i} className="px-3 py-2 font-semibold whitespace-nowrap">
                    {h[language]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono tabular-nums text-slate-800 dark:divide-slate-700 dark:text-slate-200">
              {diagram.rows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 whitespace-nowrap">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <figcaption className="border-t border-slate-200 px-3 py-1.5 text-[11px] font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">
          {diagram.caption[language]}
        </figcaption>
      </figure>
    );
  }

  return (
    <figure className="my-3 flex flex-col items-center rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-slate-800 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-200">
      {diagram.presetId === 'wheatstone_bridge' && (
        <svg viewBox="0 0 320 180" className="h-44 w-full max-w-xs" role="img" aria-label={diagram.caption[language]}>
          <line x1="40" y1="90" x2="160" y2="25" stroke="currentColor" strokeWidth="2" />
          <line x1="160" y1="25" x2="280" y2="90" stroke="currentColor" strokeWidth="2" />
          <line x1="40" y1="90" x2="160" y2="155" stroke="currentColor" strokeWidth="2" />
          <line x1="160" y1="155" x2="280" y2="90" stroke="currentColor" strokeWidth="2" />
          <line x1="160" y1="25" x2="160" y2="155" stroke="#2563eb" strokeWidth="2" strokeDasharray="4 3" />
          <circle cx="160" cy="90" r="16" fill="#eff6ff" stroke="#2563eb" strokeWidth="2" />
          <text x="160" y="95" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#1d4ed8">G</text>
          <text x="90" y="50" fontSize="12" fontWeight="bold" fill="currentColor">P</text>
          <text x="225" y="50" fontSize="12" fontWeight="bold" fill="currentColor">Q</text>
          <text x="90" y="138" fontSize="12" fontWeight="bold" fill="currentColor">R</text>
          <text x="225" y="138" fontSize="12" fontWeight="bold" fill="currentColor">S</text>
          <circle cx="40" cy="90" r="4" fill="#2563eb" />
          <circle cx="280" cy="90" r="4" fill="#2563eb" />
          <text x="24" y="94" fontSize="11" fill="currentColor">A</text>
          <text x="290" y="94" fontSize="11" fill="currentColor">C</text>
        </svg>
      )}

      {diagram.presetId === 'convex_lens_ray' && (
        <svg viewBox="0 0 340 160" className="h-40 w-full max-w-sm" role="img" aria-label={diagram.caption[language]}>
          <line x1="15" y1="80" x2="325" y2="80" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 3" />
          <path d="M 165 20 Q 190 80 165 140 Q 140 80 165 20 Z" fill="#dbeafe" fillOpacity="0.45" stroke="#2563eb" strokeWidth="2" />
          <line x1="40" y1="80" x2="165" y2="42" stroke="#0f172a" className="dark:stroke-slate-100" strokeWidth="2" />
          <line x1="165" y1="42" x2="290" y2="80" stroke="#2563eb" strokeWidth="2" />
          <line x1="165" y1="42" x2="245" y2="80" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3 3" />
          <circle cx="40" cy="80" r="4" fill="#0f172a" className="dark:fill-white" />
          <circle cx="245" cy="80" r="3.5" fill="#94a3b8" />
          <circle cx="290" cy="80" r="4" fill="#2563eb" />
          <text x="36" y="98" fontSize="12" fontWeight="bold" fill="currentColor">O</text>
          <text x="155" y="15" fontSize="11" fontWeight="bold" fill="#2563eb">R1, R2</text>
          <text x="241" y="98" fontSize="11" fill="currentColor">I1</text>
          <text x="286" y="98" fontSize="12" fontWeight="bold" fill="#2563eb">I</text>
        </svg>
      )}

      {diagram.presetId === 'pv_carnot_cycle' && (
        <svg viewBox="0 0 300 180" className="h-44 w-full max-w-xs" role="img" aria-label={diagram.caption[language]}>
          <line x1="40" y1="20" x2="40" y2="150" stroke="currentColor" strokeWidth="2" />
          <line x1="40" y1="150" x2="275" y2="150" stroke="currentColor" strokeWidth="2" />
          <text x="22" y="28" fontSize="12" fontWeight="bold" fill="currentColor">P</text>
          <text x="265" y="166" fontSize="12" fontWeight="bold" fill="currentColor">V</text>
          <path d="M 75 45 Q 125 65 180 75 Q 200 112 225 128 Q 160 115 110 105 Q 92 75 75 45 Z" fill="#dbeafe" fillOpacity="0.45" stroke="#2563eb" strokeWidth="2" />
          <text x="70" y="38" fontSize="11" fontWeight="bold" fill="currentColor">A</text>
          <text x="184" y="72" fontSize="11" fontWeight="bold" fill="currentColor">B (T1)</text>
          <text x="230" y="132" fontSize="11" fontWeight="bold" fill="currentColor">C</text>
          <text x="92" y="118" fontSize="11" fontWeight="bold" fill="currentColor">D (T2)</text>
        </svg>
      )}

      {diagram.presetId === 'young_double_slit' && (
        <svg viewBox="0 0 330 165" className="h-40 w-full max-w-sm" role="img" aria-label={diagram.caption[language]}>
          <line x1="70" y1="20" x2="70" y2="62" stroke="currentColor" strokeWidth="4" />
          <line x1="70" y1="74" x2="70" y2="96" stroke="currentColor" strokeWidth="4" />
          <line x1="70" y1="108" x2="70" y2="150" stroke="currentColor" strokeWidth="4" />
          <line x1="270" y1="15" x2="270" y2="150" stroke="currentColor" strokeWidth="3" />
          <line x1="70" y1="68" x2="270" y2="42" stroke="#2563eb" strokeWidth="1.8" />
          <line x1="70" y1="102" x2="270" y2="42" stroke="#2563eb" strokeWidth="1.8" strokeDasharray="4 3" />
          <line x1="70" y1="85" x2="270" y2="85" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
          <text x="48" y="70" fontSize="11" fontWeight="bold" fill="currentColor">S1</text>
          <text x="48" y="106" fontSize="11" fontWeight="bold" fill="currentColor">S2</text>
          <text x="54" y="88" fontSize="11" fill="#2563eb">d</text>
          <text x="165" y="138" fontSize="11" fontWeight="bold" fill="currentColor">D = 1.5 m</text>
          <text x="278" y="46" fontSize="11" fontWeight="bold" fill="#2563eb">P</text>
        </svg>
      )}

      <figcaption className="mt-2 text-center text-[11px] font-medium text-slate-500 dark:text-slate-400">
        {diagram.caption[language]}
      </figcaption>
    </figure>
  );
};
