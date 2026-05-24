import Badge from '../ui/Badge';
import { PRIORITY_COLORS, PROJECT_PRIORITY_LABELS } from '../../lib/constants';

/**
 * Priority badge — P0/P1/P2/P3 with color.
 *
 * @param {{ priority: 'p0'|'p1'|'p2'|'p3', className?: string }} props
 */
export default function PriorityBadge({ priority, className = '' }) {
  const colorClass = PRIORITY_COLORS[priority] ?? 'bg-text-muted/10 text-text-muted border-text-muted/20';
  const label = PROJECT_PRIORITY_LABELS[priority] ?? priority?.toUpperCase();

  return (
    <Badge className={`${colorClass} ${className}`}>
      {priority?.toUpperCase()} · {label}
    </Badge>
  );
}
