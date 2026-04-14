/**
 * Walk-away salary calculator.
 *
 * The walk-away number is the minimum salary a candidate should accept, calculated as:
 *   0.9 * (BLS_median * experience_multiplier) / (RPP / 100)
 *
 * The experience multiplier adjusts the BLS median based on seniority:
 *   entry (0-2yr): 0.85x, mid (3-7yr): 1.0x, senior (8+yr): 1.15x
 *
 * The RPP (Regional Price Parity) divides to normalize for cost of living.
 * Higher RPP = more expensive area = lower effective salary.
 */
import type { ExperienceBracket, WalkAwayResult, BLSData, COLData } from "../types";

/** Experience bracket multipliers */
export const EXPERIENCE_MULTIPLIERS: Record<ExperienceBracket, number> = {
  entry: 0.85,
  mid: 1.0,
  senior: 1.15,
};

/** Discount factor for walk-away calculation (10% below adjusted median) */
export const WALK_AWAY_DISCOUNT = 0.9;

/**
 * Determine experience bracket from years of experience.
 * Boundary rules: 0-2 = entry, 3-7 = mid, 8+ = senior.
 */
export function getExperienceBracket(years: number): ExperienceBracket {
  const clamped = Math.max(0, Math.floor(years));
  if (clamped <= 2) return "entry";
  if (clamped <= 7) return "mid";
  return "senior";
}

/**
 * Calculate the walk-away number and default target salary.
 *
 * Formula:
 *   walk_away = 0.9 * (BLS_median * experience_multiplier) / (RPP / 100)
 *   target    =       (BLS_median * experience_multiplier) / (RPP / 100)
 */
export function calculateWalkAway(
  blsData: BLSData,
  colData: COLData,
  bracket: ExperienceBracket
): WalkAwayResult {
  const multiplier = EXPERIENCE_MULTIPLIERS[bracket];
  const colIndex = colData.rpp / 100;

  const adjustedMedian = (blsData.median * multiplier) / colIndex;
  const walkAway = Math.round(WALK_AWAY_DISCOUNT * adjustedMedian);
  const target = Math.round(adjustedMedian);

  return {
    walkAway,
    target,
    median: blsData.median,
    p25: blsData.p25,
    p75: blsData.p75,
    colIndex,
    experienceBracket: bracket,
    experienceMultiplier: multiplier,
  };
}

/**
 * Format a number as USD currency string.
 * e.g. 168200 -> "$168,200"
 */
export function formatSalary(amount: number): string {
  return "$" + Math.round(amount).toLocaleString("en-US");
}
