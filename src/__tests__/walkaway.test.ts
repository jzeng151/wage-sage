import { describe, it, expect } from "vitest";
import {
  calculateWalkAway,
  getExperienceBracket,
  formatSalary,
  HOUSING_SHARE,
  WALK_AWAY_DISCOUNT,
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
    monthlyRent: 2385,
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
  it("calculates market rate and cost of living for SF senior bracket", () => {
    const bls = makeBLSData();
    const col = makeCOLData();
    const result = calculateWalkAway(bls, col, "senior");

    // marketSalary = 168200 * 1.15 = 193430
    expect(result.marketSalary).toBe(193430);
    // costOfLiving = 2385 * 12 / 0.30 = 95400
    expect(result.costOfLiving).toBe(95400);
    // walkAway = max(95400, 0.9 * 193430) = max(95400, 174087) = 174087
    expect(result.walkAway).toBe(Math.round(0.9 * 193430));
    // target = marketSalary
    expect(result.target).toBe(193430);
  });

  it("uses 0.85 multiplier for entry bracket", () => {
    const bls = makeBLSData({ median: 100000 });
    const col = makeCOLData({ monthlyRent: 1000 });
    const result = calculateWalkAway(bls, col, "entry");

    expect(result.marketSalary).toBe(85000);
    expect(result.costOfLiving).toBe(40000); // 1000 * 12 / 0.30
    expect(result.walkAway).toBe(76500); // max(40000, 0.9 * 85000)
    expect(result.target).toBe(85000);
  });

  it("uses 1.0 multiplier for mid bracket", () => {
    const bls = makeBLSData({ median: 100000 });
    const col = makeCOLData({ monthlyRent: 1000 });
    const result = calculateWalkAway(bls, col, "mid");

    expect(result.marketSalary).toBe(100000);
    expect(result.costOfLiving).toBe(40000);
    expect(result.walkAway).toBe(90000); // max(40000, 0.9 * 100000)
    expect(result.target).toBe(100000);
  });

  it("uses 1.15 multiplier for senior bracket", () => {
    const bls = makeBLSData({ median: 100000 });
    const col = makeCOLData({ monthlyRent: 1000 });
    const result = calculateWalkAway(bls, col, "senior");

    expect(result.marketSalary).toBe(115000);
    expect(result.costOfLiving).toBe(40000);
    expect(result.walkAway).toBe(Math.round(0.9 * 115000));
    expect(result.target).toBe(115000);
  });

  it("COL floor kicks in when market salary is low in expensive area", () => {
    // Low-paying job in an expensive area (high rent)
    const bls = makeBLSData({ median: 40000 }); // $40K median
    const col = makeCOLData({ monthlyRent: 2500 }); // SF-level rent
    const result = calculateWalkAway(bls, col, "mid");

    // marketSalary = 40000
    // costOfLiving = 2500 * 12 / 0.30 = 100000
    // walkAway = max(100000, 0.9 * 40000) = max(100000, 36000) = 100000
    expect(result.marketSalary).toBe(40000);
    expect(result.costOfLiving).toBe(100000);
    expect(result.walkAway).toBe(100000); // COL floor wins
  });

  it("market rate wins over COL for typical tech salary", () => {
    const bls = makeBLSData({ median: 150000 });
    const col = makeCOLData({ monthlyRent: 2000 });
    const result = calculateWalkAway(bls, col, "mid");

    // costOfLiving = 2000 * 12 / 0.30 = 80000
    // 0.9 * 150000 = 135000
    // walkAway = max(80000, 135000) = 135000
    expect(result.walkAway).toBe(135000);
  });

  it("handles RPP of exactly 100 (national average)", () => {
    const bls = makeBLSData({ median: 100000 });
    const col = makeCOLData({ rpp: 100, monthlyRent: 1000 });
    const result = calculateWalkAway(bls, col, "mid");

    expect(result.colIndex).toBe(1.0);
    expect(result.costOfLiving).toBe(40000);
    expect(result.walkAway).toBe(90000);
  });

  it("handles very low rent area (rural)", () => {
    const bls = makeBLSData({ median: 50000 });
    const col = makeCOLData({ rpp: 85, monthlyRent: 700 });
    const result = calculateWalkAway(bls, col, "mid");

    // costOfLiving = 700 * 12 / 0.30 = 28000
    // 0.9 * 50000 = 45000
    // walkAway = max(28000, 45000) = 45000
    expect(result.costOfLiving).toBe(28000);
    expect(result.walkAway).toBe(45000);
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

  it("boundary: 0.9 * marketSalary exactly equals costOfLiving", () => {
    // Set rent so costOfLiving = 0.9 * median (mid bracket, multiplier = 1.0)
    // costOfLiving = rent * 12 / 0.30 = rent * 40
    // 0.9 * 100000 = 90000
    // rent * 40 = 90000 => rent = 2250
    const bls = makeBLSData({ median: 100000 });
    const col = makeCOLData({ monthlyRent: 2250 });
    const result = calculateWalkAway(bls, col, "mid");

    expect(result.costOfLiving).toBe(90000);
    expect(Math.round(0.9 * result.marketSalary)).toBe(90000);
    expect(result.walkAway).toBe(90000);
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
