import { SEVERITY_COLORS, ISSUE_SEVERITY_LABELS } from '../../lib/constants';

export default function SeverityBadge({ severity }) {
  const colorClass = SEVERITY_COLORS[severity] || SEVERITY_COLORS.medium;
  const label = ISSUE_SEVERITY_LABELS[severity] || severity;

  return (
    <span className={`badge border text-xs font-medium px-2 py-0.5 rounded-full ${colorClass}`}>
      {label}
    </span>
  );
}
