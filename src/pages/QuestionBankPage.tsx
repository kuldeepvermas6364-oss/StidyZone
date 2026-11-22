import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Eye,
  Flag,
  HelpCircle,
  Search,
  Shuffle,
  SlidersHorizontal,
} from 'lucide-react';
import { EmptyState } from '../components/common/EmptyState';
import { QuestionRenderer } from '../components/assessments/QuestionRenderer';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useAssessments } from '../contexts/AssessmentContext';
import { ALL_CURRICULUM_SUBJECTS } from '../data/curriculum';
import {
  fetchQuestionsApi,
  revealQuestionSolutionApi,
} from '../services/assessments/assessmentApi';
import type {
  DifficultyLevel,
  QuestionAnswerKey,
  QuestionPublic,
  QuestionType,
} from '../types/assessment';
import type { ExamTrack, LanguageCode } from '../types/database';

const QUESTION_TYPES: Array<{ value: QuestionType | 'all'; label: string }> = [
  { value: 'all', label: 'All Types' },
  { value: 'mcq_single', label: 'Single-Choice MCQ' },
  { value: 'mcq_multi', label: 'Multiple-Correct MCQ' },
  { value: 'numerical', label: 'Numerical Value' },
  { value: 'integer', label: 'Integer Type' },
  { value: 'fill_blank', label: 'Fill in the Blank' },
  { value: 'true_false', label: 'True / False' },
  { value: 'assertion_reason', label: 'Assertion & Reason' },
  { value: 'match_following', label: 'Match the Following' },
  { value: 'short_answer', label: 'Short Answer (Board)' },
  { value: 'long_answer', label: 'Long Answer (Board)' },
  { value: 'subjective_descriptive', label: 'Subjective Descriptive' },
];

const QuestionBankPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { language: appLanguage } = useApp();
  const { isAuthenticated, session } = useAuth();
  const { isQuestionTagged, toggleQuestionTag } = useAssessments();

  const [displayLang, setDisplayLang] = useState<LanguageCode>(appLanguage);
  const [query, setQuery] = useState('');
  const [examTrack, setExamTrack] = useState<ExamTrack | 'all'>(
    (searchParams.get('exam') as ExamTrack) || 'all'
  );
  const [subjectId, setSubjectId] = useState<string>(searchParams.get('subject') || 'all');
  const [chapterId, setChapterId] = useState<string>(searchParams.get('chapter') || 'all');
  const [topicId, setTopicId] = useState<string>(searchParams.get('topic') || 'all');
  const [difficulty, setDifficulty] = useState<DifficultyLevel | 'all'>('all');
  const [questionType, setQuestionType] = useState<QuestionType | 'all'>('all');
  const [sourceType, setSourceType] = useState<'all' | 'prepzone_curated' | 'official_pattern_sample' | 'verified_pyq'>('all');
  const [attemptFilter, setAttemptFilter] = useState<'all' | 'attempted' | 'unattempted' | 'correct' | 'incorrect'>('all');
  const [academicYear, setAcademicYear] = useState<string>('all');
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<QuestionPublic[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [revealedKeys, setRevealedKeys] = useState<Record<string, QuestionAnswerKey>>({});
  const [revealError, setRevealError] = useState<Record<string, string>>({});
  const [relatedModalQuestion, setRelatedModalQuestion] = useState<QuestionPublic | null>(null);
  const [relatedList, setRelatedList] = useState<QuestionPublic[]>([]);

  useEffect(() => {
    setDisplayLang(appLanguage);
  }, [appLanguage]);

  const availableSubjects = useMemo(() => {
    if (examTrack === 'all') return ALL_CURRICULUM_SUBJECTS;
    return ALL_CURRICULUM_SUBJECTS.filter((s) => s.examTrack === examTrack);
  }, [examTrack]);

  const availableChapters = useMemo(() => {
    if (subjectId === 'all') return [];
    const sub = ALL_CURRICULUM_SUBJECTS.find((s) => s.id === subjectId);
    return sub?.chapters ?? [];
  }, [subjectId]);

  const availableTopics = useMemo(() => {
    if (chapterId === 'all') return [];
    const ch = availableChapters.find((c) => c.id === chapterId);
    return ch?.topics ?? [];
  }, [availableChapters, chapterId]);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchQuestionsApi(session, {
        query,
        examTrack,
        subjectId,
        chapterId,
        topicId,
        difficulty,
        questionType,
        sourceType,
        attemptFilter,
        academicYear,
        page,
        pageSize: 8,
      });
      setQuestions(res.questions);
      setTotalCount(res.totalCount);
      setTotalPages(res.totalPages);
    } catch {
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, [
    session,
    query,
    examTrack,
    subjectId,
    chapterId,
    topicId,
    difficulty,
    questionType,
    sourceType,
    attemptFilter,
    academicYear,
    page,
  ]);

  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

  const handleRevealSolution = async (questionId: string) => {
    if (revealedKeys[questionId]) {
      setRevealedKeys((prev) => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
      return;
    }
    setRevealError((prev) => ({ ...prev, [questionId]: '' }));
    try {
      const res = await revealQuestionSolutionApi(session, questionId);
      setRevealedKeys((prev) => ({ ...prev, [questionId]: res.answerKey }));
    } catch (err) {
      setRevealError((prev) => ({
        ...prev,
        [questionId]: err instanceof Error ? err.message : 'Unable to reveal solution.',
      }));
    }
  };

  const handleOpenRelated = async (q: QuestionPublic) => {
    setRelatedModalQuestion(q);
    try {
      const res = await fetchQuestionsApi(session, {
        chapterId: q.chapterId,
        page: 1,
        pageSize: 6,
      });
      setRelatedList(res.questions.filter((item) => item.id !== q.id));
    } catch {
      setRelatedList([]);
    }
  };

  const handleJumpRandom = async () => {
    if (totalPages <= 1) {
      const shuffled = [...questions].sort(() => Math.random() - 0.5);
      setQuestions(shuffled);
      return;
    }
    const randomPage = Math.max(1, Math.ceil(Math.random() * totalPages));
    setPage(randomPage);
  };

  const resetFilters = () => {
    setQuery('');
    setExamTrack('all');
    setSubjectId('all');
    setChapterId('all');
    setTopicId('all');
    setDifficulty('all');
    setQuestionType('all');
    setSourceType('all');
    setAttemptFilter('all');
    setAcademicYear('all');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/practice-tests"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{appLanguage === 'hi' ? 'अभ्यास केंद्र पर लौटें' : 'Back to Practice & Tests Hub'}</span>
        </Link>

        {/* Bilingual EN/HI Question Viewer Switch */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Question Language:
          </span>
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
            {(['en', 'hi'] as LanguageCode[]).map((lng) => (
              <button
                key={lng}
                type="button"
                onClick={() => setDisplayLang(lng)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                  displayLang === lng
                    ? 'bg-white text-blue-700 shadow-xs dark:bg-slate-900 dark:text-blue-300'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {lng === 'en' ? 'EN' : 'हिन्दी'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Header + Filters Card */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              {displayLang === 'hi' ? 'केंद्रीय प्रश्न बैंक एक्सप्लोरर' : 'Central Question Bank'}
            </h1>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              {totalCount} matching verified/curated question(s) · Answer keys remain protected until revealed or submitted.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleJumpRandom()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <Shuffle className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              <span>{displayLang === 'hi' ? 'रैंडम प्रश्न' : 'Random Question'}</span>
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{displayLang === 'hi' ? 'फ़िल्टर साफ़ करें' : 'Clear Filters'}</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder={
                displayLang === 'hi'
                  ? 'प्रश्न, सूत्र, अध्याय या आईडी खोजें...'
                  : 'Search prompt, keyword, ID, or chapter...'
              }
              aria-label="Search Question Bank"
              className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <select
            aria-label="Filter by Exam Track"
            value={examTrack}
            onChange={(e) => {
              setExamTrack(e.target.value as ExamTrack | 'all');
              setSubjectId('all');
              setChapterId('all');
              setTopicId('all');
              setPage(1);
            }}
            className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="all">All Exams</option>
            <option value="up-board-12">UP Board Class 12</option>
            <option value="jee-main">JEE Main</option>
            <option value="jee-advanced">JEE Advanced</option>
          </select>

          <select
            aria-label="Filter by Subject"
            value={subjectId}
            onChange={(e) => {
              setSubjectId(e.target.value);
              setChapterId('all');
              setTopicId('all');
              setPage(1);
            }}
            className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="all">All Subjects</option>
            {availableSubjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.examTrack.toUpperCase()} · {sub.name[displayLang]}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by Chapter"
            value={chapterId}
            disabled={subjectId === 'all'}
            onChange={(e) => {
              setChapterId(e.target.value);
              setTopicId('all');
              setPage(1);
            }}
            className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="all">All Chapters</option>
            {availableChapters.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.order}. {ch.title[displayLang]}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by Topic"
            value={topicId}
            disabled={chapterId === 'all'}
            onChange={(e) => {
              setTopicId(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="all">All Topics</option>
            {availableTopics.map((tp) => (
              <option key={tp.id} value={tp.id}>
                {tp.title[displayLang]}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by Question Type"
            value={questionType}
            onChange={(e) => {
              setQuestionType(e.target.value as QuestionType | 'all');
              setPage(1);
            }}
            className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            {QUESTION_TYPES.map((qt) => (
              <option key={qt.value} value={qt.value}>
                {qt.label}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by Difficulty"
            value={difficulty}
            onChange={(e) => {
              setDifficulty(e.target.value as DifficultyLevel | 'all');
              setPage(1);
            }}
            className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="all">All Difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>

          <select
            aria-label="Filter by Source Attribution"
            value={sourceType}
            onChange={(e) => {
              setSourceType(e.target.value as typeof sourceType);
              setPage(1);
            }}
            className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="all">All Sources</option>
            <option value="prepzone_curated">PrepZone Curated</option>
            <option value="official_pattern_sample">Official-Pattern Sample</option>
            <option value="verified_pyq">Verified PYQ</option>
          </select>

          <select
            aria-label="Filter by Year"
            value={academicYear}
            onChange={(e) => {
              setAcademicYear(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="all">All Years</option>
            <option value="2026">2026</option>
            <option value="2025">2025</option>
            <option value="2024">2024</option>
          </select>

          {isAuthenticated && (
            <select
              aria-label="Filter by Attempt Status"
              value={attemptFilter}
              onChange={(e) => {
                setAttemptFilter(e.target.value as typeof attemptFilter);
                setPage(1);
              }}
              className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="all">Attempt Status: All</option>
              <option value="unattempted">Unattempted Only</option>
              <option value="attempted">Attempted</option>
              <option value="correct">Solved Correctly</option>
              <option value="incorrect">Incorrect (Retry)</option>
            </select>
          )}
        </div>
      </section>

      {/* Question Cards */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
            />
          ))}
        </div>
      ) : questions.length === 0 ? (
        <EmptyState
          icon={<HelpCircle className="h-6 w-6" aria-hidden="true" />}
          title={displayLang === 'hi' ? 'कोई प्रश्न नहीं मिला' : 'No matching questions found'}
          body={
            displayLang === 'hi'
              ? 'कृपया फ़िल्टर बदलें या सभी फ़िल्टर रीसेट करें।'
              : 'Try broadening your filters or clearing the search query.'
          }
          actionLabel={displayLang === 'hi' ? 'सभी फ़िल्टर हटाएँ' : 'Reset Filters'}
          onAction={resetFilters}
        />
      ) : (
        <div className="space-y-4">
          {questions.map((q) => {
            const revealed = revealedKeys[q.id];
            const bookmarked = isQuestionTagged(q.id, 'bookmark');
            const difficult = isQuestionTagged(q.id, 'difficult');
            const revision = isQuestionTagged(q.id, 'revision');

            return (
              <article
                key={q.id}
                className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <QuestionRenderer
                  question={q}
                  language={displayLang}
                  value={undefined}
                  onChange={() => {}}
                  disabled
                  answerKey={revealed}
                  showSolution={Boolean(revealed)}
                />

                {revealError[q.id] && (
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                    <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{revealError[q.id]}</span>
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleRevealSolution(q.id)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>
                        {revealed
                          ? displayLang === 'hi'
                            ? 'हल छिपाएँ'
                            : 'Hide Solution'
                          : displayLang === 'hi'
                          ? 'हल देखें'
                          : 'Reveal Solution'}
                      </span>
                    </button>

                    <Link
                      to={`/practice?ids=${q.id}`}
                      className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {displayLang === 'hi' ? 'अभ्यास मोड में हल करें' : 'Solve in Practice Mode'}
                    </Link>

                    <button
                      type="button"
                      onClick={() => void handleOpenRelated(q)}
                      className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {displayLang === 'hi' ? 'संबंधित प्रश्न' : 'Related Questions'}
                    </button>
                  </div>

                  {isAuthenticated && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        aria-pressed={bookmarked}
                        onClick={() => void toggleQuestionTag(q.id, 'bookmark')}
                        className={`inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold ${
                          bookmarked
                            ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{displayLang === 'hi' ? 'सहेजें' : 'Bookmark'}</span>
                      </button>

                      <button
                        type="button"
                        aria-pressed={difficult}
                        onClick={() => void toggleQuestionTag(q.id, 'difficult')}
                        className={`inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold ${
                          difficult
                            ? 'border-amber-600 bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <Flag className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{displayLang === 'hi' ? 'कठिन' : 'Difficult'}</span>
                      </button>

                      <button
                        type="button"
                        aria-pressed={revision}
                        onClick={() => void toggleQuestionTag(q.id, 'revision')}
                        className={`inline-flex h-8 items-center rounded-lg border px-2.5 text-xs font-semibold ${
                          revision
                            ? 'border-violet-600 bg-violet-50 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {displayLang === 'hi' ? 'पुनरीक्षण' : 'Revision'}
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            <span>Previous</span>
          </button>
          <span className="font-mono text-xs font-semibold text-slate-600 tabular-nums dark:text-slate-300">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
          >
            <span>Next</span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Related Questions Modal */}
      {relatedModalQuestion && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="related-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
        >
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2">
              <h2 id="related-modal-title" className="font-display text-base font-bold text-slate-900 dark:text-white">
                Related Questions in {relatedModalQuestion.chapterId}
              </h2>
              <button
                type="button"
                onClick={() => setRelatedModalQuestion(null)}
                className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
              >
                Close
              </button>
            </div>
            {relatedList.length === 0 ? (
              <p className="text-xs text-slate-500">No additional questions mapped to this chapter yet.</p>
            ) : (
              <div className="space-y-2.5">
                {relatedList.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                        {item.questionType.replace(/_/g, ' ').toUpperCase()} · {item.difficulty}
                      </p>
                      <p className="truncate text-sm text-slate-800 dark:text-slate-200">
                        {item.prompt[displayLang]}
                      </p>
                    </div>
                    <Link
                      to={`/practice?ids=${item.id}`}
                      onClick={() => setRelatedModalQuestion(null)}
                      className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      Practice
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionBankPage;
