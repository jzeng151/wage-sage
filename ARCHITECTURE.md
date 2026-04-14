# Wage Sage Architecture

## Overview

Wage Sage is a Chrome extension (Manifest V3) that reads job listings on LinkedIn, calculates a data-backed walk-away salary number from Bureau of Labor Statistics data, and generates an AI negotiation script the user can read word-for-word during salary negotiations.

```
┌─────────────────────────────────────────────────────────┐
│                     Chrome Browser                       │
│                                                          │
│  ┌──────────────────┐    ┌──────────────────────────┐   │
│  │  LinkedIn Page    │    │  Extension Popup         │   │
│  │                  │    │                          │   │
│  │  ┌────────────┐  │    │  ┌────────────────────┐  │   │
│  │  │ Content    │  │    │  │ Job Card           │  │   │
│  │  │ Script     │──┼───►│  │ Walk-Away Number   │  │   │
│  │  │            │  │    │  │ Data Breakdown     │  │   │
│  │  │ Reads DOM  │  │    │  │ Target Adjuster    │  │   │
│  │  │ Caches data│  │    │  │ Generate Button    │  │   │
│  │  └────────────┘  │    │  │ Script Output      │  │   │
│  └──────────────────┘    │  └────────────────────┘  │   │
│                          └────────────┬─────────────┘   │
│                                       │                  │
│                          ┌────────────▼─────────────┐   │
│                          │  Service Worker           │   │
│                          │                          │   │
│                          │  - AI script generation   │   │
│                          │  - Survives popup close   │   │
│                          │  - Caches results         │   │
│                          └────────────┬─────────────┘   │
│                                       │                  │
└───────────────────────────────────────┼──────────────────┘
                                        │
                    ┌───────────────────▼──────────────────┐
                    │          External APIs                │
                    │                                       │
                    │  ┌──────────┐  ┌───────────────────┐ │
                    │  │ BLS OEWS │  │ BEA RPP           │ │
                    │  │ API v2   │  │ (Cost of Living)  │ │
                    │  └──────────┘  └───────────────────┘ │
                    │  ┌──────────────────────────────────┐ │
                    │  │ Claude API (Script Generation)   │ │
                    │  └──────────────────────────────────┘ │
                    └──────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Plasmo | Extension scaffolding, Manifest V3, React, hot reload |
| Language | TypeScript | Type safety across all modules |
| UI | React + Tailwind CSS | Popup and options page components |
| Data | BLS OEWS Public API v2 | Occupational wage data by MSA |
| Data | BEA Regional Price Parities | Cost-of-living adjustment by MSA |
| AI | Claude API | Negotiation script generation |
| Storage | chrome.storage.local | Cache, API keys, extracted job data |
| Testing | Vitest | Unit tests for pure functions and services |
| Build | pnpm + Vite (via Plasmo) | Bundling and development server |

## Project Structure

```
wage-sage/
├── src/
│   ├── background.ts              # Service worker (lifecycle + AI calls)
│   ├── core/
│   │   ├── walkaway.ts            # Walk-away number calculator (pure function)
│   │   ├── soc-mapping.ts         # Job title → SOC code (pure function)
│   │   ├── location-normalizer.ts # Free-text location → MSA code (pure function)
│   │   └── data/
│   │       ├── soc-codes.ts       # Top-50 title-to-SOC mapping table
│   │       ├── msa-crosswalk.ts   # BEA area → BLS MSA crosswalk
│   │       └── city-to-msa.ts     # City/state → MSA lookup table
│   ├── services/
│   │   ├── bls-service.ts         # BLS API client with 30-day cache
│   │   ├── col-service.ts         # BEA RPP fetcher with crosswalk
│   │   └── script-generator.ts    # Claude API client with timeout/retry
│   ├── content/
│   │   └── linkedin.ts            # LinkedIn DOM parser
│   ├── popup/
│   │   ├── popup.tsx              # Main popup component
│   │   ├── JobCard.tsx            # Extracted job info display
│   │   ├── WalkAwayNumber.tsx     # Walk-away number display
│   │   ├── DataBreakdown.tsx      # Percentile/COL data rows
│   │   ├── TargetAdjuster.tsx     # Adjustable target salary
│   │   ├── ScriptOutput.tsx       # Generated script with edit/copy
│   │   └── ErrorStates.tsx        # Error message components
│   ├── options/
│   │   └── options.tsx            # API key settings page
│   ├── types/
│   │   └── index.ts               # Shared TypeScript interfaces
│   └── __tests__/
│       ├── walkaway.test.ts       # Calculator boundary tests
│       ├── soc-mapping.test.ts    # Title matching tests
│       ├── location-normalizer.test.ts # Location parsing tests
│       ├── bls-service.test.ts    # API client tests (mocked)
│       ├── script-generator.test.ts    # AI generation tests (mocked)
│       └── linkedin.test.ts       # DOM parser tests (mocked)
├── ROADMAP.md
├── ARCHITECTURE.md
├── DESIGN-DOC.md
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── plasmo.config.ts
```

## Data Flow

### Primary Flow: User visits a LinkedIn job page

```
1. User navigates to linkedin.com/jobs/view/XXXXX
2. Content script activates (matches URL pattern)
3. Content script reads DOM:
   - Job title (e.g., "Senior Software Engineer")
   - Company (e.g., "Acme Corp")
   - Location (e.g., "San Francisco Bay Area")
4. Content script caches extracted data to chrome.storage.local
5. User clicks extension icon in toolbar
6. Popup opens, reads cached data from chrome.storage.local

   PARALLEL PATHS:

   PATH A: Data lookup
   ├── soc-mapping.ts: "Senior Software Engineer" → SOC 15-1252
   ├── location-normalizer.ts: "San Francisco Bay Area" → MSA 41860
   ├── bls-service.ts: Fetch wage data for SOC 15-1252 in MSA 41860
   │   └── Cache hit? Return cached. Miss? Call BLS API, cache for 30 days.
   └── col-service.ts: Fetch RPP for MSA 41860
       └── Crosswalk: MSA 41860 → BEA area → RPP 118.3

   PATH B: Walk-away calculation (waits for PATH A)
   └── walkaway.ts:
       Input: BLS median $168,200, RPP 118.3, experience 8+ years
       Calculation: 0.9 * (168200 * 1.15) / (118.3 / 100) = $146,734
       Target (default): (168200 * 1.15) / (118.3 / 100) = $163,038

7. Popup displays:
   - Walk-away number: $146,734
   - Default target: $163,038
   - Data breakdown (median, percentiles, COL index)

8. User clicks "Generate Negotiation Script"
9. Popup sends message to service worker
10. Service worker calls Claude API with structured prompt
    - 30-second timeout
    - Result cached in chrome.storage.local
11. Service worker sends result back to popup
    - If popup was closed, result is cached for next open
12. Popup displays script with Edit + Copy buttons

13. User adjusts target salary to $180,000
14. User clicks "Regenerate Script"
15. Steps 9-12 repeat with updated target
16. User copies script to clipboard
```

### Failure Paths

```
DOM parse fails
  → Content script returns null
  → Popup shows manual entry form (title, company, location fields)
  → User fills in manually, flow continues from step 6

SOC mapping no match
  → soc-mapping.ts returns undefined (confidence below threshold)
  → Popup shows dropdown of 50 supported titles
  → User selects, flow continues

Location not parseable
  → location-normalizer.ts returns undefined
  → Popup shows dropdown of top MSAs
  → User selects, flow continues

BLS no data for SOC/MSA
  → bls-service.ts returns null
  → Popup shows "Data not available for this role in this area"
  → Manual salary entry option

User offline
  → Check cache first
  → Cached? Show cached data with "cached" indicator
  → Not cached? "Connect to internet to get salary data"

AI API key missing
  → Script generator returns error
  → Popup shows setup prompt with link to options page

AI timeout (30s)
  → Service worker returns timeout error
  → Popup shows "Request timed out" with retry button

AI rate limited
  → Service worker returns rate limit error
  → Popup shows "Rate limited — try again in 30 seconds" with countdown
```

## Manifest V3 Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Chrome Extension                    │
│                                                      │
│  ┌────────────────┐  ┌──────────┐  ┌─────────────┐ │
│  │ Content Script │  │ Popup    │  │ Service      │ │
│  │ (linkedin.ts)  │  │ (React)  │  │ Worker       │ │
│  │                │  │          │  │ (background) │ │
│  │ - Reads DOM    │  │ - UI     │  │              │ │
│  │ - Caches to    │  │ - Reads  │  │ - AI calls   │ │
│  │   storage      │  │   cache  │  │ - Lifecycle  │ │
│  │                │  │ - Sends  │  │ - Survives   │ │
│  │                │  │   msgs   │  │   popup close│ │
│  └───────┬────────┘  └────┬─────┘  └──────┬───────┘ │
│          │                │                │         │
│          └────────────────┼────────────────┘         │
│                           │                          │
│                    ┌──────▼──────┐                    │
│                    │ chrome.     │                    │
│                    │ storage.    │                    │
│                    │ local       │                    │
│                    │             │                    │
│                    │ - BLS cache │                    │
│                    │ - API key   │                    │
│                    │ - Job data  │                    │
│                    │ - Scripts   │                    │
│                    └─────────────┘                    │
└─────────────────────────────────────────────────────┘
```

### Key MV3 Constraints

| Constraint | How We Handle It |
|-----------|-----------------|
| Service worker has 5-min idle timeout | AI calls stay alive during active fetch. Lifecycle events only. |
| No persistent background state | All state in `chrome.storage.local`. Service worker is stateless. |
| Content scripts can't make cross-origin requests | BLS/BEA/AI calls go through popup or service worker, not content script. |
| Popup destroyed on close | AI calls routed through service worker, results cached. Popup reads cache on reopen. |
| `chrome.storage.local` has 10MB limit | Cache capped at 200 entries with LRU eviction. Each entry ~1KB. |

## Walk-Away Number Formula

```
walk_away = 0.9 * (BLS_median_wage * experience_multiplier) / (BEA_RPP / 100)

Inputs:
  BLS_median_wage  — OEWS annual median for the occupation in the MSA
  experience_multiplier:
    0-2 years (entry-level):  0.85
    3-7 years (mid):          1.0
    8+ years (senior):        1.15
  BEA_RPP  — Regional Price Parity for the MSA (e.g., 118.3 = 18.3% above national avg)
  0.9      — 10% margin below adjusted median (the floor)

Target salary (for script generation):
  target = (BLS_median_wage * experience_multiplier) / (BEA_RPP / 100)
  (Same formula, no 0.9 discount)
```

### Example Calculation

```
Job: Senior Software Engineer at Acme Corp, San Francisco
  BLS median for SOC 15-1252 in SF MSA: $168,200
  Experience: 8+ years → multiplier: 1.15
  BEA RPP for SF MSA: 118.3

  walk_away = 0.9 * (168200 * 1.15) / (118.3 / 100)
            = 0.9 * 193430 / 1.183
            = 0.9 * 163,462
            = $147,116

  target    = 193430 / 1.183
            = $163,517
```

## Caching Strategy

| Data Source | Cache Key | TTL | Storage | Eviction |
|------------|-----------|-----|---------|----------|
| BLS OEWS wages | `bls_{soc}_{msa}` | 30 days | chrome.storage.local | LRU, max 200 entries |
| BEA RPP | `rpp_{msa}` | 30 days | chrome.storage.local | LRU, max 200 entries |
| Extracted job data | `job_{tabId}` | Until tab closes | chrome.storage.local | Cleared on tab close |
| Generated scripts | `script_{soc}_{msa}_{target}` | Session | chrome.storage.local | Cleared on popup close |
| SOC mapping table | Hardcoded | N/A | In-memory | Updated with releases |
| MSA crosswalk | Hardcoded | N/A | In-memory | Updated with releases |

Cache-first strategy: popup reads from cache immediately, never shows a loading spinner for cached data.

## Security Model

| Asset | Storage | Threat | Mitigation |
|-------|---------|--------|-----------|
| Claude API key | chrome.storage.local (not sync) | XSS via LinkedIn content script | Content script has minimal privileges, no access to API key storage keys |
| User job data | chrome.storage.local | Extension data leak | No external transmission. Data stays local. |
| BLS/BEA responses | chrome.storage.local | Tampering | Read-only after cache write. No user-editable fields. |
| Generated scripts | chrome.storage.local | Exfiltration | Scripts never leave the extension. Copy is user-initiated. |

**Known limitation:** chrome.storage.local is accessible to all contexts within the extension. A compromised content script (via XSS on LinkedIn) could potentially access stored data. For v1, this is acceptable. A backend proxy for API keys would be the v2 solution.

## Error Model

Every error follows this structure:

```typescript
interface WageSageError {
  type: 'bls_no_data' | 'bls_network' | 'bls_rate_limit'
      | 'col_no_data'
      | 'ai_missing_key' | 'ai_invalid_key' | 'ai_rate_limit' | 'ai_timeout' | 'ai_malformed'
      | 'dom_parse_failed'
      | 'soc_no_match'
      | 'location_no_match'
      | 'offline';
  message: string;        // User-facing message
  recoverable: boolean;   // Can the user fix this?
  recoveryAction?: string; // What to do (e.g., "Add your API key in Settings")
}
```

Each error type maps to a distinct UI state in the popup. No generic "something went wrong."
