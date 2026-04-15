/**
 * Indeed content script.
 *
 * Injected on Indeed job listing pages (viewjob, jobs, and international domains).
 * Extracts job title, company, and location using multiple CSS selector fallbacks
 * to handle Indeed's DOM structure and periodic class name changes.
 *
 * The extracted data is sent to the background service worker via CACHE_JOB_DATA
 * message, which caches it under the sender's tab ID. The popup reads it by tab ID.
 *
 * A MutationObserver with 500ms debounce re-extracts on SPA navigation.
 *
 * This script does NOT make cross-origin requests (MV3 constraint).
 * All network calls are handled by the background service worker.
 */
import type { PlasmoCSConfig } from "plasmohq";
import type { JobData } from "../types";
import {
  queryTextContent,
  queryElement,
  findLowestCommonAncestor,
  findNearestLocation,
  findLocationTextInContainer,
  queryTextInContainer,
} from "../core/dom-extraction";

export const config: PlasmoCSConfig = {
  matches: [
    "https://*.indeed.com/viewjob*",
    "https://*.indeed.com/jobs*",
    "https://*.indeed.com/rc/clk*",
    "https://*.indeed.ca/viewjob*",
    "https://*.indeed.ca/jobs*",
    "https://*.indeed.co.uk/viewjob*",
    "https://*.indeed.co.uk/jobs*",
    "https://*.indeed.de/viewjob*",
    "https://*.indeed.de/jobs*",
    "https://*.indeed.fr/viewjob*",
    "https://*.indeed.fr/jobs*",
    "https://*.indeed.in/viewjob*",
    "https://*.indeed.in/jobs*",
    "https://*.indeed.jp/viewjob*",
    "https://*.indeed.jp/jobs*",
    "https://*.indeed.com.au/viewjob*",
    "https://*.indeed.com.au/jobs*",
  ],
  run_at: "document_idle",
};

/**
 * Containers that hold the main job detail content on Indeed job detail pages.
 * These isolate the real listing from sidebar recommendations or search results.
 */
const DETAIL_CONTAINERS = [
  ".jobsearch-InfoHeaderContainer",
  ".jobsearch-DesktopStickyContainer",
  "[data-testid='jobsearch-CompanyInfoContainer']",
  "#viewJobSSRRoot",
  ".jobsearch-ViewJobLayout",
  ".jobsearch-ViewLayout",
  "#jobview-container",
];

/**
 * Job title selectors for Indeed job detail and search results pages.
 * Uses data-testid attributes first (most stable), then stable classes.
 */
const TITLE_SELECTORS = [
  // Job detail page
  "h1.jobsearch-JobInfoHeader-title",
  ".jobsearch-JobInfoHeader-title-container h1",
  "[data-testid='jobsearch-JobInfoHeader-title']",
  // Search results page
  "h2.jobTitle a",
  "a.jcs-JobTitle",
  // Generic fallbacks
  "h1[class*='JobInfoHeader']",
  "h2[class*='jobTitle']",
];

/**
 * Company name selectors.
 */
const COMPANY_SELECTORS = [
  // Job detail page - data-testid is most stable
  "[data-testid='inlineHeader-companyName']",
  ".jobsearch-CompanyInfoContainer a",
  "[data-company-name='true']",
  ".icl-u-lg-mr--sm",
  // Search results page
  "span.companyName",
  "[data-testid='company-name']",
  // Generic fallbacks
  "a[class*='companyName']",
  "[class*='companyName']",
];

/**
 * Location selectors.
 */
const LOCATION_SELECTORS = [
  // Job detail page
  "[data-testid='inlineHeader-companyLocation']",
  ".jobsearch-JobInfoHeader-subtitle",
  ".jobsearch-JobInfoHeader-subtitleLocation",
  // Search results page
  "div.companyLocation",
  "[data-testid='text-location']",
  // Generic fallbacks
  "[class*='companyLocation']",
  "div[class*='location']",
  "span[class*='location']",
];

/**
 * Clean Indeed job title by stripping common suffixes.
 * Indeed titles often include " - job post" or " | Indeed.com" appended.
 */
function cleanIndeedTitle(raw: string): string {
  return raw
    .replace(/\s*[-–—]\s*job\s*post\s*$/i, "")
    .replace(/\s*\|\s*Indeed(\.com?)?\s*$/i, "")
    .replace(/\s*[-–—]\s*$/,"")
    .trim();
}

/** Extract job title from Indeed job page DOM. */
export function extractTitle(doc: Document): string | null {
  const raw = queryTextContent(doc, TITLE_SELECTORS, DETAIL_CONTAINERS);
  if (!raw) return null;
  return cleanIndeedTitle(raw);
}

/** Extract company name from Indeed job page DOM. */
export function extractCompany(doc: Document): string | null {
  return queryTextContent(doc, COMPANY_SELECTORS, DETAIL_CONTAINERS);
}

/** Extract location from Indeed job page DOM. */
export function extractLocation(doc: Document): string | null {
  return queryTextContent(doc, LOCATION_SELECTORS, DETAIL_CONTAINERS);
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
 * Extract job data from an Indeed job listing page.
 *
 * Location extraction uses three strategies in order:
 * 1. Search within the LCA container of title + company (standard selectors)
 * 2. Text-based search within the container (pattern matching for "City, ST")
 * 3. DOM proximity search: find the location element physically closest to the
 *    title element.
 */
export function extractJobData(): JobData | null {
  const titleElement = queryElement(document, TITLE_SELECTORS, DETAIL_CONTAINERS);
  if (!titleElement) return null;

  const rawTitle = titleElement.textContent!.trim().replace(/\s+/g, " ");
  const title = cleanIndeedTitle(rawTitle);
  if (!title) return null;

  const companyElement = queryElement(document, COMPANY_SELECTORS, DETAIL_CONTAINERS);

  // Use LCA of title and company as the detail panel container
  const container = companyElement
    ? findLowestCommonAncestor(titleElement, companyElement)
    : (titleElement.parentElement || document.body);

  // Get company text
  let company: string | null = null;
  if (companyElement?.textContent?.trim()) {
    company = companyElement.textContent.trim().replace(/\s+/g, " ");
  }
  if (!company) {
    company = queryTextInContainer(container, COMPANY_SELECTORS);
  }

  // Strategy 1: standard selectors within the LCA container
  let location = queryTextInContainer(container, LOCATION_SELECTORS);

  // Strategy 2: text-based search within the container
  if (!location) {
    location = findLocationTextInContainer(container);
  }

  // Strategy 3: DOM proximity search - nearest location element to the title
  if (!location) {
    location = findNearestLocation(titleElement, LOCATION_SELECTORS);
  }

  // Last resort: independent full-page extraction
  if (!company) company = extractCompany(document);
  if (!location) location = extractLocation(document);

  const data: JobData = {
    title,
    company: company || "",
    location: location || "",
    source: "indeed",
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
   * Attempt extraction with retries. Indeed loads job content asynchronously,
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
