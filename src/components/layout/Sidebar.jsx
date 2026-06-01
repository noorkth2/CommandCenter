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

  const [version, setVersion] = useState('2.2.5');

  useEffect(() => {
    if (window.electron?.app?.version) {
      window.electron.app.version().then(setVersion).catch(() => {});
    }
  }, []);

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
      {window.electron?.platform === 'darwin' ? (
        <div className="flex flex-col items-center gap-2 pt-14 pb-6 px-4 flex-shrink-0 drag-region select-none w-full">
          <Logo className="w-10 h-10 flex-shrink-0" />
          <div className="text-center">
            <span className="text-sm font-bold text-text-primary tracking-tight leading-none block whitespace-nowrap">
              CommandCenter
            </span>
            <p className="text-[10px] text-text-muted font-medium leading-none mt-1.5 uppercase tracking-tighter">
              PM Hub <span className="text-[9px] font-semibold text-accent/80 lowercase ml-1">v{version}</span>
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 py-6 px-5 flex-shrink-0 drag-region select-none">
          <Logo className="w-7 h-7 flex-shrink-0" />
          <div className="min-w-0">
            <span className="text-xs font-bold text-text-primary tracking-tight leading-none block whitespace-nowrap">
              CommandCenter
            </span>
            <p className="text-[10px] text-text-muted font-medium leading-none mt-1 uppercase tracking-tighter">
              PM Hub <span className="text-[9px] font-semibold text-accent/80 lowercase ml-1">v{version}</span>
            </p>
          </div>
        </div>
      )}
 
      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-6">
        {NAV_SECTIONS.map((section) => {
          if (section.label === 'SETTINGS' && !isAdmin) return null;
          return (
            <div key={section.label}>
              <p className="text-[10px] font-bold text-text-muted/60 uppercase tracking-[0.15em] px-3 pb-2.5 select-none">
                {section.label}
              </p>
              <div className="space-y-1">
                {section.items.map(({ path, label, icon: Icon }) => (
                  <NavLink
                    key={path}
                    to={path}
                    className={({ isActive }) =>
                      `nav-item ${isActive ? 'active' : ''}`
                    }
                  >
                    <Icon size={18} className="flex-shrink-0" />
                    <span className="truncate">{label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-3 pb-4 pt-3 flex-shrink-0 space-y-3 border-t border-border">
        {/* Theme Switcher Segmented Control */}
        <div className="grid grid-cols-2 p-1 rounded-xl bg-bg-elevated/40 border border-border/40 gap-1 mx-1 shadow-inner">
          <button
            onClick={() => setTheme(false)}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all duration-300 cursor-pointer ${
              !darkMode
                ? 'bg-bg-surface text-text-primary shadow-sm ring-1 ring-border/20'
                : 'text-text-muted hover:text-text-secondary hover:bg-bg-elevated/30'
            }`}
          >
            <Sun size={14} className="flex-shrink-0" />
            <span>Light</span>
          </button>
          <button
            onClick={() => setTheme(true)}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all duration-300 cursor-pointer ${
              darkMode
                ? 'bg-bg-surface text-text-primary shadow-sm ring-1 ring-border/20'
                : 'text-text-muted hover:text-text-secondary hover:bg-bg-elevated/30'
            }`}
          >
            <Moon size={14} className="flex-shrink-0" />
            <span>Dark</span>
          </button>
        </div>

        {/* User profile */}
        {user && (
          <div className="px-3 py-3 rounded-xl bg-bg-elevated/20 border border-border/10 flex items-center gap-3 min-w-0 transition-all hover:bg-bg-elevated/40">
            {user.user_metadata?.avatar_url ? (
              <img
                src={user.user_metadata.avatar_url}
                alt={user.user_metadata.full_name || 'User'}
                className="w-8 h-8 rounded-lg border border-border/40 flex-shrink-0 object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-xs font-bold text-accent flex-shrink-0">
                {user.email?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <div className="min-w-0 leading-tight flex-1">
              <p className="text-xs font-semibold text-text-primary truncate">
                {user.user_metadata?.full_name || 'Authorized User'}
              </p>
              <p className="text-[10px] text-text-muted font-medium truncate mt-0.5">
                {user.email}
              </p>
            </div>
          </div>
        )}

        {/* Sign Out */}
        {user && (
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 rounded-xl w-full h-10 text-xs font-medium text-text-muted hover:text-danger hover:bg-danger/5 transition-all duration-200"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        )}
      </div>
    </aside>
  );
}
