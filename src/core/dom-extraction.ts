/**
 * Shared DOM extraction utilities for job listing content scripts.
 *
 * These functions provide multi-strategy DOM element extraction:
 * 1. Scoped search inside known detail containers
 * 2. Full-document search with last-match preference (detail renders after sidebar)
 * 3. Container-based search via lowest common ancestor
 * 4. Text pattern matching for elements without known selectors
 * 5. DOM proximity search (nearest element to a reference)
 *
 * Used by content scripts for LinkedIn, Indeed, and future job platforms.
 */

/**
 * Try each selector in order, return the first matching element's trimmed text.
 * First searches inside detail containers (to avoid sidebar recommendations),
 * then falls back to the full document using the LAST match.
 */
export function queryTextContent(
  doc: Document,
  selectors: string[],
  detailContainers: string[]
): string | null {
  for (const containerSelector of detailContainers) {
    const container = doc.querySelector(containerSelector);
    if (!container) continue;
    for (const selector of selectors) {
      const matchedElement = container.querySelector(selector);
      if (matchedElement && matchedElement.textContent?.trim()) {
        return matchedElement.textContent.trim().replace(/\s+/g, " ");
      }
    }
  }

  for (const selector of selectors) {
    const allMatches = doc.querySelectorAll(selector);
    if (allMatches.length === 0) continue;
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
export function queryElement(
  doc: Document,
  selectors: string[],
  detailContainers: string[]
): Element | null {
  for (const containerSelector of detailContainers) {
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
 */
export function findLowestCommonAncestor(el1: Element, el2: Element): Element {
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
 * Distance = total ancestor hops to the closest shared ancestor.
 */
export function findNearestLocation(
  refElement: Element,
  locationSelectors: string[]
): string | null {
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

  for (const selector of locationSelectors) {
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
 * Search for location-like text within a container using pattern matching.
 * Looks for "City, ST" or "City ST" patterns in leaf elements.
 */
export function findLocationTextInContainer(container: Element): string | null {
  const elements = container.querySelectorAll("*");
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    const text = el.textContent?.trim().replace(/\s+/g, " ");
    if (!text || text.length > 150) continue;

    if (el.children.length > 0) {
      const childTotal = Array.from(el.children)
        .reduce((sum, child) => sum + (child.textContent?.trim().length || 0), 0);
      if (childTotal > text.length * 0.5) continue;
    }

    if (/^[A-Z][a-zA-Z\s\-·]+,\s*[A-Z]{2}/.test(text)) return text;
    if (/^[A-Z][a-zA-Z\s\-]+\s+[A-Z]{2}\s*$/.test(text)) return text;
  }
  return null;
}

/**
 * Search for the first matching element within a container.
 */
export function queryTextInContainer(container: Element, selectors: string[]): string | null {
  for (const selector of selectors) {
    const el = container.querySelector(selector);
    if (el && el.textContent?.trim()) {
      return el.textContent.trim().replace(/\s+/g, " ");
    }
  }
  return null;
}
