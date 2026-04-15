/**
 * Walk-away salary calculator.
 *
 * Produces two figures:
 *   costOfLiving = monthlyRent * 12 / HOUSING_SHARE
 *   marketSalary = BLS_median * experience_multiplier
 *
 * The walk-away number is the floor: max(costOfLiving, 0.9 * marketSalary).
 * This ensures the user never accepts less than it costs to live, AND never
 * accepts less than 90% of market rate.
 *
 * Housing share uses the standard 30% affordability rule (HUD guideline):
 * housing costs should not exceed 30% of gross income.
 *
 * Monthly rent data comes from HUD Fair Market Rents (FY 2026, 1-bedroom).
 * Experience multipliers: entry (0-2yr): 0.85x, mid (3-7yr): 1.0x, senior (8+yr): 1.15x
 */
import type { ExperienceBracket, WalkAwayResult, BLSData, COLData } from "../types";

/** Experience bracket multipliers */
export const EXPERIENCE_MULTIPLIERS: Record<ExperienceBracket, number> = {
  entry: 0.85,
  mid: 1.0,
  senior: 1.15,
};

/** Discount factor for walk-away calculation (10% below market rate) */
export const WALK_AWAY_DISCOUNT = 0.9;

/** Housing affordability ratio (HUD 30% rule) */
export const HOUSING_SHARE = 0.30;

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
 * Calculate the walk-away number and supporting figures.
 *
 * costOfLiving: Annual cost of living derived from HUD 1BR rent.
 *   (monthlyRent * 12) / 0.30 = total annual income needed assuming
 *   housing is 30% of expenses.
 *
 * marketSalary: BLS median wage adjusted for experience level.
 *   median * experienceMultiplier
 *
 * walkAway: max(costOfLiving, 0.9 * marketSalary)
 *   Don't accept less than it costs to live.
 *   Don't accept less than 90% of market rate.
 *
 * target: marketSalary (the recommended negotiation target).
 */
export function calculateWalkAway(
  blsData: BLSData,
  colData: COLData,
  bracket: ExperienceBracket
): WalkAwayResult {
  const multiplier = EXPERIENCE_MULTIPLIERS[bracket];
  const colIndex = colData.rpp / 100;

  const marketSalary = Math.round(blsData.median * multiplier);
  const costOfLiving = Math.round((colData.monthlyRent * 12) / HOUSING_SHARE);
  const walkAway = Math.max(costOfLiving, Math.round(WALK_AWAY_DISCOUNT * marketSalary));
  const target = marketSalary;

  return {
    walkAway,
    target,
    costOfLiving,
    marketSalary,
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
