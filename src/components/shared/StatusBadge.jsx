import Badge from '../ui/Badge';
import {
  STATUS_COLORS,
  ISSUE_STATUS_LABELS,
  PROJECT_STATUS_LABELS,
  QA_STATUS_LABELS,
  DEPLOYMENT_STATUS_LABELS,
  SPRINT_STATUS_LABELS,
} from '../../lib/constants';

const ALL_STATUS_LABELS = {
  ...ISSUE_STATUS_LABELS,
  ...PROJECT_STATUS_LABELS,
  ...QA_STATUS_LABELS,
  ...DEPLOYMENT_STATUS_LABELS,
  ...SPRINT_STATUS_LABELS,
};

/**
 * Status badge — looks up color and label from constants.
 *
 * @param {{ status: string, className?: string }} props
 */
export default function StatusBadge({ status, className = '' }) {
  const colorClass = STATUS_COLORS[status] ?? 'bg-text-muted/10 text-text-muted border-text-muted/20';
  const label = ALL_STATUS_LABELS[status] ?? status;

  return (
    <Badge className={`${colorClass} ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70 flex-shrink-0" />
      {label}
    </Badge>
  );
}
