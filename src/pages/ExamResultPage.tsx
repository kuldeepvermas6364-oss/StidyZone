import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardEdit,
  Clock,
  RotateCcw,
} from 'lucide-react';
import { QuestionRenderer } from '../components/assessments/QuestionRenderer';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useAssessments } from '../contexts/AssessmentContext';
import {
  fetchAttemptDetailsApi,
  submitSelfReviewApi,
} from '../services/assessments/assessmentApi';
import type {
  AssessmentAttempt,
  QuestionAnswerKey,
  QuestionPublic,
} from '../types/assessment';
import { isSubjectiveQuestionType } from '../utils/examScoring';

const ExamResultPage: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { language } = useApp();
  const { isAuthenticated, session } = useAuth();
  const { refreshAssessmentData } = useAssessments();

  const [attempt, setAttempt] = useState<AssessmentAttempt | null>(null);
  const [questions, setQuestions] = useState<QuestionPublic[]>([]);
  const [answerKeys, setAnswerKeys] = useState<Record<string, QuestionAnswerKey>>({});
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [reviewMarksDraft, setReviewMarksDraft] = useState<Record<string, number>>({});
  const [reviewNotesDraft, setReviewNotesDraft] = useState<Record<string, string>>({});
  const [savingReviewId, setSavingReviewId] = useState<string | null>(null);

  useEffect(() => {
    if (!attemptId || !isAuthenticated || !session) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchAttemptDetailsApi(session, attemptId)
      .then((res) => {
        setAttempt(res.attempt);
        setQuestions(res.questions);
        setAnswerKeys(res.answerKeys);
      })
      .catch((err) => {
        setErrorMsg(err instanceof Error ? err.message : 'Unable to load result.');
      })
      .finally(() => setLoading(false));
  }, [attemptId, isAuthenticated, session]);

  const handleSaveSelfReview = async (questionId: string, maxMarks: number) => {
    if (!attempt || !session) return;
    const raw = reviewMarksDraft[questionId] ?? 0;
    const clamped = Math.max(0, Math.min(maxMarks, raw));
    setSavingReviewId(questionId);
    try {
      const res = await submitSelfReviewApi(session, attempt.id, {
        questionId,
        marks: clamped,
        note: reviewNotesDraft[questionId],
      });
      setAttempt(res.attempt);
      await refreshAssessmentData();
    } catch {
      // Keep current draft cleanly
    } finally {
      setSavingReviewId(null);
    }
  };

  if (!isAuthenticated) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-3 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-semibold">Sign in to view your protected assessment results.</p>
        <Link
          to={`/login?next=/exam-results/${attemptId}`}
          className="inline-flex h-10 items-center rounded-xl bg-blue-600 px-5 text-xs font-semibold text-white"
        >
          Sign In
        </Link>
      </section>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
        <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
      </div>
    );
  }

  if (errorMsg || !attempt || !attempt.result) {
    return (
      <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
        {errorMsg || 'Result not found or attempt has not been submitted yet.'}
      </section>
    );
  }

  const res = attempt.result;
  const incorrectIds = res.questionResults
    .filter((qr) => qr.status === 'incorrect')
    .map((qr) => qr.questionId);
  const gradedCount = res.correctCount + res.partialCount + res.incorrectCount;
  const accuracy = gradedCount > 0 ? Math.round((res.correctCount / gradedCount) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/practice-tests"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{language === 'hi' ? 'अभ्यास केंद्र पर लौटें' : 'Back to Practice & Tests Hub'}</span>
        </Link>

        {incorrectIds.length > 0 && (
          <Link
            to={`/practice?ids=${incorrectIds.join(',')}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Retry {incorrectIds.length} Incorrect Question(s)</span>
          </Link>
        )}
      </div>

      {/* Top Scoreboard */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              {attempt.examTrack.toUpperCase()} · Server-Scored Assessment Summary
              {attempt.autoSubmitted ? ' · Auto-Submitted at Timer Expiry' : ''}
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-white">
              {attempt.title[language]}
            </h1>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-500">Total Score</span>
            <p className="font-mono text-3xl font-bold text-blue-600 tabular-nums dark:text-blue-400">
              {res.score} / {res.maxMarks}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 rounded-xl border border-slate-200 bg-slate-50/70 sm:grid-cols-5 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-800/40">
          <div className="p-3.5">
            <p className="text-[11px] text-slate-500">Percentage</p>
            <p className="mt-0.5 font-mono text-lg font-bold tabular-nums">{res.percentage}%</p>
          </div>
          <div className="p-3.5">
            <p className="text-[11px] text-slate-500">Accuracy</p>
            <p className="mt-0.5 font-mono text-lg font-bold tabular-nums text-emerald-600">{accuracy}%</p>
          </div>
          <div className="p-3.5">
            <p className="text-[11px] text-slate-500">Correct / Wrong</p>
            <p className="mt-0.5 font-mono text-lg font-bold tabular-nums">
              {res.correctCount} / {res.incorrectCount}
            </p>
          </div>
          <div className="p-3.5">
            <p className="text-[11px] text-slate-500">Negative Deducted</p>
            <p className="mt-0.5 font-mono text-lg font-bold tabular-nums text-rose-600">
              -{res.negativeMarksDeducted}
            </p>
          </div>
          <div className="p-3.5">
            <p className="text-[11px] text-slate-500 flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden="true" /> Time Spent
            </p>
            <p className="mt-0.5 font-mono text-lg font-bold tabular-nums">
              {Math.floor(res.timeSpentSeconds / 60)}m {res.timeSpentSeconds % 60}s
            </p>
          </div>
        </div>
      </section>

      {/* Subject & Difficulty Breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
            Subject-Wise Breakdown
          </h2>
          <div className="space-y-2.5">
            {res.subjectBreakdown.map((sub) => (
              <div
                key={sub.subjectId}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/40"
              >
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">{sub.subjectId.toUpperCase()}</p>
                  <p className="text-[11px] text-slate-500">
                    {sub.correct}✓ · {sub.incorrect}✕ · {sub.unanswered} skipped · Accuracy {sub.accuracyPercent}%
                  </p>
                </div>
                <span className="font-mono text-sm font-bold text-blue-600 tabular-nums dark:text-blue-400">
                  {sub.score}/{sub.maxMarks}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
            Chapter & Difficulty Analysis
          </h2>
          <div className="space-y-2.5">
            {res.chapterBreakdown.map((ch) => (
              <div
                key={`${ch.subjectId}-${ch.chapterId}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/40"
              >
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">{ch.chapterId}</p>
                  <p className="text-[11px] text-slate-500">
                    Accuracy {ch.accuracyPercent}% ({ch.correct}✓ / {ch.incorrect}✕)
                  </p>
                </div>
                <Link
                  to={`/practice?subject=${ch.subjectId}&chapter=${ch.chapterId}`}
                  className="rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300"
                >
                  Practice Chapter
                </Link>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Question-by-Question Solutions & UP Board Rubric Self-Review */}
      <section className="space-y-4">
        <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
          Detailed Question Review & Step-by-Step Solutions
        </h2>

        {questions.map((q, idx) => {
          const detail = res.questionResults.find((d) => d.questionId === q.id);
          const key = answerKeys[q.id];
          const isSubj = isSubjectiveQuestionType(q.questionType);

          return (
            <article
              key={q.id}
              className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 text-xs dark:border-slate-800">
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                  Question {idx + 1} · {q.chapterId}
                </span>
                {detail && (
                  <span className="font-mono font-semibold text-slate-600 tabular-nums dark:text-slate-300">
                    Expected: {detail.correctSummary}
                  </span>
                )}
              </div>

              <QuestionRenderer
                question={q}
                language={language}
                value={attempt.answers[q.id]}
                onChange={() => {}}
                disabled
                optionSeed={attempt.optionSeed}
                shuffleOptions={false}
                answerKey={key}
                evaluation={detail}
                showSolution
              />

              {/* UP Board Subjective Self-Review Controls */}
              {isSubj && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3 dark:border-slate-700 dark:bg-slate-800/40">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                    <ClipboardEdit className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                    <span>UP Board Rubric Self-Evaluation (Compare with Solution Steps Above)</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Self-Awarded Marks (0 – {q.marks}):
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={q.marks}
                      step={0.5}
                      value={
                        reviewMarksDraft[q.id] ??
                        attempt.answers[q.id]?.selfEvaluatedMarks ??
                        0
                      }
                      onChange={(e) =>
                        setReviewMarksDraft((prev) => ({
                          ...prev,
                          [q.id]: Number(e.target.value),
                        }))
                      }
                      className="h-9 w-24 rounded-lg border border-slate-300 bg-white px-2.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                    <input
                      type="text"
                      placeholder="Optional self-review note..."
                      value={
                        reviewNotesDraft[q.id] ??
                        attempt.answers[q.id]?.selfEvaluationNote ??
                        ''
                      }
                      onChange={(e) =>
                        setReviewNotesDraft((prev) => ({
                          ...prev,
                          [q.id]: e.target.value,
                        }))
                      }
                      className="h-9 flex-1 min-w-[200px] rounded-lg border border-slate-300 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      disabled={savingReviewId === q.id}
                      onClick={() => void handleSaveSelfReview(q.id, q.marks)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{savingReviewId === q.id ? 'Saving...' : 'Save Self-Score'}</span>
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
};

export default ExamResultPage;
