/**
 * Options page for API key management.
 *
 * The Claude API key is stored in chrome.storage.local and only accessed by
 * the background service worker. This page provides:
 * - Masked input with show/hide toggle
 * - Validate button that makes a test API call (1 token)
 * - Save with confirmation feedback
 *
 * Privacy: the key is never sent anywhere except Anthropic's API directly.
 */
import { useState, useEffect } from "react";
import "./style.css";

export default function Options() {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<
    "success" | "error" | null
  >(null);

  useEffect(() => {
    chrome.storage.local.get("claude_api_key", (result) => {
      if (result.claude_api_key) {
        setApiKey(result.claude_api_key);
      }
    });
  }, []);

  function handleSave() {
    chrome.storage.local.set({ claude_api_key: apiKey }, () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  async function handleValidate() {
    if (!apiKey.trim()) return;
    setValidating(true);
    setValidationResult(null);

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
      });

      setValidationResult(response.ok ? "success" : "error");
    } catch {
      setValidationResult("error");
    } finally {
      setValidating(false);
    }
  }

  return (
    <div className="min-h-screen bg-cool-gray p-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-xl font-bold text-navy mb-6">Wage Sage Settings</h1>

        <div className="mb-4">
          <label className="block text-sm font-semibold text-navy mb-2">
            Claude API Key
          </label>
          <div className="flex gap-2">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-sage-green"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="text-xs bg-gray-100 px-3 py-2 rounded hover:bg-gray-200 text-slate-secondary"
            >
              {showKey ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={handleValidate}
            disabled={validating || !apiKey.trim()}
            className="text-sm border border-sage-green-dark text-sage-green-dark px-4 py-2 rounded hover:bg-green-50 disabled:opacity-50"
          >
            {validating ? "Validating..." : "Validate"}
          </button>
          <button
            onClick={handleSave}
            className="text-sm bg-navy text-white px-4 py-2 rounded hover:opacity-90"
          >
            {saved ? "Saved!" : "Save"}
          </button>
        </div>

        {validationResult === "success" && (
          <div className="text-sm text-green-700 mb-4">
            API key is valid!
          </div>
        )}
        {validationResult === "error" && (
          <div className="text-sm text-red-700 mb-4">
            Invalid API key. Please check and try again.
          </div>
        )}

        <div className="text-xs text-slate-muted border-t border-gray-100 pt-4">
          Your API key is stored locally and never sent to any server other than
          Anthropic's API.
        </div>
      </div>
    </div>
  );
}
