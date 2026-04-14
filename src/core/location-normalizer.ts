/**
 * Location string normalizer.
 *
 * Converts free-text location (e.g. "San Francisco Bay Area", "New York, NY",
 * "Washington DC-Baltimore Area (On-site)") into a BLS MSA code using the
 * CITY_TO_MSA lookup table.
 *
 * Pre-processing strips:
 * - Parenthetical suffixes like "(On-site)", "(Hybrid)", "(Remote)"
 * - Workplace type keywords that aren't location indicators
 *
 * Matching priority:
 * 1. "City, ST" format (exact two-letter state abbreviation)
 * 2. "City, State" format (full state name, resolved from table)
 * 3. "City Area/Metro/Region" suffix stripped, then exact city match
 * 4. "City1-City2 Area" hyphenated metro names
 *
 * Returns undefined for non-US or unrecognized locations.
 */
import { CITY_TO_MSA } from "./data/city-to-msa";
import type { LocationResult } from "../types";

/**
 * Strip parenthetical suffixes and workplace type annotations.
 * e.g. "Washington DC-Baltimore Area (On-site)" -> "Washington DC-Baltimore Area"
 * e.g. "New York, NY (Hybrid)" -> "New York, NY"
 */
function cleanLocation(location: string): string {
  // Strip parenthetical suffixes like (On-site), (Hybrid), (Remote)
  let cleaned = location.replace(/\s*\([^)]*\)\s*$/, "").trim();

  // Strip trailing workplace type keywords (not inside parens)
  cleaned = cleaned.replace(/\s*\b(On-site|Remote|Hybrid)\s*$/i, "").trim();

  return cleaned;
}

/**
 * Extract city and state from a free-text location string.
 * Returns null for non-US or unparseable locations.
 */
export function parseLocationParts(
  location: string
): { city: string; state: string } | null {
  const raw = location.trim();
  if (!raw) return null;

  // Strip parenthetical suffixes first
  const trimmed = cleanLocation(raw);
  if (!trimmed) return null;

  // Pure "Remote" with nothing else
  if (/^Remote$/i.test(trimmed)) return null;

  // Known non-US patterns
  const nonUSPatterns = [
    /,\s*(UK|England|Scotland|Wales|Ireland|Germany|France|India|China|Japan|Canada|Australia|Brazil|Mexico|Netherlands|Singapore|South Korea|Israel|Sweden|Switzerland)\s*$/i,
  ];
  for (const pattern of nonUSPatterns) {
    if (pattern.test(trimmed)) return null;
  }

  // Pattern: "City, ST" (two-letter state abbreviation, includes DC)
  const cityStateMatch = trimmed.match(/^(.+?),\s*([A-Z]{2})\s*$/);
  if (cityStateMatch) {
    return { city: cityStateMatch[1].trim(), state: cityStateMatch[2] };
  }

  // Pattern: "City ST" without comma (e.g. "New York NY", "Washington DC")
  const cityStateNoComma = trimmed.match(/^(.+?)\s+([A-Z]{2})\s*$/);
  if (cityStateNoComma) {
    const cityName = cityStateNoComma[1].trim();
    // Make sure the city part doesn't end with a state abbreviation (avoid double-match)
    const stateCode = cityStateNoComma[2];
    if (stateCode !== "US" && stateCode.length === 2) {
      const hasMatch = CITY_TO_MSA.find(
        (entry) => entry.state === stateCode
      );
      if (hasMatch) {
        return { city: cityName, state: stateCode };
      }
    }
  }

  // Pattern: "City, State" (full state name)
  const cityFullStateMatch = trimmed.match(/^(.+?),\s*([A-Za-z\s]+?)\s*$/);
  if (cityFullStateMatch) {
    const stateName = cityFullStateMatch[2].trim();
    const stateEntry = CITY_TO_MSA.find(
      (entry) => entry.stateFull.toLowerCase() === stateName.toLowerCase()
    );
    if (stateEntry) {
      return { city: cityFullStateMatch[1].trim(), state: stateEntry.state };
    }
  }

  // Pattern: "City Area" or "City Metro" or "City Region" (area suffix stripped)
  // Also handles "City1-City2 Area" (hyphenated metro names like "Washington DC-Baltimore Area")
  const areaSuffixes = [
    "Bay Area",
    "Metro Area",
    "Metropolitan Area",
    "Area",
    "Metro",
    "Region",
  ];
  for (const suffix of areaSuffixes) {
    const suffixIndex = trimmed.toLowerCase().indexOf(suffix.toLowerCase());
    if (suffixIndex > 0) {
      const cityPart = trimmed.substring(0, suffixIndex).trim();

      // Try the full city part first (e.g. "Washington DC-Baltimore")
      const fullMatch = CITY_TO_MSA.find(
        (entry) => entry.city.toLowerCase() === cityPart.toLowerCase()
      );
      if (fullMatch) {
        return { city: fullMatch.city, state: fullMatch.state };
      }

      // Try the first city before the hyphen (e.g. "Washington DC" from "Washington DC-Baltimore")
      const hyphenParts = cityPart.split(/\s*[-–—]\s*/);
      if (hyphenParts.length > 1) {
        const firstCity = hyphenParts[0].trim();
        // Handle "Washington DC" -> split into city/state
        const dcMatch = firstCity.match(/^(.+?)\s+(DC)$/i);
        if (dcMatch) {
          return { city: dcMatch[1].trim(), state: "DC" };
        }
        const firstCityMatch = CITY_TO_MSA.find(
          (entry) => entry.city.toLowerCase() === firstCity.toLowerCase()
        );
        if (firstCityMatch) {
          return { city: firstCityMatch.city, state: firstCityMatch.state };
        }
      }
    }
  }

  // Pattern: "United States" or similar
  if (/united states/i.test(trimmed)) return null;

  return null;
}

/**
 * Find the best matching MSA for a given city and state.
 */
export function findMSA(
  city: string,
  state: string
): (typeof CITY_TO_MSA)[0] | undefined {
  const cityLower = city.toLowerCase();
  const stateUpper = state.toUpperCase();

  // Exact match first
  const exact = CITY_TO_MSA.find(
    (entry) => entry.city.toLowerCase() === cityLower && entry.state === stateUpper
  );
  if (exact) return exact;

  // Substring match (city name contains search, or search contains city name)
  const substring = CITY_TO_MSA.find((msaEntry) => {
    const entryCityLower = msaEntry.city.toLowerCase();
    const entryStateUpper = msaEntry.state;
    return (
      entryStateUpper === stateUpper &&
      (entryCityLower.includes(cityLower) || cityLower.includes(entryCityLower))
    );
  });
  if (substring) return substring;

  // Try matching just on state if city not found
  return CITY_TO_MSA.find((msaEntry) => msaEntry.state === stateUpper);
}

/**
 * Parse a free-text location string into an MSA code.
 */
export function normalizeLocation(location: string): LocationResult | undefined {
  if (!location || location.trim().length === 0) return undefined;

  const parts = parseLocationParts(location);
  if (!parts) return undefined;

  const msa = findMSA(parts.city, parts.state);
  if (!msa) return undefined;

  return {
    msaCode: msa.msaCode,
    msaName: msa.msaName,
    city: parts.city,
    state: parts.state,
  };
}
