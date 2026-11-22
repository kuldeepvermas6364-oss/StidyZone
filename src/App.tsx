import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { PLATFORM_MODULES } from './config/modules';
import { AppProvider } from './contexts/AppContext';
import { AuthProvider } from './contexts/AuthContext';
import { MaterialsProvider } from './contexts/MaterialsContext';
import { ProgressProvider } from './contexts/ProgressContext';
import { AssessmentProvider } from './contexts/AssessmentContext';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { ErrorBoundary } from './components/common/ErrorBoundary';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ExamSyllabusPage = lazy(() => import('./pages/ExamSyllabusPage'));
const SubjectDetailPage = lazy(() => import('./pages/SubjectDetailPage'));
const ChapterDetailPage = lazy(() => import('./pages/ChapterDetailPage'));
const PdfLibraryPage = lazy(() => import('./pages/PdfLibraryPage'));
const PdfViewerPage = lazy(() => import('./pages/PdfViewerPage'));
const VideoLecturesPage = lazy(() => import('./pages/VideoLecturesPage'));
const VideoDetailPage = lazy(() => import('./pages/VideoDetailPage'));
const PracticeTestsHubPage = lazy(() => import('./pages/PracticeTestsHubPage'));
const QuestionBankPage = lazy(() => import('./pages/QuestionBankPage'));
const PracticeModePage = lazy(() => import('./pages/PracticeModePage'));
const QuizEnginePage = lazy(() => import('./pages/QuizEnginePage'));
const ExamSimulatorPage = lazy(() => import('./pages/ExamSimulatorPage'));
const ExamResultPage = lazy(() => import('./pages/ExamResultPage'));
const AiAssistantPage = lazy(() => import('./pages/AiAssistantPage'));
const BookmarksPage = lazy(() => import('./pages/BookmarksPage'));
const IntegrationsHubPage = lazy(() => import('./pages/IntegrationsHubPage'));
const ModuleSetupPage = lazy(() => import('./pages/ModuleSetupPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));

const RouteFallback: React.FC = () => (
  <div className="mx-auto max-w-4xl space-y-4 py-6" aria-busy="true" aria-label="Loading view">
    <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
    <div className="h-40 w-full animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
  </div>
);

export default function App() {
  const scheduledModules = PLATFORM_MODULES.filter((m) => m.status === 'scheduled');

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppProvider>
          <AuthProvider>
            <ProgressProvider>
              <MaterialsProvider>
                <AssessmentProvider>
                  <AppShell>
                    <Suspense fallback={<RouteFallback />}>
                      <Routes>
                        <Route path="/" element={<DashboardPage />} />

                        <Route
                          path="/up-board-class-12"
                          element={<ExamSyllabusPage examTrack="up-board-12" />}
                        />
                        <Route
                          path="/jee-main"
                          element={<ExamSyllabusPage examTrack="jee-main" />}
                        />
                        <Route
                          path="/jee-advanced"
                          element={<ExamSyllabusPage examTrack="jee-advanced" />}
                        />
                        <Route
                          path="/syllabus/:examTrack/:subjectId"
                          element={<SubjectDetailPage />}
                        />
                        <Route
                          path="/syllabus/:examTrack/:subjectId/:chapterId"
                          element={<ChapterDetailPage />}
                        />

                        <Route path="/pdf-library" element={<PdfLibraryPage />} />
                        <Route path="/pdf-library/view/:materialId" element={<PdfViewerPage />} />
                        <Route path="/video-lectures" element={<VideoLecturesPage />} />
                        <Route path="/video-lectures/:videoId" element={<VideoDetailPage />} />

                        <Route path="/practice-tests" element={<PracticeTestsHubPage />} />
                        <Route path="/question-bank" element={<QuestionBankPage />} />
                        <Route path="/practice" element={<PracticeModePage />} />
                        <Route path="/quiz" element={<QuizEnginePage />} />
                        <Route path="/quiz/play/:attemptId" element={<QuizEnginePage />} />
                        <Route path="/exam-simulator" element={<ExamSimulatorPage />} />
                        <Route path="/exam-simulator/:configId" element={<ExamSimulatorPage />} />
                        <Route path="/exam-results/:attemptId" element={<ExamResultPage />} />
                        <Route path="/ai-assistant" element={<AiAssistantPage />} />

                        <Route path="/bookmarks" element={<BookmarksPage />} />
                        <Route path="/settings/integrations" element={<IntegrationsHubPage />} />

                        {scheduledModules.map((mod) => (
                          <Route
                            key={mod.id}
                            path={mod.path}
                            element={<ModuleSetupPage module={mod} />}
                          />
                        ))}

                        <Route path="/settings" element={<SettingsPage />} />
                        <Route path="/login" element={<AuthPage mode="login" />} />
                        <Route path="/register" element={<AuthPage mode="register" />} />
                        <Route
                          path="/profile"
                          element={
                            <ProtectedRoute>
                              <ProfilePage />
                            </ProtectedRoute>
                          }
                        />
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </Suspense>
                  </AppShell>
                </AssessmentProvider>
              </MaterialsProvider>
            </ProgressProvider>
          </AuthProvider>
        </AppProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
