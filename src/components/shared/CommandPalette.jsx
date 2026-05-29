import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  ArrowRight,
  Zap,
  CircleDot,
  FolderKanban,
  ChevronRight,
  LayoutDashboard,
  Boxes,
  Users,
  TestTube2,
  Rocket,
  BrainCircuit,
  Settings,
} from 'lucide-react';
import { useIssueStore, canTransition } from '../../store/useIssueStore';
import { useProjectStore } from '../../store/useProjectStore';
import { useSprintStore } from '../../store/useSprintStore';
import { useAutomationStore } from '../../store/useAutomationStore';
import { useAuthStore } from '../../store/useAuthStore';
import { ISSUE_STATUS_LABELS } from '../../lib/constants';

// ─── Navigation items ──────────────────────────────────────────────────────

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/products', label: 'Products', icon: Boxes },
  { path: '/clients', label: 'Clients', icon: Users },
  { path: '/projects', label: 'Projects', icon: FolderKanban },
  { path: '/issues', label: 'Issues', icon: CircleDot },
  { path: '/qa', label: 'QA Tracker', icon: TestTube2 },
  { path: '/deployments', label: 'Deployments', icon: Rocket },
  { path: '/sprints', label: 'Sprints', icon: ChevronRight },
  { path: '/automations', label: 'Automations', icon: Zap },
  { path: '/ai-reports', label: 'AI Reports', icon: BrainCircuit },
  { path: '/settings', label: 'Settings', icon: Settings },
];

const NAV_ICON = {
  '/dashboard': LayoutDashboard,
  '/products': Boxes,
  '/clients': Users,
  '/projects': FolderKanban,
  '/issues': CircleDot,
  '/qa': TestTube2,
  '/deployments': Rocket,
  '/sprints': ChevronRight,
  '/automations': Zap,
  '/ai-reports': BrainCircuit,
  '/settings': Settings,
};

// ─── Fuzzy match helper ────────────────────────────────────────────────────

function score(query, text) {
  if (!query || !text) return -1;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  if (lower === q) return 100;
  if (lower.startsWith(q)) return 80;
  if (lower.includes(q)) return 50;
  return 0;
}

function highlight(text, query) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="text-accent font-medium">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

// ─── Result item ───────────────────────────────────────────────────────────

function ResultItem({ icon: Icon, label, sublabel, active, onClick, query }) {
  return (
    <button
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
        active ? 'bg-bg-elevated' : 'hover:bg-bg-elevated'
      }`}
      onClick={onClick}
    >
      {Icon && <Icon size={15} className="text-text-muted flex-shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="text-sm text-text-primary truncate">
          {highlight(label, query)}
        </div>
        {sublabel && (
          <div className="text-2xs text-text-muted truncate mt-0.5">{sublabel}</div>
        )}
      </div>
    </button>
  );
}

// ─── Group ─────────────────────────────────────────────────────────────────

function ResultGroup({ title, children }) {
  if (!children || children.length === 0) return null;
  return (
    <div>
      <div className="px-4 py-1.5 text-2xs font-semibold text-text-muted uppercase tracking-wider bg-bg-surface/80">
        {title}
      </div>
      {children}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export default function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const loadedRef = useRef(false);

  // Store data
  const issues = useIssueStore((s) => s.issues);
  const fetchIssues = useIssueStore((s) => s.fetchIssues);
  const transitionStatus = useIssueStore((s) => s.transitionStatus);
  const projects = useProjectStore((s) => s.projects);
  const fetchProjects = useProjectStore((s) => s.fetchProjects);
  const sprints = useSprintStore((s) => s.sprints);
  const fetchSprints = useSprintStore((s) => s.fetchSprints);
  const automations = useAutomationStore((s) => s.automations);
  const fetchAutomations = useAutomationStore((s) => s.fetchAutomations);
  const manualTrigger = useAutomationStore((s) => s.manualTrigger);

  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.email && [
    'kayastha.noor1100@gmail.com',
    'niroj.mahrjan@gmail.com',
  ].includes(user.email.toLowerCase().trim());

  // Load store data on first open
  useEffect(() => {
    if (open && !loadedRef.current) {
      loadedRef.current = true;
      if (issues.length === 0) fetchIssues();
      if (projects.length === 0) fetchProjects();
      if (sprints.length === 0) fetchSprints();
      if (automations.length === 0) fetchAutomations();
    }
    if (open) {
      setQuery('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Build results
  const results = useMemo(() => {
    if (!open) return { flat: [], groups: [] };
    const groups = [];

    // Navigate
    const navResults = NAV_ITEMS
      .filter((item) => item.path !== '/settings' || isAdmin)
      .map((item) => ({ ...item, _score: score(query, item.label) }))
      .filter((item) => item._score > 0)
      .sort((a, b) => b._score - a._score)
      .map((item) => ({
        type: 'navigate',
        key: `nav:${item.path}`,
        icon: item.icon,
        label: item.label,
        sublabel: item.path,
        action: () => { navigate(item.path); onClose(); },
      }));
    if (navResults.length > 0) groups.push({ title: 'Navigate', items: navResults });

    // Projects
    const projectResults = projects
      .map((p) => ({ ...p, _score: score(query, p.name) }))
      .filter((p) => p._score > 0)
      .sort((a, b) => b._score - a._score)
      .map((p) => ({
        type: 'project',
        key: `project:${p.id}`,
        icon: FolderKanban,
        label: p.name,
        sublabel: p.status,
        action: () => { navigate('/projects'); onClose(); },
      }));
    if (projectResults.length > 0) groups.push({ title: 'Projects', items: projectResults });

    // Issues
    const issueResults = issues
      .map((i) => ({ ...i, _score: score(query, i.title) }))
      .filter((i) => i._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, 10)
      .map((i) => ({
        type: 'issue',
        key: `issue:${i.id}`,
        icon: CircleDot,
        label: i.title,
        sublabel: `${ISSUE_STATUS_LABELS[i.status] ?? i.status} · ${i.id.slice(0, 8)}`,
        action: () => { navigate('/issues'); onClose(); },
      }));
    if (issueResults.length > 0) groups.push({ title: 'Issues', items: issueResults });

    // Sprints
    const sprintResults = sprints
      .map((s) => ({ ...s, _score: score(query, s.name) }))
      .filter((s) => s._score > 0)
      .sort((a, b) => b._score - a._score)
      .map((s) => ({
        type: 'sprint',
        key: `sprint:${s.id}`,
        icon: ChevronRight,
        label: s.name,
        sublabel: s.status,
        action: () => { navigate('/sprints'); onClose(); },
      }));
    if (sprintResults.length > 0) groups.push({ title: 'Sprints', items: sprintResults });

    // Issue status transitions
    if (query.length >= 2) {
      const q = query.toLowerCase();
      const transitionItems = [];
      for (const issue of issues) {
        const nextStatuses = ['backlog', 'todo', 'in_progress', 'testing', 'uat',
          'ready_to_deploy', 'production', 'monitoring', 'done', 'cancelled'];
        for (const st of nextStatuses) {
          if (!canTransition(issue.status, st)) continue;
          const label = `→ ${ISSUE_STATUS_LABELS[st]}`;
          if (label.toLowerCase().includes(q) || issue.title.toLowerCase().includes(q)) {
            transitionItems.push({
              type: 'transition',
              key: `trans:${issue.id}:${st}`,
              icon: ArrowRight,
              label: `${issue.title} → ${ISSUE_STATUS_LABELS[st]}`,
              sublabel: `Change status`,
              action: async () => {
                await transitionStatus(issue.id, st);
                onClose();
              },
            });
          }
        }
      }
      if (transitionItems.length > 0) {
        groups.push({ title: 'Change Status', items: transitionItems.slice(0, 8) });
      }
    }

    // Automation triggers (only when query matches)
    if (query.length >= 2) {
      const autoResults = automations
        .filter((a) => a.enabled)
        .map((a) => ({ ...a, _score: score(query, a.name) }))
        .filter((a) => a._score > 0 || query.toLowerCase().includes('trigger') || query.toLowerCase().includes('run'))
        .sort((a, b) => b._score - a._score)
        .map((a) => ({
          type: 'automation',
          key: `auto:${a.id}`,
          icon: Zap,
          label: `Run: ${a.name}`,
          sublabel: a.description || a.action_type,
          action: async () => {
            try { await manualTrigger(a.id); } catch {}
            onClose();
          },
        }));
      if (autoResults.length > 0) groups.push({ title: 'Automations', items: autoResults });
    }

    // Flatten for keyboard nav
    const flat = groups.flatMap((g) => g.items);
    return { flat, groups };
  }, [query, open, issues, projects, sprints, automations, navigate, onClose, transitionStatus, manualTrigger, isAdmin]);

  // Keyboard handler — only active when palette is open
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (results.flat.length === 0) return;
      setActiveIdx((prev) => Math.min(prev + 1, results.flat.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.flat.length === 0) return;
      setActiveIdx((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (e.key === 'Enter' && results.flat[activeIdx]) {
      e.preventDefault();
      results.flat[activeIdx].action();
      return;
    }
  }, [results, activeIdx, onClose]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.querySelector(`[data-idx="${activeIdx}"]`);
    item?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Palette */}
      <div
        className="relative w-full max-w-[580px] bg-bg-surface border border-border rounded-xl shadow-2xl overflow-hidden animate-scale-in"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 h-12 border-b border-border">
          <Search size={16} className="text-text-muted flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
            placeholder="Search pages, issues, projects, sprints, or run actions…"
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none border-none"
          />
          <kbd className="text-2xs text-text-muted border border-border rounded px-1.5 py-0.5 font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[360px] overflow-y-auto divide-y divide-border/40">
          {results.flat.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Search size={24} className="text-text-muted" />
              <p className="text-sm text-text-muted">
                {query ? `No results for "${query}"` : 'Type to search…'}
              </p>
            </div>
          )}

          {results.groups.map((group, gi) => {
            let offset = 0;
            for (let i = 0; i < gi; i++) offset += results.groups[i].items.length;
            return (
              <ResultGroup key={group.title} title={group.title}>
                {group.items.map((item, ii) => {
                  const idx = offset + ii;
                  return (
                    <div key={item.key} data-idx={idx}>
                      <ResultItem
                        icon={item.icon}
                        label={item.label}
                        sublabel={item.sublabel}
                        active={activeIdx === idx}
                        query={query}
                        onClick={() => { item.action(); }}
                      />
                    </div>
                  );
                })}
              </ResultGroup>
            );
          })}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 px-4 h-8 bg-bg-elevated/50 border-t border-border">
          <span className="text-2xs text-text-muted flex items-center gap-1">
            <kbd className="text-3xs border border-border rounded px-1 py-0.5 font-mono">↑↓</kbd>
            Navigate
          </span>
          <span className="text-2xs text-text-muted flex items-center gap-1">
            <kbd className="text-3xs border border-border rounded px-1 py-0.5 font-mono">↵</kbd>
            Open
          </span>
          <span className="text-2xs text-text-muted flex items-center gap-1">
            <kbd className="text-3xs border border-border rounded px-1 py-0.5 font-mono">Esc</kbd>
            Close
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
