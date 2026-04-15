/**
 * Main popup component.
 *
 * Implements a 7-state machine: LOADING → NO_DATA → CALCULATED → SCRIPT_GENERATING → SCRIPT_READY → ERROR
 *
 * On mount, reads cached JobData from chrome.storage.local (validated via validateJobDataFromStorage),
 * then runs the full pipeline: SOC mapping → location normalization → BLS + COL fetch → walk-away calculation.
 *
 * Script generation is sent as a message to the background service worker (not done in-popup)
 * so the AI call survives the popup closing. Results are cached before response.
 */
import { useState, useEffect } from "react";
import "./style.css";
import type {
  JobData,
  WalkAwayResult,
  GeneratedScript,
  WageSageError,
  BLSData,
  COLData,
  ExperienceBracket,
  MessageType,
} from "./types";
import { mapTitleToSOC } from "./core/soc-mapping";
import { normalizeLocation } from "./core/location-normalizer";
import { fetchCOLData } from "./services/col-service";
import { calculateWalkAway, formatSalary } from "./core/walkaway";
import { validateJobDataFromStorage, validateSalary, sanitizeString, MAX_TITLE_LENGTH, MAX_COMPANY_LENGTH, MAX_LOCATION_LENGTH } from "./core/validation";
import { JobCard } from "./popup/JobCard";
import { WalkAwayNumber } from "./popup/WalkAwayNumber";
import { DataBreakdown } from "./popup/DataBreakdown";
import { TargetAdjuster } from "./popup/TargetAdjuster";
import { ScriptOutput } from "./popup/ScriptOutput";
import { ErrorDisplay } from "./popup/ErrorStates";
import { ManualEntry } from "./popup/ManualEntry";

type PopupState =
  | "LOADING"
  | "NO_DATA"
  | "CALCULATED"
  | "SCRIPT_GENERATING"
  | "SCRIPT_READY"
  | "ERROR";

export default function Popup() {
  const [state, setState] = useState<PopupState>("LOADING");
  const [jobData, setJobData] = useState<JobData | null>(null);
  const [walkAwayResult, setWalkAwayResult] = useState<WalkAwayResult | null>(null);
  const [blsData, setBlsData] = useState<BLSData | null>(null);
  const [colData, setColData] = useState<COLData | null>(null);
  const [targetSalary, setTargetSalary] = useState<number>(0);
  const [script, setScript] = useState<GeneratedScript | null>(null);
  const [error, setError] = useState<WageSageError | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [bracket, setBracket] = useState<ExperienceBracket>("mid");

  // Load cached job data on mount, or extract directly from the content script
  useEffect(() => {
    async function load() {
      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (!tab?.id) {
          setState("NO_DATA");
          return;
        }

        // First try reading from cache
        const storageResult = await chrome.storage.local.get(`job_${tab.id}`);
        const raw = storageResult[`job_${tab.id}`];
        let cached = validateJobDataFromStorage(raw);

        // If no cached data, ask the content script to extract right now.
        // This handles the case where the content script hasn't run yet
        // or its auto-extraction timing missed.
        if (!cached) {
          try {
            const extractedData = await chrome.tabs.sendMessage(tab.id, {
              type: "EXTRACT_JOB_DATA",
            });
            cached = validateJobDataFromStorage(extractedData);
          } catch {
            // Content script not injected on this page, or not a LinkedIn tab
          }
        }

        if (!cached) {
          setState("NO_DATA");
          return;
        }

        setJobData(cached);
        await processData(cached);
      } catch {
        setState("NO_DATA");
      }
    }

    load();
  }, []);

  /**
   * Run the full data pipeline: SOC mapping → location → BLS + COL → walk-away.
   * Any failure in the pipeline transitions to ERROR state with a specific error type.
   */
  async function processData(jobDataInput: JobData) {
    const socResult = mapTitleToSOC(jobDataInput.title);
    if (!socResult) {
      setError({
        type: "soc_no_match",
        message: `Could not match "${jobDataInput.title}" to a BLS occupation.`,
        recoverable: true,
        recoveryAction: "Try entering the job title manually.",
      });
      setState("ERROR");
      return;
    }

    // Normalize location
    const locationResult = normalizeLocation(jobDataInput.location);
    if (!locationResult) {
      setError({
        type: "location_no_match",
        message: `Could not recognize location "${jobDataInput.location}".`,
        recoverable: true,
        recoveryAction: "Try entering a US city and state.",
      });
      setState("ERROR");
      return;
    }

    // Fetch BLS via background (avoids CORS) and COL data in parallel
    const stateCode = locationResult.state || "";
    const [blsResult, colResult] = await Promise.all([
      chrome.runtime.sendMessage({
        type: "FETCH_BLS_DATA",
        payload: { socCode: socResult.socCode, stateCode },
      }),
      fetchCOLData(locationResult.msaCode),
    ]);

    if (blsResult.success === false) {
      setError(blsResult.error);
      setState("ERROR");
      return;
    }

    if (colResult.success === false) {
      setError(colResult.error);
      setState("ERROR");
      return;
    }

    const bls = blsResult.data;
    const col = colResult.data;
    setBlsData(bls);
    setColData(col);

    // Calculate walk-away
    const walkAwayCalculation = calculateWalkAway(bls, col, bracket);
    setWalkAwayResult(walkAwayCalculation);
    setTargetSalary(walkAwayCalculation.target);
    setState("CALCULATED");
  }

  function handleTargetChange(newTarget: number) {
    const clamped = validateSalary(newTarget);
    if (clamped !== null) {
      setTargetSalary(clamped);
    }
  }

  /**
   * Send script generation request to the background service worker.
   * The service worker handles the AI call so it survives popup close.
   */
  async function handleGenerateScript() {
    if (!jobData || !blsData || !colData || !walkAwayResult) return;

    setState("SCRIPT_GENERATING");
    setIsEditing(false);

    const message: MessageType = {
      type: "GENERATE_SCRIPT",
      payload: {
        jobData,
        blsData,
        colData,
        walkAwayResult,
        targetSalary,
      },
    };

    try {
      const response = await chrome.runtime.sendMessage(message);

      if (response?.success) {
        setScript(response.script);
        setState("SCRIPT_READY");
      } else if (response?.error) {
        setError(response.error);
        setState("ERROR");
      }
    } catch {
      setError({
        type: "ai_malformed",
        message: "Failed to communicate with the extension service worker.",
        recoverable: true,
        recoveryAction: "Try again.",
      });
      setState("ERROR");
    }
  }

  function handleManualSubmit(manualInput: JobData) {
    // Sanitize manual input
    const sanitized: JobData = {
      title: sanitizeString(manualInput.title, MAX_TITLE_LENGTH),
      company: sanitizeString(manualInput.company, MAX_COMPANY_LENGTH),
      location: sanitizeString(manualInput.location, MAX_LOCATION_LENGTH),
      source: "manual",
      extractedAt: Date.now(),
    };
    if (!sanitized.title || !sanitized.company || !sanitized.location) return;
    setJobData(sanitized);
    processData(sanitized);
  }

  function handleEditScript(updatedScript: GeneratedScript) {
    setScript(updatedScript);
    setIsEditing(false);
  }

  function handleRetry() {
    if (jobData) {
      processData(jobData);
    } else {
      setState("NO_DATA");
    }
  }

  function handleBracketChange(newBracket: ExperienceBracket) {
    setBracket(newBracket);
    if (blsData && colData) {
      const result = calculateWalkAway(blsData, colData, newBracket);
      setWalkAwayResult(result);
      setTargetSalary(result.target);
    }
  }

  return (
    <div className="w-[400px] min-h-[300px] bg-white">
      {/* Header */}
      <div className="bg-navy text-white px-4 py-3 rounded-t-xl">
        <div className="flex items-center justify-between">
          <span className="font-bold text-sm">WageSage</span>
          {jobData?.source === "linkedin" && (
            <span className="text-[10px] bg-sage-green text-navy px-2 py-0.5 rounded-full font-semibold">
              LinkedIn detected
            </span>
          )}
          {jobData?.source === "indeed" && (
            <span className="text-[10px] bg-sage-green text-navy px-2 py-0.5 rounded-full font-semibold">
              Indeed detected
            </span>
          )}
        </div>
      </div>

      <div className="px-4 py-3">
        {state === "LOADING" && (
          <div className="text-center py-8 text-slate-muted text-sm">
            Loading...
          </div>
        )}

        {state === "NO_DATA" && (
          <ManualEntry onSubmit={handleManualSubmit} />
        )}

        {state === "ERROR" && error && (
          <div>
            <ManualEntry onSubmit={handleManualSubmit} />
            <div className="mt-3">
              <ErrorDisplay error={error} onRetry={handleRetry} />
            </div>
          </div>
        )}

        {state !== "LOADING" &&
          state !== "NO_DATA" &&
          state !== "ERROR" &&
          jobData && (
            <>
              <JobCard
                title={jobData.title}
                company={jobData.company}
                location={jobData.location}
              />

              {/* Experience bracket selector */}
              <div className="flex gap-1 mb-3">
                {(["entry", "mid", "senior"] as ExperienceBracket[]).map((bracketOption) => (
                  <button
                    key={bracketOption}
                    onClick={() => handleBracketChange(bracketOption)}
                    className={`text-[10px] px-2 py-1 rounded font-semibold ${
                      bracket === bracketOption
                        ? "bg-navy text-white"
                        : "bg-gray-100 text-slate-secondary hover:bg-gray-200"
                    }`}
                  >
                    {bracketOption === "entry" ? "0-2 yr" : bracketOption === "mid" ? "3-7 yr" : "8+ yr"}
                  </button>
                ))}
              </div>

              {walkAwayResult && (
                <>
                  <WalkAwayNumber
                    costOfLivingFormatted={formatSalary(walkAwayResult.costOfLiving)}
                    marketSalaryFormatted={formatSalary(walkAwayResult.marketSalary)}
                    walkAwayFormatted={formatSalary(walkAwayResult.walkAway)}
                    source={`BLS OEWS · ${blsData?.msaName || "this MSA"}`}
                  />

                  <DataBreakdown
                    median={walkAwayResult.median}
                    p25={walkAwayResult.p25}
                    p75={walkAwayResult.p75}
                    colIndex={walkAwayResult.colIndex}
                    monthlyRent={colData?.monthlyRent || 0}
                    formatSalary={formatSalary}
                  />

                  <TargetAdjuster
                    target={targetSalary}
                    formatted={formatSalary(targetSalary)}
                    onTargetChange={handleTargetChange}
                    onRegenerate={handleGenerateScript}
                    isGenerating={state === "SCRIPT_GENERATING"}
                  />
                </>
              )}

              {state === "CALCULATED" && (
                <button
                  onClick={handleGenerateScript}
                  className="w-full bg-navy text-white text-sm font-semibold py-2.5 rounded-lg hover:opacity-90 mt-2"
                >
                  Generate Negotiation Script →
                </button>
              )}

              {state === "SCRIPT_GENERATING" && (
                <div className="w-full bg-navy text-white text-sm font-semibold py-2.5 rounded-lg mt-2 text-center opacity-70">
                  Generating script...
                </div>
              )}

              {state === "SCRIPT_READY" && script && (
                <div className="mt-3">
                  <ScriptOutput
                    script={script}
                    onEdit={handleEditScript}
                    isEditing={isEditing}
                  />
                </div>
              )}
            </>
          )}
      </div>
    </div>
  );
}
