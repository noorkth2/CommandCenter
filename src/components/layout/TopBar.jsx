import { useLocation } from 'react-router-dom';
import { Bell, Search } from 'lucide-react';
import Button from '../ui/Button';

const PAGE_TITLES = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Overview of your DevOps operations' },
  '/projects': { title: 'Projects', subtitle: 'Manage your active development projects' },
  '/issues': { title: 'Issues', subtitle: 'Track bugs, tasks, and feature requests' },
  '/qa': { title: 'QA Tracker', subtitle: 'Quality assurance and test management' },
  '/deployments': { title: 'Deployments', subtitle: 'Track and manage deployments across environments' },
  '/sprints': { title: 'Sprints', subtitle: 'Sprint planning and progress tracking' },
  '/automations': { title: 'Automations', subtitle: 'Rule-based workflow automation' },
  '/ai-reports': { title: 'AI Reports', subtitle: 'AI-generated RCAs, summaries, and notes' },
  '/settings': { title: 'Settings', subtitle: 'Configure integrations and preferences' },
};

export default function TopBar() {
  const { pathname } = useLocation();
  const pageInfo = PAGE_TITLES[pathname] ?? { title: 'CommandCenter', subtitle: '' };

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
      <div className="flex items-center gap-2 flex-shrink-0 no-drag">
        {/* Global search hint */}
        <div
          className="hidden sm:flex items-center gap-2 h-8 px-3
                     bg-bg-elevated border border-border rounded text-xs text-text-muted
                     cursor-pointer hover:border-border-strong transition-colors"
        >
          <Search size={12} />
          <span>Search…</span>
          <kbd className="ml-1 text-2xs opacity-50">⌘K</kbd>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-1.5 h-8 px-3 rounded border border-border bg-bg-elevated">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse" />
          <span className="text-xs text-text-muted">Live</span>
        </div>
      </div>
    </header>
  );
}
