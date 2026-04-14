import { describe, it, expect } from "vitest";
import {
  calculateWalkAway,
  getExperienceBracket,
  formatSalary,
} from "../core/walkaway";
import type { BLSData, COLData } from "../types";

function makeBLSData(overrides: Partial<BLSData> = {}): BLSData {
  return {
    socCode: "15-1252",
    msaCode: "41860",
    msaName: "San Francisco-Oakland-Hayward, CA",
    median: 168200,
    p25: 142500,
    p75: 198600,
    mean: 175000,
    fetchedAt: Date.now(),
    ...overrides,
  };
}

function makeCOLData(overrides: Partial<COLData> = {}): COLData {
  return {
    msaCode: "41860",
    beaAreaCode: "XX200",
    rpp: 118.3,
    fetchedAt: Date.now(),
    ...overrides,
  };
}

describe("getExperienceBracket", () => {
  it("returns 'entry' for 0 years", () => {
    expect(getExperienceBracket(0)).toBe("entry");
  });
  it("returns 'entry' for 2 years", () => {
    expect(getExperienceBracket(2)).toBe("entry");
  });
  it("returns 'mid' for 3 years", () => {
    expect(getExperienceBracket(3)).toBe("mid");
  });
  it("returns 'mid' for 7 years", () => {
    expect(getExperienceBracket(7)).toBe("mid");
  });
  it("returns 'senior' for 8 years", () => {
    expect(getExperienceBracket(8)).toBe("senior");
  });
  it("returns 'senior' for 20 years", () => {
    expect(getExperienceBracket(20)).toBe("senior");
  });
  it("clamps negative years to 0 (entry)", () => {
    expect(getExperienceBracket(-5)).toBe("entry");
  });
});

describe("calculateWalkAway", () => {
  it("calculates walk-away for senior bracket matching ARCHITECTURE.md example", () => {
    const bls = makeBLSData();
    const col = makeCOLData();
    const result = calculateWalkAway(bls, col, "senior");

    // walk_away = 0.9 * (168200 * 1.15) / 1.183 = 0.9 * 193430 / 1.183 = ~147,116
    expect(result.walkAway).toBe(Math.round(0.9 * (168200 * 1.15) / 1.183));
    // target = 193430 / 1.183 = ~163,517
    expect(result.target).toBe(Math.round((168200 * 1.15) / 1.183));
  });

  it("uses 0.85 multiplier for entry bracket", () => {
    const bls = makeBLSData({ median: 100000 });
    const col = makeCOLData({ rpp: 100 });
    const result = calculateWalkAway(bls, col, "entry");
    expect(result.walkAway).toBe(Math.round(0.9 * 100000 * 0.85));
    expect(result.target).toBe(Math.round(100000 * 0.85));
  });

  it("uses 1.0 multiplier for mid bracket", () => {
    const bls = makeBLSData({ median: 100000 });
    const col = makeCOLData({ rpp: 100 });
    const result = calculateWalkAway(bls, col, "mid");
    expect(result.walkAway).toBe(Math.round(0.9 * 100000));
    expect(result.target).toBe(100000);
  });

  it("uses 1.15 multiplier for senior bracket", () => {
    const bls = makeBLSData({ median: 100000 });
    const col = makeCOLData({ rpp: 100 });
    const result = calculateWalkAway(bls, col, "senior");
    expect(result.walkAway).toBe(Math.round(0.9 * 100000 * 1.15));
    expect(result.target).toBe(Math.round(100000 * 1.15));
  });

  it("handles RPP of exactly 100 (national average)", () => {
    const bls = makeBLSData({ median: 100000 });
    const col = makeCOLData({ rpp: 100 });
    const result = calculateWalkAway(bls, col, "mid");
    expect(result.colIndex).toBe(1.0);
    expect(result.walkAway).toBe(90000);
    expect(result.target).toBe(100000);
  });

  it("handles RPP below 100 (below-average cost of living)", () => {
    const bls = makeBLSData({ median: 100000 });
    const col = makeCOLData({ rpp: 90 });
    const result = calculateWalkAway(bls, col, "mid");
    // 0.9 * 100000 / 0.9 = 100000
    expect(result.walkAway).toBe(100000);
    expect(result.target).toBe(Math.round(100000 / 0.9));
  });

  it("handles RPP significantly above 100 (NYC)", () => {
    const bls = makeBLSData({ median: 150000 });
    const col = makeCOLData({ rpp: 128.5 });
    const result = calculateWalkAway(bls, col, "senior");
    // walk_away = 0.9 * (150000 * 1.15) / 1.285
    const expected = Math.round(0.9 * (150000 * 1.15) / 1.285);
    expect(result.walkAway).toBe(expected);
  });

  it("returns correct colIndex", () => {
    const bls = makeBLSData();
    const col = makeCOLData({ rpp: 118.3 });
    const result = calculateWalkAway(bls, col, "mid");
    expect(result.colIndex).toBeCloseTo(1.183, 2);
  });

  it("returns correct experience metadata", () => {
    const bls = makeBLSData();
    const col = makeCOLData();
    const result = calculateWalkAway(bls, col, "senior");
    expect(result.experienceBracket).toBe("senior");
    expect(result.experienceMultiplier).toBe(1.15);
  });

  it("passes through BLS percentile data", () => {
    const bls = makeBLSData();
    const col = makeCOLData();
    const result = calculateWalkAway(bls, col, "mid");
    expect(result.median).toBe(168200);
    expect(result.p25).toBe(142500);
    expect(result.p75).toBe(198600);
  });
});

describe("formatSalary", () => {
  it("formats 168200 as '$168,200'", () => {
    expect(formatSalary(168200)).toBe("$168,200");
  });
  it("formats 0 as '$0'", () => {
    expect(formatSalary(0)).toBe("$0");
  });
  it("formats 999999 as '$999,999'", () => {
    expect(formatSalary(999999)).toBe("$999,999");
  });
  it("formats 1000000 as '$1,000,000'", () => {
    expect(formatSalary(1000000)).toBe("$1,000,000");
  });
});
