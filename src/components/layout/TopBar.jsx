import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, RefreshCw, CloudOff, AlertTriangle, Clock, History, Mail, Sparkles } from 'lucide-react';
import { useSync } from '../../lib/SyncContext';
import { useTimeTrackingStore } from '../../store/useTimeTrackingStore';
import NotificationBell from '../notifications/NotificationBell';
import BugReportWidget from '../shared/BugReportWidget';
import AIAssistant from '../shared/AIAssistant';

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

  const [assistantOpen, setAssistantOpen] = useState(false);
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
      <div className="flex items-center gap-3 flex-shrink-0 no-drag">
        {/* Search bar */}
        <button
          onClick={onOpenPalette}
          className="flex items-center gap-2.5 h-10 px-4 w-[280px]
                     bg-bg-elevated/40 border border-border/60 rounded-xl text-xs text-text-muted
                     cursor-pointer hover:border-accent/40 hover:bg-bg-elevated/60 transition-all duration-200 group shadow-inner"
        >
          <Search size={14} className="group-hover:text-accent transition-colors" />
          <span className="flex-1 text-left font-medium">Search anything&hellip;</span>
          <kbd className="hidden sm:flex items-center gap-1 text-[10px] text-text-muted/60 bg-bg-surface border border-border/40 rounded-md px-1.5 py-0.5 font-sans leading-none shadow-sm">
            <span className="text-xs">&#8984;</span>F
          </kbd>
        </button>

        {/* Icon button: History */}
        <button className="w-9 h-9 rounded-xl bg-bg-surface border border-border/60 flex items-center justify-center text-text-muted hover:border-accent/40 hover:text-accent hover:shadow-sm transition-all cursor-pointer">
          <History size={16} />
        </button>

        {/* Icon button: Mail */}
        <button className="w-9 h-9 rounded-xl bg-bg-surface border border-border/60 flex items-center justify-center text-text-muted hover:border-accent/40 hover:text-accent hover:shadow-sm transition-all cursor-pointer">
          <Mail size={16} />
        </button>

        <div className="h-6 w-px bg-border/60 mx-1" />

        {/* Bug Report Widget */}
        <BugReportWidget />

        {/* Notification Bell */}
        <NotificationBell />

        {/* Active timer indicator */}
        {activeTimer && timerElapsed && (
          <button
            onClick={() => window.location.hash = '#/time'}
            className="flex items-center gap-2 h-9 px-3.5 rounded-xl border border-success/30 bg-success/5 hover:bg-success/10 transition-all cursor-pointer shadow-sm group"
            title="Timer running — click to open Time Tracking"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
            <Clock size={13} className="text-success group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold font-mono text-success">{timerElapsed}</span>
          </button>
        )}

        {/* AI Assistant Button */}
        <button
          onClick={onOpenAssistant}
          className="flex items-center gap-2 px-5 py-2 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover hover:shadow-lg hover:shadow-accent/25 transition-all active:scale-[0.97] cursor-pointer"
        >
          <Sparkles size={15} />
          <span>AI Assistant</span>
        </button>

        {/* Sync status indicator — clickable when conflicts exist */}
        {hasConflicts ? (
          <button
            onClick={onOpenConflicts}
            className="flex items-center gap-2 h-9 px-3 rounded-xl border border-danger/30 bg-danger/5 hover:bg-danger/10 transition-all cursor-pointer shadow-sm"
            title="Click to resolve sync conflicts"
          >
            <AlertTriangle size={14} className="text-danger" />
            <span className="text-xs text-danger hidden lg:inline font-bold">
              Issues ({conflicts.length})
            </span>
          </button>
        ) : (
          <div
            className={`flex items-center gap-2 h-9 px-3 rounded-xl border transition-all ${
              pendingCount > 0
                ? 'border-warning/30 bg-warning/5'
                : 'border-border/60 bg-bg-elevated/20'
            }`}
          >
            {isSyncing ? (
              <RefreshCw size={13} className="text-accent animate-spin" />
            ) : pendingCount > 0 ? (
              <CloudOff size={13} className="text-warning" />
            ) : (
              <div className="w-2 h-2 rounded-full bg-success shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
            )}

            <span className="text-[11px] font-bold text-text-muted/80 hidden lg:inline uppercase tracking-wider">
              {isSyncing
                ? 'Syncing'
                : pendingCount > 0
                  ? `${pendingCount} pending`
                  : 'Synced'}
            </span>

            {pendingCount > 0 && !isSyncing && (
              <button
                onClick={manualSync}
                className="ml-1 text-text-muted hover:text-accent transition-colors"
                title="Sync now"
              >
                <RefreshCw size={12} />
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
   </div>
        )}
      </div>
    </header>
  );
}
