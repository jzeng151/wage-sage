/**
 * LinkedIn content script.
 *
 * Injected on LinkedIn job listing pages (jobs/view/* and jobs/search*).
 * Extracts job title, company, and location from the page DOM using multiple
 * CSS selector fallbacks to handle LinkedIn's frequent DOM changes.
 *
 * The extracted data is sent to the background service worker via CACHE_JOB_DATA
 * message, which caches it under the sender's tab ID. The popup reads it by tab ID.
 * Content scripts cannot access their own tab ID in MV3, so this relay is necessary.
 *
 * A MutationObserver with 500ms debounce re-extracts on SPA navigation.
 *
 * This script does NOT make cross-origin requests (MV3 constraint).
 * All network calls are handled by the background service worker.
 */
import type { PlasmoCSConfig } from "plasmohq";
import type { JobData } from "../types";

export const config: PlasmoCSConfig = {
  matches: [
    "https://www.linkedin.com/jobs/view/*",
    "https://www.linkedin.com/jobs/search*",
  ],
  run_at: "document_idle",
};

/**
 * Containers that isolate the main job detail from the sidebar recommendations.
 * On the logged-in SPA, recommended jobs appear in a left panel. The detail
 * panel uses these container classes. We scope selectors to these first.
 */
const DETAIL_CONTAINERS = [
  ".job-details",
  ".core-rail",
  ".details",
];

/**
 * Job title selectors, scoped to detail containers first to avoid
 * matching sidebar recommendations.
 */
const TITLE_SELECTORS = [
  // Logged-in job detail panel
  ".jobs-unified-top-card__job-title h1",
  ".jobs-unified-top-card__job-title",
  ".job-details-jobs-unified-top-card__job-title h1",
  ".job-details-jobs-unified-top-card__job-title",
  // Guest job detail page
  "h1.topcard__title",
  "h1.top-card-layout__title",
  // Search results page
  "h3.base-search-card__title",
  // Generic fallbacks
  ".artdeco-entity-lockup__title",
  "h1[class*='job-title']",
  "h1.t-24",
];

/**
 * Company name selectors.
 */
const COMPANY_SELECTORS = [
  // Logged-in job detail panel
  ".jobs-unified-top-card__company-name a",
  ".jobs-unified-top-card__company-name",
  ".job-details-jobs-unified-top-card__company-name a",
  ".job-details-jobs-unified-top-card__company-name",
  // Guest job detail page
  "a.topcard__org-name-link",
  // Search results page
  "h4.base-search-card__subtitle a.hidden-nested-link",
  // Generic fallbacks
  ".artdeco-entity-lockup__subtitle",
  "a.top-card-layout__second-link span",
  "a[class*='company'] span",
  ".top-card-layout__card span[class*='company']",
  ".base-search-card__subtitle",
];

/**
 * Location selectors.
 */
const LOCATION_SELECTORS = [
  // Logged-in job detail panel
  ".jobs-unified-top-card__bullet",
  ".job-details-jobs-unified-top-card__bullet",
  // Guest job detail page
  "span.topcard__flavor--bullet",
  // Search results page
  "span.job-search-card__location",
  // Generic fallbacks
  ".artdeco-entity-lockup__caption",
  "span.top-card-layout__bullet",
  ".top-card-layout__card span[class*='location']",
  "span[class*='location']",
  ".base-search-card__metadata",
];

/**
 * Try each selector in order, return the first matching element's trimmed text.
 * First attempts to find the element inside a known detail container (to avoid
 * matching sidebar recommendations), then falls back to the full document.
 * Collapses internal whitespace so multi-line text nodes become single-line.
 */
function queryTextContent(doc: Document, selectors: string[]): string | null {
  // Try scoped to detail containers first
  for (const containerSelector of DETAIL_CONTAINERS) {
    const container = doc.querySelector(containerSelector);
    if (!container) continue;
    for (const selector of selectors) {
      const matchedElement = container.querySelector(selector);
      if (matchedElement && matchedElement.textContent?.trim()) {
        return matchedElement.textContent.trim().replace(/\s+/g, " ");
      }
    }
  }

  // Fallback: search full document
  for (const selector of selectors) {
    const matchedElement = doc.querySelector(selector);
    if (matchedElement && matchedElement.textContent?.trim()) {
      return matchedElement.textContent.trim().replace(/\s+/g, " ");
    }
  }
  return null;
}

/** Extract job title from LinkedIn job page DOM. */
export function extractTitle(doc: Document): string | null {
  return queryTextContent(doc, TITLE_SELECTORS);
}

/** Extract company name from LinkedIn job page DOM. */
export function extractCompany(doc: Document): string | null {
  return queryTextContent(doc, COMPANY_SELECTORS);
}

/** Extract location from LinkedIn job page DOM. */
export function extractLocation(doc: Document): string | null {
  return queryTextContent(doc, LOCATION_SELECTORS);
}

/**
 * Validate extracted data: check for garbage/empty values and length limits.
 */
export function validateJobData(data: JobData): boolean {
  if (!data.title || data.title.trim().length === 0) return false;
  if (!data.company || data.company.trim().length === 0) return false;
  if (!data.location || data.location.trim().length === 0) return false;
  if (data.title.length > 200) return false;
  if (data.company.length > 200) return false;
  if (data.location.length > 200) return false;
  return true;
}

/**
 * Extract job data from a LinkedIn job listing page.
 */
export function extractJobData(): JobData | null {
  const title = extractTitle(document);
  const company = extractCompany(document);
  const location = extractLocation(document);

  if (!title) return null;

  const data: JobData = {
    title,
    company: company || "",
    location: location || "",
    source: "linkedin",
    extractedAt: Date.now(),
  };

  if (!validateJobData(data)) return null;

  return data;
}

/**
 * Send extracted job data to the background service worker for caching.
 * The background knows the sender's tab ID and caches under that key.
 */
export function sendJobDataToBackground(data: JobData): void {
  try {
    chrome.runtime.sendMessage({ type: "CACHE_JOB_DATA", payload: data });
  } catch {
    // Extension context may be invalidated during SPA navigation. Non-fatal.
  }
}

// Auto-extract and cache when content script loads (browser only)
if (typeof document !== "undefined" && typeof chrome !== "undefined") {
  /**
   * Attempt extraction with retries. LinkedIn loads job content asynchronously,
   * so the DOM may not have job data at script injection time even with document_idle.
   */
  function attemptExtraction(remainingAttempts: number): void {
    const jobData = extractJobData();
    if (jobData) {
      sendJobDataToBackground(jobData);
      return;
    }
    if (remainingAttempts > 0) {
      setTimeout(() => attemptExtraction(remainingAttempts - 1), 1000);
    }
  }

  // Start with a small delay to allow initial async content to render
  setTimeout(() => attemptExtraction(3), 500);

  // Re-extract on SPA navigation via debounced MutationObserver
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const observer = new MutationObserver(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const newData = extractJobData();
      if (newData) {
        sendJobDataToBackground(newData);
      }
    }, 500);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Listen for on-demand extraction requests from the popup.
  // This is more reliable than depending on auto-extraction timing.
  chrome.runtime.onMessage.addListener(
    (message: { type: string }, _sender, sendResponse) => {
      if (message.type === "EXTRACT_JOB_DATA") {
        const extractedData = extractJobData();
        if (extractedData) {
          sendJobDataToBackground(extractedData);
        }
        sendResponse(extractedData);
      }
      return false;
    }
  );
}
