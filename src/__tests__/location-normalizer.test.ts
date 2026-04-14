import { describe, it, expect } from "vitest";
import {
  normalizeLocation,
  parseLocationParts,
} from "../core/location-normalizer";

describe("parseLocationParts", () => {
  it("parses 'San Francisco, CA'", () => {
    const result = parseLocationParts("San Francisco, CA");
    expect(result).toEqual({ city: "San Francisco", state: "CA" });
  });

  it("parses 'New York, NY'", () => {
    const result = parseLocationParts("New York, NY");
    expect(result).toEqual({ city: "New York", state: "NY" });
  });

  it("parses 'Austin, Texas' (full state name)", () => {
    const result = parseLocationParts("Austin, Texas");
    expect(result).toEqual({ city: "Austin", state: "TX" });
  });

  it("returns null for 'Remote'", () => {
    expect(parseLocationParts("Remote")).toBeNull();
  });

  it("returns null for 'London, UK'", () => {
    expect(parseLocationParts("London, UK")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseLocationParts("")).toBeNull();
  });

  it("handles 'Washington, DC'", () => {
    const result = parseLocationParts("Washington, DC");
    expect(result).toEqual({ city: "Washington", state: "DC" });
  });

  it("returns null for 'Hybrid'", () => {
    expect(parseLocationParts("Hybrid")).toBeNull();
  });

  it("strips parenthetical (On-site) suffix", () => {
    const result = parseLocationParts("Washington DC-Baltimore Area (On-site)");
    expect(result).toEqual({ city: "Washington", state: "DC" });
  });

  it("strips parenthetical (Hybrid) suffix", () => {
    const result = parseLocationParts("New York, NY (Hybrid)");
    expect(result).toEqual({ city: "New York", state: "NY" });
  });

  it("strips parenthetical (Remote) suffix", () => {
    const result = parseLocationParts("San Francisco, CA (Remote)");
    expect(result).toEqual({ city: "San Francisco", state: "CA" });
  });

  it("handles 'Washington DC-Baltimore Area'", () => {
    const result = parseLocationParts("Washington DC-Baltimore Area");
    expect(result).toEqual({ city: "Washington", state: "DC" });
  });

  it("handles 'New York NY' without comma", () => {
    const result = parseLocationParts("New York NY");
    expect(result).toEqual({ city: "New York", state: "NY" });
  });

  it("handles 'San Francisco Bay Area (On-site)'", () => {
    const result = parseLocationParts("San Francisco Bay Area (On-site)");
    expect(result).toEqual({ city: "San Francisco", state: "CA" });
  });

  it("returns null for pure 'Remote' after stripping parens", () => {
    expect(parseLocationParts("Remote")).toBeNull();
  });
});

describe("normalizeLocation", () => {
  it("parses 'San Francisco, CA' to MSA 41860", () => {
    const result = normalizeLocation("San Francisco, CA");
    expect(result).toBeDefined();
    expect(result!.msaCode).toBe("41860");
  });

  it("parses 'New York, NY' to MSA 35620", () => {
    const result = normalizeLocation("New York, NY");
    expect(result).toBeDefined();
    expect(result!.msaCode).toBe("35620");
  });

  it("parses 'San Francisco Bay Area' via area suffix", () => {
    const result = normalizeLocation("San Francisco Bay Area");
    expect(result).toBeDefined();
    expect(result!.msaCode).toBe("41860");
  });

  it("parses 'Austin, Texas' to MSA", () => {
    const result = normalizeLocation("Austin, Texas");
    expect(result).toBeDefined();
    expect(result!.msaCode).toBe("12420");
  });

  it("returns undefined for 'Remote'", () => {
    expect(normalizeLocation("Remote")).toBeUndefined();
  });

  it("returns undefined for 'London, UK'", () => {
    expect(normalizeLocation("London, UK")).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(normalizeLocation("")).toBeUndefined();
  });

  it("handles 'Los Angeles, California'", () => {
    const result = normalizeLocation("Los Angeles, California");
    expect(result).toBeDefined();
    expect(result!.msaCode).toBe("31080");
  });

  it("handles 'Seattle, WA'", () => {
    const result = normalizeLocation("Seattle, WA");
    expect(result).toBeDefined();
    expect(result!.msaCode).toBe("42660");
  });

  it("handles 'Chicago, IL'", () => {
    const result = normalizeLocation("Chicago, IL");
    expect(result).toBeDefined();
    expect(result!.msaCode).toBe("16980");
  });
});
