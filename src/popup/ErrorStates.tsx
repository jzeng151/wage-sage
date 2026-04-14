/**
 * Error display with type-specific recovery actions.
 *
 * API key errors (ai_missing_key, ai_invalid_key) show a link to the options page.
 * All other errors show the message and optional retry button.
 * HTTP status codes are never exposed to the user.
 */
import type { WageSageError } from "../types";

interface ErrorDisplayProps {
  error: WageSageError;
  onRetry?: () => void;
}

export function ErrorDisplay({ error, onRetry }: ErrorDisplayProps) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
      <div className="text-sm text-red-800 mb-1">{error.message}</div>
      {error.recoveryAction && (
        <div className="text-xs text-red-600 mb-2">{error.recoveryAction}</div>
      )}
      {error.recoverable && onRetry && (
        <button
          onClick={onRetry}
          className="text-xs bg-red-100 text-red-800 rounded px-3 py-1 hover:bg-red-200"
        >
          Retry
        </button>
      )}
      {error.type === "ai_missing_key" && (
        <a
          href={chrome.runtime.getURL("options.html")}
          target="_blank"
          className="text-xs text-blue-600 underline block mt-2"
        >
          Open Settings to add your API key
        </a>
      )}
      {error.type === "ai_invalid_key" && (
        <a
          href={chrome.runtime.getURL("options.html")}
          target="_blank"
          className="text-xs text-blue-600 underline block mt-2"
        >
          Update your API key in Settings
        </a>
      )}
    </div>
  );
}
