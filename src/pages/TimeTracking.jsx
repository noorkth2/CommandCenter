import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Square,
  Trash2,
  Plus,
  Download,
  Clock,
  Timer,
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, parseISO } from 'date-fns';

import { useTimeTrackingStore } from '../store/useTimeTrackingStore';
import { useIssueStore } from '../store/useIssueStore';
import { useToast } from '../components/ui/Toast';
import Button from '../components/ui/Button';
import Dialog from '../components/ui/Dialog';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import TimerControl from '../components/timetracking/TimerControl';

function formatDuration(minutes) {
  if (!minutes) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function TimeTracking() {
  const toast = useToast();
  const navigate = useNavigate();

  const { entries, activeTimer, fetchEntries, deleteEntry, logManual } = useTimeTrackingStore();
  const { issues, fetch: fetchIssues } = useIssueStore();

  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [logOpen, setLogOpen] = useState(false);
  const [logIssue, setLogIssue] = useState('');
  const [logMinutes, setLogMinutes] = useState('');
  const [logDesc, setLogDesc] = useState('');
  const [logDate, setLogDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [logging, setLogging] = useState(false);
  const [activeElapsed, setActiveElapsed] = useState('');

  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: currentWeekStart, end: weekEnd });

  useEffect(() => {
    fetchEntries({
      start_date: format(currentWeekStart, 'yyyy-MM-dd'),
      end_date: format(weekEnd, 'yyyy-MM-dd'),
    });
    fetchIssues();
  }, [currentWeekStart]);

  // Active timer elapsed counter
  useEffect(() => {
    if (!activeTimer) { setActiveElapsed(''); return; }
    const tick = () => {
      const diff = Date.now() - new Date(activeTimer.started_at).getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setActiveElapsed(h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeTimer]);

  // Group entries by day
  const entriesByDay = useMemo(() => {
    const map = {};
    days.forEach((d) => {
      const key = format(d, 'yyyy-MM-dd');
      map[key] = { date: d, entries: [], totalMinutes: 0 };
    });
    entries.forEach((e) => {
      if (map[e.date]) {
        map[e.date].entries.push(e);
        map[e.date].totalMinutes += e.duration_minutes || 0;
      }
    });
    return Object.values(map);
  }, [entries, days]);

  const weekTotalMinutes = useMemo(
    () => entries.reduce((s, e) => s + (e.duration_minutes || 0), 0),
    [entries]
  );

  const prevWeek = () => setCurrentWeekStart((w) => subWeeks(w, 1));
  const nextWeek = () => setCurrentWeekStart((w) => addWeeks(w, 1));
  const thisWeek = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const handleLog = async () => {
    if (!logIssue || !logMinutes) { toast.error('Issue and duration are required.'); return; }
    const mins = parseInt(logMinutes, 10);
    if (!mins || mins < 1) { toast.error('Duration must be at least 1 minute.'); return; }

    setLogging(true);
    try {
      await logManual({
        issue_id: logIssue,
        duration_minutes: mins,
        date: logDate,
        description: logDesc || null,
      });
      toast.success('Time logged');
      setLogOpen(false);
      setLogIssue('');
      setLogMinutes('');
      setLogDesc('');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLogging(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteEntry(id);
      toast.success('Entry deleted');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleExport = () => {
    const header = 'Date,Issue,Description,Duration (minutes),Duration (hours)\n';
    const rows = entries
      .sort((a, b) => a.date?.localeCompare(b.date) || 0)
      .map((e) => {
        const issueName = e.issues?.title || 'Unknown';
        const desc = (e.description || '').replace(/,/g, ';');
        return `${e.date},${issueName},${desc},${e.duration_minutes || 0},${((e.duration_minutes || 0) / 60).toFixed(2)}`;
      })
      .join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timesheet_${format(currentWeekStart, 'yyyyMMdd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Timesheet exported');
  };

  return (
    <div className="animate-fade-in space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-title">Time Tracking</h2>
          <p className="section-subtitle">Track time per issue — weekly view</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleExport}>
            <Download size={13} /> Export CSV
          </Button>
          <Button variant="primary" size="sm" onClick={() => setLogOpen(true)}>
            <Plus size={13} /> Log Time
          </Button>
        </div>
      </div>

      {/* Active Timer Bar */}
      {activeTimer && (
        <div className="card p-4 border-brand-green/30 bg-brand-green/[0.04]">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-2 h-2 rounded-full bg-brand-green animate-pulse flex-shrink-0" />
              <div className="min-w-0">
                <span className="text-sm font-medium text-text-primary truncate block">
                  {activeTimer.issues?.title || 'Timer running'}
                </span>
                <span className="text-xs text-text-muted font-mono">{activeElapsed}</span>
              </div>
            </div>
            <TimerControl
              issueId={activeTimer.issue_id}
              issueTitle={activeTimer.issues?.title || ''}
            />
          </div>
        </div>
      )}

      {/* Week Navigation */}
      <div className="card px-4 py-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button onClick={prevWeek} className="btn-icon w-7 h-7 cursor-pointer" title="Previous week">
              <ChevronLeft size={14} />
            </button>
            <span className="text-sm font-semibold text-text-primary min-w-[200px] text-center select-none">
              {format(currentWeekStart, 'MMM d')} — {format(weekEnd, 'MMM d, yyyy')}
            </span>
            <button onClick={nextWeek} className="btn-icon w-7 h-7 cursor-pointer" title="Next week">
              <ChevronRight size={14} />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={thisWeek}>This Week</Button>
            <div className="h-5 w-px bg-border" />
            <span className="text-xs text-text-muted font-mono">
              {formatDuration(weekTotalMinutes)} total
            </span>
          </div>
        </div>
      </div>

      {/* Day Columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-2">
        {entriesByDay.map(({ date, entries: dayEntries, totalMinutes }) => {
          const dayStr = format(date, 'EEE');
          const dateStr = format(date, 'MMM d');
          const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
          return (
            <div
              key={date.toISOString()}
              className={`card p-3 space-y-2 ${isToday ? 'ring-1 ring-brand-blue/30' : ''} hover:shadow-sm transition-shadow`}
            >
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div>
                  <span className="text-xs font-semibold text-text-primary">{dayStr}</span>
                  <span className="text-2xs text-text-muted ml-1">{dateStr}</span>
                </div>
                {totalMinutes > 0 && (
                  <span className="text-2xs font-mono text-text-muted">{formatDuration(totalMinutes)}</span>
                )}
                {isToday && <span className="text-2xs text-brand-blue font-medium">Today</span>}
              </div>

              <div className="space-y-1.5 min-h-[80px] max-h-[300px] overflow-y-auto">
                {dayEntries.length === 0 ? (
                  <p className="text-2xs text-text-muted text-center py-4">No entries</p>
                ) : (
                  dayEntries.map((e) => (
                    <div
                      key={e.id}
                      className="p-2 rounded bg-bg-elevated border border-border group"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0 flex-1">
                          <button
                            onClick={() => navigate(`/issues`)}
                            className="text-2xs text-text-primary font-medium truncate block hover:text-brand-blue transition-colors cursor-pointer"
                          >
                            {e.issues?.title || 'Unknown issue'}
                          </button>
                          {e.description && (
                            <p className="text-2xs text-text-muted truncate mt-0.5">{e.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="text-2xs font-mono text-text-secondary">{formatDuration(e.duration_minutes)}</span>
                          <button
                            onClick={() => handleDelete(e.id)}
                            className="p-0.5 rounded text-text-muted opacity-0 group-hover:opacity-100 hover:text-brand-red transition-all cursor-pointer"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Manual Log Dialog */}
      <Dialog open={logOpen} onClose={() => setLogOpen(false)} title="Log Time Manually">
        <div className="space-y-4">
          <Select
            label="Issue"
            placeholder="Select an issue"
            value={logIssue}
            onChange={(e) => setLogIssue(e.target.value)}
            options={issues.map((i) => ({ value: i.id, label: i.title }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Duration (minutes)"
              type="number"
              min="1"
              placeholder="30"
              value={logMinutes}
              onChange={(e) => setLogMinutes(e.target.value)}
            />
            <Input
              label="Date"
              type="date"
              value={logDate}
              onChange={(e) => setLogDate(e.target.value)}
            />
          </div>
          <Input
            label="Description (optional)"
            placeholder="What did you work on?"
            value={logDesc}
            onChange={(e) => setLogDesc(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setLogOpen(false)}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleLog} loading={logging}>
              <Clock size={13} /> Log Time
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
