/**
 * Input validation and sanitization for untrusted data.
 *
 * All data from chrome.storage.local and message payloads is treated as untrusted.
 * These functions enforce type, length, and format constraints before data reaches
 * business logic.
 *
 * Key rules:
 * - String inputs: max 200 chars, whitespace collapsed, trimmed
 * - Salary values: must be finite, positive, clamped to $5M
 * - SOC codes: must match ^\d{2}-\d{4}$
 * - MSA codes: must match ^\d{5}$
 */

/** Maximum string lengths for user-provided input */
const MAX_TITLE_LENGTH = 200;
const MAX_COMPANY_LENGTH = 200;
const MAX_LOCATION_LENGTH = 200;
const MAX_SALARY = 5_000_000;

/**
 * Sanitize a free-text string: trim, collapse whitespace, enforce length.
 */
export function sanitizeString(input: string, maxLength: number): string {
  return input.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

/**
 * Validate and clamp a salary value to a sane range.
 * Returns the clamped value or null if invalid.
 */
export function validateSalary(value: number): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.min(value, MAX_SALARY);
}

/**
 * Validate a JobData-like object from untrusted storage.
 * Returns the sanitized object or null if invalid.
 */
export function validateJobDataFromStorage(raw: unknown): {
  title: string;
  company: string;
  location: string;
  source: "linkedin" | "manual";
  extractedAt: number;
  tabId?: number;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;

  if (typeof data.title !== "string" || data.title.trim().length === 0) return null;
  if (typeof data.company !== "string" || data.company.trim().length === 0) return null;
  if (typeof data.location !== "string" || data.location.trim().length === 0) return null;
  if (data.source !== "linkedin" && data.source !== "manual") return null;
  if (typeof data.extractedAt !== "number") return null;

  // Enforce length limits
  if (data.title.length > MAX_TITLE_LENGTH) return null;
  if (data.company.length > MAX_COMPANY_LENGTH) return null;
  if (data.location.length > MAX_LOCATION_LENGTH) return null;

  return {
    title: data.title,
    company: data.company,
    location: data.location,
    source: data.source,
    extractedAt: data.extractedAt,
    ...(typeof data.tabId === "number" ? { tabId: data.tabId } : {}),
  };
}

/**
 * Validate a message payload from untrusted source.
 * Enforces string length limits and number ranges.
 */
export function validateScriptRequestPayload(
  payload: unknown
): boolean {
  if (!payload || typeof payload !== "object") return false;
  const payloadObj = payload as Record<string, unknown>;

  // Check nested jobData
  if (!payloadObj.jobData || typeof payloadObj.jobData !== "object") return false;
  const jobDataFields = payloadObj.jobData as Record<string, unknown>;
  if (typeof jobDataFields.title !== "string" || jobDataFields.title.length > MAX_TITLE_LENGTH) return false;
  if (typeof jobDataFields.company !== "string" || jobDataFields.company.length > MAX_COMPANY_LENGTH) return false;
  if (typeof jobDataFields.location !== "string" || jobDataFields.location.length > MAX_LOCATION_LENGTH) return false;

  // Check targetSalary
  if (typeof payloadObj.targetSalary !== "number" || !Number.isFinite(payloadObj.targetSalary)) return false;
  if (payloadObj.targetSalary <= 0 || payloadObj.targetSalary > MAX_SALARY) return false;

  // Check nested blsData numbers
  if (!payloadObj.blsData || typeof payloadObj.blsData !== "object") return false;
  const blsFields = payloadObj.blsData as Record<string, unknown>;
  if (typeof blsFields.socCode !== "string" || !/^\d{2}-\d{4}$/.test(blsFields.socCode)) return false;
  if (typeof blsFields.msaCode !== "string" || !/^\d{5}$/.test(blsFields.msaCode)) return false;

  return true;
}

export { MAX_TITLE_LENGTH, MAX_COMPANY_LENGTH, MAX_LOCATION_LENGTH, MAX_SALARY };
