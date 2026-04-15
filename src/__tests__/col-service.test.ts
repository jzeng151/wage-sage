import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchCOLData, lookupRPP, getCachedCOLData } from "../services/col-service";

const storage: Record<string, unknown> = {};
const chromeMock = {
  storage: {
    local: {
      get: vi.fn((keys: string | string[]) => {
        const keyArr = Array.isArray(keys) ? keys : [keys];
        const result: Record<string, unknown> = {};
        for (const k of keyArr) {
          if (k in storage) result[k] = storage[k];
        }
        return Promise.resolve(result);
      }),
      set: vi.fn((items: Record<string, unknown>) => {
        Object.assign(storage, items);
        return Promise.resolve();
      }),
    },
  },
};

beforeEach(() => {
  Object.keys(storage).forEach((k) => delete storage[k]);
  vi.clearAllMocks();
});

Object.defineProperty(globalThis, "chrome", { value: chromeMock, writable: true });

describe("col-service", () => {
  it("looks up RPP for known MSA code", () => {
    const result = lookupRPP("41860");
    expect(result).toBeDefined();
    expect(result!.rpp).toBe(118.3);
    expect(result!.msaName).toContain("San Francisco");
  });

  it("looks up RPP for New York", () => {
    const result = lookupRPP("35620");
    expect(result).toBeDefined();
    expect(result!.rpp).toBeGreaterThan(100);
  });

  it("returns undefined for unknown MSA code", () => {
    expect(lookupRPP("99999")).toBeUndefined();
  });

  it("fetches COL data for known MSA", async () => {
    const result = await fetchCOLData("41860");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rpp).toBe(118.3);
      expect(result.data.msaCode).toBe("41860");
      expect(result.data.monthlyRent).toBe(2385);
    }
  });

  it("returns col_no_data error for unknown MSA code", async () => {
    const result = await fetchCOLData("99999");
    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.error.type).toBe("col_no_data");
    }
  });

  it("caches results in chrome.storage.local", async () => {
    await fetchCOLData("41860");
    expect(chromeMock.storage.local.set).toHaveBeenCalled();
  });

  it("reads from cache when available", async () => {
    const cachedData = {
      data: { msaCode: "41860", beaAreaCode: "XX200", rpp: 118.3, monthlyRent: 2385, fetchedAt: Date.now() },
      cachedAt: Date.now(),
      ttlMs: 30 * 24 * 60 * 60 * 1000,
    };
    storage["rpp_41860"] = cachedData;

    const result = await getCachedCOLData("41860");
    expect(result).toBeDefined();
    expect(result!.rpp).toBe(118.3);
    expect(result!.monthlyRent).toBe(2385);
  });
});
