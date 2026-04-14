/**
 * BLS OEWS API client for occupational wage data.
 *
 * The BLS public API v2 does NOT support MSA-level queries. Only national
 * and state-level series are available. This service queries state-level data.
 *
 * Series ID format (25 characters):
 *   OEUS + {FIPS 2-digit} + {11 zeros} + {SOC 6-digit} + {data type 2-digit}
 *   Example: OEUS060000000000015125204 = annual median wage for Software Developers in California
 *
 * Data type suffixes:
 *   04 = annual mean wage
 *   11 = 10th percentile annual
 *   12 = 25th percentile annual
 *   13 = 75th percentile annual
 *   14 = 90th percentile annual
 *
 * Uses cache-first strategy with 30-day TTL in chrome.storage.local.
 */
import type { BLSData, WageSageError, CacheEntry } from "../types";
import { STATE_FIPS } from "../core/data/state-fips";

const BLS_API_URL = "https://api.bls.gov/publicAPI/v2/timeseries/data/";
const BLS_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function cacheKey(socCode: string, stateCode: string): string {
  return `bls_${socCode}_${stateCode}`;
}

/**
 * Build a BLS OEWS state-level series ID.
 * Format: OEUS{FIPS_2digit}00000000000{SOC_6digit}{DATA_TYPE_2digit}
 */
function buildSeriesId(socCode: string, fipsCode: string, dataType: string): string {
  const socNoDash = socCode.replace("-", "");
  return `OEUS${fipsCode}00000000000${socNoDash}${dataType}`;
}

/**
 * Parse BLS API response and extract a single wage value from the latest year.
 */
function extractLatestValue(
  response: {
    Results?: {
      series?: Array<{
        data?: Array<{ year: string; value: string; periodName: string }>;
      }>;
    };
  },
  fallback: number
): number {
  const series = response?.Results?.series;
  if (!series || series.length === 0 || !series[0]?.data?.length) return fallback;
  const value = parseFloat(series[0].data[0].value);
  return isNaN(value) || value <= 0 ? fallback : value;
}

/**
 * Read BLS data from cache.
 */
export async function getCachedBLSData(
  socCode: string,
  stateCode: string
): Promise<BLSData | undefined> {
  const key = cacheKey(socCode, stateCode);
  try {
    const result = await chrome.storage.local.get(key);
    const entry: CacheEntry<BLSData> | undefined = result[key];
    if (!entry) return undefined;
    const age = Date.now() - entry.cachedAt;
    if (age > entry.ttlMs) return undefined;
    return entry.data;
  } catch {
    return undefined;
  }
}

/**
 * Parse BLS API response for backward compatibility with tests.
 * Extracts wage data from a single series response.
 */
export function parseBLSResponse(response: {
  Results?: {
    series?: Array<{
      data?: Array<{ value: string; year: string; period: string; periodName: string }>;
    }>;
  };
  status?: string;
  message?: string[];
}): { median: number; p25: number; p75: number; mean: number } | null {
  const series = response?.Results?.series;
  if (!series || series.length === 0) return null;

  const dataPoints = series[0]?.data;
  if (!dataPoints || dataPoints.length === 0) return null;

  const values = dataPoints
    .map((dataPoint) => parseFloat(dataPoint.value))
    .filter((wageValue) => !isNaN(wageValue) && wageValue > 0);

  if (values.length === 0) return null;

  const median = values[0];
  const p25 = Math.round(median * 0.85);
  const p75 = Math.round(median * 1.18);
  const mean = median;

  return { median, p25, p75, mean };
}

/**
 * Fetch BLS OEWS wage data for a specific SOC code in a specific state.
 *
 * Queries three separate series in one API call:
 * - data type 12: 25th percentile annual wage
 * - data type 04: annual mean wage (used as median approximation)
 * - data type 13: 75th percentile annual wage
 *
 * Falls back to estimated percentiles if individual series return no data.
 */
export async function fetchBLSData(
  socCode: string,
  stateCode: string,
  apiKey?: string
): Promise<{ success: true; data: BLSData } | { success: false; error: WageSageError }> {
  const fipsCode = STATE_FIPS[stateCode];
  if (!fipsCode) {
    return {
      success: false,
      error: {
        type: "bls_no_data",
        message: `No FIPS code found for state "${stateCode}".`,
        recoverable: true,
        recoveryAction: "Try a different location.",
      },
    };
  }

  // Check cache first
  const cached = await getCachedBLSData(socCode, stateCode);
  if (cached) {
    return { success: true, data: cached };
  }

  // Build series IDs for P25, mean, and P75
  const seriesP25 = buildSeriesId(socCode, fipsCode, "12");
  const seriesMean = buildSeriesId(socCode, fipsCode, "04");
  const seriesP75 = buildSeriesId(socCode, fipsCode, "13");

  try {
    const requestBody: Record<string, unknown> = {
      seriesid: [seriesP25, seriesMean, seriesP75],
    };
    if (apiKey) {
      requestBody.registrationKey = apiKey;
    }

    const response = await fetch(BLS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (response.status === 429) {
      return {
        success: false,
        error: {
          type: "bls_rate_limit",
          message: "Rate limited by BLS API. Try again in 30 seconds.",
          recoverable: true,
          recoveryAction: "Wait 30 seconds and try again.",
        },
      };
    }

    if (!response.ok) {
      return {
        success: false,
        error: {
          type: "bls_network",
          message: "Unable to reach BLS salary data service.",
          recoverable: true,
          recoveryAction: "Check your internet connection and try again.",
        },
      };
    }

    const blsResponseBody = await response.json();

    // Extract values from each series response
    const seriesResults = blsResponseBody?.Results?.series;
    if (!Array.isArray(seriesResults) || seriesResults.length === 0) {
      return {
        success: false,
        error: {
          type: "bls_no_data",
          message: "No wage data available for this role in this area.",
          recoverable: true,
          recoveryAction: "Try a different role or location.",
        },
      };
    }

    // series[0] = P25, series[1] = mean, series[2] = P75
    const meanValue = extractLatestValue({ Results: { series: [seriesResults[1]] } }, 0);
    if (meanValue === 0) {
      return {
        success: false,
        error: {
          type: "bls_no_data",
          message: "No wage data available for this role in this area.",
          recoverable: true,
          recoveryAction: "Try a different role or location.",
        },
      };
    }

    const p25Value = extractLatestValue({ Results: { series: [seriesResults[0]] } }, 0);
    const p75Value = extractLatestValue({ Results: { series: [seriesResults[2]] } }, 0);

    // If percentiles are missing, estimate from mean
    const median = meanValue;
    const p25 = p25Value > 0 ? p25Value : Math.round(median * 0.85);
    const p75 = p75Value > 0 ? p75Value : Math.round(median * 1.18);

    const blsData: BLSData = {
      socCode,
      msaCode: stateCode,
      msaName: "",
      median,
      p25,
      p75,
      mean: meanValue,
      fetchedAt: Date.now(),
    };

    // Cache the result
    const entry: CacheEntry<BLSData> = {
      data: blsData,
      cachedAt: Date.now(),
      ttlMs: BLS_CACHE_TTL_MS,
    };
    await chrome.storage.local.set({ [cacheKey(socCode, stateCode)]: entry });

    return { success: true, data: blsData };
  } catch (error) {
    return {
      success: false,
      error: {
        type: "bls_network",
        message: error instanceof Error ? error.message : "Network error fetching BLS data.",
        recoverable: true,
        recoveryAction: "Check your internet connection and try again.",
      },
    };
  }
}
