import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpen,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Edit3,
  FileText,
  ImagePlus,
  Layers,
  ListChecks,
  Menu,
  MessageSquarePlus,
  Play,
  RefreshCw,
  Send,
  Sparkles,
  Square,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from 'lucide-react';
import { AiMarkdownMath } from '../components/ai/AiMarkdownMath';
import { ReadAloudButton, VoiceMicButton } from '../components/ai/VoiceControls';
import { useApp } from '../contexts/AppContext';
import { useAssessments } from '../contexts/AssessmentContext';
import { useAuth } from '../contexts/AuthContext';
import { useProgress } from '../contexts/ProgressContext';
import { ALL_CURRICULUM_SUBJECTS, getSubjectsForExam } from '../data/curriculum';
import { STUDY_MATERIALS_CATALOG } from '../data/materials/studyMaterialsCatalog';
import {
  AiApiError,
  approveStudyPlanApi,
  clearConversationsApi,
  createConversationApi,
  deleteConversationApi,
  fetchAiStatusApi,
  fetchConversationsApi,
  fetchRecommendationsApi,
  fetchSavedAiQuizzesApi,
  fetchStudyPlansApi,
  generateAiQuizApi,
  generateAiSummaryApi,
  generateStudyPlanApi,
  indexPdfForAiApi,
  saveAiQuizApi,
  streamAiChatApi,
  submitAiFeedbackApi,
  updateConversationApi,
} from '../services/ai/aiApi';
import { startAssessmentAttemptApi } from '../services/assessments/assessmentApi';
import type {
  AiCitation,
  AiConversation,
  AiLanguageMode,
  AiMessage,
  AiProviderStatus,
  AiQuizGenerateParams,
  AiStudyPlan,
  AiStudyRecommendation,
  AiSummaryMode,
  AiWorkflowMode,
  GeneratedChapterSummary,
  GeneratedQuizDraft,
  PdfIndexStatus,
} from '../types/ai';
import type { DifficultyLevel } from '../types/assessment';
import type { ExamTrack } from '../types/database';

type WorkspaceTab = 'chat' | 'pdf' | 'quiz' | 'summary' | 'plan';

const SUMMARY_MODE_OPTIONS: Array<{ id: AiSummaryMode; labelEn: string; labelHi: string }> = [
  { id: 'full', labelEn: 'Full Chapter Summary', labelHi: 'पूर्ण अध्याय सारांश' },
  { id: 'short_revision', labelEn: 'Short Revision Sheet', labelHi: 'संक्षिप्त पुनरीक्षण' },
  { id: 'formulas', labelEn: 'Formulas & SI Units', labelHi: 'सूत्र व SI मात्रक' },
  { id: 'definitions', labelEn: 'Key Definitions & Laws', labelHi: 'प्रमुख परिभाषाएँ व नियम' },
  { id: 'key_concepts', labelEn: 'Core Concepts', labelHi: 'मुख्य अवधारणाएँ' },
  { id: 'derivations', labelEn: 'Important Derivations', labelHi: 'प्रमुख व्युत्पत्तियाँ' },
  { id: 'quick_notes', labelEn: 'Pocket Quick Notes', labelHi: 'त्वरित नोट्स' },
];

const AiAssistantPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const { language, primaryExam, countdowns, dailyTargetHours } = useApp();
  const { isAuthenticated, session } = useAuth();
  const { progressMap, selectedStream, selectedSubjects } = useProgress();
  const { refreshAssessmentData } = useAssessments();

  const initialTabParam = searchParams.get('tab');
  const initialTab: WorkspaceTab =
    initialTabParam === 'pdf' ||
    initialTabParam === 'quiz' ||
    initialTabParam === 'summary' ||
    initialTabParam === 'plan' ||
    initialTabParam === 'recommendations'
      ? initialTabParam === 'recommendations'
        ? 'plan'
        : initialTabParam
      : searchParams.get('material')
      ? 'pdf'
      : 'chat';

  const initialTrackParam = searchParams.get('exam') as ExamTrack | null;
  const validInitialTrack: ExamTrack =
    initialTrackParam === 'up-board-12' ||
    initialTrackParam === 'jee-main' ||
    initialTrackParam === 'jee-advanced'
      ? initialTrackParam
      : primaryExam;

  // Global Workspace State
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(initialTab);
  const [examTrack, setExamTrack] = useState<ExamTrack>(validInitialTrack);
  const [subjectId, setSubjectId] = useState<string>(searchParams.get('subject') || 'all');
  const [chapterId, setChapterId] = useState<string>(searchParams.get('chapter') || 'all');
  const [languageMode, setLanguageMode] = useState<AiLanguageMode>(language === 'hi' ? 'hi' : 'en');
  const [providerStatus, setProviderStatus] = useState<AiProviderStatus | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Conversations & Chat State
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [renamingConvId, setRenamingConvId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  const [chatSubMode, setChatSubMode] = useState<Extract<AiWorkflowMode, 'chat' | 'doubt_solver' | 'step_solver'>>(
    searchParams.get('mode') === 'doubt'
      ? 'doubt_solver'
      : searchParams.get('mode') === 'steps'
      ? 'step_solver'
      : 'chat'
  );
  const [promptText, setPromptText] = useState(searchParams.get('prompt') || '');
  const [imageAttachment, setImageAttachment] = useState<{
    base64: string;
    mimeType: string;
    name: string;
    previewUrl: string;
  } | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [streamingCitations, setStreamingCitations] = useState<AiCitation[]>([]);
  const [streamingUncertainty, setStreamingUncertainty] = useState<string | undefined>(undefined);
  const [chatError, setChatError] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // PDF RAG State
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>(
    searchParams.get('material') || ''
  );
  const [pdfConsentAccepted, setPdfConsentAccepted] = useState(false);
  const [pdfIndexing, setPdfIndexing] = useState(false);
  const [pdfIndexStatus, setPdfIndexStatus] = useState<PdfIndexStatus | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Quiz Generator State
  const [quizDifficulty, setQuizDifficulty] = useState<DifficultyLevel | 'mixed'>('mixed');
  const [quizType, setQuizType] = useState<AiQuizGenerateParams['questionType']>('mcq_single');
  const [quizCount, setQuizCount] = useState<number>(5);
  const [quizGenerating, setQuizGenerating] = useState(false);
  const [quizDraft, setQuizDraft] = useState<GeneratedQuizDraft | null>(null);
  const [savedQuizzes, setSavedQuizzes] = useState<GeneratedQuizDraft[]>([]);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [launchingQuiz, setLaunchingQuiz] = useState(false);

  // Summary State
  const [summaryMode, setSummaryMode] = useState<AiSummaryMode>('full');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryResult, setSummaryResult] = useState<GeneratedChapterSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryCopied, setSummaryCopied] = useState(false);

  // Recommendations & Study Plan State
  const [recommendations, setRecommendations] = useState<AiStudyRecommendation[]>([]);
  const [hasRealActivity, setHasRealActivity] = useState(false);
  const [recsLoading, setRecsLoading] = useState(false);
  const [planExamDate, setPlanExamDate] = useState<string>(countdowns[examTrack] || '2027-02-15');
  const [planDailyHours, setPlanDailyHours] = useState<number>(dailyTargetHours || 4);
  const [planSubjectIds, setPlanSubjectIds] = useState<string[]>([]);
  const [planGenerating, setPlanGenerating] = useState(false);
  const [draftPlan, setDraftPlan] = useState<AiStudyPlan | null>(null);
  const [approvedPlans, setApprovedPlans] = useState<AiStudyPlan[]>([]);
  const [planError, setPlanError] = useState<string | null>(null);

  const availableSubjects = useMemo(() => {
    if (examTrack === 'up-board-12') {
      return getSubjectsForExam('up-board-12', selectedStream, selectedSubjects);
    }
    return ALL_CURRICULUM_SUBJECTS.filter((s) => s.examTrack === examTrack);
  }, [examTrack, selectedStream, selectedSubjects]);

  const activeSubject = useMemo(() => {
    if (subjectId !== 'all') {
      const found = availableSubjects.find((s) => s.id === subjectId);
      if (found) return found;
    }
    return availableSubjects[0];
  }, [availableSubjects, subjectId]);

  const availableChapters = useMemo(() => {
    return activeSubject?.chapters ?? [];
  }, [activeSubject]);

  const activeChapter = useMemo(() => {
    if (chapterId !== 'all') {
      const found = availableChapters.find((c) => c.id === chapterId);
      if (found) return found;
    }
    return availableChapters[0];
  }, [availableChapters, chapterId]);

  // Authorized local PDFs eligible for RAG indexing
  const indexablePdfs = useMemo(
    () =>
      STUDY_MATERIALS_CATALOG.filter(
        (m) =>
          m.fileFormat === 'PDF' &&
          m.storageProvider === 'local-signed-storage' &&
          (examTrack ? m.examTrack === examTrack : true)
      ),
    [examTrack]
  );

  // Sync default plan subjects when examTrack changes
  useEffect(() => {
    setPlanSubjectIds(availableSubjects.map((s) => s.id));
    setPlanExamDate(countdowns[examTrack] || '2027-02-15');
  }, [examTrack, availableSubjects, countdowns]);

  // Select first PDF automatically on PDF tab if none picked
  useEffect(() => {
    if (!selectedMaterialId && indexablePdfs.length > 0) {
      setSelectedMaterialId(indexablePdfs[0].id);
    }
  }, [selectedMaterialId, indexablePdfs]);

  const loadStatusAndUserHistory = useCallback(async () => {
    try {
      const st = await fetchAiStatusApi(session);
      setProviderStatus(st);
    } catch {
      // Keep null if offline
    }

    if (!isAuthenticated || !session) {
      setConversations([]);
      setMessages([]);
      setSavedQuizzes([]);
      setApprovedPlans([]);
      return;
    }

    try {
      const [convRes, qzRes, plRes] = await Promise.all([
        fetchConversationsApi(session, activeConvId ?? undefined),
        fetchSavedAiQuizzesApi(session),
        fetchStudyPlansApi(session),
      ]);
      setConversations(convRes.conversations);
      if (activeConvId) {
        setMessages(convRes.messages);
      }
      setSavedQuizzes(qzRes.quizzes);
      setApprovedPlans(plRes.plans);
    } catch {
      // Ignore silent background load errors
    }
  }, [isAuthenticated, session, activeConvId]);

  useEffect(() => {
    void loadStatusAndUserHistory();
  }, [loadStatusAndUserHistory]);

  const loadRecommendations = useCallback(async () => {
    setRecsLoading(true);
    try {
      const res = await fetchRecommendationsApi(session, {
        examTrack,
        language,
        progressMap,
        selectedSubjectIds: availableSubjects.map((s) => s.id),
      });
      setRecommendations(res.recommendations);
      setHasRealActivity(res.hasRealActivity);
    } catch {
      setRecommendations([]);
    } finally {
      setRecsLoading(false);
    }
  }, [session, examTrack, language, progressMap, availableSubjects]);

  useEffect(() => {
    if (activeTab === 'plan') {
      void loadRecommendations();
    }
  }, [activeTab, loadRecommendations]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, streamingText]);

  // Handle Conversation Switching
  const handleSelectConversation = async (conv: AiConversation) => {
    setActiveConvId(conv.id);
    setExamTrack(conv.examTrack);
    if (conv.subjectId) setSubjectId(conv.subjectId);
    if (conv.chapterId) setChapterId(conv.chapterId);
    if (conv.materialId) setSelectedMaterialId(conv.materialId);
    setLanguageMode(conv.languageMode);
    setMobileSidebarOpen(false);
    if (session) {
      try {
        const res = await fetchConversationsApi(session, conv.id);
        setMessages(res.messages);
      } catch {
        setMessages([]);
      }
    }
  };

  const handleNewConversation = async () => {
    setActiveConvId(null);
    setMessages([]);
    setChatError(null);
    setMobileSidebarOpen(false);
    if (session && isAuthenticated) {
      try {
        const res = await createConversationApi(session, {
          title: 'New Study Session',
          examTrack,
          subjectId: subjectId !== 'all' ? subjectId : undefined,
          chapterId: chapterId !== 'all' ? chapterId : undefined,
          materialId: activeTab === 'pdf' ? selectedMaterialId : undefined,
          languageMode,
        });
        setConversations((prev) => [res.conversation, ...prev]);
        setActiveConvId(res.conversation.id);
      } catch {
        // Fallback: next sent message creates conversation automatically
      }
    }
  };

  const handleSaveRename = async (convId: string) => {
    if (!session || !renameText.trim()) {
      setRenamingConvId(null);
      return;
    }
    try {
      const res = await updateConversationApi(session, convId, { title: renameText.trim() });
      setConversations((prev) => prev.map((c) => (c.id === convId ? res.conversation : c)));
    } finally {
      setRenamingConvId(null);
    }
  };

  const handleDeleteConversation = async (convId: string) => {
    if (!session) return;
    await deleteConversationApi(session, convId);
    setConversations((prev) => prev.filter((c) => c.id !== convId));
    if (activeConvId === convId) {
      setActiveConvId(null);
      setMessages([]);
    }
  };

  const handleClearAllConversations = async () => {
    if (!session) return;
    await clearConversationsApi(session);
    setConversations([]);
    setActiveConvId(null);
    setMessages([]);
  };

  // Image attachment handler for Doubt Solver
  const handleImageFileSelect = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setChatError('Only PNG, JPEG, or WebP images are supported.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setChatError('Image file exceeds 3 MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      setImageAttachment({
        base64,
        mimeType: file.type,
        name: file.name,
        previewUrl: dataUrl,
      });
      setChatError(null);
      setChatSubMode('doubt_solver');
    };
    reader.readAsDataURL(file);
  };

  // Stream Send / Retry
  const handleSendChat = async (overridePrompt?: string, isRetry = false) => {
    const promptToSend = (overridePrompt ?? promptText).trim();
    if (!promptToSend || streaming) return;

    if (!isAuthenticated || !session) {
      setChatError('Please sign in to send messages to the PrepZone AI Tutor.');
      return;
    }

    const workflowMode: AiWorkflowMode = activeTab === 'pdf' ? 'pdf_tutor' : chatSubMode;
    if (activeTab === 'pdf' && !selectedMaterialId) {
      setPdfError('Select an authorized PDF document first.');
      return;
    }
    if (activeTab === 'pdf' && !pdfConsentAccepted) {
      setPdfError('Please accept PDF processing consent before asking PDF-grounded questions.');
      return;
    }

    setChatError(null);
    setPdfError(null);
    setStreaming(true);
    setStreamingText('');
    setStreamingCitations([]);
    setStreamingUncertainty(undefined);
    if (!isRetry) setPromptText('');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamAiChatApi(
        session,
        {
          conversationId: activeConvId ?? undefined,
          prompt: promptToSend,
          examTrack,
          subjectId: subjectId !== 'all' ? subjectId : undefined,
          chapterId: chapterId !== 'all' ? chapterId : undefined,
          materialId: activeTab === 'pdf' ? selectedMaterialId : undefined,
          languageMode,
          workflowMode,
          stepByStep: chatSubMode === 'step_solver',
          imageBase64: imageAttachment?.base64,
          imageMimeType: imageAttachment?.mimeType,
          imageName: imageAttachment?.name,
          isRetry,
        },
        {
          onMeta: (meta) => {
            setActiveConvId(meta.conversation.id);
            setConversations((prev) => {
              const exists = prev.some((c) => c.id === meta.conversation.id);
              return exists
                ? prev.map((c) => (c.id === meta.conversation.id ? meta.conversation : c))
                : [meta.conversation, ...prev];
            });
            if (meta.userMessage) {
              setMessages((prev) => [...prev, meta.userMessage!]);
            }
            setStreamingCitations(meta.citations ?? []);
            setStreamingUncertainty(meta.uncertaintyNotice);
          },
          onChunk: (piece) => {
            setStreamingText((prev) => prev + piece);
          },
          onDone: (result) => {
            setMessages((prev) => [...prev, result.assistantMessage]);
            setConversations((prev) =>
              prev.map((c) => (c.id === result.conversation.id ? result.conversation : c))
            );
            setProviderStatus((prev) => (prev ? { ...prev, usage: result.usage } : prev));
            setStreamingText('');
            setImageAttachment(null);
          },
        },
        controller.signal
      );
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        const msg = err instanceof AiApiError ? err.message : 'Unable to complete AI response.';
        setChatError(msg);
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const handleStopStream = () => {
    abortRef.current?.abort();
    setStreaming(false);
  };

  const handleRetryLast = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUser) {
      void handleSendChat(lastUser.content, true);
    }
  };

  const handleCopyMessage = async (msgId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMsgId(msgId);
      window.setTimeout(() => setCopiedMsgId(null), 1800);
    } catch {
      // Ignore clipboard deny
    }
  };

  const handleFeedback = async (msgId: string, rating: 'helpful' | 'needs_review') => {
    if (!session || !activeConvId) return;
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, feedback: rating } : m)));
    try {
      await submitAiFeedbackApi(session, { conversationId: activeConvId, messageId: msgId, rating });
    } catch {
      // Non-fatal
    }
  };

  // PDF Pre-Indexing Handler
  const handleIndexSelectedPdf = async () => {
    if (!selectedMaterialId) return;
    if (!pdfConsentAccepted) {
      setPdfError('Please confirm PDF processing consent before indexing.');
      return;
    }
    setPdfIndexing(true);
    setPdfError(null);
    try {
      const res = await indexPdfForAiApi(session, selectedMaterialId, true);
      setPdfIndexStatus(res.status);
    } catch (err) {
      setPdfError(err instanceof AiApiError ? err.message : 'Unable to extract PDF text.');
    } finally {
      setPdfIndexing(false);
    }
  };

  // AI Quiz Generator Handlers
  const handleGenerateQuiz = async () => {
    if (!isAuthenticated || !session) {
      setQuizError('Please sign in to generate AI practice quizzes.');
      return;
    }
    if (!activeSubject || !activeChapter) {
      setQuizError('Select a valid Subject and Chapter.');
      return;
    }
    setQuizGenerating(true);
    setQuizError(null);
    setQuizDraft(null);
    try {
      const res = await generateAiQuizApi(session, {
        examTrack,
        subjectId: activeSubject.id,
        chapterId: activeChapter.id,
        difficulty: quizDifficulty,
        questionType: quizType,
        questionCount: quizCount,
        languageMode,
      });
      setQuizDraft(res.draft);
      setProviderStatus((prev) => (prev ? { ...prev, usage: res.usage } : prev));
    } catch (err) {
      setQuizError(err instanceof AiApiError ? err.message : 'Quiz generation failed.');
    } finally {
      setQuizGenerating(false);
    }
  };

  const handleConfirmSaveQuiz = async () => {
    if (!session || !quizDraft) return;
    try {
      const res = await saveAiQuizApi(session, quizDraft.id);
      setQuizDraft(res.draft);
      setSavedQuizzes((prev) => [res.draft, ...prev.filter((d) => d.id !== res.draft.id)]);
      await refreshAssessmentData();
    } catch (err) {
      setQuizError(err instanceof AiApiError ? err.message : 'Failed to save generated quiz.');
    }
  };

  const handleLaunchSavedQuiz = async (draft: GeneratedQuizDraft) => {
    if (!session) return;
    setLaunchingQuiz(true);
    try {
      const startRes = await startAssessmentAttemptApi(session, {
        kind: 'quiz',
        forceNew: true,
        customQuiz: {
          examTrack: draft.examTrack,
          quizType: 'custom_quiz',
          subjectId: draft.subjectId,
          chapterId: draft.chapterId,
          title: draft.title,
          questionIds: draft.questions.map((q) => q.id),
          durationMinutes: Math.max(5, draft.questions.length * 2),
        },
      });
      navigate(`/quiz/play/${startRes.attempt.id}`);
    } catch (err) {
      setQuizError(err instanceof Error ? err.message : 'Unable to launch timed quiz.');
    } finally {
      setLaunchingQuiz(false);
    }
  };

  // Chapter Summary Handler
  const handleGenerateSummary = async (forceRefresh = false) => {
    if (!isAuthenticated || !session) {
      setSummaryError('Please sign in to generate AI chapter summaries.');
      return;
    }
    if (!activeSubject || !activeChapter) {
      setSummaryError('Select a Subject and Chapter.');
      return;
    }
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const res = await generateAiSummaryApi(session, {
        examTrack,
        subjectId: activeSubject.id,
        chapterId: activeChapter.id,
        summaryMode,
        languageMode,
        materialId: selectedMaterialId || undefined,
        forceRefresh,
      });
      setSummaryResult(res.summary);
      if (res.usage) {
        setProviderStatus((prev) => (prev ? { ...prev, usage: res.usage! } : prev));
      }
    } catch (err) {
      setSummaryError(err instanceof AiApiError ? err.message : 'Summary generation failed.');
    } finally {
      setSummaryLoading(false);
    }
  };

  // Study Plan Handlers
  const handleGenerateStudyPlan = async () => {
    if (!isAuthenticated || !session) {
      setPlanError('Please sign in to generate a personalized study plan.');
      return;
    }
    setPlanGenerating(true);
    setPlanError(null);
    try {
      const res = await generateStudyPlanApi(session, {
        examTrack,
        examDateISO: planExamDate,
        dailyHours: planDailyHours,
        selectedSubjectIds: planSubjectIds,
        languageMode,
        progressMap,
      });
      setDraftPlan(res.plan);
      setProviderStatus((prev) => (prev ? { ...prev, usage: res.usage } : prev));
    } catch (err) {
      setPlanError(err instanceof AiApiError ? err.message : 'Study plan generation failed.');
    } finally {
      setPlanGenerating(false);
    }
  };

  const handleApproveStudyPlan = async () => {
    if (!session || !draftPlan) return;
    try {
      const res = await approveStudyPlanApi(session, draftPlan);
      setDraftPlan(res.plan);
      setApprovedPlans((prev) => [res.plan, ...prev.filter((p) => p.id !== res.plan.id)]);
    } catch (err) {
      setPlanError(err instanceof AiApiError ? err.message : 'Unable to save approved plan.');
    }
  };

  const unconfigured = providerStatus !== null && !providerStatus.configured;

  const tabs: Array<{ id: WorkspaceTab; label: string; icon: React.ReactNode }> = [
    {
      id: 'chat',
      label: language === 'hi' ? 'AI ट्यूटर व संदेह समाधान' : 'Tutor & Doubt Solver',
      icon: <Sparkles className="h-4 w-4" aria-hidden="true" />,
    },
    {
      id: 'pdf',
      label: language === 'hi' ? 'PDF AI रीडर' : 'PDF AI Reader',
      icon: <FileText className="h-4 w-4" aria-hidden="true" />,
    },
    {
      id: 'quiz',
      label: language === 'hi' ? 'AI क्विज़ जनरेटर' : 'AI Quiz Generator',
      icon: <ClipboardCheck className="h-4 w-4" aria-hidden="true" />,
    },
    {
      id: 'summary',
      label: language === 'hi' ? 'अध्याय सारांश' : 'Chapter Summaries',
      icon: <Layers className="h-4 w-4" aria-hidden="true" />,
    },
    {
      id: 'plan',
      label: language === 'hi' ? 'अनुशंसा व अध्ययन योजना' : 'Recommendations & Plan',
      icon: <CalendarClock className="h-4 w-4" aria-hidden="true" />,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
              <span>PrepZone AI Study Assistant</span>
              {providerStatus && (
                <>
                  <span>·</span>
                  <span className="font-mono">{providerStatus.model}</span>
                  <span>·</span>
                  <span
                    className={
                      providerStatus.configured
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-amber-700 dark:text-amber-400'
                    }
                  >
                    {providerStatus.configured
                      ? language === 'hi'
                        ? 'सर्वर सक्रिय'
                        : 'Server Ready'
                      : language === 'hi'
                      ? 'API कुंजी लंबित'
                      : 'Provider Setup Pending'}
                  </span>
                </>
              )}
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {language === 'hi'
                ? 'PrepZone AI अध्ययन सहायक व व्यक्तिगत ट्यूटर'
                : 'PrepZone AI Study Assistant & Personal Tutor'}
            </h1>
            <p className="max-w-3xl text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {language === 'hi'
                ? 'यूपी बोर्ड कक्षा 12, जेईई मेन और जेईई एडवांस्ड के लिए चरण-दर-चरण समाधान, PDF पृष्ठ उद्धरण, AI क्विज़ व अध्ययन योजना।'
                : 'Syllabus-aligned step-by-step tutoring, PDF page-cited Q&A, multimodal doubt solving, validated AI practice quizzes, and study planning.'}
            </p>
          </div>

          {/* Quota & Mobile History Toggle */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {providerStatus?.usage && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800/50">
                <span className="text-slate-500 dark:text-slate-400">Today: </span>
                <span className="font-mono font-bold text-slate-900 tabular-nums dark:text-white">
                  {providerStatus.usage.requestsUsed}/{providerStatus.usage.dailyRequestLimit}
                </span>
                <span className="text-slate-500 dark:text-slate-400"> reqs</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setMobileSidebarOpen((v) => !v)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50 lg:hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <Menu className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              <span>History ({conversations.length})</span>
            </button>
          </div>
        </div>

        {/* Unconfigured Server Secret Banner (Never fakes AI replies) */}
        {unconfigured && (
          <div
            data-testid="ai-provider-setup-banner"
            role="status"
            className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-semibold">
                AI Generation Pending Server Secret Configuration
              </p>
              <p className="leading-relaxed">
                <code>GEMINI_API_KEY</code> is not configured in the server environment yet. Conversation management, curriculum browsing, and real analytics-based recommendations remain active; AI text/quiz/plan generation will activate once the server secret is set.
              </p>
            </div>
          </div>
        )}

        {/* Guest Notice Banner */}
        {!isAuthenticated && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs dark:border-blue-900/50 dark:bg-blue-950/30">
            <p className="font-medium text-blue-900 dark:text-blue-200">
              Sign in with your PrepZone student account to save AI conversations, index PDFs, generate quizzes, and approve personalized study plans.
            </p>
            <Link
              to="/login?next=/ai-assistant"
              className="inline-flex h-8 items-center rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 shrink-0"
            >
              Sign In to Unlock Full AI Tutor
            </Link>
          </div>
        )}

        {/* Global Academic Scope Controls */}
        <div className="mt-4 grid grid-cols-1 gap-2.5 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800">
          <div>
            <label htmlFor="ai-exam-select" className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Exam Track
            </label>
            <select
              id="ai-exam-select"
              value={examTrack}
              onChange={(e) => {
                setExamTrack(e.target.value as ExamTrack);
                setSubjectId('all');
                setChapterId('all');
                setSelectedMaterialId('');
              }}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="up-board-12">UP Board Class 12</option>
              <option value="jee-main">JEE Main</option>
              <option value="jee-advanced">JEE Advanced</option>
            </select>
          </div>

          <div>
            <label htmlFor="ai-subject-select" className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Subject
            </label>
            <select
              id="ai-subject-select"
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                setChapterId('all');
              }}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="all">
                All Track Subjects ({availableSubjects.length})
              </option>
              {availableSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name[language]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ai-chapter-select" className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Chapter Focus
            </label>
            <select
              id="ai-chapter-select"
              value={chapterId}
              onChange={(e) => setChapterId(e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="all">
                {activeSubject ? `${activeSubject.name[language]} (General)` : 'General Syllabus'}
              </option>
              {availableChapters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.order}. {c.title[language]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ai-language-select" className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Tutor Language
            </label>
            <select
              id="ai-language-select"
              value={languageMode}
              onChange={(e) => setLanguageMode(e.target.value as AiLanguageMode)}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="en">English</option>
              <option value="hi">हिन्दी (Hindi)</option>
              <option value="hinglish">Hinglish (Hindi + English)</option>
            </select>
          </div>
        </div>

        {/* Workflow Switcher Tabs */}
        <div
          role="tablist"
          aria-label="AI Tutor Workflows"
          className="mt-4 flex flex-wrap gap-1.5 border-t border-slate-100 pt-4 dark:border-slate-800"
        >
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Main Responsive Workspace Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Conversation History Sidebar */}
        <aside
          className={`${
            mobileSidebarOpen ? 'block' : 'hidden'
          } lg:col-span-3 lg:block rounded-2xl border border-slate-200 bg-white p-4 space-y-3 self-start dark:border-slate-800 dark:bg-slate-900`}
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Conversations
            </h2>
            <button
              type="button"
              onClick={() => void handleNewConversation()}
              className="inline-flex h-8 items-center gap-1 rounded-lg bg-blue-600 px-2.5 text-xs font-semibold text-white hover:bg-blue-700 whitespace-nowrap"
            >
              <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>New Chat</span>
            </button>
          </div>

          {conversations.length > 0 ? (
            <>
              <ul className="max-h-96 space-y-1.5 overflow-y-auto pr-1">
                {conversations.map((conv) => {
                  const isActive = conv.id === activeConvId;
                  return (
                    <li
                      key={conv.id}
                      className={`rounded-xl border p-2.5 transition-colors ${
                        isActive
                          ? 'border-blue-600 bg-blue-50/70 dark:border-blue-500 dark:bg-blue-950/40'
                          : 'border-slate-200 bg-slate-50/50 hover:border-blue-300 dark:border-slate-800 dark:bg-slate-800/40'
                      }`}
                    >
                      {renamingConvId === conv.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={renameText}
                            onChange={(e) => setRenameText(e.target.value)}
                            aria-label="Rename conversation title"
                            className="h-7 min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={() => void handleSaveRename(conv.id)}
                            aria-label="Save rename"
                            className="flex h-7 w-7 items-center justify-center rounded bg-blue-600 text-white"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => void handleSelectConversation(conv)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                              {conv.title}
                            </p>
                            <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                              {conv.examTrack} · {conv.messageCount} msgs
                            </p>
                          </button>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setRenamingConvId(conv.id);
                                setRenameText(conv.title);
                              }}
                              aria-label="Rename conversation"
                              className="rounded p-1 text-slate-400 hover:text-blue-600"
                            >
                              <Edit3 className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteConversation(conv.id)}
                              aria-label="Delete conversation"
                              className="rounded p-1 text-slate-400 hover:text-red-600"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                onClick={() => void handleClearAllConversations()}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-red-600 dark:text-slate-400"
              >
                <Trash2 className="h-3 w-3" aria-hidden="true" />
                <span>Clear All History</span>
              </button>
            </>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              {isAuthenticated
                ? 'No saved conversations yet. Start a doubt or topic chat on the right.'
                : 'Sign in to view and manage your saved conversation history.'}
            </p>
          )}
        </aside>

        {/* Primary Workflow Panel */}
        <div className="lg:col-span-9 space-y-5">
          {/* ============================================================== */}
          {/* TAB 1 & TAB 2: AI TUTOR / DOUBT SOLVER & PDF AI READER         */}
          {/* ============================================================== */}
          {(activeTab === 'chat' || activeTab === 'pdf') && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 dark:border-slate-800 dark:bg-slate-900">
              {activeTab === 'pdf' ? (
                <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900/50 dark:bg-blue-950/30">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                      PDF-Grounded AI Study (Page-Cited Retrieval)
                    </h2>
                    {selectedMaterialId && (
                      <Link
                        to={`/pdf-library/view/${selectedMaterialId}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                      >
                        <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Open in PDF Viewer</span>
                      </Link>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                    <div className="md:col-span-8">
                      <label htmlFor="ai-pdf-select" className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        Select Authorized Study Material PDF
                      </label>
                      <select
                        id="ai-pdf-select"
                        value={selectedMaterialId}
                        onChange={(e) => {
                          setSelectedMaterialId(e.target.value);
                          setPdfIndexStatus(null);
                          setPdfError(null);
                        }}
                        className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      >
                        {indexablePdfs.map((mat) => (
                          <option key={mat.id} value={mat.id}>
                            {mat.title[language]} ({mat.pageCount ?? '?'} pages)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end md:col-span-4">
                      <button
                        type="button"
                        onClick={() => void handleIndexSelectedPdf()}
                        disabled={pdfIndexing || !selectedMaterialId}
                        className="h-9 w-full rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                      >
                        {pdfIndexing ? 'Extracting Pages...' : 'Extract & Index PDF'}
                      </button>
                    </div>
                  </div>

                  <label className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pdfConsentAccepted}
                      onChange={(e) => setPdfConsentAccepted(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600"
                    />
                    <span>
                      I consent to extracting text chunks from this authorized PrepZone PDF for page-cited AI explanations (copyrighted external websites are excluded and linked directly).
                    </span>
                  </label>

                  {pdfIndexStatus && (
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      Ready: Indexed {pdfIndexStatus.pageCount} pages into {pdfIndexStatus.chunkCount} searchable chunks. Ask any question below to get exact Page citations!
                    </p>
                  )}
                  {pdfError && (
                    <p role="alert" className="text-xs font-semibold text-red-600 dark:text-red-400">
                      {pdfError}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tutor response mode">
                    {(
                      [
                        { id: 'chat', label: 'Academic Tutor' },
                        { id: 'doubt_solver', label: 'Doubt Solver (Text / Image)' },
                        { id: 'step_solver', label: 'Step-by-Step Solver' },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setChatSubMode(m.id)}
                        aria-pressed={chatSubMode === m.id}
                        className={`h-8 rounded-lg border px-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                          chatSubMode === m.id
                            ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-300'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {/* Quick Prompt Chips */}
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setPromptText(
                          activeChapter
                            ? `Explain key concepts and common exam mistakes in ${activeChapter.title.en}.`
                            : "Derive electric field due to an infinite plane sheet using Gauss's law."
                        )
                      }
                      className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      + Suggested Prompt
                    </button>
                  </div>
                </div>
              )}

              {/* Messages Thread */}
              <div
                ref={chatScrollRef}
                className="min-h-[320px] max-h-[500px] space-y-4 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/40"
              >
                {messages.length === 0 && !streaming && (
                  <div className="flex h-64 flex-col items-center justify-center text-center space-y-2">
                    <Sparkles className="h-7 w-7 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                    <p className="font-display text-sm font-bold text-slate-900 dark:text-white">
                      {activeTab === 'pdf'
                        ? 'Ask Questions About Your Selected PDF'
                        : 'Ask Any UP Board or JEE Academic Question'}
                    </p>
                    <p className="max-w-md text-xs text-slate-500 dark:text-slate-400">
                      {activeTab === 'pdf'
                        ? 'Answers include verified Page citations and clearly warn if a concept is not covered inside the PDF.'
                        : 'Supports LaTeX math, step-by-step physics/chemistry/maths derivations, Hindi/English/Hinglish, voice input, and uploaded question images.'}
                    </p>
                  </div>
                )}

                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded-2xl p-4 ${
                      msg.role === 'user'
                        ? 'ml-auto max-w-2xl border border-blue-200 bg-blue-600 text-white'
                        : 'mr-auto max-w-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                    }`}
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] opacity-80">
                      <span className="font-semibold">
                        {msg.role === 'user' ? 'You' : 'PrepZone AI Tutor'}
                        {msg.hasImageAttachment && msg.imageName ? ` · Image: ${msg.imageName}` : ''}
                      </span>
                      <span>{msg.languageMode.toUpperCase()}</span>
                    </div>

                    {msg.role === 'user' ? (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                    ) : (
                      <div className="space-y-3">
                        {msg.uncertaintyNotice && (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                            {msg.uncertaintyNotice}
                          </div>
                        )}

                        <AiMarkdownMath content={msg.content} />

                        {msg.citations && msg.citations.length > 0 && (
                          <div className="space-y-1.5 border-t border-slate-100 pt-2.5 dark:border-slate-800">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Referenced PDF Pages
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {msg.citations.map((cit, cIdx) => (
                                <Link
                                  key={cIdx}
                                  to={
                                    cit.materialId
                                      ? `/pdf-library/view/${cit.materialId}`
                                      : '/pdf-library'
                                  }
                                  title={cit.excerpt}
                                  className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
                                >
                                  <FileText className="h-3 w-3" aria-hidden="true" />
                                  <span>
                                    {cit.materialTitle.slice(0, 32)}
                                    {cit.pageNumber ? ` · Page ${cit.pageNumber}` : ''}
                                  </span>
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Action Bar: Copy, Listen, Helpful, Needs Review */}
                        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2.5 dark:border-slate-800">
                          <button
                            type="button"
                            onClick={() => void handleCopyMessage(msg.id, msg.content)}
                            className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-600 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          >
                            <Copy className="h-3 w-3" aria-hidden="true" />
                            <span>{copiedMsgId === msg.id ? 'Copied' : 'Copy'}</span>
                          </button>

                          <ReadAloudButton text={msg.content} languageMode={msg.languageMode} />

                          <button
                            type="button"
                            onClick={() => void handleFeedback(msg.id, 'helpful')}
                            aria-pressed={msg.feedback === 'helpful'}
                            className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-semibold ${
                              msg.feedback === 'helpful'
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : 'border-slate-200 bg-white text-slate-600 hover:text-emerald-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            <ThumbsUp className="h-3 w-3" aria-hidden="true" />
                            <span>Helpful</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleFeedback(msg.id, 'needs_review')}
                            aria-pressed={msg.feedback === 'needs_review'}
                            className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-semibold ${
                              msg.feedback === 'needs_review'
                                ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                : 'border-slate-200 bg-white text-slate-600 hover:text-amber-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            <ThumbsDown className="h-3 w-3" aria-hidden="true" />
                            <span>Needs Review</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Live SSE Streaming Bubble */}
                {streaming && (
                  <div className="mr-auto max-w-3xl rounded-2xl border border-blue-200 bg-white p-4 space-y-2 dark:border-blue-800 dark:bg-slate-900">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                      <span>PrepZone AI Tutor · Streaming...</span>
                    </div>
                    {streamingUncertainty && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                        {streamingUncertainty}
                      </div>
                    )}
                    {streamingText ? (
                      <AiMarkdownMath content={streamingText} />
                    ) : (
                      <p className="text-xs text-slate-500">Thinking and preparing step-by-step explanation...</p>
                    )}
                    {streamingCitations.length > 0 && (
                      <p className="text-[11px] text-slate-500">
                        Grounding with {streamingCitations.length} PDF excerpt(s)...
                      </p>
                    )}
                  </div>
                )}
              </div>

              {chatError && (
                <div
                  role="alert"
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
                >
                  <span>{chatError}</span>
                  {messages.some((m) => m.role === 'user') && (
                    <button
                      type="button"
                      onClick={handleRetryLast}
                      className="inline-flex items-center gap-1 font-semibold underline"
                    >
                      <RefreshCw className="h-3 w-3" aria-hidden="true" />
                      <span>Retry</span>
                    </button>
                  )}
                </div>
              )}

              {/* Image Preview Strip (Doubt Solver) */}
              {imageAttachment && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/50 p-2.5 dark:border-blue-900/40 dark:bg-blue-950/20">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={imageAttachment.previewUrl}
                      alt="Uploaded doubt preview"
                      className="h-12 w-12 rounded-lg border border-slate-200 object-cover"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                        {imageAttachment.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Attached for multimodal Doubt Solver
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setImageAttachment(null)}
                    aria-label="Remove attached image"
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Prompt Composer */}
              <div className="space-y-2.5">
                <textarea
                  rows={3}
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleSendChat();
                    }
                  }}
                  placeholder={
                    activeTab === 'pdf'
                      ? 'Ask a question from the selected PDF (e.g., "Summarize page 2 formulas")...'
                      : chatSubMode === 'doubt_solver'
                      ? 'Type your physics/chemistry/maths doubt or attach a question image below...'
                      : 'Ask any concept, numerical, or derivation (Enter to send, Shift+Enter for new line)...'
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />

                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleImageFileSelect}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={streaming}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      <ImagePlus className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                      <span>Upload Doubt Image</span>
                    </button>

                    <VoiceMicButton
                      languageMode={languageMode}
                      disabled={streaming}
                      onTranscript={(spoken) =>
                        setPromptText((prev) => (prev ? `${prev} ${spoken}` : spoken))
                      }
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    {messages.some((m) => m.role === 'user') && !streaming && (
                      <button
                        type="button"
                        onClick={handleRetryLast}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Retry Last</span>
                      </button>
                    )}

                    {streaming ? (
                      <button
                        type="button"
                        onClick={handleStopStream}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-red-600 px-4 text-xs font-semibold text-white hover:bg-red-700"
                      >
                        <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                        <span>Stop Generation</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleSendChat()}
                        disabled={!promptText.trim()}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        <Send className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Ask Tutor</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ============================================================== */}
          {/* TAB 3: AI QUIZ GENERATOR                                       */}
          {/* ============================================================== */}
          {activeTab === 'quiz' && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="space-y-1">
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  AI Practice Quiz Generator
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Generates syllabus-aligned practice sets marked transparently as AI-Generated (never labeled as verified official PYQs). Preview and confirm before saving to your practice pool.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor="quiz-diff" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Difficulty
                  </label>
                  <select
                    id="quiz-diff"
                    value={quizDifficulty}
                    onChange={(e) => setQuizDifficulty(e.target.value as DifficultyLevel | 'mixed')}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="mixed">Mixed</option>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="quiz-type" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Question Format
                  </label>
                  <select
                    id="quiz-type"
                    value={quizType}
                    onChange={(e) => setQuizType(e.target.value as AiQuizGenerateParams['questionType'])}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="mcq_single">Single-Choice MCQ</option>
                    <option value="numerical">Numerical Value</option>
                    <option value="true_false">True / False</option>
                    <option value="short_answer">Short Answer (Board)</option>
                    <option value="mixed">Mixed Formats</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="quiz-count" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Question Count
                  </label>
                  <select
                    id="quiz-count"
                    value={quizCount}
                    onChange={(e) => setQuizCount(Number(e.target.value))}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value={3}>3 Questions</option>
                    <option value={5}>5 Questions</option>
                    <option value={8}>8 Questions</option>
                    <option value={10}>10 Questions</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleGenerateQuiz()}
                  disabled={quizGenerating || !activeSubject || !activeChapter}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  <span>
                    {quizGenerating
                      ? 'Generating & Validating Questions...'
                      : `Generate ${quizCount}-Question Preview`}
                  </span>
                </button>
                {activeSubject && activeChapter && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Scope: {activeSubject.name[language]} · {activeChapter.title[language]}
                  </span>
                )}
              </div>

              {quizError && (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                  {quizError}
                </div>
              )}

              {/* Preview Generated Draft Before Saving */}
              {quizDraft && (
                <div className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                        AI-Generated Practice Preview · Not an Official PYQ
                      </p>
                      <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                        {quizDraft.title[language === 'hi' ? 'hi' : 'en']} ({quizDraft.questions.length} validated)
                      </h3>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {!quizDraft.savedToBank ? (
                        <button
                          type="button"
                          onClick={() => void handleConfirmSaveQuiz()}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                          <span>Confirm & Save to Practice Pool</span>
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleLaunchSavedQuiz(quizDraft)}
                            disabled={launchingQuiz}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-xs font-semibold text-white hover:bg-blue-700"
                          >
                            <Play className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>{launchingQuiz ? 'Starting...' : 'Launch Timed Quiz'}</span>
                          </button>
                          <Link
                            to={`/practice?ids=${encodeURIComponent(quizDraft.questions.map((q) => q.id).join(','))}`}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          >
                            <span>Open in Practice Mode</span>
                          </Link>
                        </>
                      )}
                    </div>
                  </div>

                  <ol className="space-y-3">
                    {quizDraft.questions.map((q, qIdx) => (
                      <li
                        key={q.id}
                        className="rounded-xl border border-slate-200 bg-white p-4 space-y-2 dark:border-slate-800 dark:bg-slate-900"
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          <span>
                            Q{qIdx + 1} · {q.questionType} · {q.difficulty}
                          </span>
                          <span>{q.sourceLabel[language === 'hi' ? 'hi' : 'en']}</span>
                        </div>
                        <div className="text-sm font-medium text-slate-900 dark:text-white">
                          <AiMarkdownMath content={q.prompt[language === 'hi' ? 'hi' : 'en']} />
                        </div>
                        {q.options && (
                          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 text-xs">
                            {q.options.map((o) => {
                              const isAns = q.answerKey.correctOptionIds?.includes(o.id);
                              return (
                                <li
                                  key={o.id}
                                  className={`rounded-lg border px-2.5 py-1.5 ${
                                    isAns
                                      ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200'
                                      : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200'
                                  }`}
                                >
                                  <span className="font-bold">{o.label}. </span>
                                  <AiMarkdownMath content={o.text[language === 'hi' ? 'hi' : 'en']} />
                                </li>
                              );
                            })}
                          </ul>
                        )}
                        <div className="text-xs text-slate-600 dark:text-slate-300">
                          <span className="font-semibold text-slate-900 dark:text-white">Solution: </span>
                          {q.answerKey.explanation[language === 'hi' ? 'hi' : 'en']}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Saved AI Quizzes */}
              {savedQuizzes.length > 0 && (
                <div className="space-y-2.5 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Your Saved AI Quizzes ({savedQuizzes.length})
                  </h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {savedQuizzes.map((sq) => (
                      <div
                        key={sq.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                            {sq.title[language === 'hi' ? 'hi' : 'en']}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {sq.questions.length} AI questions · {sq.examTrack}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleLaunchSavedQuiz(sq)}
                          className="h-8 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 shrink-0"
                        >
                          Start
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ============================================================== */}
          {/* TAB 4: AI CHAPTER SUMMARIES & STUDY NOTES                      */}
          {/* ============================================================== */}
          {activeTab === 'summary' && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="space-y-1">
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  AI Chapter Summaries & Formula Revision Notes
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Generates structured revision sheets mapped to PrepZone's official syllabus topics and optional study PDFs. Cached per chapter & mode for fast reuse.
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {SUMMARY_MODE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSummaryMode(opt.id)}
                    aria-pressed={summaryMode === opt.id}
                    className={`h-8 rounded-lg border px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                      summaryMode === opt.id
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {language === 'hi' ? opt.labelHi : opt.labelEn}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleGenerateSummary(false)}
                  disabled={summaryLoading || !activeSubject || !activeChapter}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  <span>{summaryLoading ? 'Generating Notes...' : 'Generate Chapter Notes'}</span>
                </button>
                {activeChapter && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Chapter: {activeChapter.order}. {activeChapter.title[language]}
                  </span>
                )}
              </div>

              {summaryError && (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                  {summaryError}
                </div>
              )}

              {summaryResult && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-5 space-y-4 dark:border-slate-800 dark:bg-slate-800/30">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-700">
                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                      {summaryResult.cached ? 'Loaded from Summary Cache' : 'Freshly Generated'} ·{' '}
                      {summaryResult.summaryMode.replace(/_/g, ' ')}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await navigator.clipboard.writeText(summaryResult.content);
                          setSummaryCopied(true);
                          window.setTimeout(() => setSummaryCopied(false), 1800);
                        }}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{summaryCopied ? 'Copied' : 'Copy Notes'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleGenerateSummary(true)}
                        disabled={summaryLoading}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Regenerate</span>
                      </button>
                    </div>
                  </div>

                  <AiMarkdownMath content={summaryResult.content} />
                </div>
              )}
            </section>
          )}

          {/* ============================================================== */}
          {/* TAB 5: REAL RECOMMENDATIONS & PERSONAL STUDY PLAN BUILDER      */}
          {/* ============================================================== */}
          {activeTab === 'plan' && (
            <div className="space-y-5">
              {/* Personalized Study Recommendations (Strictly Real Logs) */}
              <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                      Personalized Study Recommendations
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {hasRealActivity
                        ? 'Computed directly from your real chapter completion progress, practice accuracy, and mock test logs.'
                        : 'No recorded practice or test history yet — showing honest syllabus starter guidance without fabricated scores.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadRecommendations()}
                    disabled={recsLoading}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${recsLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
                    <span>Refresh</span>
                  </button>
                </div>

                {recommendations.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {recommendations.map((rec) => (
                      <article
                        key={rec.id}
                        className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3 dark:border-slate-800 dark:bg-slate-800/40"
                      >
                        <div className="space-y-1">
                          <span
                            className={`text-[11px] font-bold uppercase tracking-wide ${
                              rec.priority === 'high'
                                ? 'text-red-600 dark:text-red-400'
                                : rec.priority === 'medium'
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {rec.priority} priority · {rec.kind.replace(/_/g, ' ')}
                          </span>
                          <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                            {rec.title}
                          </h3>
                          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                            {rec.reason}
                          </p>
                        </div>
                        <Link
                          to={rec.actionRoute}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                        >
                          <span>{rec.actionLabel}</span>
                        </Link>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Loading real syllabus recommendations...
                  </p>
                )}
              </section>

              {/* Personal Study Plan Generator */}
              <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5 dark:border-slate-800 dark:bg-slate-900">
                <div className="space-y-1">
                  <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                    AI Personal Study Plan Builder
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Generates a structured weekly schedule from your target exam date, daily study hours, selected subjects, pending chapters, and weak topics. Review and approve before saving.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="plan-date" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Target Exam Date
                    </label>
                    <input
                      id="plan-date"
                      type="date"
                      value={planExamDate}
                      onChange={(e) => setPlanExamDate(e.target.value)}
                      className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="plan-hours" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Daily Study Hours ({planDailyHours}h)
                    </label>
                    <input
                      id="plan-hours"
                      type="number"
                      min={0.5}
                      max={16}
                      step={0.5}
                      value={planDailyHours}
                      onChange={(e) => setPlanDailyHours(Number(e.target.value))}
                      className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Included Subjects
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {availableSubjects.map((sub) => {
                      const checked = planSubjectIds.includes(sub.id);
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          aria-pressed={checked}
                          onClick={() =>
                            setPlanSubjectIds((prev) =>
                              prev.includes(sub.id)
                                ? prev.length > 1
                                  ? prev.filter((id) => id !== sub.id)
                                  : prev
                                : [...prev, sub.id]
                            )
                          }
                          className={`h-8 rounded-lg border px-3 text-xs font-semibold transition-colors ${
                            checked
                              ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-300'
                              : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {sub.name[language]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleGenerateStudyPlan()}
                  disabled={planGenerating}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <ListChecks className="h-4 w-4" aria-hidden="true" />
                  <span>{planGenerating ? 'Building Study Plan Draft...' : 'Generate Study Plan Draft'}</span>
                </button>

                {planError && (
                  <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                    {planError}
                  </div>
                )}

                {draftPlan && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-5 space-y-4 dark:border-blue-900/50 dark:bg-blue-950/20">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                          {draftPlan.status === 'approved' ? 'Approved Personal Study Plan' : 'Draft Study Plan — Review Before Saving'}
                        </p>
                        <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                          {draftPlan.title}
                        </h3>
                      </div>
                      {draftPlan.status === 'draft' && (
                        <button
                          type="button"
                          onClick={() => void handleApproveStudyPlan()}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                          <span>Approve & Save Plan</span>
                        </button>
                      )}
                    </div>

                    <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                      {draftPlan.summaryNote}
                    </p>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {draftPlan.weeklySchedule.map((slot, sIdx) => (
                        <div
                          key={sIdx}
                          className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900"
                        >
                          <div className="flex items-center justify-between text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                            <span>
                              {slot.dayLabel} · {slot.focusSubject}
                            </span>
                            <span className="font-mono">{slot.durationMinutes} min</span>
                          </div>
                          <p className="mt-1 text-xs font-bold text-slate-900 dark:text-white">
                            {slot.chapterTitle}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                            {slot.activity}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {approvedPlans.length > 0 && (
                  <div className="space-y-2.5 border-t border-slate-100 pt-4 dark:border-slate-800">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Saved Approved Study Plans ({approvedPlans.length})
                    </h3>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {approvedPlans.map((pl) => (
                        <div
                          key={pl.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                              {pl.title}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {pl.dailyHours}h/day · Target {pl.examDateISO}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setDraftPlan(pl)}
                            className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          >
                            View
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AiAssistantPage;
