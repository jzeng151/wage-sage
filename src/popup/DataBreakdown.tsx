/**
 * Salary data breakdown showing BLS median, P25, P75, and cost-of-living index.
 * The 75th percentile row is highlighted in green as the aspirational target.
 * COL index shows how much above/below the national average this area costs.
 */
interface DataBreakdownProps {
  median: number;
  p25: number;
  p75: number;
  colIndex: number;
  formatSalary: (n: number) => string;
}

export function DataBreakdown({
  median,
  p25,
  p75,
  colIndex,
  formatSalary,
}: DataBreakdownProps) {
  return (
    <div className="text-xs space-y-1.5 px-1">
      <div className="flex justify-between">
        <span className="text-slate-secondary">Median:</span>
        <span className="font-semibold text-navy">{formatSalary(median)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-slate-secondary">25th percentile:</span>
        <span className="font-semibold text-navy">{formatSalary(p25)}</span>
      </div>
      <div className="flex justify-between bg-green-50 rounded px-1 py-0.5">
        <span className="text-sage-green-dark">75th percentile:</span>
        <span className="font-semibold text-sage-green-dark">
          {formatSalary(p75)}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-slate-secondary">COL index:</span>
        <span className="font-semibold text-navy">{colIndex.toFixed(2)}x avg</span>
      </div>
    </div>
  );
}
