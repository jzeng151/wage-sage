// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extractTitle,
  extractCompany,
  extractLocation,
  validateJobData,
  extractJobData,
  sendJobDataToBackground,
} from "../contents/linkedin";
import type { JobData } from "../types";

const sendMessageMock = vi.fn();
const chromeMock = {
  runtime: {
    sendMessage: sendMessageMock,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

Object.defineProperty(globalThis, "chrome", { value: chromeMock, writable: true });

function makeLinkedInPage(title: string, company: string, location: string): void {
  document.body.innerHTML = `
    <section class="top-card-layout">
      <div class="top-card-layout__card">
        <div class="top-card-layout__entity-info-container">
          <div class="top-card-layout__entity-info">
            <h1 class="top-card-layout__title topcard__title">${title}</h1>
            <h4 class="top-card-layout__second-subline">
              <div class="topcard__flavor-row">
                <span class="topcard__flavor">
                  <a class="topcard__org-name-link">${company}</a>
                </span>
                <span class="topcard__flavor topcard__flavor--bullet">${location}</span>
              </div>
            </h4>
          </div>
        </div>
      </div>
    </section>
  `;
}

describe("extractTitle", () => {
  it("extracts title from topcard selector", () => {
    document.body.innerHTML = `<h1 class="topcard__title">Senior Software Engineer</h1>`;
    expect(extractTitle(document)).toBe("Senior Software Engineer");
  });

  it("extracts title from top-card-layout fallback", () => {
    makeLinkedInPage("Senior Software Engineer", "Acme Corp", "San Francisco, CA");
    expect(extractTitle(document)).toBe("Senior Software Engineer");
  });

  it("extracts title from logged-in SPA selector", () => {
    document.body.innerHTML = `
      <div class="jobs-unified-top-card__job-title"><h1>Staff Engineer</h1></div>
    `;
    expect(extractTitle(document)).toBe("Staff Engineer");
  });

  it("extracts title from search results h3", () => {
    document.body.innerHTML = `
      <h3 class="base-search-card__title">Software Engineer, Fullstack</h3>
    `;
    expect(extractTitle(document)).toBe("Software Engineer, Fullstack");
  });

  it("extracts title from artdeco-entity-lockup", () => {
    document.body.innerHTML = `
      <div class="artdeco-entity-lockup__title">Product Manager</div>
    `;
    expect(extractTitle(document)).toBe("Product Manager");
  });

  it("extracts title from unified top card fallback", () => {
    document.body.innerHTML = `
      <div class="job-details-jobs-unified-top-card__job-title">Data Scientist</div>
    `;
    expect(extractTitle(document)).toBe("Data Scientist");
  });

  it("returns null when no selectors match", () => {
    document.body.innerHTML = "<div>No job info here</div>";
    expect(extractTitle(document)).toBeNull();
  });

  it("strips extra whitespace", () => {
    document.body.innerHTML = `
      <h1 class="topcard__title">  Software   Engineer  </h1>
    `;
    expect(extractTitle(document)).toBe("Software Engineer");
  });
});

describe("extractCompany", () => {
  it("extracts company from logged-in SPA selector", () => {
    document.body.innerHTML = `
      <div class="jobs-unified-top-card__company-name"><a>Google</a></div>
    `;
    expect(extractCompany(document)).toBe("Google");
  });

  it("extracts company from topcard org name link", () => {
    document.body.innerHTML = `
      <a class="topcard__org-name-link">Acme Corp</a>
    `;
    expect(extractCompany(document)).toBe("Acme Corp");
  });

  it("extracts company from search results hidden-nested-link", () => {
    document.body.innerHTML = `
      <h4 class="base-search-card__subtitle">
        <a class="hidden-nested-link">Notion</a>
      </h4>
    `;
    expect(extractCompany(document)).toBe("Notion");
  });

  it("extracts company from unified top card link", () => {
    document.body.innerHTML = `
      <div class="job-details-jobs-unified-top-card__company-name"><a>Acme Corp</a></div>
    `;
    expect(extractCompany(document)).toBe("Acme Corp");
  });

  it("extracts company from artdeco subtitle", () => {
    document.body.innerHTML = `
      <div class="artdeco-entity-lockup__subtitle">Acme Corp</div>
    `;
    expect(extractCompany(document)).toBe("Acme Corp");
  });

  it("extracts company from top-card-layout fallback", () => {
    makeLinkedInPage("Title", "Acme Corp", "Location");
    expect(extractCompany(document)).toBe("Acme Corp");
  });

  it("returns null when no selectors match", () => {
    document.body.innerHTML = "<div>No company info</div>";
    expect(extractCompany(document)).toBeNull();
  });
});

describe("extractLocation", () => {
  it("extracts location from logged-in SPA bullet", () => {
    document.body.innerHTML = `
      <div class="jobs-unified-top-card__bullet">San Francisco, CA</div>
    `;
    expect(extractLocation(document)).toBe("San Francisco, CA");
  });

  it("extracts location from search results card location", () => {
    document.body.innerHTML = `
      <span class="job-search-card__location">New York, NY</span>
    `;
    expect(extractLocation(document)).toBe("New York, NY");
  });

  it("extracts location from topcard flavor bullet", () => {
    document.body.innerHTML = `
      <span class="topcard__flavor topcard__flavor--bullet">San Francisco, CA</span>
    `;
    expect(extractLocation(document)).toBe("San Francisco, CA");
  });

  it("extracts location from top-card-layout fallback", () => {
    makeLinkedInPage("Title", "Company", "San Francisco, CA");
    expect(extractLocation(document)).toBe("San Francisco, CA");
  });

  it("extracts location from unified top card bullet", () => {
    document.body.innerHTML = `
      <div class="job-details-jobs-unified-top-card__bullet">New York, NY</div>
    `;
    expect(extractLocation(document)).toBe("New York, NY");
  });

  it("returns null when no selectors match", () => {
    document.body.innerHTML = "<div>No location info</div>";
    expect(extractLocation(document)).toBeNull();
  });
});

describe("extractJobData", () => {
  it("extracts title, company, location from standard LinkedIn job page", () => {
    makeLinkedInPage("Senior Software Engineer", "Acme Corp", "San Francisco, CA");
    const data = extractJobData();
    expect(data).toBeDefined();
    expect(data!.title).toBe("Senior Software Engineer");
    expect(data!.company).toBe("Acme Corp");
    expect(data!.location).toBe("San Francisco, CA");
    expect(data!.source).toBe("linkedin");
  });

  it("returns null when all selectors fail (non-job page)", () => {
    document.body.innerHTML = "<div>Not a job page</div>";
    expect(extractJobData()).toBeNull();
  });

  it("returns null when title is missing", () => {
    document.body.innerHTML = `
      <a class="top-card-layout__second-link"><span>Company</span></a>
      <span class="top-card-layout__bullet">Location</span>
    `;
    expect(extractJobData()).toBeNull();
  });

  it("handles extra whitespace in extracted text", () => {
    document.body.innerHTML = `
      <h1 class="topcard__title">  Senior   Engineer  </h1>
      <div class="artdeco-entity-lockup__subtitle">  Acme   Corp  </div>
      <div class="artdeco-entity-lockup__caption">  San   Francisco  </div>
    `;
    const data = extractJobData();
    expect(data).toBeDefined();
    expect(data!.title).toBe("Senior Engineer");
    expect(data!.company).toBe("Acme Corp");
  });

  it("extracts data using artdeco selectors (authenticated layout)", () => {
    document.body.innerHTML = `
      <div class="artdeco-entity-lockup__title">Staff Engineer</div>
      <div class="artdeco-entity-lockup__subtitle">Google</div>
      <div class="artdeco-entity-lockup__caption">Mountain View, CA</div>
    `;
    const data = extractJobData();
    expect(data).toBeDefined();
    expect(data!.title).toBe("Staff Engineer");
    expect(data!.company).toBe("Google");
    expect(data!.location).toBe("Mountain View, CA");
  });

  it("extracts data from logged-in SPA layout", () => {
    document.body.innerHTML = `
      <div class="jobs-unified-top-card__job-title"><h1>Senior SRE</h1></div>
      <div class="jobs-unified-top-card__company-name"><a>Meta</a></div>
      <div class="jobs-unified-top-card__bullet">Menlo Park, CA</div>
    `;
    const data = extractJobData();
    expect(data).toBeDefined();
    expect(data!.title).toBe("Senior SRE");
    expect(data!.company).toBe("Meta");
    expect(data!.location).toBe("Menlo Park, CA");
  });

  it("extracts data from search results card layout", () => {
    document.body.innerHTML = `
      <div class="base-search-card__info">
        <h3 class="base-search-card__title">Full Stack Developer</h3>
        <h4 class="base-search-card__subtitle">
          <a class="hidden-nested-link">Stripe</a>
        </h4>
        <div class="base-search-card__metadata">
          <span class="job-search-card__location">South San Francisco, CA</span>
        </div>
      </div>
    `;
    const data = extractJobData();
    expect(data).toBeDefined();
    expect(data!.title).toBe("Full Stack Developer");
    expect(data!.company).toBe("Stripe");
    expect(data!.location).toBe("South San Francisco, CA");
  });
});

describe("validateJobData", () => {
  it("returns true for valid data with all fields", () => {
    const data: JobData = {
      title: "Software Engineer",
      company: "Acme Corp",
      location: "San Francisco, CA",
      source: "linkedin",
      extractedAt: Date.now(),
    };
    expect(validateJobData(data)).toBe(true);
  });

  it("returns false for empty title", () => {
    const data: JobData = {
      title: "",
      company: "Acme Corp",
      location: "San Francisco, CA",
      source: "linkedin",
      extractedAt: Date.now(),
    };
    expect(validateJobData(data)).toBe(false);
  });

  it("returns false for empty company", () => {
    const data: JobData = {
      title: "Software Engineer",
      company: "",
      location: "San Francisco, CA",
      source: "linkedin",
      extractedAt: Date.now(),
    };
    expect(validateJobData(data)).toBe(false);
  });

  it("returns false for empty location", () => {
    const data: JobData = {
      title: "Software Engineer",
      company: "Acme Corp",
      location: "",
      source: "linkedin",
      extractedAt: Date.now(),
    };
    expect(validateJobData(data)).toBe(false);
  });

  it("returns false for extremely long title (garbage)", () => {
    const data: JobData = {
      title: "x".repeat(201),
      company: "Acme Corp",
      location: "San Francisco, CA",
      source: "linkedin",
      extractedAt: Date.now(),
    };
    expect(validateJobData(data)).toBe(false);
  });
});

describe("sendJobDataToBackground", () => {
  it("sends CACHE_JOB_DATA message to background", () => {
    const data: JobData = {
      title: "Software Engineer",
      company: "Acme Corp",
      location: "San Francisco, CA",
      source: "linkedin",
      extractedAt: Date.now(),
    };
    sendJobDataToBackground(data);
    expect(sendMessageMock).toHaveBeenCalledWith({
      type: "CACHE_JOB_DATA",
      payload: data,
    });
  });

  it("swallows errors when extension context is invalidated", () => {
    sendMessageMock.mockImplementation(() => {
      throw new Error("Extension context invalidated");
    });
    const data: JobData = {
      title: "Software Engineer",
      company: "Acme Corp",
      location: "San Francisco, CA",
      source: "linkedin",
      extractedAt: Date.now(),
    };
    // Should not throw
    expect(() => sendJobDataToBackground(data)).not.toThrow();
  });
});
