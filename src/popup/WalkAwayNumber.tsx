/**
 * Two-figure salary display: Cost of Living + Recommended Salary.
 *
 * Cost of Living is derived from HUD Fair Market Rent data (1BR rent).
 * Recommended Salary is the BLS median adjusted for experience level.
 * The walk-away (minimum acceptable) is shown as a highlighted badge.
 */
interface WalkAwayNumberProps {
  costOfLivingFormatted: string;
  marketSalaryFormatted: string;
  walkAwayFormatted: string;
  source: string;
}

export function WalkAwayNumber({
  costOfLivingFormatted,
  marketSalaryFormatted,
  walkAwayFormatted,
  source,
}: WalkAwayNumberProps) {
  return (
    <div className="text-center py-3 space-y-3">
      {/* Cost of Living */}
      <div>
        <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-secondary">
          Cost of Living
        </div>
        <div className="text-sm font-bold text-slate-secondary">
          {costOfLivingFormatted}
          <span className="text-[10px] font-normal text-slate-muted">/yr</span>
        </div>
        <div className="text-[10px] text-slate-muted">
          Based on 1BR rent in this area
        </div>
      </div>

      {/* Recommended Salary (hero number) */}
      <div>
        <div className="text-[10px] uppercase tracking-wider font-semibold text-sage-green-dark">
          Recommended Salary
        </div>
        <div className="text-walk-away text-navy">{marketSalaryFormatted}</div>
        <div className="text-[10px] text-slate-muted mt-1">{source}</div>
      </div>

      {/* Walk-away badge */}
      <div className="inline-block bg-green-50 text-sage-green-dark text-xs font-semibold px-3 py-1 rounded-full">
        Minimum: {walkAwayFormatted}
      </div>
    </div>
  );
}
