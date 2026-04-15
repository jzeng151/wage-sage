/**
 * AI negotiation script generator.
 *
 * Builds a structured prompt from job/BLS/COL data, sends it to the Claude API,
 * and parses the response into a four-section script (Opening, Data Reference,
 * The Ask, Pushback Response).
 *
 * Architecture notes:
 * - AIProvider interface abstracts the backend for future model swapping
 * - 30-second timeout via AbortController to avoid hanging the service worker
 * - Results are cached in chrome.storage.local with 24-hour TTL
 * - The API key is passed in from the service worker, never from the popup
 */
import type {
  ScriptRequest,
  GeneratedScript,
  WageSageError,
  CacheEntry,
} from "../types";

const AI_TIMEOUT_MS = 30_000;
const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";

/** AI provider interface for future backend abstraction */
export interface AIProvider {
  name: string;
  generateScript(
    prompt: string,
    systemPrompt: string
  ): Promise<
    { success: true; text: string } | { success: false; error: WageSageError }
  >;
}

function scriptCacheKey(req: ScriptRequest): string {
  return `script_${req.blsData.socCode}_${req.blsData.msaCode}_${req.targetSalary}`;
}

/**
 * Build the structured prompt for Claude API.
 */
export function buildPrompt(request: ScriptRequest): string {
  const { jobData, blsData, colData, walkAwayResult, targetSalary } = request;
  const colPctAbove = ((colData.rpp - 100)).toFixed(1);
  const colDirection = colData.rpp >= 100 ? "above" : "below";

  return `CONTEXT:
- Role: ${jobData.title}
- Company: ${jobData.company}
- Location: ${blsData.msaName || "this area"}
- BLS median for this role in this MSA: $${blsData.median.toLocaleString()}
- 25th percentile: $${blsData.p25.toLocaleString()}
- 75th percentile: $${blsData.p75.toLocaleString()}
- Cost of living index: ${colData.rpp} (${colPctAbove}% ${colDirection} national average)
- Estimated annual cost of living: $${walkAwayResult.costOfLiving.toLocaleString()} (based on 1BR rent of $${colData.monthlyRent.toLocaleString()}/mo)
- Market salary for this role: $${walkAwayResult.marketSalary.toLocaleString()}
- Minimum acceptable salary: $${walkAwayResult.walkAway.toLocaleString()}
- User's target salary: $${targetSalary.toLocaleString()}

Generate a salary negotiation script the user can read word-for-word. Reference the specific MSA name and specific BLS dollar figures. Use collaborative language ("I'd like to propose...", "Based on the data...", "Would it be possible to explore..."). Do NOT use adversarial language ("I deserve", "I refuse", "That's not acceptable").

Structure your response with exactly these four sections:

OPENING
(1-2 sentences: acknowledge the offer, express enthusiasm)

DATA REFERENCE
(2-3 sentences: cite specific BLS data for this MSA)

THE ASK
(1-2 sentences: state the specific number being proposed)

PUSHBACK RESPONSE
(2-3 sentences: if they say no, what to say next)`;
}

export function buildSystemPrompt(): string {
  return `You are an expert salary negotiation coach. Generate a negotiation script that a real person can read word-for-word during a salary discussion. Be collaborative in tone, not adversarial. Cite specific BLS data points. Your response must have exactly four sections labeled OPENING, DATA REFERENCE, THE ASK, and PUSHBACK RESPONSE. Do not include any other text outside these sections.`;
}

/**
 * Parse the raw AI response text into a structured GeneratedScript.
 */
export function parseScriptResponse(rawText: string): GeneratedScript | null {
  if (!rawText || rawText.trim().length === 0) return null;

  const sections = {
    opening: "",
    dataReference: "",
    theAsk: "",
    pushbackResponse: "",
  };

  // Try to split by section headers
  const openingMatch = rawText.match(/OPENING\s*\n([\s\S]*?)(?=\n\s*(?:DATA REFERENCE|THE ASK|PUSHBACK)|$)/i);
  const dataMatch = rawText.match(/DATA REFERENCE\s*\n([\s\S]*?)(?=\n\s*(?:THE ASK|PUSHBACK)|$)/i);
  const askMatch = rawText.match(/THE ASK\s*\n([\s\S]*?)(?=\n\s*(?:PUSHBACK|IF THEY)|$)/i);
  const pushbackMatch = rawText.match(/(?:PUSHBACK RESPONSE|PUSHBACK|IF THEY PUSH BACK)\s*\n([\s\S]*?)$/i);

  if (openingMatch) sections.opening = openingMatch[1].trim();
  if (dataMatch) sections.dataReference = dataMatch[1].trim();
  if (askMatch) sections.theAsk = askMatch[1].trim();
  if (pushbackMatch) sections.pushbackResponse = pushbackMatch[1].trim();

  // If no sections were parsed, return null
  if (!sections.opening && !sections.dataReference && !sections.theAsk && !sections.pushbackResponse) {
    return null;
  }

  return {
    ...sections,
    rawResponse: rawText,
    generatedAt: Date.now(),
  };
}

/**
 * Create a Claude API provider instance.
 */
export function createClaudeProvider(apiKey: string): AIProvider {
  return {
    name: "claude",
    async generateScript(
      prompt: string,
      systemPrompt: string
    ): Promise<
      | { success: true; text: string }
      | { success: false; error: WageSageError }
    > {
      if (!apiKey || apiKey.trim().length === 0) {
        return {
          success: false,
          error: {
            type: "ai_missing_key",
            message: "Claude API key is required.",
            recoverable: true,
            recoveryAction: "Add your API key in Settings.",
          },
        };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

      try {
        const response = await fetch(CLAUDE_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1024,
            system: systemPrompt,
            messages: [{ role: "user", content: prompt }],
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.status === 401) {
          return {
            success: false,
            error: {
              type: "ai_invalid_key",
              message: "Invalid API key.",
              recoverable: true,
              recoveryAction: "Check your API key in Settings.",
            },
          };
        }

        if (response.status === 429) {
          return {
            success: false,
            error: {
              type: "ai_rate_limit",
              message: "Rate limited. Try again in 30 seconds.",
              recoverable: true,
              recoveryAction: "Wait 30 seconds and try again.",
            },
          };
        }

        if (!response.ok) {
          return {
            success: false,
            error: {
              type: "ai_malformed",
              message: "AI service returned an error.",
              recoverable: true,
              recoveryAction: "Try again.",
            },
          };
        }

        const claudeResponseBody = await response.json();

        // Validate response structure
        if (!claudeResponseBody || typeof claudeResponseBody !== "object") {
          return {
            success: false,
            error: {
              type: "ai_malformed",
              message: "AI returned an unexpected response format.",
              recoverable: true,
              recoveryAction: "Try again.",
            },
          };
        }

        const content = (claudeResponseBody as Record<string, unknown>).content;
        if (!Array.isArray(content) || content.length === 0) {
          return {
            success: false,
            error: {
              type: "ai_malformed",
              message: "AI returned an empty response.",
              recoverable: true,
              recoveryAction: "Try again.",
            },
          };
        }

        const text = (content[0] as Record<string, unknown>)?.text;
        if (typeof text !== "string" || text.trim().length === 0) {
          return {
            success: false,
            error: {
              type: "ai_malformed",
              message: "AI returned an empty response.",
              recoverable: true,
              recoveryAction: "Try again.",
            },
          };
        }

        return { success: true, text };
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof DOMException && error.name === "AbortError") {
          return {
            success: false,
            error: {
              type: "ai_timeout",
              message: "Request timed out after 30 seconds.",
              recoverable: true,
              recoveryAction: "Try again.",
            },
          };
        }
        return {
          success: false,
          error: {
            type: "ai_malformed",
            message: error instanceof Error ? error.message : "Unknown error.",
            recoverable: true,
            recoveryAction: "Try again.",
          },
        };
      }
    },
  };
}

/**
 * Get cached script from chrome.storage.local.
 */
export async function getCachedScript(
  request: ScriptRequest
): Promise<GeneratedScript | undefined> {
  const key = scriptCacheKey(request);
  try {
    const result = await chrome.storage.local.get(key);
    const entry: CacheEntry<GeneratedScript> | undefined = result[key];
    if (!entry) return undefined;
    return entry.data;
  } catch {
    return undefined;
  }
}

/**
 * Generate a negotiation script using the configured AI provider.
 */
export async function generateScript(
  request: ScriptRequest,
  apiKey: string
): Promise<
  | { success: true; script: GeneratedScript }
  | { success: false; error: WageSageError }
> {
  if (!apiKey || apiKey.trim().length === 0) {
    return {
      success: false,
      error: {
        type: "ai_missing_key",
        message: "Claude API key is required.",
        recoverable: true,
        recoveryAction: "Add your API key in Settings.",
      },
    };
  }

  // Check cache first
  const cached = await getCachedScript(request);
  if (cached) {
    return { success: true, script: cached };
  }

  const provider = createClaudeProvider(apiKey);
  const prompt = buildPrompt(request);
  const systemPrompt = buildSystemPrompt();

  const generationResult = await provider.generateScript(prompt, systemPrompt);

  if (generationResult.success === false) {
    return { success: false, error: generationResult.error };
  }

  const script = parseScriptResponse(generationResult.text);

  if (!script) {
    return {
      success: false,
      error: {
        type: "ai_malformed",
        message: "Could not parse the AI response into a structured script.",
        recoverable: true,
        recoveryAction: "Try again.",
      },
    };
  }

  // Cache the result
  const cacheEntry: CacheEntry<GeneratedScript> = {
    data: script,
    cachedAt: Date.now(),
    ttlMs: 24 * 60 * 60 * 1000, // 24-hour TTL for scripts
  };
  try {
    await chrome.storage.local.set({
      [scriptCacheKey(request)]: cacheEntry,
    });
  } catch {
    // Storage write failure is non-fatal
  }

  return { success: true, script };
}
