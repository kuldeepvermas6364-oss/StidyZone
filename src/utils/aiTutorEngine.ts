import type {
  AiCitation,
  AiLanguageMode,
  AiQuizGenerateParams,
  AiStudyPlan,
  AiStudyRecommendation,
  AiSummaryMode,
  DocumentChunkRecord,
} from '../types/ai';
import type {
  AssessmentAttempt,
  DifficultyLevel,
  FullQuestionRecord,
  PracticeHistoryEntry,
  QuestionType,
  StudentPerformanceAnalytics,
} from '../types/assessment';
import type { CurriculumChapter, CurriculumSubject } from '../types/curriculum';
import type { ExamTrack } from '../types/database';
import type { ProgressMap } from './curriculumProgress';
import { getChapterProgress } from './curriculumProgress';

export const MAX_PROMPT_CHARS = 4000;
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3 MB decoded limit
export const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export interface PdfPageText {
  pageNumber: number;
  text: string;
}

export interface RetrievedPdfChunk {
  chunk: DocumentChunkRecord;
  score: number;
}

export function estimateTokens(text: string): number {
  const clean = text.trim();
  if (!clean) return 0;
  return Math.max(1, Math.ceil(clean.length / 4));
}

export function validatePromptInput(
  rawPrompt: unknown
): { ok: true; prompt: string } | { ok: false; error: string } {
  if (typeof rawPrompt !== 'string') {
    return { ok: false, error: 'Prompt must be a text string.' };
  }
  const normalized = rawPrompt.replace(/\r\n/g, '\n').trim();
  if (normalized.length === 0) {
    return { ok: false, error: 'Please enter a question or study prompt before sending.' };
  }
  if (normalized.length > MAX_PROMPT_CHARS) {
    return {
      ok: false,
      error: `Prompt exceeds the ${MAX_PROMPT_CHARS}-character safety limit (${normalized.length} characters provided).`,
    };
  }
  return { ok: true, prompt: normalized };
}

export function validateImageAttachment(
  imageBase64?: unknown,
  mimeType?: unknown
): { ok: true; data?: { base64: string; mimeType: string } } | { ok: false; error: string } {
  if (!imageBase64) return { ok: true };
  if (typeof imageBase64 !== 'string' || typeof mimeType !== 'string') {
    return { ok: false, error: 'Invalid image attachment payload.' };
  }
  const normalizedMime = mimeType.toLowerCase().trim();
  if (!ALLOWED_IMAGE_MIME_TYPES.has(normalizedMime)) {
    return { ok: false, error: 'Only PNG, JPEG, or WebP images are supported for doubt solving.' };
  }
  const stripped = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '').trim();
  if (!/^[A-Za-z0-9+/=]+$/.test(stripped)) {
    return { ok: false, error: 'Image attachment data is malformed.' };
  }
  const estimatedBytes = Math.floor((stripped.length * 3) / 4);
  if (estimatedBytes > MAX_IMAGE_BYTES) {
    return { ok: false, error: 'Image size exceeds the 3 MB upload limit.' };
  }
  return { ok: true, data: { base64: stripped, mimeType: normalizedMime } };
}

export function tokenizeMultilingual(text: string): string[] {
  const lower = text.toLowerCase();
  const matches = lower.match(/[\p{L}\p{N}]{2,}/gu);
  return matches ?? [];
}

/**
 * Deterministic lightweight 64-dim hashed trigram + token embedding vector
 * so every stored PDF chunk carries a normalized semantic fingerprint alongside BM25 terms.
 */
export function hashTextEmbedding(text: string, dims = 64): number[] {
  const vec = new Array<number>(dims).fill(0);
  const tokens = tokenizeMultilingual(text);
  if (tokens.length === 0) return vec;

  for (const tok of tokens) {
    let h = 2166136261;
    for (let i = 0; i < tok.length; i += 1) {
      h ^= tok.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const idx = Math.abs(h) % dims;
    vec[idx] += 1;

    if (tok.length >= 3) {
      for (let j = 0; j <= tok.length - 3; j += 1) {
        const tri = tok.slice(j, j + 3);
        let th = 2166136261;
        for (let k = 0; k < tri.length; k += 1) {
          th ^= tri.charCodeAt(k);
          th = Math.imul(th, 16777619);
        }
        const tIdx = Math.abs(th) % dims;
        vec[tIdx] += 0.35;
      }
    }
  }

  let norm = 0;
  for (let i = 0; i < dims; i += 1) norm += vec[i] * vec[i];
  const mag = Math.sqrt(norm);
  if (mag > 0) {
    for (let i = 0; i < dims; i += 1) vec[i] = Number((vec[i] / mag).toFixed(5));
  }
  return vec;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let dot = 0;
  for (let i = 0; i < len; i += 1) dot += a[i] * b[i];
  return dot;
}

/**
 * Page-aware sliding-window chunking preserving exact 1-based pageNumber for citations.
 */
export function chunkPdfPages(
  materialId: string,
  pages: PdfPageText[],
  chunkSizeChars = 900,
  overlapChars = 160
): DocumentChunkRecord[] {
  const chunks: DocumentChunkRecord[] = [];
  const safeSize = Math.max(250, chunkSizeChars);
  const safeOverlap = Math.min(Math.floor(safeSize / 2), Math.max(40, overlapChars));

  for (const page of pages) {
    const cleanText = page.text.replace(/\s+/g, ' ').trim();
    if (!cleanText) continue;

    let start = 0;
    let chunkIndex = 0;
    while (start < cleanText.length) {
      const end = Math.min(cleanText.length, start + safeSize);
      const slice = cleanText.slice(start, end).trim();
      if (slice.length > 0) {
        chunks.push({
          id: `${materialId}-p${page.pageNumber}-c${chunkIndex}`,
          materialId,
          pageNumber: page.pageNumber,
          chunkIndex,
          text: slice,
          tokenEstimate: estimateTokens(slice),
          embedding: hashTextEmbedding(slice),
        });
      }
      if (end >= cleanText.length) break;
      start = Math.max(start + 1, end - safeOverlap);
      chunkIndex += 1;
    }
  }

  return chunks;
}

/**
 * Hybrid BM25-style lexical + hashed embedding retrieval over page-numbered PDF chunks.
 */
export function retrieveRelevantPdfChunks(
  query: string,
  chunks: DocumentChunkRecord[],
  topK = 4
): RetrievedPdfChunk[] {
  if (!query.trim() || chunks.length === 0) return [];
  const qTokens = tokenizeMultilingual(query);
  const qVec = hashTextEmbedding(query);
  const normalizedQuery = query.trim().toLowerCase();

  const avgLen =
    chunks.reduce((acc, c) => acc + Math.max(1, c.text.length), 0) / Math.max(1, chunks.length);

  // Document frequency per query token
  const df = new Map<string, number>();
  for (const tok of new Set(qTokens)) {
    let count = 0;
    for (const c of chunks) {
      if (c.text.toLowerCase().includes(tok)) count += 1;
    }
    df.set(tok, count);
  }

  const scored: RetrievedPdfChunk[] = [];
  for (const chunk of chunks) {
    const lower = chunk.text.toLowerCase();
    const docTokens = tokenizeMultilingual(chunk.text);
    const tfMap = new Map<string, number>();
    for (const dt of docTokens) {
      tfMap.set(dt, (tfMap.get(dt) ?? 0) + 1);
    }

    let bm25 = 0;
    const k1 = 1.4;
    const b = 0.75;
    const dlNorm = chunk.text.length / Math.max(1, avgLen);

    for (const tok of qTokens) {
      const tf = tfMap.get(tok) ?? 0;
      if (tf === 0) continue;
      const docFreq = df.get(tok) ?? 0;
      const idf = Math.log(1 + (chunks.length - docFreq + 0.5) / (docFreq + 0.5));
      bm25 += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + b * dlNorm)));
    }

    const phraseBonus = normalizedQuery.length >= 6 && lower.includes(normalizedQuery) ? 2.5 : 0;
    const vecSim = chunk.embedding ? cosineSimilarity(qVec, chunk.embedding) : 0;

    // Require either at least one real term/phrase match or strong semantic vector overlap
    if (bm25 === 0 && phraseBonus === 0 && vecSim < 0.45) {
      continue;
    }

    const totalScore = bm25 + phraseBonus + vecSim * 1.25;
    if (totalScore > 0.18) {
      scored.push({ chunk, score: Number(totalScore.toFixed(4)) });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.chunk.pageNumber - b.chunk.pageNumber);
  return scored.slice(0, Math.max(1, topK));
}

export function buildPdfCitationsFromChunks(
  materialTitle: string,
  retrieved: RetrievedPdfChunk[]
): AiCitation[] {
  return retrieved.map((r) => ({
    materialId: r.chunk.materialId,
    materialTitle,
    pageNumber: r.chunk.pageNumber,
    excerpt: r.chunk.text.length > 220 ? `${r.chunk.text.slice(0, 217).trim()}...` : r.chunk.text,
    sourceKind: 'pdf',
  }));
}

function describeLanguageInstruction(lang: AiLanguageMode): string {
  if (lang === 'hi') {
    return 'Respond in clear academic Hindi (Devanagari script), keeping standard mathematical symbols, SI units, and chemical formulas in LaTeX ($...$ / $$...$$).';
  }
  if (lang === 'hinglish') {
    return 'Respond in clear student-friendly Hinglish (natural mix of Hindi and English in Roman script) while keeping technical terms, formulas ($...$ / $$...$$), and units accurate.';
  }
  return 'Respond in clear, structured academic English using LaTeX ($...$ / $$...$$) for equations, symbols, and derivations.';
}

function describeExamInstruction(examTrack: ExamTrack): string {
  if (examTrack === 'up-board-12') {
    return 'Target Exam: UP Board Class 12 (UPMSP / NCERT Class 12 pattern). Emphasize clear definitions, step-wise board derivations, SI units, and neat diagram explanations.';
  }
  if (examTrack === 'jee-advanced') {
    return 'Target Exam: IIT JEE Advanced. Emphasize deep multi-concept intuition, edge cases, calculus-based rigor, and JEE Advanced retained topics (kept distinct from reduced JEE Main syllabus).';
  }
  return 'Target Exam: NTA JEE Main. Emphasize current NTA JEE Main syllabus concepts, fast problem-solving methods, dimensional checks, and common trap avoidance without mixing excluded JEE Advanced-only topics unless requested.';
}

export function buildTutorSystemPrompt(params: {
  examTrack: ExamTrack;
  languageMode: AiLanguageMode;
  subjectName?: string;
  chapterTitle?: string;
  topicTitle?: string;
  stepByStep?: boolean;
}): string {
  const scopeParts = [
    params.subjectName ? `Subject: ${params.subjectName}` : '',
    params.chapterTitle ? `Chapter: ${params.chapterTitle}` : '',
    params.topicTitle ? `Topic: ${params.topicTitle}` : '',
  ]
    .filter(Boolean)
    .join(' | ');

  return [
    'You are the PrepZone AI Academic Tutor helping Indian Class 12 and JEE students.',
    describeExamInstruction(params.examTrack),
    describeLanguageInstruction(params.languageMode),
    scopeParts ? `Active Syllabus Context: ${scopeParts}` : '',
    'Core Academic Honesty Rules:',
    '1. Never invent official syllabus rules, exam dates, cutoff marks, or unverified PYQ claims.',
    '2. If a question is ambiguous, missing numerical values, or blurry in an uploaded image, explicitly list what clarification is needed before guessing.',
    '3. Format mathematical formulas with $...$ (inline) and $$...$$ (display block), and use Markdown headings/lists cleanly.',
    params.stepByStep
      ? '4. Use strict Step-by-Step Solution formatting with sections: **Concept**, **Given Information**, **Formula Selection**, **Step-by-Step Calculation**, **Units Check**, and **Final Answer Verification**.'
      : '4. Give concise, conceptually accurate tutoring and offer a worked example when helpful.',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildPdfGroundedPrompt(params: {
  question: string;
  materialTitle: string;
  retrievedChunks: RetrievedPdfChunk[];
  languageMode: AiLanguageMode;
}): string {
  if (params.retrievedChunks.length === 0) {
    return [
      `Selected PDF Document: "${params.materialTitle}"`,
      `Student Question: ${params.question}`,
      'Retrieval Result: ZERO matching excerpts were found inside the selected PDF.',
      `Instruct the student clearly in ${params.languageMode === 'hi' ? 'Hindi' : params.languageMode === 'hinglish' ? 'Hinglish' : 'English'} that this topic does not appear in the selected PDF pages, and only provide general syllabus guidance if clearly labeled as external to the PDF.`,
    ].join('\n\n');
  }

  const excerpts = params.retrievedChunks
    .map((r) => `[Page ${r.chunk.pageNumber}] ${r.chunk.text}`)
    .join('\n\n');

  return [
    `Selected PDF Document: "${params.materialTitle}"`,
    'Answer strictly grounded in the retrieved PDF excerpts below. Cite page numbers inline as (Page N) whenever referencing content from an excerpt.',
    'If the excerpts do not completely answer the student question, state explicitly what is missing from the PDF rather than inventing facts.',
    '--- RETRIEVED PDF EXCERPTS ---',
    excerpts,
    '--- STUDENT QUESTION ---',
    params.question,
  ].join('\n\n');
}

export function buildDoubtSolverPrompt(params: {
  question: string;
  hasImage: boolean;
  examTrack: ExamTrack;
  subjectName?: string;
  chapterTitle?: string;
  languageMode: AiLanguageMode;
}): string {
  return [
    `Solve this student doubt for ${params.examTrack}. ${describeLanguageInstruction(params.languageMode)}`,
    params.subjectName ? `Context Subject: ${params.subjectName}` : '',
    params.chapterTitle ? `Context Chapter: ${params.chapterTitle}` : '',
    params.hasImage
      ? 'An image of the question or diagram is attached. Read every equation, diagram label, and value carefully; if anything is unreadable or incomplete, list clarifying questions first instead of guessing.'
      : '',
    'Begin your response with a brief **Identified Scope** line naming the likely Subject, Chapter, and Topic, then provide a complete **Concept -> Given -> Formula -> Step-by-Step Solution -> Units & Final Check** explanation.',
    `Doubt / Question:\n${params.question}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function buildChapterSummaryPrompt(params: {
  examTrack: ExamTrack;
  subjectName: string;
  chapter: CurriculumChapter;
  summaryMode: AiSummaryMode;
  languageMode: AiLanguageMode;
  pdfExcerpts?: RetrievedPdfChunk[];
  materialTitle?: string;
}): string {
  const modeMap: Record<AiSummaryMode, string> = {
    full: 'Comprehensive structured chapter summary covering intuition, definitions, key laws, important formulas, derivations overview, and common exam mistakes.',
    short_revision: 'Crisp 5-minute high-yield revision sheet with bullet points and exam traps.',
    definitions: 'Glossary of essential technical definitions, laws, and named principles in this chapter.',
    formulas: 'Clean LaTeX formula sheet with every symbol defined and SI units listed.',
    key_concepts: 'Core conceptual breakdown connecting prerequisite ideas to advanced applications.',
    derivations: 'Key exam derivations outlined step-by-step with boundary conditions.',
    quick_notes: 'Ultra-compact pocket revision notes for last-day recall.',
  };

  const topicList = params.chapter.topics
    .map((t, idx) => `${idx + 1}. ${t.title.en} (${t.title.hi})`)
    .join('\n');

  const pdfBlock =
    params.pdfExcerpts && params.pdfExcerpts.length > 0 && params.materialTitle
      ? `\n\nOptional Mapped Study Material ("${params.materialTitle}") Excerpts (cite Page N if used):\n` +
        params.pdfExcerpts.map((e) => `[Page ${e.chunk.pageNumber}] ${e.chunk.text}`).join('\n')
      : '';

  return [
    `Generate a ${modeMap[params.summaryMode]}`,
    `Exam: ${params.examTrack} | Subject: ${params.subjectName}`,
    `Chapter: ${params.chapter.order}. ${params.chapter.title.en} (${params.chapter.title.hi})`,
    `Overview: ${params.chapter.overview.en}`,
    `Official Mapped Topics:\n${topicList}${pdfBlock}`,
    describeLanguageInstruction(params.languageMode),
    'Stay strictly aligned to the listed topics and standard NCERT/UPMSP/NTA academic facts. Never fabricate board blueprints or unverified claims.',
  ].join('\n\n');
}

export function buildQuizGenPrompt(params: {
  config: AiQuizGenerateParams;
  subjectName: string;
  chapter: CurriculumChapter;
}): string {
  const topicNote = params.config.topicId
    ? params.chapter.topics.find((t) => t.id === params.config.topicId)?.title.en ?? params.config.topicId
    : 'All chapter topics';

  const typeHint =
    params.config.questionType === 'mixed'
      ? 'Use a mix of mcq_single and numerical/true_false'
      : `Use questionType "${params.config.questionType}" for all items`;

  return [
    `Generate exactly ${params.config.questionCount} original practice questions (NOT claimed as official PYQs) in valid JSON only.`,
    `Exam: ${params.config.examTrack} | Subject: ${params.subjectName} | Chapter: ${params.chapter.title.en} | Topic: ${topicNote}`,
    `Difficulty: ${params.config.difficulty} | ${typeHint}.`,
    `Provide BOTH English ("en") and Hindi ("hi") text for prompts, options, and explanations (primary tone: ${params.config.languageMode}).`,
    'Ensure each question has unambiguous data, mathematically verified final numerical/option answers, SI units, and clear step-by-step explanations.',
    'Return ONLY a JSON object matching: {"title":{"en":"...","hi":"..."},"questions":[{"questionType":"mcq_single|numerical|true_false|short_answer","difficulty":"easy|medium|hard","prompt":{"en":"...","hi":"..."},"options":[{"id":"opt-a","label":"A","text":{"en":"...","hi":"..."}}],"correctOptionId":"opt-a","correctNumeric":0,"numericTolerance":0.05,"correctBool":true,"correctTextAnswers":["..."],"explanation":{"en":"...","hi":"..."},"solutionSteps":[{"en":"...","hi":"..."}]}]}',
  ].join('\n\n');
}

interface RawAiQuestionShape {
  questionType?: unknown;
  difficulty?: unknown;
  prompt?: { en?: unknown; hi?: unknown };
  options?: Array<{ id?: unknown; label?: unknown; text?: { en?: unknown; hi?: unknown } }>;
  correctOptionId?: unknown;
  correctNumeric?: unknown;
  numericTolerance?: unknown;
  correctBool?: unknown;
  correctTextAnswers?: unknown;
  explanation?: { en?: unknown; hi?: unknown };
  solutionSteps?: Array<{ en?: unknown; hi?: unknown }>;
}

export function validateAndSanitizeAiQuiz(
  rawPayload: unknown,
  meta: {
    examTrack: ExamTrack;
    subjectId: string;
    chapterId: string;
    topicId: string;
    classLevel: 'class-12' | 'entrance-ug';
    batchId: string;
  }
): { validQuestions: FullQuestionRecord[]; rejectedCount: number; warnings: string[] } {
  const warnings: string[] = [];
  const validQuestions: FullQuestionRecord[] = [];
  let rejectedCount = 0;

  const obj = rawPayload as { questions?: unknown[] } | null;
  const list = Array.isArray(obj?.questions) ? (obj.questions as RawAiQuestionShape[]) : [];
  const nowISO = new Date().toISOString();
  const seenPrompts = new Set<string>();

  for (let i = 0; i < list.length; i += 1) {
    const raw = list[i];
    const promptEn = typeof raw?.prompt?.en === 'string' ? raw.prompt.en.trim() : '';
    const promptHi =
      typeof raw?.prompt?.hi === 'string' && raw.prompt.hi.trim().length > 0
        ? raw.prompt.hi.trim()
        : promptEn;

    if (promptEn.length < 8) {
      rejectedCount += 1;
      warnings.push(`Skipped item ${i + 1}: missing or too short question prompt.`);
      continue;
    }

    const promptKey = promptEn.toLowerCase().replace(/\s+/g, ' ');
    if (seenPrompts.has(promptKey)) {
      rejectedCount += 1;
      warnings.push(`Skipped duplicate question ${i + 1}.`);
      continue;
    }

    const rawType = typeof raw.questionType === 'string' ? raw.questionType : 'mcq_single';
    const qType: QuestionType =
      rawType === 'numerical' || rawType === 'true_false' || rawType === 'short_answer'
        ? rawType
        : 'mcq_single';

    const rawDiff = typeof raw.difficulty === 'string' ? raw.difficulty : 'medium';
    const difficulty: DifficultyLevel =
      rawDiff === 'easy' || rawDiff === 'hard' ? rawDiff : 'medium';

    const expEn =
      typeof raw?.explanation?.en === 'string' && raw.explanation.en.trim().length > 0
        ? raw.explanation.en.trim()
        : '';
    const expHi =
      typeof raw?.explanation?.hi === 'string' && raw.explanation.hi.trim().length > 0
        ? raw.explanation.hi.trim()
        : expEn;

    if (!expEn) {
      rejectedCount += 1;
      warnings.push(`Skipped item ${i + 1}: missing step-by-step explanation.`);
      continue;
    }

    const steps = Array.isArray(raw.solutionSteps)
      ? raw.solutionSteps
          .map((s) => ({
            en: typeof s?.en === 'string' ? s.en.trim() : '',
            hi: typeof s?.hi === 'string' && s.hi.trim() ? s.hi.trim() : typeof s?.en === 'string' ? s.en.trim() : '',
          }))
          .filter((s) => s.en.length > 0)
      : [{ en: expEn, hi: expHi }];

    const id = `aiq-${meta.batchId}-${i + 1}`;
    const baseRecord: Omit<FullQuestionRecord, 'answerKey'> = {
      id,
      examTrack: meta.examTrack,
      academicSession: '2026-27',
      classLevel: meta.classLevel,
      subjectId: meta.subjectId,
      chapterId: meta.chapterId,
      topicId: meta.topicId,
      questionType: qType,
      difficulty,
      prompt: { en: promptEn, hi: promptHi },
      marks: meta.examTrack === 'up-board-12' ? 2 : 4,
      negativeMarks: meta.examTrack === 'up-board-12' || qType === 'short_answer' ? 0 : 1,
      sourceType: 'ai_generated',
      sourceLabel: {
        en: 'AI-Generated Practice (Reviewable · Not an Official PYQ)',
        hi: 'AI-निर्मित अभ्यास प्रश्न (समीक्षाधीन · आधिकारिक PYQ नहीं)',
      },
      verificationStatus: 'awaiting_verification',
      isPublished: true,
      importBatchId: meta.batchId,
      createdAt: nowISO,
      updatedAt: nowISO,
    };

    if (qType === 'mcq_single') {
      const opts = Array.isArray(raw.options) ? raw.options : [];
      const sanitizedOpts = opts
        .map((o, idx) => {
          const textEn = typeof o?.text?.en === 'string' ? o.text.en.trim() : '';
          const textHi =
            typeof o?.text?.hi === 'string' && o.text.hi.trim() ? o.text.hi.trim() : textEn;
          const label = ['A', 'B', 'C', 'D'][idx] ?? String(idx + 1);
          const optId =
            typeof o?.id === 'string' && o.id.trim().length > 0 ? o.id.trim() : `opt-${label.toLowerCase()}`;
          return { id: optId, label, text: { en: textEn, hi: textHi } };
        })
        .filter((o) => o.text.en.length > 0)
        .slice(0, 4);

      const distinctOptionTexts = new Set(sanitizedOpts.map((o) => o.text.en.toLowerCase()));
      const correctId = typeof raw.correctOptionId === 'string' ? raw.correctOptionId.trim() : '';

      if (sanitizedOpts.length < 2 || distinctOptionTexts.size < sanitizedOpts.length) {
        rejectedCount += 1;
        warnings.push(`Skipped MCQ ${i + 1}: duplicate or missing options.`);
        continue;
      }

      if (!sanitizedOpts.some((o) => o.id === correctId)) {
        rejectedCount += 1;
        warnings.push(`Skipped MCQ ${i + 1}: answer key did not match any valid option.`);
        continue;
      }

      seenPrompts.add(promptKey);
      validQuestions.push({
        ...baseRecord,
        options: sanitizedOpts,
        answerKey: {
          questionId: id,
          correctOptionIds: [correctId],
          explanation: { en: expEn, hi: expHi },
          solutionSteps: steps.length > 0 ? steps : [{ en: expEn, hi: expHi }],
        },
      });
    } else if (qType === 'numerical') {
      const numVal = Number(raw.correctNumeric);
      if (!Number.isFinite(numVal)) {
        rejectedCount += 1;
        warnings.push(`Skipped Numerical ${i + 1}: non-finite numerical answer.`);
        continue;
      }
      const tol = Number.isFinite(Number(raw.numericTolerance))
        ? Math.max(0.001, Math.abs(Number(raw.numericTolerance)))
        : 0.05;
      seenPrompts.add(promptKey);
      validQuestions.push({
        ...baseRecord,
        answerKey: {
          questionId: id,
          correctNumeric: numVal,
          numericTolerance: tol,
          explanation: { en: expEn, hi: expHi },
          solutionSteps: steps.length > 0 ? steps : [{ en: expEn, hi: expHi }],
        },
      });
    } else if (qType === 'true_false') {
      if (typeof raw.correctBool !== 'boolean') {
        rejectedCount += 1;
        warnings.push(`Skipped True/False ${i + 1}: missing boolean answer.`);
        continue;
      }
      seenPrompts.add(promptKey);
      validQuestions.push({
        ...baseRecord,
        answerKey: {
          questionId: id,
          correctBool: raw.correctBool,
          explanation: { en: expEn, hi: expHi },
          solutionSteps: steps.length > 0 ? steps : [{ en: expEn, hi: expHi }],
        },
      });
    } else {
      const textAnswers = Array.isArray(raw.correctTextAnswers)
        ? raw.correctTextAnswers.map((v) => String(v).trim()).filter(Boolean)
        : [expEn];
      seenPrompts.add(promptKey);
      validQuestions.push({
        ...baseRecord,
        answerKey: {
          questionId: id,
          correctTextAnswers: textAnswers,
          explanation: { en: expEn, hi: expHi },
          solutionSteps: steps.length > 0 ? steps : [{ en: expEn, hi: expHi }],
        },
      });
    }
  }

  return { validQuestions, rejectedCount, warnings };
}

/**
 * Generates strictly authentic, data-backed study recommendations from real student logs.
 * Never fabricates test scores, accuracy percentages, or weak topics when no attempts exist.
 */
export function computeRealStudyRecommendations(params: {
  examTrack: ExamTrack;
  subjects: CurriculumSubject[];
  analytics: StudentPerformanceAnalytics;
  practiceHistory: PracticeHistoryEntry[];
  attempts: AssessmentAttempt[];
  progressMap: ProgressMap;
  language: 'en' | 'hi';
}): AiStudyRecommendation[] {
  const { examTrack, subjects, analytics, practiceHistory, attempts, progressMap, language } = params;
  const recs: AiStudyRecommendation[] = [];

  const chapterLookup = new Map<string, { subject: CurriculumSubject; chapter: CurriculumChapter }>();
  for (const sub of subjects) {
    for (const ch of sub.chapters) {
      chapterLookup.set(ch.id, { subject: sub, chapter: ch });
    }
  }

  // 1. Real weak chapters from practice & exam accuracy
  for (const wc of analytics.weakChapters.slice(0, 3)) {
    const info = chapterLookup.get(wc.chapterId);
    const titleText = info
      ? `${info.subject.name[language]} · ${info.chapter.title[language]}`
      : `${wc.subjectId} · ${wc.chapterId}`;
    recs.push({
      id: `rec-weak-${wc.chapterId}`,
      priority: 'high',
      kind: 'weak_chapter',
      examTrack,
      subjectId: wc.subjectId,
      chapterId: wc.chapterId,
      accuracyPercent: wc.accuracyPercent,
      title:
        language === 'hi'
          ? `कमज़ोर अध्याय सुधारें: ${titleText}`
          : `Strengthen Weak Chapter: ${titleText}`,
      reason:
        language === 'hi'
          ? `आपके वास्तविक अभ्यास/टेस्ट लॉग में ${wc.attempts} प्रयासों में ${wc.accuracyPercent}% सटीकता दर्ज है।`
          : `Recorded ${wc.accuracyPercent}% accuracy across ${wc.attempts} real question attempts (${wc.correct} correct).`,
      actionRoute: `/practice?exam=${examTrack}&subject=${wc.subjectId}&chapter=${wc.chapterId}`,
      actionLabel: language === 'hi' ? 'अभ्यास शुरू करें' : 'Practice Chapter',
    });
  }

  // 2. Chapters explicitly marked 'needs_revision' by the student
  for (const sub of subjects) {
    for (const ch of sub.chapters) {
      const prog = getChapterProgress(progressMap, examTrack, sub.id, ch.id);
      if (prog.status === 'needs_revision' && recs.length < 6) {
        recs.push({
          id: `rec-rev-${ch.id}`,
          priority: 'high',
          kind: 'revision_needed',
          examTrack,
          subjectId: sub.id,
          chapterId: ch.id,
          title:
            language === 'hi'
              ? `पुनरीक्षण आवश्यक: ${ch.title.hi}`
              : `Revision Flagged: ${ch.title.en}`,
          reason:
            language === 'hi'
              ? `${sub.name.hi} में आपने इस अध्याय को "पुनरीक्षण आवश्यक" के रूप में चिह्नित किया है।`
              : `You marked this chapter in ${sub.name.en} as Needs Revision (${prog.completionPercent}% topics checked).`,
          actionRoute: `/ai-assistant?tab=summary&exam=${examTrack}&subject=${sub.id}&chapter=${ch.id}`,
          actionLabel: language === 'hi' ? 'AI पुनरीक्षण सारांश देखें' : 'Open AI Revision Notes',
        });
      }
    }
  }

  // 3. Frequently incorrect question formats (e.g., numerical vs mcq_multi)
  const weakType = analytics.frequentlyIncorrectTypes.find((qt) => qt.accuracyPercent < 65);
  if (weakType && recs.length < 6) {
    recs.push({
      id: `rec-qtype-${weakType.questionType}`,
      priority: 'medium',
      kind: 'question_type_drill',
      examTrack,
      accuracyPercent: weakType.accuracyPercent,
      title:
        language === 'hi'
          ? `${weakType.questionType} प्रश्न प्रकार अभ्यास`
          : `Target ${weakType.questionType.replace(/_/g, ' ')} Format Drill`,
      reason:
        language === 'hi'
          ? `इस प्रश्न प्रारूप में आपकी वास्तविक सटीकता ${weakType.accuracyPercent}% (${weakType.attempts} प्रयास) है।`
          : `Observed ${weakType.accuracyPercent}% accuracy across ${weakType.attempts} real ${weakType.questionType} attempts.`,
      actionRoute: `/practice?mode=retry_incorrect`,
      actionLabel: language === 'hi' ? 'गलत प्रश्न दोबारा हल करें' : 'Retry Incorrect Questions',
    });
  }

  // 4. Incomplete / not_started syllabus chapters if student has activity or needs next step
  if (recs.length < 4) {
    for (const sub of subjects) {
      const nextCh = sub.chapters.find((ch) => {
        const p = getChapterProgress(progressMap, examTrack, sub.id, ch.id);
        return p.status === 'in_progress' || p.status === 'not_started';
      });
      if (nextCh && recs.length < 5) {
        const hasRealData =
          practiceHistory.length > 0 ||
          attempts.some((a) => a.status === 'submitted') ||
          Object.keys(progressMap).length > 0;

        recs.push({
          id: `rec-next-${nextCh.id}`,
          priority: hasRealData ? 'medium' : 'low',
          kind: hasRealData ? 'incomplete_chapter' : 'starter_guidance',
          examTrack,
          subjectId: sub.id,
          chapterId: nextCh.id,
          title:
            language === 'hi'
              ? `अगला अध्याय: ${sub.name.hi} — ${nextCh.title.hi}`
              : `Next Syllabus Chapter: ${sub.name.en} — ${nextCh.title.en}`,
          reason: hasRealData
            ? language === 'hi'
              ? 'आपके सक्रिय पाठ्यक्रम में यह अध्याय अभी पूर्ण होना बाकी है।'
              : 'Selected in your active curriculum and awaiting completion.'
            : language === 'hi'
            ? 'कोई पिछला टेस्ट/अभ्यास डेटा दर्ज नहीं है — पहले अध्याय से वास्तविक तैयारी शुरू करें।'
            : 'No practice or test history recorded yet — start with this foundation chapter to build real analytics.',
          actionRoute: `/syllabus/${examTrack}/${sub.id}/${nextCh.id}`,
          actionLabel: language === 'hi' ? 'अध्याय खोलें' : 'Open Chapter',
        });
      }
    }
  }

  return recs;
}

export function validateStudyPlanInputs(input: {
  examTrack: unknown;
  examDateISO: unknown;
  dailyHours: unknown;
  selectedSubjectIds: unknown;
}): {
  ok: true;
  examTrack: ExamTrack;
  examDateISO: string;
  dailyHours: number;
  selectedSubjectIds: string[];
} | { ok: false; error: string } {
  const track = input.examTrack;
  if (track !== 'up-board-12' && track !== 'jee-main' && track !== 'jee-advanced') {
    return { ok: false, error: 'Please select a valid exam track.' };
  }
  const dateStr = typeof input.examDateISO === 'string' ? input.examDateISO.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { ok: false, error: 'Please provide a valid exam target date (YYYY-MM-DD).' };
  }
  const parsedDate = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime())) {
    return { ok: false, error: 'Invalid exam target date.' };
  }
  const hours = Number(input.dailyHours);
  if (!Number.isFinite(hours) || hours < 0.5 || hours > 16) {
    return { ok: false, error: 'Daily study hours must be between 0.5 and 16 hours.' };
  }
  const subIds = Array.isArray(input.selectedSubjectIds)
    ? input.selectedSubjectIds.map(String).filter(Boolean)
    : [];
  if (subIds.length === 0) {
    return { ok: false, error: 'Select at least one subject to build a study plan.' };
  }
  return {
    ok: true,
    examTrack: track,
    examDateISO: dateStr,
    dailyHours: Number(hours.toFixed(1)),
    selectedSubjectIds: subIds,
  };
}

export function buildStudyPlanPrompt(params: {
  examTrack: ExamTrack;
  examDateISO: string;
  dailyHours: number;
  selectedSubjects: CurriculumSubject[];
  pendingChaptersSummary: string[];
  weakTopicsSummary: string[];
  languageMode: AiLanguageMode;
}): string {
  const subList = params.selectedSubjects.map((s) => `${s.name.en} (${s.chapters.length} chapters)`).join(', ');
  return [
    `Create a realistic, structured 7-day Personal Study Plan draft in valid JSON only.`,
    `Exam: ${params.examTrack} | Target Date: ${params.examDateISO} | Daily Study Hours: ${params.dailyHours} hrs/day`,
    `Selected Subjects: ${subList}`,
    params.weakTopicsSummary.length > 0
      ? `Weak Chapters/Topics From Real Logs: ${params.weakTopicsSummary.join('; ')}`
      : 'No recorded weak topics yet — balance foundation concepts, NCERT/notes reading, and daily practice.',
    params.pendingChaptersSummary.length > 0
      ? `Pending Syllabus Chapters: ${params.pendingChaptersSummary.slice(0, 10).join('; ')}`
      : '',
    describeLanguageInstruction(params.languageMode),
    'Return ONLY JSON matching: {"title":"...","summaryNote":"...","dailyTargets":["..."],"weeklySchedule":[{"dayLabel":"Day 1","focusSubject":"...","chapterTitle":"...","activity":"...","durationMinutes":90}],"revisionSprints":["..."],"practiceMilestones":["..."]}',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function normalizeGeneratedStudyPlan(
  raw: unknown,
  meta: {
    id: string;
    uid: string;
    examTrack: ExamTrack;
    examDateISO: string;
    dailyHours: number;
    selectedSubjectIds: string[];
  }
): AiStudyPlan {
  const obj = (raw ?? {}) as Partial<AiStudyPlan>;
  const schedule = Array.isArray(obj.weeklySchedule)
    ? obj.weeklySchedule
        .filter((s) => s && typeof s.dayLabel === 'string' && typeof s.chapterTitle === 'string')
        .slice(0, 21)
        .map((s) => ({
          dayLabel: String(s.dayLabel).slice(0, 40),
          focusSubject: String(s.focusSubject || 'Core Subject').slice(0, 80),
          chapterTitle: String(s.chapterTitle).slice(0, 120),
          activity: String(s.activity || 'Concept study & solved examples').slice(0, 200),
          durationMinutes: Math.max(15, Math.min(360, Number(s.durationMinutes) || 60)),
        }))
    : [];

  return {
    id: meta.id,
    uid: meta.uid,
    title:
      typeof obj.title === 'string' && obj.title.trim()
        ? obj.title.trim().slice(0, 140)
        : `Personal ${meta.examTrack.toUpperCase()} Study Plan`,
    examTrack: meta.examTrack,
    examDateISO: meta.examDateISO,
    dailyHours: meta.dailyHours,
    selectedSubjectIds: meta.selectedSubjectIds,
    status: 'draft',
    summaryNote:
      typeof obj.summaryNote === 'string' && obj.summaryNote.trim()
        ? obj.summaryNote.trim().slice(0, 500)
        : 'Review and adjust these daily blocks before approving.',
    dailyTargets: Array.isArray(obj.dailyTargets)
      ? obj.dailyTargets.map((v) => String(v).trim()).filter(Boolean).slice(0, 8)
      : [],
    weeklySchedule: schedule,
    revisionSprints: Array.isArray(obj.revisionSprints)
      ? obj.revisionSprints.map((v) => String(v).trim()).filter(Boolean).slice(0, 6)
      : [],
    practiceMilestones: Array.isArray(obj.practiceMilestones)
      ? obj.practiceMilestones.map((v) => String(v).trim()).filter(Boolean).slice(0, 6)
      : [],
    createdAt: new Date().toISOString(),
  };
}
