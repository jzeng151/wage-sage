/**
 * Displays extracted job title, company, and location.
 * Shows a LinkedIn badge when data was auto-detected from the page.
 */
interface JobCardProps {
  title: string;
  company: string;
  location: string;
}

export function JobCard({ title, company, location }: JobCardProps) {
  return (
    <div className="bg-cool-gray rounded-lg p-3 mb-3">
      <div className="text-sm font-semibold text-navy">{title}</div>
      <div className="text-xs text-slate-secondary">
        {company} · {location}
      </div>
    </div>
  );
}
