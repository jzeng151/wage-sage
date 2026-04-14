/**
 * Shared type definitions for Wage Sage.
 *
 * Discriminated union pattern: service results use `{ success: true; data } | { success: false; error }`.
 * Always narrow with `result.success === false` (not `!result.success`) for TypeScript to correctly narrow the union.
 */

/** Raw job data extracted from a LinkedIn page or entered manually */
export interface JobData {
  title: string;
  company: string;
  location: string;
  source: "linkedin" | "manual";
  extractedAt: number;
  tabId?: number;
}

/** Experience bracket used in walk-away calculation */
export type ExperienceBracket = "entry" | "mid" | "senior";

/** BLS OEWS wage data for a specific SOC code + MSA */
export interface BLSData {
  socCode: string;
  msaCode: string;
  msaName: string;
  median: number;
  p25: number;
  p75: number;
  mean: number;
  fetchedAt: number;
}

/** BEA Regional Price Parity for cost-of-living adjustment */
export interface COLData {
  msaCode: string;
  beaAreaCode: string;
  rpp: number;
  fetchedAt: number;
}

/** Result of the walk-away number calculator */
export interface WalkAwayResult {
  walkAway: number;
  target: number;
  median: number;
  p25: number;
  p75: number;
  colIndex: number;
  experienceBracket: ExperienceBracket;
  experienceMultiplier: number;
}

/** Result of SOC code mapping with confidence */
export interface SOCMappingResult {
  socCode: string;
  title: string;
  confidence: number;
}

/** Result of location normalization */
export interface LocationResult {
  msaCode: string;
  msaName: string;
  city?: string;
  state?: string;
}

/**
 * Structured error with typed discriminants.
 * Each `type` maps to a distinct recovery UI in ErrorStates.tsx.
 * HTTP status codes are intentionally excluded to avoid leaking transport details.
 */
export interface WageSageError {
  type:
    | "bls_no_data"
    | "bls_network"
    | "bls_rate_limit"
    | "col_no_data"
    | "ai_missing_key"
    | "ai_invalid_key"
    | "ai_rate_limit"
    | "ai_timeout"
    | "ai_malformed"
    | "dom_parse_failed"
    | "soc_no_match"
    | "location_no_match"
    | "offline";
  message: string;
  recoverable: boolean;
  recoveryAction?: string;
}

/** Provider-agnostic AI script generation request */
export interface ScriptRequest {
  jobData: JobData;
  blsData: BLSData;
  colData: COLData;
  walkAwayResult: WalkAwayResult;
  targetSalary: number;
}

/** Structured negotiation script */
export interface GeneratedScript {
  opening: string;
  dataReference: string;
  theAsk: string;
  pushbackResponse: string;
  rawResponse?: string;
  generatedAt: number;
}

/** Cache entry wrapper */
export interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  ttlMs: number;
}

/**
 * Message types for popup <-> service worker <-> content script communication.
 * The popup never sends the API key; the service worker reads it from storage.
 * All payloads are validated by validateScriptRequestPayload() before processing.
 *
 * Content scripts send CACHE_JOB_DATA to the background, which caches under
 * the sender's tab ID. The popup reads by tab ID. This avoids the content
 * script needing to know its own tab ID (unavailable in MV3 content scripts).
 */
export type MessageType =
  | { type: "GENERATE_SCRIPT"; payload: ScriptRequest }
  | {
      type: "SCRIPT_RESULT";
      payload:
        | { success: true; script: GeneratedScript }
        | { success: false; error: WageSageError };
    }
  | {
      type: "GET_CACHED_SCRIPT";
      payload: { socCode: string; msaCode: string; target: number };
    }
  | { type: "CACHE_JOB_DATA"; payload: JobData }
  | {
      type: "FETCH_BLS_DATA";
      payload: { socCode: string; stateCode: string };
    }
  | { type: "EXTRACT_JOB_DATA" };
