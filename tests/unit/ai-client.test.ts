import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  generateCompletion,
  resolveProvider,
  isAiConfigured,
  AiNotConfiguredError,
  AiRequestError,
} from "@/lib/ai/client";

/** Build a fetch Response-like stub. */
function jsonResponse(body: unknown, init?: { ok?: boolean; status?: number }) {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  // Clean slate for provider env each test.
  vi.stubEnv("AI_API_KEY", "test-key");
  vi.stubEnv("AI_PROVIDER", "");
  vi.stubEnv("AI_MODEL", "");
  vi.stubEnv("AI_BASE_URL", "");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const REQ = { system: "sys instructions", prompt: "user prompt", temperature: 0.5, maxTokens: 60 };

describe("isAiConfigured", () => {
  it("is true when AI_API_KEY is set, false otherwise", () => {
    expect(isAiConfigured()).toBe(true);
    vi.stubEnv("AI_API_KEY", "");
    expect(isAiConfigured()).toBe(false);
  });
});

describe("resolveProvider", () => {
  it("defaults to openai when unset", () => {
    expect(resolveProvider()).toBe("openai");
  });
  it("returns gemini when AI_PROVIDER=gemini (case-insensitive)", () => {
    vi.stubEnv("AI_PROVIDER", "Gemini");
    expect(resolveProvider()).toBe("gemini");
  });
  it("throws AiNotConfiguredError on unknown provider", () => {
    vi.stubEnv("AI_PROVIDER", "claude");
    expect(() => resolveProvider()).toThrow(AiNotConfiguredError);
  });
});

describe("OpenAI branch", () => {
  it("sends OpenAI Chat Completions request shape", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: "Hello title" } }] }),
    );
    const text = await generateCompletion(REQ);

    expect(text).toBe("Hello title");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer test-key");
    const body = JSON.parse(init.body);
    expect(body.model).toBe("gpt-4o-mini");
    expect(body.temperature).toBe(0.5);
    expect(body.max_tokens).toBe(60);
    expect(body.messages).toEqual([
      { role: "system", content: "sys instructions" },
      { role: "user", content: "user prompt" },
    ]);
  });

  it("parses choices[0].message.content", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: "  Parsed  " } }] }),
    );
    expect(await generateCompletion(REQ)).toBe("Parsed");
  });

  it("throws AiRequestError on empty content", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ choices: [{ message: { content: "" } }] }));
    await expect(generateCompletion(REQ)).rejects.toBeInstanceOf(AiRequestError);
  });

  it("respects AI_MODEL / AI_BASE_URL overrides", async () => {
    vi.stubEnv("AI_MODEL", "gpt-4o");
    vi.stubEnv("AI_BASE_URL", "https://proxy.example.com/v1/");
    fetchMock.mockResolvedValue(jsonResponse({ choices: [{ message: { content: "x" } }] }));
    await generateCompletion(REQ);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://proxy.example.com/v1/chat/completions");
    expect(JSON.parse(init.body).model).toBe("gpt-4o");
  });
});

describe("Gemini branch", () => {
  beforeEach(() => vi.stubEnv("AI_PROVIDER", "gemini"));

  it("sends Gemini generateContent request shape", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ candidates: [{ content: { parts: [{ text: "Gemini title" }] } }] }),
    );
    const text = await generateCompletion(REQ);

    expect(text).toBe("Gemini title");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    );
    expect(init.headers["x-goog-api-key"]).toBe("test-key");
    expect(init.headers.Authorization).toBeUndefined();
    const body = JSON.parse(init.body);
    expect(body.system_instruction.parts[0].text).toBe("sys instructions");
    expect(body.contents[0].role).toBe("user");
    expect(body.contents[0].parts[0].text).toBe("user prompt");
    expect(body.generationConfig.temperature).toBe(0.5);
    expect(body.generationConfig.maxOutputTokens).toBe(60);
  });

  it("joins all candidate text parts", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        candidates: [{ content: { parts: [{ text: "Hello " }, { text: "world" }] } }],
      }),
    );
    expect(await generateCompletion(REQ)).toBe("Hello world");
  });

  it("blocks on promptFeedback.blockReason", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ promptFeedback: { blockReason: "SAFETY" } }));
    await expect(generateCompletion(REQ)).rejects.toThrow(/AI response blocked: SAFETY/);
  });

  it("blocks when candidates are missing", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    await expect(generateCompletion(REQ)).rejects.toThrow(/AI response blocked: no candidates/);
  });

  it("blocks on finishReason SAFETY", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ candidates: [{ finishReason: "SAFETY", content: { parts: [] } }] }),
    );
    await expect(generateCompletion(REQ)).rejects.toThrow(/AI response blocked: SAFETY/);
  });

  it("blocks on empty parts", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ candidates: [{ content: { parts: [] } }] }),
    );
    await expect(generateCompletion(REQ)).rejects.toBeInstanceOf(AiRequestError);
  });

  it("uses gemini model override + default base url", async () => {
    vi.stubEnv("AI_MODEL", "gemini-2.5-flash-lite");
    fetchMock.mockResolvedValue(
      jsonResponse({ candidates: [{ content: { parts: [{ text: "ok" }] } }] }),
    );
    await generateCompletion(REQ);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/models/gemini-2.5-flash-lite:generateContent");
  });
});

describe("Provider routing + config", () => {
  it("missing AI_API_KEY throws AiNotConfiguredError before any fetch", async () => {
    vi.stubEnv("AI_API_KEY", "");
    await expect(generateCompletion(REQ)).rejects.toBeInstanceOf(AiNotConfiguredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("unknown provider throws AiNotConfiguredError (key present)", async () => {
    vi.stubEnv("AI_PROVIDER", "mistral");
    await expect(generateCompletion(REQ)).rejects.toBeInstanceOf(AiNotConfiguredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("non-2xx response surfaces as AiRequestError", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "bad" }, { ok: false, status: 401 }));
    await expect(generateCompletion(REQ)).rejects.toThrow(/AI request failed \(401\)/);
  });
});

describe("Timeout handling", () => {
  it("maps AbortError to a timeout AiRequestError", async () => {
    fetchMock.mockImplementation(() => {
      const err = new Error("aborted");
      err.name = "AbortError";
      return Promise.reject(err);
    });
    await expect(generateCompletion(REQ)).rejects.toThrow(/timed out/);
  });
});
