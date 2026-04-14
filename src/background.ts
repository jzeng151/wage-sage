/**
 * Background service worker.
 *
 * Handles message routing between the popup and services. Key security rule:
 * the Claude API key is read from chrome.storage.local ONLY here, never passed
 * through messages. This isolates the key from the content script and popup.
 *
 * Messages handled:
 * - CACHE_JOB_DATA: content script sends extracted job data, background caches by sender tab ID
 * - GENERATE_SCRIPT: validates payload, reads API key, calls script-generator, responds
 * - GET_CACHED_SCRIPT: looks up cached script by SOC code + MSA code + target
 *
 * Payloads are validated with validateScriptRequestPayload() before processing
 * to guard against malformed or malicious messages.
 */
import type {
  MessageType,
  GeneratedScript,
  WageSageError,
  ScriptRequest,
  JobData,
  BLSData,
} from "./types";
import { generateScript } from "./services/script-generator";
import { fetchBLSData } from "./services/bls-service";
import { validateScriptRequestPayload, validateJobDataFromStorage } from "./core/validation";

/**
 * Get the Claude API key from storage.
 * Only the service worker reads the key directly.
 * The popup never handles the key.
 */
async function getApiKey(): Promise<string> {
  try {
    const storageResult = await chrome.storage.local.get("claude_api_key");
    const storedKey = storageResult.claude_api_key;
    if (typeof storedKey !== "string") return "";
    return storedKey;
  } catch {
    return "";
  }
}

/**
 * Handle extension install/update lifecycle.
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.storage.local.set({
      claude_api_key: "",
    });
  }
});

/**
 * Listen for messages from popup and content scripts.
 * Validates payloads before processing.
 * API key is never passed via messages.
 */
chrome.runtime.onMessage.addListener(
  (
    message: MessageType,
    sender: chrome.runtime.MessageSender,
    sendResponse: (
      response:
        | { success: true; script: GeneratedScript }
        | { success: false; error: WageSageError }
        | { success: true; data: GeneratedScript | null }
        | { success: true; data: BLSData }
        | { success: false; error: WageSageError }
        | { success: true }
    ) => void
  ) => {
    if (message.type === "CACHE_JOB_DATA") {
      handleCacheJobData(message.payload as JobData, sender);
      sendResponse({ success: true });
      return false;
    }

    if (message.type === "FETCH_BLS_DATA") {
      const fetchPayload = message.payload as { socCode: string; stateCode: string };
      if (
        typeof fetchPayload?.socCode !== "string" ||
        !/^\d{2}-\d{4}$/.test(fetchPayload.socCode) ||
        typeof fetchPayload?.stateCode !== "string" ||
        fetchPayload.stateCode.length !== 2
      ) {
        sendResponse({
          success: false,
          error: { type: "bls_no_data", message: "Invalid BLS request.", recoverable: true, recoveryAction: "Try again." },
        });
        return false;
      }
      handleFetchBLSData(fetchPayload.socCode, fetchPayload.stateCode, sendResponse);
      return true;
    }

    if (message.type === "GENERATE_SCRIPT") {
      // Validate payload before processing
      if (!validateScriptRequestPayload(message.payload)) {
        sendResponse({
          success: false,
          error: {
            type: "ai_malformed",
            message: "Invalid request payload.",
            recoverable: true,
            recoveryAction: "Try again.",
          },
        });
        return false;
      }
      handleGenerateScript(message.payload as ScriptRequest, sendResponse);
      return true;
    }

    if (message.type === "GET_CACHED_SCRIPT") {
      const payload = message.payload as { socCode: string; msaCode: string; target: number };
      // Validate payload
      if (
        typeof payload?.socCode !== "string" ||
        !/^\d{2}-\d{4}$/.test(payload.socCode) ||
        typeof payload?.msaCode !== "string" ||
        !/^\d{5}$/.test(payload.msaCode) ||
        typeof payload?.target !== "number" ||
        !Number.isFinite(payload.target)
      ) {
        sendResponse({ success: true, data: null });
        return false;
      }
      handleGetCachedScript(payload, sendResponse);
      return true;
    }

    // Unknown message type
    return false;
  }
);

/**
 * Handle FETCH_BLS_DATA message from popup.
 * The BLS API blocks CORS from extension origins, so the fetch must
 * happen in the background service worker which is not subject to CORS.
 */
async function handleFetchBLSData(
  socCode: string,
  stateCode: string,
  sendResponse: (
    response: { success: true; data: BLSData } | { success: false; error: WageSageError }
  ) => void
): Promise<void> {
  const result = await fetchBLSData(socCode, stateCode);
  sendResponse(result);
}

/**
 * Handle CACHE_JOB_DATA message from content script.
 * Validates the extracted data, then caches under the sender's tab ID
 * so the popup can look it up by tab ID.
 */
function handleCacheJobData(
  payload: JobData,
  sender: chrome.runtime.MessageSender,
): void {
  const validated = validateJobDataFromStorage(payload);
  if (!validated) return;

  const tabId = sender.tab?.id;
  if (!tabId) return;

  const cacheKey = `job_${tabId}`;
  const dataToCache: JobData = { ...validated, tabId };
  chrome.storage.local.set({ [cacheKey]: dataToCache }).catch(() => {
    // Storage write failure is non-fatal
  });
}

/**
 * Handle GENERATE_SCRIPT message.
 * API key is retrieved from storage inside the service worker.
 * Never passed through messages.
 */
async function handleGenerateScript(
  request: ScriptRequest,
  sendResponse: (
    response:
      | { success: true; script: GeneratedScript }
      | { success: false; error: WageSageError }
  ) => void
): Promise<void> {
  const apiKey = await getApiKey();
  const scriptResult = await generateScript(request, apiKey);
  sendResponse(scriptResult);
}

/**
 * Handle GET_CACHED_SCRIPT message.
 */
async function handleGetCachedScript(
  payload: { socCode: string; msaCode: string; target: number },
  sendResponse: (response: { success: true; data: GeneratedScript | null }) => void
): Promise<void> {
  const cacheKey = `script_${payload.socCode}_${payload.msaCode}_${payload.target}`;
  try {
    const storageResult = await chrome.storage.local.get(cacheKey);
    const cachedScript = storageResult[cacheKey];
    if (cachedScript?.data && typeof cachedScript.data === "object") {
      sendResponse({ success: true, data: cachedScript.data });
    } else {
      sendResponse({ success: true, data: null });
    }
  } catch {
    sendResponse({ success: true, data: null });
  }
}
