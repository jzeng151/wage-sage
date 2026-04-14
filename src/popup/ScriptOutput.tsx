/**
 * Four-section negotiation script display.
 *
 * Sections: Opening, Data Reference (warm yellow highlight), The Ask, Pushback Response.
 * Edit mode converts to a raw textarea and re-parses sections by header on save.
 * Copy button writes the full script text to clipboard.
 *
 * The edit parser uses the same regex patterns as parseScriptResponse() in script-generator.ts.
 */
import { useState } from "react";
import type { GeneratedScript } from "../types";

interface ScriptOutputProps {
  script: GeneratedScript;
  onEdit: (updatedScript: GeneratedScript) => void;
  isEditing: boolean;
}

export function ScriptOutput({ script, onEdit, isEditing }: ScriptOutputProps) {
  const [editText, setEditText] = useState("");

  function handleEditStart() {
    const full = [
      "OPENING\n" + script.opening,
      "DATA REFERENCE\n" + script.dataReference,
      "THE ASK\n" + script.theAsk,
      "PUSHBACK RESPONSE\n" + script.pushbackResponse,
    ].join("\n\n");
    setEditText(full);
  }

  function handleEditSave() {
    // Simple parse: split by section headers
    const openingMatch = editText.match(
      /OPENING\s*\n([\s\S]*?)(?=\n\s*(?:DATA REFERENCE|THE ASK|PUSHBACK)|$)/i
    );
    const dataMatch = editText.match(
      /DATA REFERENCE\s*\n([\s\S]*?)(?=\n\s*(?:THE ASK|PUSHBACK)|$)/i
    );
    const askMatch = editText.match(
      /THE ASK\s*\n([\s\S]*?)(?=\n\s*(?:PUSHBACK|IF THEY)|$)/i
    );
    const pushbackMatch = editText.match(
      /(?:PUSHBACK RESPONSE|PUSHBACK|IF THEY PUSH BACK)\s*\n([\s\S]*?)$/i
    );

    onEdit({
      opening: openingMatch?.[1]?.trim() || script.opening,
      dataReference: dataMatch?.[1]?.trim() || script.dataReference,
      theAsk: askMatch?.[1]?.trim() || script.theAsk,
      pushbackResponse: pushbackMatch?.[1]?.trim() || script.pushbackResponse,
      generatedAt: script.generatedAt,
    });
  }

  function handleCopy() {
    const full = [
      script.opening,
      script.dataReference,
      script.theAsk,
      script.pushbackResponse,
    ].join("\n\n");
    navigator.clipboard.writeText(full);
  }

  return (
    <div className="rounded-lg overflow-hidden border border-green-200">
      <div className="bg-script-header px-3 py-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-sage-green-dark uppercase tracking-wider">
          Your Script
        </span>
        <div className="flex gap-2">
          {isEditing ? (
            <button
              onClick={handleEditSave}
              className="text-xs text-sage-green-dark border border-sage-green-dark rounded px-2 py-0.5 hover:bg-green-100"
            >
              Save
            </button>
          ) : (
            <button
              onClick={handleEditStart}
              className="text-xs text-sage-green-dark border border-sage-green-dark rounded px-2 py-0.5 hover:bg-green-100"
            >
              Edit
            </button>
          )}
          <button
            onClick={handleCopy}
            className="text-xs text-white bg-sage-green-dark rounded px-2 py-0.5 hover:bg-green-800"
          >
            Copy
          </button>
        </div>
      </div>
      {isEditing ? (
        <textarea
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          className="w-full h-64 p-3 text-xs text-navy resize-none focus:outline-none font-mono"
        />
      ) : (
        <div className="p-3 text-xs text-navy space-y-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-secondary mb-1">
              Opening
            </div>
            <div className="whitespace-pre-wrap">{script.opening}</div>
          </div>
          <div className="bg-warm-yellow rounded p-2">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-secondary mb-1">
              Data Reference
            </div>
            <div className="whitespace-pre-wrap">{script.dataReference}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-secondary mb-1">
              The Ask
            </div>
            <div className="whitespace-pre-wrap font-semibold">
              {script.theAsk}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-secondary mb-1">
              Pushback Response
            </div>
            <div className="whitespace-pre-wrap">{script.pushbackResponse}</div>
          </div>
        </div>
      )}
    </div>
  );
}
