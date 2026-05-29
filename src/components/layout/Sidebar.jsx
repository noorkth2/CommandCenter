import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Kanban,
  Package,
  Users,
  FolderOpen,
  CircleDot,
  FlaskConical,
  Rocket,
  Zap,
  Bot,
  Sparkles,
  Upload,
  Clock,
  Settings,
  LogOut,
  Moon,
  Sun,
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useToast } from '../ui/Toast';
import Logo from '../shared/Logo';

const NAV_SECTIONS = [
  {
    label: 'GENERAL',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/board', label: 'Board', icon: Kanban },
    ],
  },
  {
    label: 'TOOLS/RESOURCES',
    items: [
      { path: '/products', label: 'Products', icon: Package },
      { path: '/clients', label: 'Clients', icon: Users },
      { path: '/projects', label: 'Projects', icon: FolderOpen },
      { path: '/issues', label: 'Issues', icon: CircleDot },
      { path: '/qa', label: 'QA Tracker', icon: FlaskConical },
      { path: '/deployments', label: 'Deployments', icon: Rocket },
      { path: '/sprints', label: 'Sprints', icon: Zap },
      { path: '/automations', label: 'Automations', icon: Bot },
      { path: '/ai-reports', label: 'AI Reports', icon: Sparkles },
      { path: '/import', label: 'Import', icon: Upload },
      { path: '/time', label: 'Time Tracking', icon: Clock },
    ],
  },
  {
    label: 'SETTINGS',
    items: [
      { path: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

const ADMIN_EMAILS = [
  'kayastha.noor1100@gmail.com',
  'niroj.mahrjan@gmail.com',
];

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const toast = useToast();
  const isAdmin = user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase().trim());

  const [darkMode, setDarkMode] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('theme');
      if (stored === 'light') return false;
      if (stored === 'dark') return true;
    }
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return true;
  });

  const setTheme = (isDark) => {
    setDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Signed out successfully.');
    } catch (err) {
      toast.error(err.message || 'Logout failed.');
    }
  };

  return (
    <aside className="sidebar">
      {/* Logo / Brand — compact */}
      {window.electron?.platform === 'darwin' ? (
        <div className="flex flex-col items-center gap-1.5 py-4 px-4 flex-shrink-0 drag-region select-none" style={{ paddingLeft: '76px', paddingRight: '16px' }}>
          <Logo className="w-6 h-6 flex-shrink-0" />
          <div className="text-center">
            <span className="text-xs font-semibold text-text-primary tracking-tight leading-none block whitespace-nowrap">
              CommandCenter
            </span>
            <p className="text-3xs text-text-muted leading-none mt-0.5">PM Hub</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 py-3 px-4 flex-shrink-0 drag-region select-none">
          <Logo className="w-6 h-6 flex-shrink-0" />
          <div className="min-w-0">
            <span className="text-xs font-semibold text-text-primary tracking-tight leading-none block whitespace-nowrap">
              CommandCenter
            </span>
            <p className="text-3xs text-text-muted leading-none mt-0.5">PM Hub</p>
          </div>
        </div>
      )}
 
      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {NAV_SECTIONS.map((section) => {
          if (section.label === 'SETTINGS' && !isAdmin) return null;
          return (
            <div key={section.label}>
            <p className="text-2xs font-medium text-text-muted uppercase tracking-widest px-3 pb-1.5 select-none">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map(({ path, label, icon: Icon }) => (
                <NavLink
                  key={path}
                  to={path}
                  className={({ isActive }) =>
                    `nav-item ${isActive ? 'active' : ''}`
                  }
                >
                  <Icon size={16} className="flex-shrink-0" />
                  <span className="truncate">{label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="px-2 pb-3 pt-2 flex-shrink-0 space-y-2 border-t border-border">
        {/* Theme Switcher Segmented Control */}
        <div className="grid grid-cols-2 p-1 rounded-lg bg-bg-elevated/50 border border-border/60 gap-1 mx-1">
          <button
            onClick={() => setTheme(false)}
            className={`flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer ${
              !darkMode
                ? 'bg-bg-surface text-text-primary shadow-sm border border-border/20'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <Sun size={14} className="flex-shrink-0" />
            <span>Light</span>
          </button>
          <button
            onClick={() => setTheme(true)}
            className={`flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer ${
              darkMode
                ? 'bg-bg-surface text-text-primary shadow-sm border border-border/20'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <Moon size={14} className="flex-shrink-0" />
            <span>Dark</span>
          </button>
        </div>

        {/* User profile */}
        {user && (
          <div className="px-3 py-2.5 rounded-lg bg-bg-elevated/30 flex items-center gap-2.5 min-w-0">
            {user.user_metadata?.avatar_url ? (
              <img
                src={user.user_metadata.avatar_url}
                alt={user.user_metadata.full_name || 'User'}
                className="w-7 h-7 rounded-full border border-border flex-shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center text-xs font-semibold text-accent flex-shrink-0">
                {user.email?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <div className="min-w-0 leading-tight flex-1">
              <p className="text-xs font-medium text-text-primary truncate">
                {user.user_metadata?.full_name || 'Authorized User'}
              </p>
              <p className="text-2xs text-text-muted truncate mt-px">
                {user.email}
              </p>
            </div>
          </div>
        )}

        {/* Sign Out */}
        {user && (
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 rounded-lg w-full h-8 text-xs text-text-muted hover:text-danger hover:bg-danger/5 transition-colors duration-150"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        )}
      </div>
    </aside>
  );
}
