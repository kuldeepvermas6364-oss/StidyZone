import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  Database,
  FileUp,
  Layers,
  MonitorPlay,
  SlidersHorizontal,
  Target,
} from 'lucide-react';
import { QuestionImportPanel } from '../components/assessments/QuestionImportPanel';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useAssessments } from '../contexts/AssessmentContext';

const PracticeTestsHubPage: React.FC = () => {
  const { language } = useApp();
  const { isAuthenticated } = useAuth();
  const {
    totalQuestionCount,
    analytics,
    attempts,
    examConfigurations,
    quizzes,
    questionBookmarks,
  } = useAssessments();
  const [showImport, setShowImport] = useState(false);

  const submittedAttempts = attempts.filter((a) => a.status === 'submitted');
  const inProgressAttempt = attempts.find((a) => a.status === 'in_progress');

  const cards = [
    {
      to: '/question-bank',
      icon: <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />,
      title: language === 'hi' ? 'केंद्रीय प्रश्न बैंक (Question Bank)' : 'Central Question Bank',
      meta:
        language === 'hi'
          ? `${totalQuestionCount} द्विभाषी प्रश्न · 11 प्रारूप · KaTeX सूत्र`
          : `${totalQuestionCount} Bilingual Questions · 11 Formats · KaTeX Math`,
      desc:
        language === 'hi'
          ? 'परीक्षा, विषय, अध्याय, टॉपिक, कठिनाई और प्रकार के अनुसार खोजें, हल देखें और बुकमार्क करें।'
          : 'Browse and filter by Exam, Subject, Chapter, Topic, Difficulty, Question Type, and Attempt Status.',
      cta: language === 'hi' ? 'प्रश्न बैंक खोलें' : 'Explore Question Bank',
    },
    {
      to: '/practice',
      icon: <Target className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />,
      title: language === 'hi' ? 'तत्काल अभ्यास मोड (Practice Mode)' : 'Guided Practice Mode',
      meta:
        language === 'hi'
          ? 'तुरंत उत्तर जाँच · चरणबद्ध हल · गलत प्रश्नों का पुनः अभ्यास'
          : 'Instant Feedback · Step-by-Step Solutions · Retry Mistakes',
      desc:
        language === 'hi'
          ? 'अध्याय-वार, टॉपिक-वार, मिश्रित या दैनिक अभ्यास बिना परीक्षा टाइमर दबाव के करें।'
          : 'Practice by chapter, topic, mixed set, or previously incorrect questions with immediate solution verification.',
      cta: language === 'hi' ? 'अभ्यास शुरू करें' : 'Start Practice Session',
    },
    {
      to: '/quiz',
      icon: <Layers className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />,
      title: language === 'hi' ? 'समयबद्ध क्विज़ इंजन (Quiz Engine)' : 'Timed Quiz Engine & Builder',
      meta:
        language === 'hi'
          ? `${quizzes.length} प्रीसेट क्विज़ + कस्टम क्विज़ बिल्डर`
          : `${quizzes.length} Preset Quizzes + Custom Quiz Builder`,
      desc:
        language === 'hi'
          ? 'दैनिक, अध्याय, विषय व पुनरीक्षण क्विज़ — सिंगल/ऑल व्यू और ऑटो-सेव सहित।'
          : 'Daily, chapter, subject, and revision sprints with single/all-question view, review marks, and reload-safe autosave.',
      cta: language === 'hi' ? 'क्विज़ बिल्डर खोलें' : 'Open Quiz Engine',
    },
    {
      to: '/exam-simulator',
      icon: <MonitorPlay className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />,
      title:
        language === 'hi'
          ? 'CBT मॉक एवं यूपी बोर्ड परीक्षा सिम्युलेटर'
          : 'JEE CBT & UP Board Exam Simulator',
      meta:
        language === 'hi'
          ? `${examConfigurations.length} परीक्षा प्रारूप · NTA 5-रंग पैलेट व बोर्ड उत्तर लेखन`
          : `${examConfigurations.length} Exam Formats · NTA 5-State Palette & UP Board Descriptive`,
      desc:
        language === 'hi'
          ? 'जेईई मेन/एडवांस्ड पूर्ण स्क्रीन CBT इंटरफ़ेस और यूपी बोर्ड वर्णनात्मक (रूब्रिक स्व-मूल्यांकन सहित) परीक्षा दें।'
          : 'Full-screen NTA CBT mock tests (+4/-1 & Advanced partial marking) plus UP Board mixed descriptive board papers.',
      cta: language === 'hi' ? 'परीक्षा सिम्युलेटर खोलें' : 'Launch Exam Simulator',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              {language === 'hi'
                ? 'चरण 4 · मूल्यांकन, अभ्यास एवं परीक्षा प्रणाली'
                : 'Assessment Engine · Question Bank, Quizzes & Exam Simulator'}
            </p>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {language === 'hi' ? 'अभ्यास और मॉक टेस्ट केंद्र' : 'Practice & Mock Tests Hub'}
            </h1>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {language === 'hi'
                ? 'यूपी बोर्ड कक्षा 12, जेईई मेन और जेईई एडवांस्ड के लिए द्विभाषी प्रश्न बैंक, तुरंत जाँच अभ्यास, समयबद्ध क्विज़ और पूर्ण सीबीटी सिम्युलेटर।'
                : 'Centralized bilingual assessments for UP Board Class 12, JEE Main, and JEE Advanced with server-verified scoring, NTA CBT navigation, and weak-topic diagnostics.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowImport((v) => !v)}
              aria-expanded={showImport}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <FileUp className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              <span>{language === 'hi' ? 'प्रश्न आयात करें' : 'Import Questions'}</span>
            </button>
            <Link
              to="/practice"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <span>{language === 'hi' ? 'त्वरित अभ्यास शुरू करें' : 'Quick Practice'}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>

        {/* Real Metrics Strip (no fake data) */}
        <div className="grid grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 rounded-xl border border-slate-200 bg-slate-50/70 sm:grid-cols-4 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-800/40">
          <div className="p-3.5">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {language === 'hi' ? 'कुल प्रश्न बैंक' : 'Question Bank'}
            </p>
            <p className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums dark:text-white">
              {totalQuestionCount}
            </p>
          </div>
          <div className="p-3.5">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {language === 'hi' ? 'अभ्यास सटीकता' : 'Practice Accuracy'}
            </p>
            <p className="mt-1 font-mono text-xl font-bold text-blue-600 tabular-nums dark:text-blue-400">
              {analytics.totalPracticeQuestions > 0 || submittedAttempts.length > 0
                ? `${analytics.overallAccuracyPercent}%`
                : '0%'}
            </p>
          </div>
          <div className="p-3.5">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {language === 'hi' ? 'पूर्ण टेस्ट / क्विज़' : 'Submitted Tests'}
            </p>
            <p className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums dark:text-white">
              {submittedAttempts.length}
            </p>
          </div>
          <div className="p-3.5">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {language === 'hi' ? 'चिह्नित कमज़ोर टॉपिक' : 'Weak Topics / Bookmarks'}
            </p>
            <p className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums dark:text-white">
              {analytics.weakTopics.length} / {questionBookmarks.length}
            </p>
          </div>
        </div>
      </section>

      {!isAuthenticated && (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900/50 dark:bg-blue-950/30">
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-slate-900 dark:text-white">
              {language === 'hi'
                ? 'स्कोर सहेजने और समयबद्ध मॉक टेस्ट शुरू करने के लिए साइन इन करें'
                : 'Sign in to run timed Quizzes, Exam Simulators & save Weak-Topic Analytics'}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {language === 'hi'
                ? 'अतिथि मोड में आप प्रश्न बैंक ब्राउज़ कर सकते हैं और तुरंत अभ्यास उत्तर जाँच सकते हैं।'
                : 'Guest users can browse the Question Bank and run instant answer checks in Practice Mode.'}
            </p>
          </div>
          <Link
            to="/login?next=/practice-tests"
            className="inline-flex h-9 items-center rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700"
          >
            {language === 'hi' ? 'लॉगिन करें' : 'Sign In'}
          </Link>
        </section>
      )}

      {/* Resume Active In-Progress Attempt Banner */}
      {inProgressAttempt && (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
              {language === 'hi' ? 'अधूरा टेस्ट फिर से शुरू करें' : 'In-Progress Timed Assessment Ready to Resume'}
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-300">
              {inProgressAttempt.title[language]} · {inProgressAttempt.questionIds.length} questions
            </p>
          </div>
          <Link
            to={
              inProgressAttempt.kind === 'quiz'
                ? `/quiz/play/${inProgressAttempt.id}`
                : `/exam-simulator/${inProgressAttempt.configId}`
            }
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-amber-600 px-4 text-xs font-semibold text-white hover:bg-amber-700"
          >
            <span>{language === 'hi' ? 'जारी रखें' : 'Resume Now'}</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </section>
      )}

      {/* Toggleable Import Panel */}
      {showImport && <QuestionImportPanel />}

      {/* 4 Core Assessment Pillars */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {cards.map((card) => (
          <article
            key={card.to}
            className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 transition-colors hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700"
          >
            <div>
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/50">
                {card.icon}
              </div>
              <h2 className="mt-4 font-display text-base font-bold text-slate-900 dark:text-white">
                {card.title}
              </h2>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                {card.meta}
              </p>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {card.desc}
              </p>
            </div>
            <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
              <Link
                to={card.to}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
              >
                <span>{card.cta}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </article>
        ))}
      </div>

      {/* Recent Test Submissions & Weak Topic Diagnostics */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-display text-base font-bold text-slate-900 dark:text-white">
              <ClipboardCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              <span>{language === 'hi' ? 'हाल के टेस्ट परिणाम' : 'Recent Submitted Tests'}</span>
            </h2>
            <Link
              to="/quiz"
              className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              {language === 'hi' ? 'नया टेस्ट लें' : 'Take New Test'}
            </Link>
          </div>

          {submittedAttempts.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {submittedAttempts.slice(0, 6).map((att) => (
                <Link
                  key={att.id}
                  to={`/exam-results/${att.id}`}
                  className="flex items-center justify-between gap-3 py-3 first:pt-1 last:pb-1 group"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-400">
                      {att.title[language]}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {att.examTrack.toUpperCase()} · {att.result?.correctCount ?? 0}/
                      {att.result?.totalQuestions ?? att.questionIds.length} correct ·{' '}
                      {new Date(att.submittedAtServerMs ?? att.startedAtServerMs).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="font-mono text-sm font-bold text-blue-600 tabular-nums shrink-0 dark:text-blue-400">
                    {att.result ? `${att.result.score}/${att.result.maxMarks}` : '--'}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center space-y-2 dark:border-slate-700">
              <BookOpen className="mx-auto h-6 w-6 text-slate-400" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {language === 'hi' ? 'अभी तक कोई टेस्ट सबमिट नहीं हुआ' : 'No submitted tests yet'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'hi'
                  ? 'वास्तविक स्कोर और अध्याय-वार सटीकता यहाँ देखने के लिए कोई क्विज़ या मॉक टेस्ट पूरा करें।'
                  : 'Complete a timed quiz or CBT mock test to view your real score breakdowns and question solutions here.'}
              </p>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-slate-900 dark:text-white">
            <BarChart3 className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <span>{language === 'hi' ? 'कमज़ोर विषय और पुनरीक्षण कतार' : 'Weak Topics & Revision Queue'}</span>
          </h2>

          {analytics.weakTopics.length > 0 || analytics.revisionQueue.length > 0 ? (
            <div className="space-y-3">
              {[...analytics.weakTopics, ...analytics.revisionQueue]
                .slice(0, 5)
                .map((wt) => (
                  <div
                    key={`${wt.chapterId}-${wt.topicId}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                        {wt.subjectId} · {wt.chapterId}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Accuracy {wt.accuracyPercent}% ({wt.correct}/{wt.attempts}) ·{' '}
                        {wt.category.replace('_', ' ')}
                      </p>
                    </div>
                    <Link
                      to={`/practice?exam=${wt.examTrack}&subject=${wt.subjectId}&chapter=${wt.chapterId}`}
                      className="shrink-0 rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700"
                    >
                      {language === 'hi' ? 'अभ्यास' : 'Practice'}
                    </Link>
                  </div>
                ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center space-y-2 dark:border-slate-700">
              <SlidersHorizontal className="mx-auto h-6 w-6 text-slate-400" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {language === 'hi' ? 'विश्लेषण प्रतीक्षित' : 'Diagnostics ready after first attempts'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'hi'
                  ? 'कमज़ोर विषय केवल आपके वास्तविक अभ्यास और परीक्षा परिणामों से निकाले जाते हैं।'
                  : 'Weak topics and revision queues are computed strictly from your real practice and submitted test accuracy.'}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default PracticeTestsHubPage;
