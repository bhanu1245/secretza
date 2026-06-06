// ==========================================
// SecretZa — Single AI Client (server-only)
// ==========================================
// The ONE and only AI provider abstraction for the whole codebase. Mirrors the
// email-provider pattern: env-driven, graceful no-op when unconfigured, and the
// API key never leaves the server.
//
// Supports two providers behind one public API (generateCompletion):
//   - openai : any OpenAI-compatible Chat Completions endpoint
//   - gemini : Google Gemini native generateContent endpoint
// Selected at runtime by AI_PROVIDER. There is still exactly one client and no
// SDK dependency (plain fetch).
//
// Configure with:
//   AI_PROVIDER  — openai | gemini (default "openai")
//   AI_API_KEY   — provider key (required to enable AI; read server-side only)
//   AI_BASE_URL  — optional override (per-provider default below)
//   AI_MODEL     — optional override (per-provider default below)

export type AiProvider = "openai" | "gemini";

const PROVIDER_DEFAULTS: Record<AiProvider, { baseUrl: string; model: string }> = {
  openai: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-2.5-flash",
  },
};

const REQUEST_TIMEOUT_MS = 20_000;
const DEFAULT_TEMPERATURE = 0.4;
const DEFAULT_MAX_TOKENS = 300;

export class AiNotConfiguredError extends Error {
  constructor(message = "AI is not configured. Set AI_API_KEY to enable AI features.") {
    super(message);
    this.name = "AiNotConfiguredError";
  }
}

export class AiRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiRequestError";
  }
}

/** True when an API key is present, so AI features can run. */
export function isAiConfigured(): boolean {
  return Boolean(process.env.AI_API_KEY?.trim());
}

/**
 * Resolve the active provider from AI_PROVIDER.
 * Defaults to "openai". Throws AiNotConfiguredError for unknown values so a
 * typo surfaces as a clear 503 instead of silently hitting the wrong API.
 */
export function resolveProvider(): AiProvider {
  const raw = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (!raw || raw === "openai") return "openai";
  if (raw === "gemini") return "gemini";
  throw new AiNotConfiguredError(
    `Unknown AI_PROVIDER "${raw}". Supported providers: openai, gemini.`,
  );
}

function getBaseUrl(provider: AiProvider): string {
  return (process.env.AI_BASE_URL?.trim() || PROVIDER_DEFAULTS[provider].baseUrl).replace(/\/+$/, "");
}

function getModelFor(provider: AiProvider): string {
  return process.env.AI_MODEL?.trim() || PROVIDER_DEFAULTS[provider].model;
}

/** The active model name (provider-aware). */
export function getAiModel(): string {
  return getModelFor(resolveProvider());
}

export interface CompletionRequest {
  system: string;
  prompt: string;
  /** Sampling temperature (0–2). Defaults to a low, deterministic value. */
  temperature?: number;
  /** Hard cap on response tokens. */
  maxTokens?: number;
}

/** OpenAI-compatible Chat Completions request + parse. */
async function completeOpenAi(
  req: CompletionRequest,
  apiKey: string,
  signal: AbortSignal,
): Promise<string> {
  const response = await fetch(`${getBaseUrl("openai")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: getModelFor("openai"),
      temperature: req.temperature ?? DEFAULT_TEMPERATURE,
      max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.prompt },
      ],
    }),
    signal,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new AiRequestError(
      `AI request failed (${response.status}): ${detail.slice(0, 200)}`,
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new AiRequestError("AI returned an empty response.");
  return text;
}

interface GeminiPart {
  text?: string;
}
interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
}

/** Google Gemini native generateContent request + parse. */
async function completeGemini(
  req: CompletionRequest,
  apiKey: string,
  signal: AbortSignal,
): Promise<string> {
  const model = getModelFor("gemini");
  const response = await fetch(
    `${getBaseUrl("gemini")}/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: req.system }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: req.prompt }],
          },
        ],
        generationConfig: {
          temperature: req.temperature ?? DEFAULT_TEMPERATURE,
          maxOutputTokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
        },
      }),
      signal,
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new AiRequestError(
      `AI request failed (${response.status}): ${detail.slice(0, 200)}`,
    );
  }

  const data = (await response.json()) as GeminiResponse;

  // Prompt-level block (no candidates produced at all).
  if (data.promptFeedback?.blockReason) {
    throw new AiRequestError(`AI response blocked: ${data.promptFeedback.blockReason}`);
  }

  const candidate = data.candidates?.[0];
  if (!candidate) {
    throw new AiRequestError("AI response blocked: no candidates returned");
  }

  if (candidate.finishReason === "SAFETY" || candidate.finishReason === "RECITATION") {
    throw new AiRequestError(`AI response blocked: ${candidate.finishReason}`);
  }

  const text = (candidate.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) {
    const reason = candidate.finishReason || "empty response";
    throw new AiRequestError(`AI response blocked: ${reason}`);
  }

  return text;
}

/**
 * Run a single chat completion. Returns the trimmed assistant message text.
 * Throws AiNotConfiguredError when no key is set or the provider is unknown,
 * AiRequestError on failure.
 */
export async function generateCompletion(req: CompletionRequest): Promise<string> {
  const apiKey = process.env.AI_API_KEY?.trim();
  if (!apiKey) throw new AiNotConfiguredError();

  const provider = resolveProvider();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return provider === "gemini"
      ? await completeGemini(req, apiKey, controller.signal)
      : await completeOpenAi(req, apiKey, controller.signal);
  } catch (error) {
    if (error instanceof AiNotConfiguredError || error instanceof AiRequestError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new AiRequestError("AI request timed out.");
    }
    throw new AiRequestError(
      error instanceof Error ? error.message : "Unknown AI error.",
    );
  } finally {
    clearTimeout(timeout);
  }
}
