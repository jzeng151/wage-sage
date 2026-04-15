// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extractTitle,
  extractCompany,
  extractLocation,
  validateJobData,
  extractJobData,
  sendJobDataToBackground,
} from "../contents/indeed";
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

function makeIndeedDetailPage(title: string, company: string, location: string): void {
  document.body.innerHTML = `
    <div class="jobsearch-InfoHeaderContainer jobsearch-DesktopStickyContainer">
      <div class="jobsearch-JobInfoHeader" data-testid="jobsearch-JobInfoHeader">
        <h1 class="jobsearch-JobInfoHeader-title css-1b1jw74 e1tiznh50" data-testid="jobsearch-JobInfoHeader-title">
          <span>${title}</span>
        </h1>
        <div data-testid="jobsearch-CompanyInfoContainer">
          <div data-company-name="true" data-testid="inlineHeader-companyName">
            <span><a>${company}</a></span>
          </div>
          <div data-testid="inlineHeader-companyLocation">
            <div>${location}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function makeIndeedSearchPage(title: string, company: string, location: string): void {
  document.body.innerHTML = `
    <div class="job_seen_beacon">
      <h2 class="jobTitle"><a>${title}</a></h2>
      <span class="companyName">${company}</span>
      <div class="companyLocation">${location}</div>
    </div>
  `;
}

describe("extractTitle", () => {
  it("extracts title from job detail header", () => {
    document.body.innerHTML = `
      <h1 class="jobsearch-JobInfoHeader-title">Software Engineer</h1>
    `;
    expect(extractTitle(document)).toBe("Software Engineer");
  });

  it("extracts title from data-testid", () => {
    document.body.innerHTML = `
      <h1 data-testid="jobsearch-JobInfoHeader-title">Senior Developer</h1>
    `;
    expect(extractTitle(document)).toBe("Senior Developer");
  });

  it("extracts title from search results", () => {
    document.body.innerHTML = `
      <h2 class="jobTitle"><a>Full Stack Engineer</a></h2>
    `;
    expect(extractTitle(document)).toBe("Full Stack Engineer");
  });

  it("strips ' - job post' suffix", () => {
    document.body.innerHTML = `
      <h1 class="jobsearch-JobInfoHeader-title">Software Engineer - job post</h1>
    `;
    expect(extractTitle(document)).toBe("Software Engineer");
  });

  it("strips ' | Indeed' suffix", () => {
    document.body.innerHTML = `
      <h1 class="jobsearch-JobInfoHeader-title">Product Manager | Indeed.com</h1>
    `;
    expect(extractTitle(document)).toBe("Product Manager");
  });

  it("strips trailing dash after suffix removal", () => {
    document.body.innerHTML = `
      <h1 class="jobsearch-JobInfoHeader-title">Data Analyst - job post</h1>
    `;
    expect(extractTitle(document)).toBe("Data Analyst");
  });

  it("strips ' – job post' with en-dash", () => {
    document.body.innerHTML = `
      <h1 class="jobsearch-JobInfoHeader-title">Frontend Engineer – job post</h1>
    `;
    expect(extractTitle(document)).toBe("Frontend Engineer");
  });

  it("returns null when no selectors match", () => {
    document.body.innerHTML = "<div>No job info here</div>";
    expect(extractTitle(document)).toBeNull();
  });

  it("strips extra whitespace", () => {
    document.body.innerHTML = `
      <h1 class="jobsearch-JobInfoHeader-title">  Software   Engineer  </h1>
    `;
    expect(extractTitle(document)).toBe("Software Engineer");
  });
});

describe("extractCompany", () => {
  it("extracts company from data-testid", () => {
    document.body.innerHTML = `
      <span data-testid="inlineHeader-companyName">Acme Corp</span>
    `;
    expect(extractCompany(document)).toBe("Acme Corp");
  });

  it("extracts company from CompanyInfoContainer link", () => {
    document.body.innerHTML = `
      <div class="jobsearch-CompanyInfoContainer"><a>Google</a></div>
    `;
    expect(extractCompany(document)).toBe("Google");
  });

  it("extracts company from search results companyName span", () => {
    document.body.innerHTML = `
      <span class="companyName">Stripe</span>
    `;
    expect(extractCompany(document)).toBe("Stripe");
  });

  it("extracts company from data-company-name attribute", () => {
    document.body.innerHTML = `
      <span data-company-name="true">Meta</span>
    `;
    expect(extractCompany(document)).toBe("Meta");
  });

  it("returns null when no selectors match", () => {
    document.body.innerHTML = "<div>No company info</div>";
    expect(extractCompany(document)).toBeNull();
  });
});

describe("extractLocation", () => {
  it("extracts location from data-testid", () => {
    document.body.innerHTML = `
      <span data-testid="inlineHeader-companyLocation">San Francisco, CA</span>
    `;
    expect(extractLocation(document)).toBe("San Francisco, CA");
  });

  it("extracts location from subtitle", () => {
    document.body.innerHTML = `
      <div class="jobsearch-JobInfoHeader-subtitle">New York, NY 10001</div>
    `;
    expect(extractLocation(document)).toBe("New York, NY 10001");
  });

  it("extracts location from search results companyLocation", () => {
    document.body.innerHTML = `
      <div class="companyLocation">Austin, TX</div>
    `;
    expect(extractLocation(document)).toBe("Austin, TX");
  });

  it("extracts location with remote indicator", () => {
    document.body.innerHTML = `
      <div data-testid="text-location">Remote in Denver, CO</div>
    `;
    expect(extractLocation(document)).toBe("Remote in Denver, CO");
  });

  it("returns null when no selectors match", () => {
    document.body.innerHTML = "<div>No location info</div>";
    expect(extractLocation(document)).toBeNull();
  });
});

describe("extractJobData", () => {
  it("extracts title, company, location from job detail page", () => {
    makeIndeedDetailPage("Software Engineer", "Acme Corp", "San Francisco, CA");
    const data = extractJobData();
    expect(data).toBeDefined();
    expect(data!.title).toBe("Software Engineer");
    expect(data!.company).toBe("Acme Corp");
    expect(data!.location).toBe("San Francisco, CA");
    expect(data!.source).toBe("indeed");
  });

  it("strips title suffix during extraction", () => {
    makeIndeedDetailPage("Senior Engineer - job post", "Google", "Mountain View, CA");
    const data = extractJobData();
    expect(data).toBeDefined();
    expect(data!.title).toBe("Senior Engineer");
    expect(data!.company).toBe("Google");
  });

  it("extracts from search results page", () => {
    makeIndeedSearchPage("Full Stack Developer", "Stripe", "South San Francisco, CA");
    const data = extractJobData();
    expect(data).toBeDefined();
    expect(data!.title).toBe("Full Stack Developer");
    expect(data!.company).toBe("Stripe");
    expect(data!.location).toBe("South San Francisco, CA");
    expect(data!.source).toBe("indeed");
  });

  it("returns null when all selectors fail (non-job page)", () => {
    document.body.innerHTML = "<div>Not a job page</div>";
    expect(extractJobData()).toBeNull();
  });

  it("returns null when title is missing", () => {
    document.body.innerHTML = `
      <span data-testid="inlineHeader-companyName">Company</span>
      <div class="companyLocation">Location</div>
    `;
    expect(extractJobData()).toBeNull();
  });

  it("handles extra whitespace in extracted text", () => {
    document.body.innerHTML = `
      <div class="jobsearch-InfoHeaderContainer">
        <h1 class="jobsearch-JobInfoHeader-title" data-testid="jobsearch-JobInfoHeader-title"><span>  Senior   Engineer  </span></h1>
        <div data-testid="inlineHeader-companyName"><span><a>  Acme   Corp  </a></span></div>
        <div data-testid="inlineHeader-companyLocation"><div>  San   Francisco  </div></div>
      </div>
    `;
    const data = extractJobData();
    expect(data).toBeDefined();
    expect(data!.title).toBe("Senior Engineer");
    expect(data!.company).toBe("Acme Corp");
  });

  it("extracts from detail container, not search results", () => {
    document.body.innerHTML = `
      <div class="job_seen_beacon">
        <h2 class="jobTitle"><a>Wrong Title</a></h2>
        <span class="companyName">WrongCo</span>
        <div class="companyLocation">Wrong City, XX</div>
      </div>
      <div class="jobsearch-InfoHeaderContainer">
        <h1 class="jobsearch-JobInfoHeader-title" data-testid="jobsearch-JobInfoHeader-title"><span>Real Title</span></h1>
        <div data-testid="jobsearch-CompanyInfoContainer">
          <div data-testid="inlineHeader-companyName"><span><a>RealCo</a></span></div>
          <div data-testid="inlineHeader-companyLocation"><div>Real City, CA</div></div>
        </div>
      </div>
    `;
    const data = extractJobData();
    expect(data).toBeDefined();
    expect(data!.title).toBe("Real Title");
    expect(data!.company).toBe("RealCo");
    expect(data!.location).toBe("Real City, CA");
  });

  it("falls back to proximity when location class is unknown", () => {
    document.body.innerHTML = `
      <div class="job_seen_beacon">
        <h2 class="jobTitle"><a>Junior Dev</a></h2>
        <span class="companyName">SideCorp</span>
        <div class="companyLocation">Portland, OR</div>
      </div>
      <div class="jobsearch-InfoHeaderContainer">
        <h1 class="jobsearch-JobInfoHeader-title"><span>Staff Engineer</span></h1>
        <div data-testid="inlineHeader-companyName"><span><a>Meta</a></span></div>
        <span class="unknown-loc">Menlo Park, CA</span>
      </div>
    `;
    const data = extractJobData();
    expect(data).toBeDefined();
    expect(data!.title).toBe("Staff Engineer");
    expect(data!.company).toBe("Meta");
    expect(data!.location).toBe("Menlo Park, CA");
  });
});

describe("validateJobData", () => {
  it("returns true for valid data with all fields", () => {
    const data: JobData = {
      title: "Software Engineer",
      company: "Acme Corp",
      location: "San Francisco, CA",
      source: "indeed",
      extractedAt: Date.now(),
    };
    expect(validateJobData(data)).toBe(true);
  });

  it("returns false for empty title", () => {
    const data: JobData = {
      title: "",
      company: "Acme Corp",
      location: "San Francisco, CA",
      source: "indeed",
      extractedAt: Date.now(),
    };
    expect(validateJobData(data)).toBe(false);
  });

  it("returns false for empty company", () => {
    const data: JobData = {
      title: "Software Engineer",
      company: "",
      location: "San Francisco, CA",
      source: "indeed",
      extractedAt: Date.now(),
    };
    expect(validateJobData(data)).toBe(false);
  });

  it("returns false for extremely long title (garbage)", () => {
    const data: JobData = {
      title: "x".repeat(201),
      company: "Acme Corp",
      location: "San Francisco, CA",
      source: "indeed",
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
      source: "indeed",
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
      source: "indeed",
      extractedAt: Date.now(),
    };
    expect(() => sendJobDataToBackground(data)).not.toThrow();
  });
});
