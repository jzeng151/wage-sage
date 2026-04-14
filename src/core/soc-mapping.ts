/**
 * Job title to BLS SOC code mapper.
 *
 * Two-phase matching strategy:
 * 1. Keyword match: check if normalized title contains any keyword from the SOC_CODES table.
 *    Confidence = 0.7 + (keyword_length / input_length) * 0.3, capped at 1.0.
 * 2. Levenshtein fallback: if no keyword match hits the 0.6 threshold, compute edit distance
 *    against every BLS title. Confidence = 1 - (distance / max_length).
 *
 * Titles are normalized by lowercasing, stripping punctuation, and removing seniority
 * prefixes (senior, staff, principal, lead, junior, etc.).
 */
import { SOC_CODES } from "./data/soc-codes";
import type { SOCMappingResult } from "../types";

/**
 * Normalize a job title for comparison: lowercase, strip punctuation,
 * remove common prefixes.
 */
export function normalizeTitle(title: string): string {
  let normalized = title.toLowerCase().trim();
  // Remove punctuation
  normalized = normalized.replace(/[^\w\s]/g, "");
  // Remove common prefixes
  const prefixes = [
    "senior",
    "staff",
    "principal",
    "lead",
    "junior",
    "sr",
    "jr",
    "sr.",
    "jr.",
    "associate",
    "assistant",
    "entry level",
    "mid level",
    "mid-level",
    "entry-level",
  ];
  for (const prefix of prefixes) {
    const regex = new RegExp(`^${prefix}\\s+`, "i");
    normalized = normalized.replace(regex, "");
  }
  return normalized.trim();
}

/**
 * Calculate Levenshtein edit distance between two strings.
 */
export function levenshteinDistance(source: string, target: string): number {
  const sourceLen = source.length;
  const targetLen = target.length;
  const distanceMatrix: number[][] = Array.from({ length: sourceLen + 1 }, () =>
    Array(targetLen + 1).fill(0)
  );

  for (let i = 0; i <= sourceLen; i++) distanceMatrix[i][0] = i;
  for (let j = 0; j <= targetLen; j++) distanceMatrix[0][j] = j;

  for (let i = 1; i <= sourceLen; i++) {
    for (let j = 1; j <= targetLen; j++) {
      const substitutionCost = source[i - 1] === target[j - 1] ? 0 : 1;
      distanceMatrix[i][j] = Math.min(
        distanceMatrix[i - 1][j] + 1, // deletion
        distanceMatrix[i][j - 1] + 1, // insertion
        distanceMatrix[i - 1][j - 1] + substitutionCost // substitution
      );
    }
  }

  return distanceMatrix[sourceLen][targetLen];
}

/**
 * Map a free-text job title to a BLS SOC code using keyword matching
 * with Levenshtein distance fallback.
 */
export function mapTitleToSOC(inputTitle: string): SOCMappingResult | undefined {
  if (!inputTitle || inputTitle.trim().length === 0) {
    return undefined;
  }

  const normalized = normalizeTitle(inputTitle);
  if (normalized.length === 0) {
    return undefined;
  }

  let bestMatch: SOCMappingResult | undefined;
  let bestScore = 0;
  const CONFIDENCE_THRESHOLD = 0.6;

  // Step 1: Keyword matching
  for (const entry of SOC_CODES) {
    for (const keyword of entry.keywords) {
      if (normalized.includes(keyword.toLowerCase())) {
        // Keyword match confidence is based on how specific the keyword is
        const specificity = keyword.length / normalized.length;
        const confidence = Math.min(0.7 + specificity * 0.3, 1.0);
        if (confidence > bestScore) {
          bestScore = confidence;
          bestMatch = {
            socCode: entry.socCode,
            title: entry.blsTitle,
            confidence,
          };
        }
      }
    }
  }

  if (bestScore >= CONFIDENCE_THRESHOLD) {
    return bestMatch;
  }

  // Step 2: Levenshtein fallback
  for (const entry of SOC_CODES) {
    const entryTitle = normalizeTitle(entry.blsTitle);
    const distance = levenshteinDistance(normalized, entryTitle);
    const maxTitleLength = Math.max(normalized.length, entryTitle.length);
    if (maxTitleLength === 0) continue;
    const similarity = 1 - distance / maxTitleLength;

    if (similarity > bestScore && similarity >= CONFIDENCE_THRESHOLD) {
      bestScore = similarity;
      bestMatch = {
        socCode: entry.socCode,
        title: entry.blsTitle,
        confidence: similarity,
      };
    }
  }

  return bestScore >= CONFIDENCE_THRESHOLD ? bestMatch : undefined;
}

/**
 * Get all supported BLS titles for dropdown display.
 */
export function getSupportedTitles(): { socCode: string; blsTitle: string }[] {
  // Deduplicate by socCode
  const seen = new Set<string>();
  return SOC_CODES.filter((entry) => {
    if (seen.has(entry.socCode)) return false;
    seen.add(entry.socCode);
    return true;
  }).map((entry) => ({
    socCode: entry.socCode,
    blsTitle: entry.blsTitle,
  }));
}
