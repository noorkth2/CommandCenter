import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, RefreshCw, CloudOff, AlertTriangle, Clock } from 'lucide-react';
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

export default function TopBar({ onOpenPalette }) {
  const { pathname } = useLocation();
  const { pendingCount, isSyncing, conflicts, manualSync } = useSync();
  const activeTimer = useTimeTrackingStore((s) => s.activeTimer);
  const pageInfo = PAGE_TITLES[pathname] ?? { title: 'CommandCenter', subtitle: '' };
  const hasConflicts = conflicts.length > 0;

  // Running timer elapsed display
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
      {/* Page title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-semibold text-text-primary truncate leading-none">
          {pageInfo.title}
        </h1>
        {pageInfo.subtitle && (
          <p className="text-xs text-text-muted mt-0.5 truncate leading-none">
            {pageInfo.subtitle}
          </p>
        )}
      </div>

      {/* Right-side actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 no-drag">
        {/* Active timer indicator */}
        {activeTimer && timerElapsed && (
          <button
            onClick={() => window.location.hash = '#/time'}
            className="flex items-center gap-1.5 h-8 px-3 rounded border border-brand-green/30 bg-brand-green/10 hover:bg-brand-green/15 transition-colors cursor-pointer"
            title="Timer running — click to open Time Tracking"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse" />
            <Clock size={11} className="text-brand-green" />
            <span className="text-xs font-mono text-brand-green">{timerElapsed}</span>
          </button>
        )}

        {/* Notifications */}
        <NotificationBell />

        {/* Global search hint */}
        <button
          onClick={onOpenPalette}
          className="hidden lg:flex items-center gap-2 h-8 px-3
                     bg-bg-elevated border border-border rounded text-xs text-text-muted
                     cursor-pointer hover:border-border-strong transition-colors"
        >
          <Search size={12} />
          <span>Search…</span>
          <kbd className="ml-1 text-2xs opacity-50">⌘K</kbd>
        </button>

        {/* Sync status indicator */}
        <div
          className={`flex items-center gap-1.5 h-8 px-2 sm:px-3 rounded border ${hasConflicts
              ? 'border-brand-red/30 bg-brand-red/10'
              : pendingCount > 0
                ? 'border-brand-amber/30 bg-brand-amber/10'
                : 'border-border bg-bg-elevated'
            }`}
        >
          {isSyncing ? (
            <RefreshCw size={12} className="text-brand-blue animate-spin" />
          ) : hasConflicts ? (
            <AlertTriangle size={12} className="text-brand-red" />
          ) : pendingCount > 0 ? (
            <CloudOff size={12} className="text-brand-amber" />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-brand-green" />
          )}

          <span className="text-xs text-text-muted hidden sm:inline">
            {isSyncing
              ? 'Syncing…'
              : hasConflicts
                ? `${conflicts.length} conflict${conflicts.length > 1 ? 's' : ''}`
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
      </div>
    </header>
  );
}
