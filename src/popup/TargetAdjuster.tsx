/**
 * Target salary adjuster with +/- $5K buttons and inline edit.
 *
 * The editable input only accepts digits (inputMode="numeric", strips non-digits in real time).
 * validateSalary() clamps to the $5M max on submit.
 * Clicking the salary number enters edit mode; Enter or blur saves.
 * "Adjust and regenerate script" re-sends the generation request with the new target.
 */
import { useState } from "react";
import { formatSalary } from "../core/walkaway";
import { validateSalary, MAX_SALARY } from "../core/validation";

interface TargetAdjusterProps {
  target: number;
  formatted: string;
  onTargetChange: (newTarget: number) => void;
  onRegenerate: () => void;
  isGenerating: boolean;
}

export function TargetAdjuster({
  target,
  onTargetChange,
  onRegenerate,
  isGenerating,
}: TargetAdjusterProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const STEP = 5000;

  function adjust(delta: number) {
    const adjustedTarget = target + delta;
    if (adjustedTarget > 0 && adjustedTarget <= MAX_SALARY) {
      onTargetChange(adjustedTarget);
    }
  }

  function handleEditSubmit() {
    // Only allow digits
    const digitsOnly = editValue.replace(/\D/g, "");
    const parsed = parseInt(digitsOnly, 10);
    const validated = validateSalary(parsed);
    if (validated !== null) {
      onTargetChange(validated);
    }
    setIsEditing(false);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Strip non-digit characters in real time
    const value = e.target.value.replace(/\D/g, "");
    setEditValue(value);
  }

  return (
    <div className="bg-target-bg border border-target-border rounded-lg p-3 mb-3">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-secondary mb-2">
        Your Target Salary
      </div>
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => adjust(-STEP)}
          className="w-8 h-8 rounded border border-gray-300 text-lg font-bold text-slate-secondary hover:bg-gray-100"
        >
          −
        </button>
        {isEditing ? (
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={editValue}
            onChange={handleInputChange}
            onBlur={handleEditSubmit}
            onKeyDown={(e) => e.key === "Enter" && handleEditSubmit()}
            className="text-lg font-bold text-navy text-center w-32 border border-target-border rounded px-2 py-1"
            autoFocus
          />
        ) : (
          <button
            onClick={() => {
              setEditValue(target.toString());
              setIsEditing(true);
            }}
            className="text-lg font-bold text-navy hover:underline"
          >
            {formatSalary(target)}
          </button>
        )}
        <button
          onClick={() => adjust(STEP)}
          className="w-8 h-8 rounded border border-gray-300 text-lg font-bold text-slate-secondary hover:bg-gray-100"
        >
          +
        </button>
      </div>
      <div className="text-center mt-2">
        <button
          onClick={onRegenerate}
          disabled={isGenerating}
          className="text-xs text-sage-green-dark hover:underline disabled:opacity-50"
        >
          {isGenerating ? "Regenerating..." : "Adjust and regenerate script"}
        </button>
      </div>
    </div>
  );
}
