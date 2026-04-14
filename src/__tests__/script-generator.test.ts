import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildPrompt,
  buildSystemPrompt,
  parseScriptResponse,
  generateScript,
  createClaudeProvider,
} from "../services/script-generator";
import type { ScriptRequest } from "../types";

function makeScriptRequest(overrides: Partial<ScriptRequest> = {}): ScriptRequest {
  return {
    jobData: {
      title: "Senior Software Engineer",
      company: "Acme Corp",
      location: "San Francisco, CA",
      source: "linkedin",
      extractedAt: Date.now(),
    },
    blsData: {
      socCode: "15-1252",
      msaCode: "41860",
      msaName: "San Francisco-Oakland-Hayward, CA",
      median: 168200,
      p25: 142500,
      p75: 198600,
      mean: 175000,
      fetchedAt: Date.now(),
    },
    colData: {
      msaCode: "41860",
      beaAreaCode: "XX200",
      rpp: 118.3,
      fetchedAt: Date.now(),
    },
    walkAwayResult: {
      walkAway: 147116,
      target: 163517,
      median: 168200,
      p25: 142500,
      p75: 198600,
      colIndex: 1.183,
      experienceBracket: "senior",
      experienceMultiplier: 1.15,
    },
    targetSalary: 195000,
    ...overrides,
  };
}

const storage: Record<string, unknown> = {};
const chromeMock = {
  storage: {
    local: {
      get: vi.fn((keys: string | string[]) => {
        const keyArr = Array.isArray(keys) ? keys : [keys];
        const result: Record<string, unknown> = {};
        for (const k of keyArr) {
          if (k in storage) result[k] = storage[k];
        }
        return Promise.resolve(result);
      }),
      set: vi.fn((items: Record<string, unknown>) => {
        Object.assign(storage, items);
        return Promise.resolve();
      }),
    },
  },
};

beforeEach(() => {
  Object.keys(storage).forEach((k) => delete storage[k]);
  vi.clearAllMocks();
});

Object.defineProperty(globalThis, "chrome", { value: chromeMock, writable: true });

describe("buildPrompt", () => {
  const request = makeScriptRequest();

  it("includes job title and company in prompt", () => {
    const prompt = buildPrompt(request);
    expect(prompt).toContain("Senior Software Engineer");
    expect(prompt).toContain("Acme Corp");
  });

  it("includes BLS median, p25, p75 in prompt", () => {
    const prompt = buildPrompt(request);
    expect(prompt).toContain("168,200");
    expect(prompt).toContain("142,500");
    expect(prompt).toContain("198,600");
  });

  it("includes COL index and MSA name in prompt", () => {
    const prompt = buildPrompt(request);
    expect(prompt).toContain("118.3");
    expect(prompt).toContain("San Francisco");
  });

  it("includes walk-away number and target salary in prompt", () => {
    const prompt = buildPrompt(request);
    expect(prompt).toContain("147,116");
    expect(prompt).toContain("195,000");
  });

  it("includes output format instructions", () => {
    const prompt = buildPrompt(request);
    expect(prompt).toContain("OPENING");
    expect(prompt).toContain("DATA REFERENCE");
    expect(prompt).toContain("THE ASK");
    expect(prompt).toContain("PUSHBACK RESPONSE");
  });
});

describe("buildSystemPrompt", () => {
  it("includes negotiation coach persona", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("negotiation coach");
  });
});

describe("parseScriptResponse", () => {
  it("parses a well-formed response into GeneratedScript with 4 sections", () => {
    const raw = `OPENING
Thank you for the offer. I'm excited about the opportunity to join the team.

DATA REFERENCE
Based on BLS data for the San Francisco MSA, the median salary for this role is $168,200, with the 75th percentile at $198,600.

THE ASK
I'd like to propose a base salary of $195,000, which aligns with the upper range for this role in this market.

PUSHBACK RESPONSE
Would it be possible to explore the total compensation package? I'm flexible on how we structure it.`;

    const result = parseScriptResponse(raw);
    expect(result).toBeDefined();
    expect(result!.opening).toContain("Thank you");
    expect(result!.dataReference).toContain("BLS data");
    expect(result!.theAsk).toContain("$195,000");
    expect(result!.pushbackResponse).toContain("total compensation");
  });

  it("returns null for empty response", () => {
    expect(parseScriptResponse("")).toBeNull();
    expect(parseScriptResponse("   ")).toBeNull();
  });

  it("handles 'IF THEY PUSH BACK' variant", () => {
    const raw = `OPENING
Thank you for the offer.

DATA REFERENCE
BLS data shows the median is competitive.

THE ASK
I'd like to propose $190,000.

IF THEY PUSH BACK
Would it be possible to explore total comp?`;

    const result = parseScriptResponse(raw);
    expect(result).toBeDefined();
    expect(result!.pushbackResponse).toContain("total comp");
  });
});

describe("generateScript", () => {
  it("returns ai_missing_key error when key is empty", async () => {
    const result = await generateScript(makeScriptRequest(), "");
    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.error.type).toBe("ai_missing_key");
    }
  });

  it("returns ai_missing_key error when key is whitespace", async () => {
    const result = await generateScript(makeScriptRequest(), "   ");
    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.error.type).toBe("ai_missing_key");
    }
  });

  it("generates script successfully with valid API key", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          content: [
            {
              text: `OPENING
Thank you for the offer.

DATA REFERENCE
BLS data for this role shows a median of $168,200.

THE ASK
I'd like to propose $195,000.

PUSHBACK RESPONSE
Would it be possible to explore total comp?`,
            },
          ],
        }),
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

    const result = await generateScript(makeScriptRequest(), "sk-test-key");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.script.opening).toBeTruthy();
      expect(result.script.generatedAt).toBeGreaterThan(0);
    }

    vi.restoreAllMocks();
  });

  it("returns ai_invalid_key error on 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401 })
    );

    const result = await generateScript(makeScriptRequest(), "bad-key");
    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.error.type).toBe("ai_invalid_key");
    }

    vi.restoreAllMocks();
  });

  it("returns ai_rate_limit error on 429", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 429 })
    );

    const result = await generateScript(makeScriptRequest(), "sk-test");
    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.error.type).toBe("ai_rate_limit");
    }

    vi.restoreAllMocks();
  });

  it("returns ai_timeout error when request exceeds timeout", async () => {
    const abortError = new DOMException("The operation was aborted.", "AbortError");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(abortError)
    );

    const result = await generateScript(makeScriptRequest(), "sk-test");
    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.error.type).toBe("ai_timeout");
    }

    vi.restoreAllMocks();
  });
});

describe("createClaudeProvider", () => {
  it("returns a provider with name 'claude'", () => {
    const provider = createClaudeProvider("sk-test");
    expect(provider.name).toBe("claude");
  });
});
