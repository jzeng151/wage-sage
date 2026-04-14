import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchBLSData, parseBLSResponse } from "../services/bls-service";

// Mock chrome.storage.local
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

// Inject mock
Object.defineProperty(globalThis, "chrome", { value: chromeMock, writable: true });

describe("parseBLSResponse", () => {
  it("parses valid BLS response with annual wage data", () => {
    const response = {
      Results: {
        series: [
          {
            data: [
              { year: "2024", period: "A01", value: "168200", periodName: "Annual" },
            ],
          },
        ],
      },
    };
    const result = parseBLSResponse(response);
    expect(result).toBeDefined();
    expect(result!.median).toBe(168200);
  });

  it("returns null for malformed response", () => {
    expect(parseBLSResponse({})).toBeNull();
    expect(parseBLSResponse({ Results: {} })).toBeNull();
    expect(parseBLSResponse({ Results: { series: [] } })).toBeNull();
  });

  it("returns null for response with no data series", () => {
    expect(parseBLSResponse({ Results: { series: [{ data: [] }] } })).toBeNull();
  });

  it("returns null for zero/negative values", () => {
    const response = {
      Results: {
        series: [{ data: [{ year: "2024", period: "A01", value: "0", periodName: "Annual" }] }],
      },
    };
    expect(parseBLSResponse(response)).toBeNull();
  });
});

describe("fetchBLSData", () => {
  it("returns bls_no_data for unknown state code", async () => {
    const result = await fetchBLSData("15-1252", "XX");
    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.error.type).toBe("bls_no_data");
    }
  });

  it("returns cached data when cache is fresh", async () => {
    const cachedData = {
      data: {
        socCode: "15-1252",
        msaCode: "CA",
        msaName: "",
        median: 185750,
        p25: 155000,
        p75: 220000,
        mean: 185750,
        fetchedAt: Date.now(),
      },
      cachedAt: Date.now(),
      ttlMs: 30 * 24 * 60 * 60 * 1000,
    };
    storage["bls_15-1252_CA"] = cachedData;

    const result = await fetchBLSData("15-1252", "CA");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.median).toBe(185750);
    }
  });

  it("calls API with state-level series IDs when no cache", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          Results: {
            series: [
              // P25 (data type 12)
              { data: [{ year: "2024", value: "103050", periodName: "Annual" }] },
              // Mean (data type 04)
              { data: [{ year: "2024", value: "185750", periodName: "Annual" }] },
              // P75 (data type 13)
              { data: [{ year: "2024", value: "133080", periodName: "Annual" }] },
            ],
          },
        }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await fetchBLSData("15-1252", "CA");
    expect(mockFetch).toHaveBeenCalled();

    // Verify the request body contains state-level series IDs
    const callArgs = mockFetch.mock.calls[0][1];
    const body = JSON.parse(callArgs.body);
    expect(body.seriesid).toContain("OEUS060000000000015125212");
    expect(body.seriesid).toContain("OEUS060000000000015125204");
    expect(body.seriesid).toContain("OEUS060000000000015125213");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.median).toBe(185750);
      expect(result.data.p25).toBe(103050);
      expect(result.data.p75).toBe(133080);
    }

    vi.restoreAllMocks();
  });

  it("estimates percentiles when series returns no data", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          Results: {
            series: [
              // P25 missing
              { data: [] },
              // Mean present
              { data: [{ year: "2024", value: "150000", periodName: "Annual" }] },
              // P75 missing
              { data: [] },
            ],
          },
        }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await fetchBLSData("15-1252", "CA");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.median).toBe(150000);
      // P25 estimated as 0.85 * median
      expect(result.data.p25).toBe(Math.round(150000 * 0.85));
      // P75 estimated as 1.18 * median
      expect(result.data.p75).toBe(Math.round(150000 * 1.18));
    }

    vi.restoreAllMocks();
  });

  it("returns bls_rate_limit error on 429", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await fetchBLSData("15-1252", "CA");
    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.error.type).toBe("bls_rate_limit");
    }

    vi.restoreAllMocks();
  });

  it("returns bls_network error on fetch failure", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
    vi.stubGlobal("fetch", mockFetch);

    const result = await fetchBLSData("15-1252", "CA");
    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.error.type).toBe("bls_network");
    }

    vi.restoreAllMocks();
  });

  it("returns bls_no_data when API returns empty results", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ Results: { series: [] } }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await fetchBLSData("15-1252", "CA");
    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.error.type).toBe("bls_no_data");
    }

    vi.restoreAllMocks();
  });

  it("returns bls_no_data when mean series returns zero", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          Results: {
            series: [
              { data: [] },
              { data: [{ year: "2024", value: "0", periodName: "Annual" }] },
              { data: [] },
            ],
          },
        }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await fetchBLSData("15-1252", "CA");
    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.error.type).toBe("bls_no_data");
    }

    vi.restoreAllMocks();
  });
});
