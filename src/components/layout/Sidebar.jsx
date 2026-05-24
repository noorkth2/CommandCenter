import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Boxes,
  Users,
  FolderKanban,
  CircleDot,
  TestTube2,
  Rocket,
  Zap,
  BrainCircuit,
  Settings,
  ChevronRight,
  Terminal,
} from 'lucide-react';

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
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      {/* Logo / Brand */}
      <div className={`flex items-center gap-3 py-4 border-b border-border flex-shrink-0 drag-region select-none ${
        window.electron?.platform === 'darwin' ? 'pl-[76px] pr-4' : 'px-4'
      }`}>
        <div className="w-8 h-8 rounded-lg bg-brand-blue/20 border border-brand-blue/30 flex items-center justify-center flex-shrink-0">
          <Terminal size={15} className="text-brand-blue" />
        </div>
        <div>
          <span className="text-sm font-semibold text-text-primary tracking-tight">
            CommandCenter
          </span>
          <p className="text-2xs text-text-muted leading-none mt-0.5">DevOps Hub</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `nav-item group ${isActive ? 'active' : ''}`
            }
          >
            <Icon size={16} className="flex-shrink-0" />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom: Settings */}
      <div className="px-2 pb-3 border-t border-border pt-3 flex-shrink-0">
        <NavLink
          to="/settings"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <Settings size={16} className="flex-shrink-0" />
          <span>Settings</span>
        </NavLink>
        <div className="mt-3 mx-1 px-3 py-2.5 rounded-lg bg-bg-elevated border border-border">
          <p className="text-2xs text-text-muted">Version 1.0.0</p>
          <p className="text-2xs text-text-muted mt-0.5">
            {import.meta.env.VITE_APP_NAME ?? 'CommandCenter'}
          </p>
        </div>
      </div>
    </aside>
  );
}
