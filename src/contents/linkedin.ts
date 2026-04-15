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
 * matching sidebar recommendations), then falls back to the full document using
 * the LAST match (detail panel renders after the sidebar).
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

  // Fallback: search full document, take the LAST match.
  // The logged-in detail panel renders after the sidebar, so the last
  // matching element is more likely to be the main job detail.
  for (const selector of selectors) {
    const allMatches = doc.querySelectorAll(selector);
    if (allMatches.length === 0) continue;
    // Check from the last element backwards
    for (let i = allMatches.length - 1; i >= 0; i--) {
      const text = allMatches[i].textContent?.trim();
      if (text) {
        return text.replace(/\s+/g, " ");
      }
    }
  }
  return null;
}

/**
 * Find the first matching DOM element for a set of selectors.
 * Searches detail containers first, then full document (last match).
 * Returns the element itself, not its text content.
 */
function queryElement(doc: Document, selectors: string[]): Element | null {
  for (const containerSelector of DETAIL_CONTAINERS) {
    const container = doc.querySelector(containerSelector);
    if (!container) continue;
    for (const selector of selectors) {
      const el = container.querySelector(selector);
      if (el && el.textContent?.trim()) return el;
    }
  }
  for (const selector of selectors) {
    const allMatches = doc.querySelectorAll(selector);
    if (allMatches.length === 0) continue;
    for (let i = allMatches.length - 1; i >= 0; i--) {
      if (allMatches[i].textContent?.trim()) return allMatches[i];
    }
  }
  return null;
}

/**
 * Find the lowest (closest) common ancestor of two DOM elements.
 * Used to determine the detail panel container that holds both title and company.
 */
function findLowestCommonAncestor(el1: Element, el2: Element): Element {
  const ancestors1 = new Set<Element>();
  let cur: Element | null = el1;
  while (cur) {
    ancestors1.add(cur);
    cur = cur.parentElement;
  }
  cur = el2;
  while (cur) {
    if (ancestors1.has(cur)) return cur;
    cur = cur.parentElement;
  }
  return document.body;
}

/**
 * Find the location element nearest to a reference element in the DOM tree.
 * Distance is measured as the total number of ancestor hops to reach the closest
 * shared ancestor. Detail panel locations will be 1-4 hops away; sidebar
 * recommendations will be 8+ hops away (through the layout root).
 */
function findNearestLocation(refElement: Element): string | null {
  const refAncestors = new Map<Element, number>();
  let cur: Element | null = refElement;
  let depth = 0;
  while (cur) {
    refAncestors.set(cur, depth);
    cur = cur.parentElement;
    depth++;
  }

  let bestText: string | null = null;
  let bestDistance = Infinity;

  for (const selector of LOCATION_SELECTORS) {
    const matches = document.querySelectorAll(selector);
    for (const match of matches) {
      const text = match.textContent?.trim().replace(/\s+/g, " ");
      if (!text) continue;

      let locCur: Element | null = match;
      let locDepth = 0;
      while (locCur) {
        const refDepth = refAncestors.get(locCur);
        if (refDepth !== undefined) {
          const distance = refDepth + locDepth;
          if (distance < bestDistance) {
            bestDistance = distance;
            bestText = text;
          }
          break;
        }
        locCur = locCur.parentElement;
        locDepth++;
      }
    }
  }

  return bestText;
}

/**
 * Search for location-like text within a container, falling back to
 * pattern matching when no CSS selector matches. Handles LinkedIn's
 * frequent class name changes by looking for "City, ST" text patterns
 * in leaf elements.
 */
function findLocationTextInContainer(container: Element): string | null {
  const elements = container.querySelectorAll("*");
  // Iterate from leaves upward to find the most specific match first
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    const text = el.textContent?.trim().replace(/\s+/g, " ");
    if (!text || text.length > 150) continue;

    // Skip elements whose children contain most of the text (non-leaf)
    if (el.children.length > 0) {
      const childTotal = Array.from(el.children)
        .reduce((sum, child) => sum + (child.textContent?.trim().length || 0), 0);
      if (childTotal > text.length * 0.5) continue;
    }

    // "City, ST" format
    if (/^[A-Z][a-zA-Z\s\-·]+,\s*[A-Z]{2}/.test(text)) return text;
    // "City ST" without comma (e.g. "Washington DC")
    if (/^[A-Z][a-zA-Z\s\-]+\s+[A-Z]{2}\s*$/.test(text)) return text;
  }
  return null;
}

/**
 * Search for the first matching element within a container, using a list of
 * selectors. Returns trimmed, single-line text or null.
 */
function queryTextInContainer(container: Element, selectors: string[]): string | null {
  for (const selector of selectors) {
    const el = container.querySelector(selector);
    if (el && el.textContent?.trim()) {
      return el.textContent.trim().replace(/\s+/g, " ");
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
 *
 * Location extraction uses three strategies in order:
 * 1. Search within the LCA container of title + company (standard selectors)
 * 2. Text-based search within the container (handles LinkedIn class name changes)
 * 3. DOM proximity search: find the location element physically closest to the
 *    title element. Detail panel locations are 1-4 hops away; sidebar
 *    recommendations are 8+ hops away through the layout root.
 */
export function extractJobData(): JobData | null {
  const titleElement = queryElement(document, TITLE_SELECTORS);
  if (!titleElement) return null;

  const title = titleElement.textContent!.trim().replace(/\s+/g, " ");
  const companyElement = queryElement(document, COMPANY_SELECTORS);

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
    location = findNearestLocation(titleElement);
  }

  // Last resort: independent full-page extraction
  if (!company) company = extractCompany(document);
  if (!location) location = extractLocation(document);

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
