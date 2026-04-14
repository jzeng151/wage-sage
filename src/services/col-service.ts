/**
 * Cost-of-living data service.
 *
 * Uses hardcoded BEA Regional Price Parity (RPP) values from the MSA crosswalk table.
 * No API call needed for v1. RPP values are indexed to the national average (100).
 * Values above 100 = more expensive than average (e.g. SF = 118.3).
 *
 * For v2, this could be replaced with a live BEA API call for broader coverage.
 */
import type { COLData, WageSageError, CacheEntry } from "../types";
import { MSA_CROSSWALK } from "../core/data/msa-crosswalk";

const COL_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function cacheKey(msaCode: string): string {
  return `rpp_${msaCode}`;
}

/**
 * Look up BEA area code and RPP from BLS MSA code using the crosswalk table.
 */
export function lookupRPP(msaCode: string): { beaAreaCode: string; rpp: number; msaName: string } | undefined {
  return MSA_CROSSWALK.find((crosswalkEntry) => crosswalkEntry.blsMSACode === msaCode);
}

/**
 * Fetch COL data using hardcoded RPP table.
 * No API call needed for v1.
 */
export async function fetchCOLData(
  msaCode: string
): Promise<{ success: true; data: COLData } | { success: false; error: WageSageError }> {
  const entry = lookupRPP(msaCode);

  if (!entry) {
    return {
      success: false,
      error: {
        type: "col_no_data",
        message: "Cost of living data not available for this area.",
        recoverable: true,
        recoveryAction: "Try a different location.",
      },
    };
  }

  const data: COLData = {
    msaCode,
    beaAreaCode: entry.beaAreaCode,
    rpp: entry.rpp,
    fetchedAt: Date.now(),
  };

  // Cache it
  const cacheEntry: CacheEntry<COLData> = {
    data,
    cachedAt: Date.now(),
    ttlMs: COL_CACHE_TTL_MS,
  };
  try {
    await chrome.storage.local.set({ [cacheKey(msaCode)]: cacheEntry });
  } catch {
    // Storage write failure is non-fatal
  }

  return { success: true, data };
}

/**
 * Read COL data from cache.
 */
export async function getCachedCOLData(msaCode: string): Promise<COLData | undefined> {
  const key = cacheKey(msaCode);
  try {
    const result = await chrome.storage.local.get(key);
    const entry: CacheEntry<COLData> | undefined = result[key];
    if (!entry) return undefined;
    const age = Date.now() - entry.cachedAt;
    if (age > entry.ttlMs) return undefined;
    return entry.data;
  } catch {
    return undefined;
  }
}
