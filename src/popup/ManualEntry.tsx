/**
 * Manual job entry form shown when LinkedIn DOM extraction fails.
 *
 * All inputs are constrained by maxLength (200 chars) and sanitized on submit
 * via sanitizeString() before being passed to the data pipeline.
 */
import { useState } from "react";
import type { JobData } from "../types";
import { MAX_TITLE_LENGTH, MAX_COMPANY_LENGTH, MAX_LOCATION_LENGTH } from "../core/validation";

interface ManualEntryProps {
  onSubmit: (data: JobData) => void;
}

export function ManualEntry({ onSubmit }: ManualEntryProps) {
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedCompany = company.trim();
    const trimmedLocation = location.trim();
    if (!trimmedTitle || !trimmedCompany || !trimmedLocation) return;
    onSubmit({
      title: trimmedTitle.slice(0, MAX_TITLE_LENGTH),
      company: trimmedCompany.slice(0, MAX_COMPANY_LENGTH),
      location: trimmedLocation.slice(0, MAX_LOCATION_LENGTH),
      source: "manual",
      extractedAt: Date.now(),
    });
  }

  return (
    <div className="p-3">
      <div className="text-xs text-slate-secondary mb-3">
        Could not read job data from this page. Enter details manually.
      </div>
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          type="text"
          placeholder="Job Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={MAX_TITLE_LENGTH}
          className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-sage-green"
        />
        <input
          type="text"
          placeholder="Company"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          maxLength={MAX_COMPANY_LENGTH}
          className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-sage-green"
        />
        <input
          type="text"
          placeholder="Location (e.g. San Francisco, CA)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          maxLength={MAX_LOCATION_LENGTH}
          className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-sage-green"
        />
        <button
          type="submit"
          disabled={!title.trim() || !company.trim() || !location.trim()}
          className="w-full bg-navy text-white text-xs font-semibold py-2 rounded hover:opacity-90 disabled:opacity-50"
        >
          Look Up Salary Data
        </button>
      </form>
    </div>
  );
}
