# Wage Sage Roadmap

## Phase 1: MVP — Chrome Extension Core

**Goal:** A working Chrome extension that reads a LinkedIn job page, calculates a walk-away number from BLS data, and generates an AI negotiation script the user can read word-for-word.

### Data Layer
- [ ] BLS OEWS API client (`src/services/bls-service.ts`)
  - Fetch occupational wage data by SOC code + MSA
  - 30-day cache in `chrome.storage.local`, keyed by SOC+MSA
  - Rate limit handling (25 req/sec cap), 429 backoff
- [ ] BEA RPP cost-of-living service (`src/services/col-service.ts`)
  - Fetch Regional Price Parities by MSA
  - Static crosswalk table mapping BEA area codes to BLS MSA codes
- [ ] Walk-away number calculator (`src/core/walkaway.ts`)
  - Formula: `0.9 * (BLS_median * experience_multiplier) / (RPP / 100)`
  - Experience brackets: 0-2yr (0.85), 3-7yr (1.0), 8+yr (1.15)
  - Adjustable target defaults to full adjusted median (1.0x, no 0.9 discount)
- [ ] Job title to SOC code mapping (`src/core/soc-mapping.ts`)
  - Hardcoded top-50 tech job titles mapped to BLS SOC codes
  - Levenshtein fuzzy matching with confidence threshold
  - Below threshold → dropdown of all 50 titles
  - Log unmatched titles for future expansion
- [ ] Location normalizer (`src/core/location-normalizer.ts`)
  - Parse free-text location ("San Francisco Bay Area", "New York, NY") into MSA codes
  - Static city/state-to-MSA lookup table
  - "Remote" → dropdown fallback
  - Non-US → "not supported" message

### Content Script
- [ ] LinkedIn DOM parser (`src/content/linkedin.ts`)
  - Extract job title, company, location from LinkedIn job pages
  - Cache extracted data in `chrome.storage.local` (pull model)
  - Silent failure detection (garbage data flags)
  - Manual entry fallback when parsing fails

### Service Worker
- [ ] Background message handler (`src/background.ts`)
  - Route AI script generation requests (survives popup close)
  - Cache generated scripts in `chrome.storage.local`
  - Extension lifecycle events (install, update)

### Popup UI
- [ ] Extension popup (`src/popup/`)
  - Header: WageSage logo, "LinkedIn detected" badge
  - Job card: extracted title, company, location
  - Walk-away number: 38px, BLS citation (MSA, percentile, COL-adjusted)
  - Data breakdown: median, 25th/75th percentile, COL index
  - Adjustable target: +/- buttons, editable dollar amount, "Regenerate Script" button
  - Generate button: full-width, loading spinner during AI call
  - Script output: structured sections (Opening, Data Reference, The Ask, Pushback Response)
  - Edit + Copy buttons on script
  - Error states: BLS no data, offline, API key missing, rate limited, timeout

### AI Script Generator
- [ ] Claude API integration (`src/services/script-generator.ts`)
  - Structured prompt: walk-away number, job details, BLS data, target salary
  - Provider abstraction interface for future AI backends
  - 30-second timeout with retry
  - Runs in service worker (not popup) to survive popup close

### Settings
- [ ] Options page (`src/options/`)
  - Claude API key input (stored in `chrome.storage.local`, not `sync`)
  - Key validation on save

### Tests
- [ ] Unit tests with Vitest (`src/__tests__/`)
  - Walk-away calculator: all experience brackets, boundaries, edge cases
  - SOC mapping: exact match, fuzzy match, no match, case insensitive
  - Location normalizer: city/state parsing, remote handling
- [ ] Service tests (mocked API responses)
  - BLS client: success, no data, network error, rate limit, cache behavior
  - Script generator: success, missing key, timeout, malformed response
- [ ] Content script tests (DOM mocks)
  - LinkedIn parser: standard page, missing selectors, non-job page

### Distribution
- [ ] Chrome Web Store listing
- [ ] GitHub repo with developer mode install instructions

---

## Phase 2: Expanded Coverage

**Goal:** Support more job boards and improve data granularity.

### Additional Job Boards
- [ ] Greenhouse DOM parser
- [ ] Indeed DOM parser
- [ ] Lever DOM parser
- [ ] Generic fallback parser (any job page with structured data / JSON-LD)

### Expanded SOC Mapping
- [ ] Grow from top-50 to top-200 job titles
- [ ] Add non-tech categories (healthcare, finance, marketing, legal)
- [ ] Auto-update mapping from BLS SOC index

### Improved Location Handling
- [ ] Full US city-to-MSA database (Census gazetteer)
- [ ] Zip code resolution
- [ ] International job support (UK, Canada, EU salary benchmarks)

---

## Phase 3: Full Negotiation Suite

**Goal:** Expand from salary-only to total compensation negotiation.

### Offer Letter Analysis
- [ ] Offer letter parser (paste or upload)
- [ ] Identify all negotiable terms (salary, signing bonus, equity, PTO, remote days, title, relocation, review cycle)
- [ ] Rank terms by leverage (which ones have most room to move)
- [ ] Cross-reference each term against BLS data and crowd-sourced outcomes

### Total Compensation View
- [ ] Equity estimation for startups (stage-based, using Crunchbase/API data)
- [ ] Benefits valuation (health insurance, 401k match, PTO dollar value)
- [ ] Side-by-side offer comparison dashboard

### AI Enhancements
- [ ] Multiple AI provider support (OpenAI, Gemini, etc.)
- [ ] Tone configuration (collaborative vs. assertive)
- [ ] Multi-round script (opening, first response, counter, final)
- [ ] Data-only mode (works without AI API key)

---

## Phase 4: Live Coaching

**Goal:** Real-time negotiation copilot during actual calls.

### Live Transcription
- [ ] Detect Google Meet / Zoom / phone screen
- [ ] Real-time transcription via Web Speech API
- [ ] Identify counter-party tactics ("tight budget", "we don't negotiate base")

### Dynamic Counter-Arguments
- [ ] Feed updated suggestions based on what the other person says
- [ ] Highlight when the recruiter uses a known negotiation tactic
- [ ] Suggest specific responses in real time

### Post-Negotiation Tracker
- [ ] Log what you asked for vs. what you got
- [ ] Personal negotiation dataset over time
- [ ] Aggregate anonymized outcomes for future users

---

## Phase 5: Platform

**Goal:** Multi-browser, multi-platform, backend services.

### Cross-Browser
- [ ] Firefox support (Plasmo multi-browser)
- [ ] Edge support
- [ ] Safari (WebExtension API)

### Backend Services
- [ ] API key proxy (users don't bring their own keys)
- [ ] User accounts and sync
- [ ] Crowd-sourced salary data with verification
- [ ] Salary trend tracking over time

### Mobile
- [ ] Mobile web app for salary lookups
- [ ] Share negotiation scripts via link
