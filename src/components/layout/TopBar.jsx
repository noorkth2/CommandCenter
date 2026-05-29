import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, RefreshCw, CloudOff, AlertTriangle, Clock, History, Mail, Sparkles } from 'lucide-react';
import { useSync } from '../../lib/SyncContext';
import { useTimeTrackingStore } from '../../store/useTimeTrackingStore';
import NotificationBell from '../notifications/NotificationBell';

const PAGE_TITLES = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Overview of your PM operations' },
  '/board': { title: 'Sprint Board', subtitle: 'Drag-and-drop sprint management' },
  '/projects': { title: 'Projects', subtitle: 'Manage your active development projects' },
  '/issues': { title: 'Issues', subtitle: 'Track bugs, tasks, and feature requests' },
  '/qa': { title: 'QA Tracker', subtitle: 'Quality assurance and test management' },
  '/deployments': { title: 'Deployments', subtitle: 'Track and manage deployments across environments' },
  '/sprints': { title: 'Sprints', subtitle: 'Sprint planning and progress tracking' },
  '/automations': { title: 'Automations', subtitle: 'Rule-based workflow automation' },
  '/ai-reports': { title: 'AI Reports', subtitle: 'AI-generated RCAs, summaries, and notes' },
  '/import': { title: 'Import', subtitle: 'Migrate from backups, CSV, or Jira' },
  '/time': { title: 'Time Tracking', subtitle: 'Per-issue timer and weekly timesheet' },
  '/settings': { title: 'Settings', subtitle: 'Configure integrations and preferences' },
};

export default function TopBar({ onOpenPalette, onOpenConflicts }) {
  const { pathname } = useLocation();
  const { pendingCount, isSyncing, conflicts, manualSync } = useSync();
  const activeTimer = useTimeTrackingStore((s) => s.activeTimer);
  const pageInfo = PAGE_TITLES[pathname] ?? { title: 'CommandCenter', subtitle: '' };
  const hasConflicts = conflicts.length > 0;

  const [timerElapsed, setTimerElapsed] = useState('');
  useEffect(() => {
    if (!activeTimer) { setTimerElapsed(''); return; }
    const tick = () => {
      const diff = Date.now() - new Date(activeTimer.started_at).getTime();
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimerElapsed(m > 0 ? `${m}m ${s}s` : `${s}s`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeTimer]);

  return (
    <header className="topbar px-6 gap-4">
      {/* Page title + subtitle (stacked) */}
      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-semibold text-text-primary truncate leading-none">
          {pageInfo.title}
        </h1>
        {pageInfo.subtitle && (
          <p className="text-xs text-text-muted mt-0.5 truncate leading-none">
            {pageInfo.subtitle}
          </p>
        )}
      </div>

      {/* Right-side actions */}
      <div className="flex items-center gap-2 flex-shrink-0 no-drag">
        {/* Search bar */}
        <button
          onClick={onOpenPalette}
          className="flex items-center gap-2 h-8 px-3 w-[240px]
                     bg-bg-surface border border-border rounded text-xs text-text-muted
                     cursor-pointer hover:border-border-hover transition-colors"
        >
          <Search size={14} className="text-text-muted" />
          <span className="flex-1 text-left">Search&hellip;</span>
          <kbd className="text-2xs text-text-muted/50 border border-border rounded px-1 py-px font-sans leading-none">
            &#8984;F
          </kbd>
        </button>

        {/* Icon button: History */}
        <button className="w-[34px] h-[34px] rounded-full bg-bg-surface border border-border flex items-center justify-center text-text-muted hover:border-accent hover:text-text-primary transition-colors cursor-pointer">
          <History size={16} />
        </button>

        {/* Icon button: Mail */}
        <button className="w-[34px] h-[34px] rounded-full bg-bg-surface border border-border flex items-center justify-center text-text-muted hover:border-accent hover:text-text-primary transition-colors cursor-pointer">
          <Mail size={16} />
        </button>

        {/* Notification Bell */}
        <NotificationBell />

        {/* Active timer indicator */}
        {activeTimer && timerElapsed && (
          <button
            onClick={() => window.location.hash = '#/time'}
            className="flex items-center gap-1.5 h-8 px-3 rounded border border-success/30 bg-success/10 hover:bg-success/15 transition-colors cursor-pointer"
            title="Timer running — click to open Time Tracking"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <Clock size={11} className="text-success" />
            <span className="text-xs font-mono text-success">{timerElapsed}</span>
          </button>
        )}

        {/* AI Assistant Button */}
        <button className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors cursor-pointer">
          <Sparkles size={14} />
          AI Assistant
        </button>

        {/* Sync status indicator — clickable when conflicts exist */}
        {hasConflicts ? (
          <button
            onClick={onOpenConflicts}
            className="flex items-center gap-1.5 h-8 px-2.5 rounded border border-danger/30 bg-danger/10 hover:bg-danger/20 transition-colors cursor-pointer"
            title="Click to resolve sync conflicts"
          >
            <AlertTriangle size={12} className="text-danger" />
            <span className="text-xs text-danger hidden sm:inline font-medium">
              Sync Issues ({conflicts.length})
            </span>
          </button>
        ) : (
          <div
            className={`flex items-center gap-1.5 h-8 px-2.5 rounded border ${
              pendingCount > 0
                ? 'border-warning/30 bg-warning/10'
                : 'border-border bg-bg-surface'
            }`}
          >
            {isSyncing ? (
              <RefreshCw size={12} className="text-accent animate-spin" />
            ) : pendingCount > 0 ? (
              <CloudOff size={12} className="text-warning" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
            )}

            <span className="text-xs text-text-muted hidden sm:inline">
              {isSyncing
                ? 'Syncing…'
                : pendingCount > 0
                  ? `${pendingCount} pending`
                  : 'Synced'}
            </span>

            {pendingCount > 0 && !isSyncing && (
              <button
                onClick={manualSync}
                className="ml-0.5 text-text-muted hover:text-text-primary transition-colors"
                title="Sync now"
              >
                <RefreshCw size={11} />
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
