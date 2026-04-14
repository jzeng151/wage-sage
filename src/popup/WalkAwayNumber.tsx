/**
 * Large (38px) walk-away number display with BLS data source citation.
 * This is the hero number the user sees first after calculation.
 */
interface WalkAwayNumberProps {
  amount: number;
  formatted: string;
  source: string;
}

export function WalkAwayNumber({ formatted, source }: WalkAwayNumberProps) {
  return (
    <div className="text-center py-3">
      <div className="text-walk-away text-navy">{formatted}</div>
      <div className="text-[10px] text-slate-muted mt-1">{source}</div>
    </div>
  );
}
