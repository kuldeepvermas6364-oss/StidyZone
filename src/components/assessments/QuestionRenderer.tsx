import React, { useState } from 'react';
import {
  CheckCircle2,
  ImagePlus,
  Trash2,
  XCircle,
} from 'lucide-react';
import type {
  QuestionAnswerKey,
  QuestionOption,
  QuestionPublic,
  QuestionScoreDetail,
  StudentAnswerValue,
} from '../../types/assessment';
import type { LanguageCode } from '../../types/database';
import { getSeededOptions } from '../../utils/examScoring';
import { MathText } from './MathText';
import { QuestionDiagramView } from './QuestionDiagramView';

const SYMBOL_SHORTCUTS = ['α', 'β', 'θ', 'π', 'ε₀', 'μ₀', 'Ω', 'λ', '√', '∫', '→', '⇌', 'Δ', '°'];

interface QuestionRendererProps {
  question: QuestionPublic;
  language: LanguageCode;
  value?: StudentAnswerValue;
  onChange: (nextValue: StudentAnswerValue) => void;
  disabled?: boolean;
  optionSeed?: number;
  shuffleOptions?: boolean;
  answerKey?: QuestionAnswerKey;
  evaluation?: QuestionScoreDetail;
  showSolution?: boolean;
}

export const QuestionRenderer: React.FC<QuestionRendererProps> = ({
  question,
  language,
  value,
  onChange,
  disabled = false,
  optionSeed = 1,
  shuffleOptions = false,
  answerKey,
  evaluation,
  showSolution = false,
}) => {
  const [uploadError, setUploadError] = useState<string | null>(null);

  const displayedOptions: QuestionOption[] = getSeededOptions(question, optionSeed, shuffleOptions);
  const currentSelected = value?.selectedOptionIds ?? [];

  const handleToggleSingle = (optId: string) => {
    if (disabled) return;
    onChange({ ...value, selectedOptionIds: [optId] });
  };

  const handleToggleMulti = (optId: string) => {
    if (disabled) return;
    const set = new Set(currentSelected);
    if (set.has(optId)) set.delete(optId);
    else set.add(optId);
    onChange({ ...value, selectedOptionIds: Array.from(set) });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setUploadError(
        language === 'hi'
          ? 'केवल PNG, JPEG या WEBP छवि अपलोड की जा सकती है।'
          : 'Only PNG, JPEG, or WEBP answer-sheet photos are supported.'
      );
      return;
    }
    if (file.size > 450 * 1024) {
      setUploadError(
        language === 'hi'
          ? 'छवि का आकार 450 KB से कम होना चाहिए।'
          : 'Image size must be under 450 KB for fast autosave.'
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onChange({
          ...value,
          attachedImageName: file.name,
          attachedImageDataUrl: reader.result,
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const isCorrectOption = (optId: string): boolean =>
    Boolean(answerKey?.correctOptionIds?.includes(optId));

  return (
    <div className="space-y-4">
      {/* Metadata Header Strip (No pills — middle-dot typography) */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span className="font-semibold text-blue-600 dark:text-blue-400">
          {question.examTrack.toUpperCase()} · {question.questionType.replace(/_/g, ' ').toUpperCase()} ·{' '}
          {question.difficulty.toUpperCase()} · +{question.marks}
          {question.negativeMarks > 0 ? ` / -${question.negativeMarks}` : ''}
        </span>
        <span className="font-medium">
          {question.sourceLabel[language]}
          {question.academicYear ? ` (${question.academicYear})` : ''}
        </span>
      </div>

      {/* Main Prompt */}
      <div className="text-base leading-relaxed font-medium text-slate-900 dark:text-slate-100">
        <MathText text={question.prompt[language]} />
      </div>

      {/* Assertion & Reason Block */}
      {question.questionType === 'assertion_reason' && question.assertionReason && (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm dark:border-slate-700 dark:bg-slate-800/40">
          <p className="text-slate-800 dark:text-slate-100">
            <strong className="font-semibold text-blue-700 dark:text-blue-400">
              {language === 'hi' ? 'अभिकथन (A): ' : 'Assertion (A): '}
            </strong>
            <MathText text={question.assertionReason.assertion[language]} />
          </p>
          <p className="text-slate-800 dark:text-slate-100">
            <strong className="font-semibold text-blue-700 dark:text-blue-400">
              {language === 'hi' ? 'कारण (R): ' : 'Reason (R): '}
            </strong>
            <MathText text={question.assertionReason.reason[language]} />
          </p>
        </div>
      )}

      {/* Optional Diagram / Table */}
      {question.diagram && (
        <QuestionDiagramView diagram={question.diagram} language={language} />
      )}

      {/* 1, 2, 7. MCQ Single, MCQ Multi, Assertion-Reason */}
      {(question.questionType === 'mcq_single' ||
        question.questionType === 'mcq_multi' ||
        question.questionType === 'assertion_reason') && (
        <div className="space-y-2.5" role={question.questionType === 'mcq_multi' ? 'group' : 'radiogroup'}>
          {displayedOptions.map((opt, idx) => {
            const selected = currentSelected.includes(opt.id);
            const displayLetter = String.fromCharCode(65 + idx);
            const showGood = showSolution && answerKey && isCorrectOption(opt.id);
            const showBad = showSolution && answerKey && selected && !isCorrectOption(opt.id);

            return (
              <button
                key={opt.id}
                type="button"
                disabled={disabled}
                onClick={() =>
                  question.questionType === 'mcq_multi'
                    ? handleToggleMulti(opt.id)
                    : handleToggleSingle(opt.id)
                }
                aria-pressed={selected}
                className={`flex min-h-11 w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left text-sm transition-colors ${
                  showGood
                    ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 dark:border-emerald-500 dark:bg-emerald-950/30 dark:text-emerald-100'
                    : showBad
                    ? 'border-rose-500 bg-rose-50/70 text-rose-950 dark:border-rose-500 dark:bg-rose-950/30 dark:text-rose-100'
                    : selected
                    ? 'border-blue-600 bg-blue-50 text-slate-900 dark:border-blue-400 dark:bg-blue-950/50 dark:text-white'
                    : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border font-mono text-xs font-bold ${
                    selected
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {displayLetter}
                </span>
                <span className="min-w-0 flex-1">
                  <MathText text={opt.text[language]} />
                </span>
                {showGood && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />}
                {showBad && <XCircle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}

      {/* 3, 4. Numerical & Integer Inputs */}
      {(question.questionType === 'numerical' || question.questionType === 'integer') && (
        <div className="space-y-2">
          <label
            htmlFor={`num-input-${question.id}`}
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            {question.questionType === 'integer'
              ? language === 'hi'
                ? 'पूर्णांक उत्तर दर्ज करें (उदा. 0 से 9999):'
                : 'Enter exact integer answer:'
              : language === 'hi'
              ? 'संख्यात्मक उत्तर दर्ज करें (दशमलव मान्य):'
              : 'Enter numerical value (decimal accepted):'}
          </label>
          <input
            id={`num-input-${question.id}`}
            type="text"
            inputMode="decimal"
            disabled={disabled}
            value={value?.numericValue ?? ''}
            onChange={(e) => onChange({ ...value, numericValue: e.target.value })}
            placeholder={question.questionType === 'integer' ? 'e.g. 5' : 'e.g. 1.80'}
            className="h-11 w-full max-w-xs rounded-xl border border-slate-300 bg-white px-4 font-mono text-base font-semibold text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </div>
      )}

      {/* 5. Fill in the Blanks */}
      {question.questionType === 'fill_blank' && (
        <div className="space-y-2">
          <label
            htmlFor={`blank-input-${question.id}`}
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            {language === 'hi' ? 'रिक्त स्थान भरें:' : 'Type exact value or expression:'}
          </label>
          <input
            id={`blank-input-${question.id}`}
            type="text"
            disabled={disabled}
            value={value?.textValue ?? ''}
            onChange={(e) => onChange({ ...value, textValue: e.target.value })}
            placeholder={language === 'hi' ? 'यहाँ उत्तर लिखें (जैसे q/e0)' : 'Type answer (e.g. q/e0)'}
            className="h-11 w-full max-w-md rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </div>
      )}

      {/* 6. True / False */}
      {question.questionType === 'true_false' && (
        <div className="grid grid-cols-2 gap-3 max-w-sm">
          {[
            { val: true, en: 'True', hi: 'सत्य (True)' },
            { val: false, en: 'False', hi: 'असत्य (False)' },
          ].map((item) => {
            const active = value?.booleanValue === item.val;
            return (
              <button
                key={String(item.val)}
                type="button"
                disabled={disabled}
                onClick={() => onChange({ ...value, booleanValue: item.val })}
                aria-pressed={active}
                className={`h-11 rounded-xl border text-sm font-semibold transition-colors ${
                  active
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                }`}
              >
                {item[language]}
              </button>
            );
          })}
        </div>
      )}

      {/* 8. Match the Following */}
      {question.questionType === 'match_following' && question.matchColumns && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/40">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                {question.matchColumns.leftTitle[language]}
              </p>
              <ul className="space-y-2 text-sm">
                {question.matchColumns.leftItems.map((left) => (
                  <li key={left.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                    <span>
                      <strong className="mr-1.5 font-mono text-blue-600 dark:text-blue-400">{left.id}.</strong>
                      <MathText text={left.text[language]} />
                    </span>
                    <select
                      disabled={disabled}
                      aria-label={`Match ${left.id}`}
                      value={value?.matchMapping?.[left.id] ?? ''}
                      onChange={(e) =>
                        onChange({
                          ...value,
                          matchMapping: {
                            ...(value?.matchMapping ?? {}),
                            [left.id]: e.target.value,
                          },
                        })
                      }
                      className="h-9 rounded-lg border border-slate-300 bg-white px-2 font-mono text-xs font-semibold text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="">--</option>
                      {question.matchColumns!.rightItems.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.id}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                {question.matchColumns.rightTitle[language]}
              </p>
              <ul className="space-y-2 text-sm">
                {question.matchColumns.rightItems.map((right) => (
                  <li key={right.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                    <strong className="font-mono text-slate-500 dark:text-slate-400">{right.id}.</strong>
                    <MathText text={right.text[language]} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 9, 10, 11. UP Board Short Answer, Long Answer & Subjective Descriptive */}
      {(question.questionType === 'short_answer' ||
        question.questionType === 'long_answer' ||
        question.questionType === 'subjective_descriptive') && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {language === 'hi' ? 'प्रतीक जोड़ें:' : 'Insert Symbol:'}
            </span>
            {SYMBOL_SHORTCUTS.map((sym) => (
              <button
                key={sym}
                type="button"
                disabled={disabled}
                onClick={() =>
                  onChange({
                    ...value,
                    textValue: `${value?.textValue ?? ''}${sym}`,
                  })
                }
                className="h-7 rounded border border-slate-200 bg-slate-50 px-2 font-mono text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {sym}
              </button>
            ))}
          </div>

          <textarea
            rows={question.questionType === 'short_answer' ? 4 : 7}
            disabled={disabled}
            value={value?.textValue ?? ''}
            onChange={(e) => onChange({ ...value, textValue: e.target.value })}
            placeholder={
              language === 'hi'
                ? 'अपना विस्तृत उत्तर, सूत्र एवं चरणबद्ध निगमन यहाँ लिखें...'
                : 'Write your structured answer, formulas, and step-by-step derivation here...'
            }
            className="w-full rounded-xl border border-slate-300 bg-white p-3.5 text-sm leading-relaxed text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />

          {/* Optional Written Answer Sheet Upload Preview */}
          {!disabled && (
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <ImagePlus className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                <span>
                  {language === 'hi'
                    ? 'लिखित कॉपी का फोटो संलग्न करें (वैकल्पिक)'
                    : 'Attach Answer-Sheet Image (Optional)'}
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleImageUpload}
                  className="sr-only"
                />
              </label>
              {uploadError && <p className="text-xs font-medium text-rose-600">{uploadError}</p>}
            </div>
          )}

          {value?.attachedImageDataUrl && (
            <div className="inline-flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800/50">
              <img
                src={value.attachedImageDataUrl}
                alt={value.attachedImageName || 'Attached answer sheet'}
                className="h-24 w-auto rounded-lg object-contain border border-slate-200"
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...value,
                      attachedImageDataUrl: undefined,
                      attachedImageName: undefined,
                    })
                  }
                  aria-label="Remove attached image"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:text-rose-600"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Post-Submit / Immediate Practice Feedback & Step-by-Step Solution */}
      {showSolution && answerKey && (
        <div
          className={`mt-4 rounded-xl border p-4 space-y-2.5 text-sm ${
            evaluation?.status === 'correct'
              ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/20'
              : evaluation?.status === 'incorrect'
              ? 'border-rose-200 bg-rose-50/70 dark:border-rose-900/50 dark:bg-rose-950/20'
              : 'border-blue-200 bg-blue-50/70 dark:border-blue-900/50 dark:bg-blue-950/20'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-display text-xs font-bold uppercase tracking-wide text-slate-900 dark:text-white">
              {evaluation
                ? evaluation.status === 'correct'
                  ? language === 'hi'
                    ? 'सही उत्तर'
                    : 'Correct'
                  : evaluation.status === 'partial'
                  ? language === 'hi'
                    ? 'आंशिक सही'
                    : 'Partial Credit'
                  : evaluation.status === 'pending_review'
                  ? language === 'hi'
                    ? 'स्व-मूल्यांकन लंबित'
                    : 'Rubric Self-Review'
                  : evaluation.status === 'self_evaluated'
                  ? language === 'hi'
                    ? 'स्व-मूल्यांकित'
                    : 'Self-Evaluated'
                  : evaluation.status === 'unanswered'
                  ? language === 'hi'
                    ? 'अनुत्तरित'
                    : 'Unanswered'
                  : language === 'hi'
                  ? 'गलत उत्तर'
                  : 'Incorrect'
                : language === 'hi'
                ? 'विस्तृत हल'
                : 'Verified Solution'}
            </span>
            {evaluation && (
              <span className="font-mono text-xs font-bold text-slate-800 tabular-nums dark:text-slate-100">
                {evaluation.awardedMarks > 0 ? `+${evaluation.awardedMarks}` : evaluation.awardedMarks} / {evaluation.maxMarks}
              </span>
            )}
          </div>

          <p className="text-slate-800 dark:text-slate-100">
            <strong className="font-semibold">
              {language === 'hi' ? 'व्याख्या: ' : 'Explanation: '}
            </strong>
            <MathText text={answerKey.explanation[language]} />
          </p>

          {answerKey.solutionSteps.length > 0 && (
            <ol className="list-decimal space-y-1 pl-5 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
              {answerKey.solutionSteps.map((step, sIdx) => (
                <li key={sIdx}>
                  <MathText text={step[language]} />
                </li>
              ))}
            </ol>
          )}

          {answerKey.rubric && (
            <p className="border-t border-slate-200/80 pt-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300">
              <strong>{language === 'hi' ? 'अंक योजना (Rubric): ' : 'Marking Rubric: '}</strong>
              {answerKey.rubric[language]}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
