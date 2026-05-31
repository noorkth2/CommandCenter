import { useMemo } from 'react';
import { format, startOfDay, addDays, differenceInDays, isWithinInterval, subDays } from 'date-fns';
import PriorityBadge from '../shared/PriorityBadge';

export default function IssuesTimeline({ issues, onCardClick }) {
  const windowDays = 30;
  const endDate = startOfDay(new Date());
  const startDate = subDays(endDate, windowDays - 1);

  const timelineDays = useMemo(() => {
    return Array.from({ length: windowDays }).map((_, i) => addDays(startDate, i));
  }, [startDate, windowDays]);

  const sortedIssues = useMemo(() => {
    return [...issues].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [issues]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-bg-surface border border-border rounded-lg">
      {/* Timeline Header */}
      <div className="flex border-b border-border bg-bg-elevated sticky top-0 z-10">
        <div className="w-64 flex-shrink-0 p-3 border-r border-border font-semibold text-xs text-text-muted uppercase tracking-wider">
          Issue
        </div>
        <div className="flex-1 flex overflow-x-auto no-scrollbar">
          {timelineDays.map((day) => (
            <div
              key={day.toISOString()}
              className="flex-shrink-0 w-10 border-r border-border/50 text-center py-2 flex flex-col items-center justify-center gap-0.5"
            >
              <span className="text-[10px] text-text-muted uppercase font-medium">
                {format(day, 'EEE')}
              </span>
              <span className={`text-[11px] font-bold ${format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') ? 'text-accent' : 'text-text-primary'}`}>
                {format(day, 'd')}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline Body */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {sortedIssues.map((issue) => {
          const createdDate = startOfDay(new Date(issue.created_at));
          const completedDate = issue.completed_at ? startOfDay(new Date(issue.completed_at)) : endDate;
          
          const startOffset = Math.max(0, differenceInDays(createdDate, startDate));
          const duration = Math.max(1, differenceInDays(completedDate, createdDate) + 1);
          const visibleDuration = Math.min(duration, windowDays - startOffset);

          // If the issue was completed before our window or started after our window, skip or show partially
          const isVisible = (createdDate <= endDate && completedDate >= startDate);

          if (!isVisible) return null;

          return (
            <div key={issue.id} className="flex border-b border-border/50 hover:bg-bg-elevated/30 transition-colors group">
              <div className="w-64 flex-shrink-0 p-3 border-r border-border flex flex-col gap-1 cursor-pointer" onClick={() => onCardClick(issue)}>
                <p className="text-xs font-medium text-text-primary truncate" title={issue.title}>
                  {issue.title}
                </p>
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={issue.priority} />
                  <span className="text-[10px] text-text-muted">{issue.status.replace('_', ' ')}</span>
                </div>
              </div>
              <div className="flex-1 relative h-12 flex items-center overflow-x-hidden">
                {/* Background grid */}
                <div className="absolute inset-0 flex">
                  {timelineDays.map((day) => (
                    <div key={day.toISOString()} className="flex-shrink-0 w-10 border-r border-border/20 h-full" />
                  ))}
                </div>
                
                {/* Duration Bar */}
                <div
                  className={`absolute h-6 rounded-full flex items-center px-3 text-[10px] font-semibold text-white shadow-sm transition-transform group-hover:scale-[1.01] ${
                    issue.status === 'done' ? 'bg-success/60' : 
                    issue.status === 'in_progress' ? 'bg-accent/60' : 
                    'bg-text-muted/40'
                  }`}
                  style={{
                    left: `${startOffset * 40}px`,
                    width: `${visibleDuration * 40}px`,
                    minWidth: '24px'
                  }}
                  onClick={() => onCardClick(issue)}
                >
                  <span className="truncate">{issue.status === 'done' ? 'Completed' : 'Active'}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
