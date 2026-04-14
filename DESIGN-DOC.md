# Wage Sage Design Doc

## Problem

Salary negotiation is uncomfortable because it feels personal. Job seekers, freelancers, and employees preparing for performance reviews lack data-backed confidence and, more importantly, the actual words to say during negotiation. Existing tools (Glassdoor, Levels.fyi, PayScale) show static salary bell curves. Nobody gives you a script you can read out loud.

## Core Insight

The value is not "better salary data." The value is "here are the exact words to say." A walk-away number backed by BLS data, combined with an AI-generated negotiation script tailored to the specific role, company, and location, replaces feelings with math and hesitation with a script.

## Target Users

- **Job seekers** comparing offers or preparing for initial salary discussions
- **Employees** preparing for annual performance reviews and raise negotiations
- **Freelancers** negotiating project rates with data-backed justification

## Product Principles

1. **Script quality is everything.** The generated script must be readable as natural speech. No jargon, no robotic phrasing. The user should feel comfortable reading it verbatim.
2. **Data credibility is trust.** Every number must cite its source. "BLS OEWS data for this MSA" is not optional decoration. It is the reason the user believes the number.
3. **Speed in the moment matters.** The user might be opening the extension 5 minutes before a negotiation call. Instant cached display. No unnecessary spinners.
4. **The user is in control.** Adjustable target salary. Editable script. The tool provides a starting point, not a rigid prescription.
5. **Graceful degradation.** If DOM parsing fails, show manual entry. If BLS has no data, let the user input a number. If the AI is down, at least show the walk-away number. Never show a blank screen.

## User Flow

```
User visits LinkedIn job page
        │
        ▼
User clicks Wage Sage extension icon
        │
        ▼
┌──────────────────────────────┐
│ Popup Opens (instantly)      │
│                              │
│ ┌──────────────────────────┐ │
│ │ WageSage   [LinkedIn ●] │ │  ← Dark header, active badge
│ └──────────────────────────┘ │
│                              │
│ ┌──────────────────────────┐ │
│ │ Senior Software Engineer │ │  ← Extracted from page
│ │ Acme Corp · San Fran, CA │ │
│ └──────────────────────────┘ │
│                              │
│        $187,400              │  ← Walk-away number, 38px
│  BLS OEWS · SF MSA · 75th % │
│                              │
│ Median:         $168,200     │
│ 25th percentile: $142,500   │
│ 75th percentile: $198,600   │  ← Green highlight
│ COL index:       1.18x avg  │
│                              │
│ ┌──────────────────────────┐ │
│ │ Your Target Salary       │ │  ← Yellow, adjustable
│ │  [-]  $195,000  [+]      │ │
│ │ Adjust and regenerate    │ │
│ └──────────────────────────┘ │
│                              │
│ [ Generate Negotiation Script→] │  ← Full-width dark button
│                              │
└──────────────────────────────┘
        │
        ▼  (user clicks Generate)
┌──────────────────────────────┐
│ ┌──────────────────────────┐ │
│ │ ▶ Your Script  [Edit][Copy] │  ← Green header
│ ├──────────────────────────┤ │
│ │ OPENING                  │ │
│ │ Thank you for the offer. │ │
│ │ I'm excited about the    │ │
│ │ team...                  │ │
│ │                          │ │
│ │ DATA REFERENCE           │ │
│ │ BLS data for this role   │ │
│ │ in San Francisco MSA     │ │  ← Yellow highlighted data
│ │ shows the 75th % at      │ │
│ │ $198,600...              │ │
│ │                          │ │
│ │ THE ASK                  │ │
│ │ I'd like to propose a    │ │
│ │ base of $195,000...      │ │
│ │                          │ │
│ │ IF THEY PUSH BACK        │ │
│ │ Would it be possible to  │ │
│ │ explore total comp?...   │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

## Script Generation Design

### Prompt Structure

The Claude API receives a structured prompt with four sections:

```
SYSTEM: You are an expert salary negotiation coach. Generate a negotiation
script that a real person can read word-for-word during a salary discussion.
Be collaborative in tone, not adversarial. Cite specific BLS data points.
Structure: Opening, Data Reference, The Ask, Pushback Response.

CONTEXT:
- Role: {job title}
- Company: {company name}
- Location: {city}, {MSA name}
- BLS median for this role in this MSA: ${median}
- 25th percentile: ${p25}
- 75th percentile: ${p75}
- Cost of living index: {RPP} ({pct}% {above/below} national average)
- Walk-away number: ${walkAway}
- User's target salary: ${target}

OUTPUT FORMAT:
- Opening (1-2 sentences): Acknowledge the offer, express enthusiasm
- Data Reference (2-3 sentences): Cite specific BLS data for this MSA
- The Ask (1-2 sentences): State the specific number being proposed
- Pushback Response (2-3 sentences): If they say no, what to say next
```

### Script Quality Criteria

Every generated script must:
- Reference the specific MSA by name (not just "your area")
- Include at least one specific dollar figure from BLS data
- Be readable as natural speech (no "furthermore", "additionally", "moreover")
- Use collaborative language ("I'd like to propose" not "I demand")
- Include a specific dollar amount in "The Ask" section
- Offer a constructive alternative in "Pushback Response" (total comp, signing bonus, review cycle)

### Tone: Collaborative, Not Adversarial

The script should feel like a confident professional having a reasonable conversation, not a hostage negotiator making demands. Phrases to use:
- "I'd like to propose..."
- "Based on the data..."
- "Would it be possible to explore..."
- "I understand budget constraints..."

Phrases to avoid:
- "I deserve..."
- "I refuse to accept..."
- "That's not acceptable..."

## Visual Design

### Color Palette

| Role | Color | Hex |
|------|-------|-----|
| Header background | Deep navy | #1a1a2e |
| Primary text | Near-black | #1a1a2e |
| Accent (positive) | Green | #4ade80 |
| Data highlight | Warm yellow | #fef3c7 |
| Target adjuster background | Light yellow | #fffbeb |
| Target adjuster border | Yellow | #fde68a |
| Script header | Light green | #f0fdf4 |
| Script action buttons | Dark green | #166534 |
| Secondary text | Slate | #64748b |
| Muted text | Light slate | #94a3b8 |
| Backgrounds | Cool gray | #f8fafc |

### Typography

- Walk-away number: 38px, font-weight 800, letter-spacing -2px
- Section headers: 10px, uppercase, letter-spacing 1.5px, font-weight 600
- Body text: 12-14px, system font stack
- Numbers in data rows: font-weight 600

### Layout Principles

- Walk-away number is the single largest element on the page (38px vs 14px body text)
- Data breakdown is secondary visual weight (12px, gray)
- Target adjuster is visually distinct (yellow background) to signal interactivity
- Script output uses green accents to signal positive outcome
- Copy button is the most prominent action in the script section

### Interaction States

| Element | Default | Hover | Active/Loading | Error |
|---------|---------|-------|----------------|-------|
| Generate button | Dark bg, white text | Darker bg | Spinner + "Generating..." | Red outline, error message |
| +/- buttons | Gray border | Light gray bg | — | — |
| Target input | White bg, border | — | Border highlight on focus | Red border if invalid |
| Copy button | White bg, green text | Light green bg | — | — |
| Edit button | White bg, green border | Light green bg | Textarea mode | — |

## Settings / Options Page

Minimal. One purpose: let the user enter their Claude API key.

```
┌──────────────────────────────┐
│ Wage Sage Settings           │
│                              │
│ Claude API Key               │
│ ┌──────────────────────────┐ │
│ │ sk-ant-••••••••••••••    │ │  ← Masked by default
│ └──────────────────────────┘ │
│ [Show] [Validate]            │
│                              │
│ Your API key is stored locally│
│ and never sent to any server │
│ other than Anthropic's API.  │
│                              │
│ [Save]                       │
└──────────────────────────────┘
```

## Future Design Directions (Not v1)

These are documented here so they don't get lost, but they are explicitly out of scope for v1.

### Negotiation Simulator
An AI practice partner that plays the hiring manager. User rehearses the script before the real call. The simulator pushes back with common tactics ("we have a tight budget", "we don't negotiate base salary") and the user practices responses.

### Offer Comparison Dashboard
Side-by-side view of multiple offers. Each row is a negotiable term (salary, equity, signing bonus, PTO). Color-coded by which offer wins each category. Total comp estimate at the bottom.

### Live Coaching Mode
Real-time transcription during an actual negotiation call (Zoom/Meet). The extension listens, identifies counter-party tactics, and surfaces suggested responses on screen. The script becomes dynamic, not static.

### Tone Configuration
A toggle between "Collaborative" (default), "Direct", and "Soft" script styles. Each tone adjusts word choice, sentence structure, and the aggressiveness of "The Ask."
