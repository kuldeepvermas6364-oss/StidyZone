import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

export class AiProviderError extends Error {
  public readonly code:
    | 'AI_PROVIDER_NOT_CONFIGURED'
    | 'AI_TIMEOUT'
    | 'AI_UPSTREAM_ERROR'
    | 'AI_INVALID_JSON';
  public readonly statusCode: number;

  constructor(
    code:
      | 'AI_PROVIDER_NOT_CONFIGURED'
      | 'AI_TIMEOUT'
      | 'AI_UPSTREAM_ERROR'
      | 'AI_INVALID_JSON',
    message: string,
    statusCode = 502
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

export interface GeminiHistoryTurn {
  role: 'user' | 'model';
  text: string;
}

export interface GeminiImagePart {
  base64: string;
  mimeType: string;
}

const DEFAULT_MODEL = 'gemini-4-hydrogen';

export function getConfiguredModel(): string {
  const raw = process.env.GEMINI_MODEL?.trim();
  if (!raw) return DEFAULT_MODEL;
  // Guard against legacy or unsupported model names
  if (raw.includes('1.5') || raw.includes('2.0')) return DEFAULT_MODEL;
  return raw;
}

export function getActiveGeminiApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key || key === 'MY_GEMINI_API_KEY' || key.length < 12) {
    return null;
  }
  return key;
}

export function isGeminiConfigured(): boolean {
  return getActiveGeminiApiKey() !== null;
}

let cachedClient: { key: string; client: GoogleGenAI } | null = null;

function getClient(): GoogleGenAI {
  const key = getActiveGeminiApiKey();
  if (!key) {
    throw new AiProviderError(
      'AI_PROVIDER_NOT_CONFIGURED',
      'Server-side GEMINI_API_KEY is not configured in environment secrets yet.',
      503
    );
  }
  if (!cachedClient || cachedClient.key !== key) {
    cachedClient = {
      key,
      client: new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: { 'User-Agent': 'aistudio-build' },
        },
      }),
    };
  }
  return cachedClient.client;
}

function getTimeoutMs(): number {
  const raw = Number(process.env.AI_REQUEST_TIMEOUT_MS || 30000);
  if (!Number.isFinite(raw) || raw < 5000) return 30000;
  return Math.min(90000, raw);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(
            new AiProviderError(
              'AI_TIMEOUT',
              'The AI tutor took too long to respond. Please retry with a shorter prompt.',
              504
            )
          );
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function isRetryableError(err: unknown): boolean {
  if (err instanceof AiProviderError && err.code === 'AI_PROVIDER_NOT_CONFIGURED') return false;
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('unavailable') ||
    msg.includes('rate') ||
    msg.includes('econnreset')
  );
}

export function extractReadableGeminiError(err: unknown): {
  message: string;
  statusCode: number;
} {
  const raw = err instanceof Error ? err.message : String(err ?? 'Gemini request failed.');
  let current = raw.trim();
  let detectedStatus = err instanceof AiProviderError ? err.statusCode : 502;

  for (let depth = 0; depth < 3; depth += 1) {
    if (!current.startsWith('{')) break;
    try {
      const parsed = JSON.parse(current) as {
        error?: { code?: number; status?: string; message?: string };
        message?: string;
        code?: number;
      };
      const nextCode = parsed.error?.code ?? parsed.code;
      if (typeof nextCode === 'number' && nextCode >= 400 && nextCode < 600) {
        detectedStatus = nextCode;
      }
      const nextMsg = parsed.error?.message ?? parsed.message;
      if (typeof nextMsg === 'string' && nextMsg.trim()) {
        current = nextMsg.trim();
      } else {
        break;
      }
    } catch {
      break;
    }
  }

  return {
    message: current.replace(/\s+/g, ' ').slice(0, 320),
    statusCode: detectedStatus,
  };
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 2): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt >= maxAttempts || !isRetryableError(err)) {
        break;
      }
      const delayMs = 450 * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  if (lastErr instanceof AiProviderError) throw lastErr;
  const readable = extractReadableGeminiError(lastErr);
  throw new AiProviderError('AI_UPSTREAM_ERROR', readable.message, readable.statusCode);
}

function buildContents(
  prompt: string,
  history: GeminiHistoryTurn[] = [],
  image?: GeminiImagePart
) {
  const contents: Array<{
    role: 'user' | 'model';
    parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }>;
  }> = [];

  for (const turn of history.slice(-10)) {
    if (!turn.text.trim()) continue;
    contents.push({
      role: turn.role,
      parts: [{ text: turn.text }],
    });
  }

  const userParts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [
    { text: prompt },
  ];
  if (image) {
    userParts.push({
      inlineData: {
        data: image.base64,
        mimeType: image.mimeType,
      },
    });
  }

  contents.push({ role: 'user', parts: userParts });
  return contents;
}

export async function generateTutorText(params: {
  systemInstruction: string;
  prompt: string;
  history?: GeminiHistoryTurn[];
  image?: GeminiImagePart;
  thinkingLevel?: 'minimal' | 'low' | 'medium';
}): Promise<string> {
  const ai = getClient();
  const model = getConfiguredModel();
  const timeoutMs = getTimeoutMs();

  const level =
    params.thinkingLevel === 'minimal'
      ? ThinkingLevel.MINIMAL
      : params.thinkingLevel === 'medium'
      ? ThinkingLevel.MEDIUM
      : ThinkingLevel.LOW;

  const response = await withRetry(() =>
    withTimeout(
      ai.models.generateContent({
        model,
        contents: buildContents(params.prompt, params.history, params.image),
        config: {
          systemInstruction: params.systemInstruction,
          thinkingConfig: { thinkingLevel: level },
        },
      }),
      timeoutMs
    )
  );

  const text = response.text?.trim();
  if (!text) {
    throw new AiProviderError('AI_UPSTREAM_ERROR', 'Model returned an empty response.', 502);
  }
  return text;
}

export async function* streamTutorChat(params: {
  systemInstruction: string;
  prompt: string;
  history?: GeminiHistoryTurn[];
  image?: GeminiImagePart;
  signal?: AbortSignal;
}): AsyncGenerator<string, void, unknown> {
  const ai = getClient();
  const model = getConfiguredModel();

  const stream = await withRetry(() =>
    withTimeout(
      ai.models.generateContentStream({
        model,
        contents: buildContents(params.prompt, params.history, params.image),
        config: {
          systemInstruction: params.systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      }),
      getTimeoutMs()
    )
  );

  for await (const chunk of stream) {
    if (params.signal?.aborted) {
      break;
    }
    const piece = chunk.text;
    if (piece) {
      yield piece;
    }
  }
}

export async function generateStructuredQuizJson(params: {
  systemInstruction: string;
  prompt: string;
}): Promise<unknown> {
  const ai = getClient();
  const model = getConfiguredModel();

  const response = await withRetry(() =>
    withTimeout(
      ai.models.generateContent({
        model,
        contents: params.prompt,
        config: {
          systemInstruction: params.systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.OBJECT,
                properties: {
                  en: { type: Type.STRING },
                  hi: { type: Type.STRING },
                },
                required: ['en', 'hi'],
              },
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    questionType: { type: Type.STRING },
                    difficulty: { type: Type.STRING },
                    prompt: {
                      type: Type.OBJECT,
                      properties: {
                        en: { type: Type.STRING },
                        hi: { type: Type.STRING },
                      },
                      required: ['en', 'hi'],
                    },
                    options: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          id: { type: Type.STRING },
                          label: { type: Type.STRING },
                          text: {
                            type: Type.OBJECT,
                            properties: {
                              en: { type: Type.STRING },
                              hi: { type: Type.STRING },
                            },
                            required: ['en', 'hi'],
                          },
                        },
                      },
                    },
                    correctOptionId: { type: Type.STRING },
                    correctNumeric: { type: Type.NUMBER },
                    numericTolerance: { type: Type.NUMBER },
                    correctBool: { type: Type.BOOLEAN },
                    correctTextAnswers: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    explanation: {
                      type: Type.OBJECT,
                      properties: {
                        en: { type: Type.STRING },
                        hi: { type: Type.STRING },
                      },
                      required: ['en', 'hi'],
                    },
                    solutionSteps: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          en: { type: Type.STRING },
                          hi: { type: Type.STRING },
                        },
                      },
                    },
                  },
                  required: ['questionType', 'difficulty', 'prompt', 'explanation'],
                },
              },
            },
            required: ['title', 'questions'],
          },
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      }),
      getTimeoutMs()
    )
  );

  const rawText = response.text?.trim() || '';
  try {
    return JSON.parse(rawText);
  } catch {
    throw new AiProviderError(
      'AI_INVALID_JSON',
      'Model returned invalid JSON while generating quiz items.',
      502
    );
  }
}

export async function generateStructuredStudyPlanJson(params: {
  systemInstruction: string;
  prompt: string;
}): Promise<unknown> {
  const ai = getClient();
  const model = getConfiguredModel();

  const response = await withRetry(() =>
    withTimeout(
      ai.models.generateContent({
        model,
        contents: params.prompt,
        config: {
          systemInstruction: params.systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              summaryNote: { type: Type.STRING },
              dailyTargets: { type: Type.ARRAY, items: { type: Type.STRING } },
              weeklySchedule: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    dayLabel: { type: Type.STRING },
                    focusSubject: { type: Type.STRING },
                    chapterTitle: { type: Type.STRING },
                    activity: { type: Type.STRING },
                    durationMinutes: { type: Type.NUMBER },
                  },
                  required: ['dayLabel', 'focusSubject', 'chapterTitle', 'activity', 'durationMinutes'],
                },
              },
              revisionSprints: { type: Type.ARRAY, items: { type: Type.STRING } },
              practiceMilestones: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['title', 'summaryNote', 'dailyTargets', 'weeklySchedule'],
          },
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      }),
      getTimeoutMs()
    )
  );

  const rawText = response.text?.trim() || '';
  try {
    return JSON.parse(rawText);
  } catch {
    throw new AiProviderError(
      'AI_INVALID_JSON',
      'Model returned invalid JSON while generating study plan.',
      502
    );
  }
}
