import { describe, it, expect } from "vitest";
import {
  sanitizeString,
  validateSalary,
  validateJobDataFromStorage,
  validateScriptRequestPayload,
  MAX_SALARY,
} from "../core/validation";

describe("sanitizeString", () => {
  it("trims whitespace", () => {
    expect(sanitizeString("  hello  ", 100)).toBe("hello");
  });

  it("collapses internal whitespace", () => {
    expect(sanitizeString("hello   world", 100)).toBe("hello world");
  });

  it("enforces max length", () => {
    expect(sanitizeString("abcdefghij", 5)).toBe("abcde");
  });
});

describe("validateSalary", () => {
  it("returns valid salary unchanged", () => {
    expect(validateSalary(100000)).toBe(100000);
  });

  it("clamps to MAX_SALARY", () => {
    expect(validateSalary(999999999)).toBe(MAX_SALARY);
  });

  it("returns null for zero", () => {
    expect(validateSalary(0)).toBeNull();
  });

  it("returns null for negative", () => {
    expect(validateSalary(-1000)).toBeNull();
  });

  it("returns null for NaN", () => {
    expect(validateSalary(NaN)).toBeNull();
  });

  it("returns null for Infinity", () => {
    expect(validateSalary(Infinity)).toBeNull();
  });
});

describe("validateJobDataFromStorage", () => {
  it("returns valid data", () => {
    const data = {
      title: "Software Engineer",
      company: "Acme Corp",
      location: "San Francisco, CA",
      source: "linkedin",
      extractedAt: Date.now(),
    };
    expect(validateJobDataFromStorage(data)).toEqual(data);
  });

  it("returns null for null input", () => {
    expect(validateJobDataFromStorage(null)).toBeNull();
  });

  it("returns null for non-object input", () => {
    expect(validateJobDataFromStorage("string")).toBeNull();
    expect(validateJobDataFromStorage(42)).toBeNull();
  });

  it("returns null for missing title", () => {
    const data = { company: "Acme", location: "SF", source: "manual", extractedAt: 123 };
    expect(validateJobDataFromStorage(data)).toBeNull();
  });

  it("returns null for invalid source", () => {
    const data = {
      title: "Engineer",
      company: "Acme",
      location: "SF",
      source: "evil",
      extractedAt: 123,
    };
    expect(validateJobDataFromStorage(data)).toBeNull();
  });

  it("returns null for title exceeding max length", () => {
    const data = {
      title: "x".repeat(201),
      company: "Acme",
      location: "SF",
      source: "manual",
      extractedAt: 123,
    };
    expect(validateJobDataFromStorage(data)).toBeNull();
  });
});

describe("validateScriptRequestPayload", () => {
  function makePayload() {
    return {
      jobData: {
        title: "Software Engineer",
        company: "Acme Corp",
        location: "San Francisco, CA",
        source: "linkedin",
        extractedAt: Date.now(),
      },
      blsData: {
        socCode: "15-1252",
        msaCode: "41860",
        msaName: "SF",
        median: 168200,
        p25: 142500,
        p75: 198600,
        mean: 175000,
        fetchedAt: Date.now(),
      },
      colData: {
        msaCode: "41860",
        beaAreaCode: "XX200",
        rpp: 118.3,
        fetchedAt: Date.now(),
      },
      walkAwayResult: {
        walkAway: 147116,
        target: 163517,
        median: 168200,
        p25: 142500,
        p75: 198600,
        colIndex: 1.183,
        experienceBracket: "senior",
        experienceMultiplier: 1.15,
      },
      targetSalary: 195000,
    };
  }

  it("accepts valid payload", () => {
    expect(validateScriptRequestPayload(makePayload())).toBe(true);
  });

  it("rejects null payload", () => {
    expect(validateScriptRequestPayload(null)).toBe(false);
  });

  it("rejects missing jobData", () => {
    const p = makePayload() as Record<string, unknown>;
    delete p.jobData;
    expect(validateScriptRequestPayload(p)).toBe(false);
  });

  it("rejects oversized title", () => {
    const p = makePayload();
    p.jobData.title = "x".repeat(201);
    expect(validateScriptRequestPayload(p)).toBe(false);
  });

  it("rejects invalid SOC code format", () => {
    const p = makePayload();
    p.blsData.socCode = "INVALID";
    expect(validateScriptRequestPayload(p)).toBe(false);
  });

  it("rejects invalid MSA code format", () => {
    const p = makePayload();
    p.blsData.msaCode = "abc";
    expect(validateScriptRequestPayload(p)).toBe(false);
  });

  it("rejects negative target salary", () => {
    const p = makePayload();
    p.targetSalary = -1000;
    expect(validateScriptRequestPayload(p)).toBe(false);
  });

  it("rejects oversized target salary", () => {
    const p = makePayload();
    p.targetSalary = 999999999;
    expect(validateScriptRequestPayload(p)).toBe(false);
  });

  it("rejects NaN target salary", () => {
    const p = makePayload();
    p.targetSalary = NaN;
    expect(validateScriptRequestPayload(p)).toBe(false);
  });
});
