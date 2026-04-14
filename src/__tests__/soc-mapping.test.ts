import { describe, it, expect } from "vitest";
import {
  mapTitleToSOC,
  normalizeTitle,
  levenshteinDistance,
  getSupportedTitles,
} from "../core/soc-mapping";

describe("normalizeTitle", () => {
  it("lowercases input", () => {
    expect(normalizeTitle("Software Engineer")).toBe("software engineer");
  });

  it("removes punctuation", () => {
    expect(normalizeTitle("Sr. Software Engineer")).toBe("software engineer");
  });

  it("strips senior prefix", () => {
    expect(normalizeTitle("Senior Software Engineer")).toBe("software engineer");
  });

  it("strips staff prefix", () => {
    expect(normalizeTitle("Staff Software Engineer")).toBe("software engineer");
  });

  it("strips principal prefix", () => {
    expect(normalizeTitle("Principal Engineer")).toBe("engineer");
  });

  it("strips lead prefix", () => {
    expect(normalizeTitle("Lead Developer")).toBe("developer");
  });

  it("strips junior prefix", () => {
    expect(normalizeTitle("Junior Developer")).toBe("developer");
  });

  it("strips associate prefix", () => {
    expect(normalizeTitle("Associate Product Manager")).toBe(
      "product manager"
    );
  });

  it("handles empty string", () => {
    expect(normalizeTitle("")).toBe("");
  });

  it("handles whitespace-only input", () => {
    expect(normalizeTitle("   ")).toBe("");
  });
});

describe("levenshteinDistance", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshteinDistance("hello", "hello")).toBe(0);
  });

  it("returns length for empty string comparison", () => {
    expect(levenshteinDistance("hello", "")).toBe(5);
    expect(levenshteinDistance("", "hello")).toBe(5);
  });

  it("calculates single edit distance", () => {
    expect(levenshteinDistance("cat", "car")).toBe(1);
  });

  it("calculates multi-edit distance", () => {
    expect(levenshteinDistance("kitten", "sitting")).toBe(3);
  });
});

describe("mapTitleToSOC", () => {
  it("maps 'Software Engineer' to 15-1252", () => {
    const result = mapTitleToSOC("Software Engineer");
    expect(result).toBeDefined();
    expect(result!.socCode).toBe("15-1252");
    expect(result!.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it("maps 'Data Scientist' to 15-2051", () => {
    const result = mapTitleToSOC("Data Scientist");
    expect(result).toBeDefined();
    expect(result!.socCode).toBe("15-2051");
  });

  it("maps 'Product Manager' to 13-1199", () => {
    const result = mapTitleToSOC("Product Manager");
    expect(result).toBeDefined();
    expect(result!.socCode).toBe("13-1199");
  });

  it("strips 'Senior' prefix and maps correctly", () => {
    const result = mapTitleToSOC("Senior Software Engineer");
    expect(result).toBeDefined();
    expect(result!.socCode).toBe("15-1252");
  });

  it("strips 'Staff' prefix and maps correctly", () => {
    const result = mapTitleToSOC("Staff Software Engineer");
    expect(result).toBeDefined();
    expect(result!.socCode).toBe("15-1252");
  });

  it("strips 'Principal' prefix and maps correctly", () => {
    const result = mapTitleToSOC("Principal Engineer");
    expect(result).toBeDefined();
    expect(result!.socCode).toBe("15-1252");
  });

  it("matches case-insensitively", () => {
    const result = mapTitleToSOC("software ENGINEER");
    expect(result).toBeDefined();
    expect(result!.socCode).toBe("15-1252");
  });

  it("fuzzy matches with typo via Levenshtein fallback", () => {
    const result = mapTitleToSOC("Software Devlopers");
    expect(result).toBeDefined();
    expect(result!.socCode).toBe("15-1252");
    expect(result!.confidence).toBeLessThan(0.9);
  });

  it("returns undefined for unrecognized title", () => {
    const result = mapTitleToSOC("Dragon Trainer");
    expect(result).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(mapTitleToSOC("")).toBeUndefined();
  });

  it("returns undefined for whitespace-only string", () => {
    expect(mapTitleToSOC("   ")).toBeUndefined();
  });

  it("maps 'DevOps Engineer' to a relevant code", () => {
    const result = mapTitleToSOC("DevOps Engineer");
    expect(result).toBeDefined();
  });

  it("maps 'UX Designer' correctly", () => {
    const result = mapTitleToSOC("UX Designer");
    expect(result).toBeDefined();
  });

  it("maps 'Security Analyst' correctly", () => {
    const result = mapTitleToSOC("Security Analyst");
    expect(result).toBeDefined();
    expect(result!.socCode).toBe("15-1212");
  });
});

describe("getSupportedTitles", () => {
  it("returns a non-empty list", () => {
    const titles = getSupportedTitles();
    expect(titles.length).toBeGreaterThan(0);
  });

  it("deduplicates by socCode", () => {
    const titles = getSupportedTitles();
    const codes = titles.map((t) => t.socCode);
    const uniqueCodes = new Set(codes);
    expect(codes.length).toBe(uniqueCodes.size);
  });

  it("includes Software Developers", () => {
    const titles = getSupportedTitles();
    expect(titles.some((t) => t.socCode === "15-1252")).toBe(true);
  });
});
