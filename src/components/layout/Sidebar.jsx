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
  LogOut,
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useToast } from '../ui/Toast';
import Logo from '../shared/Logo';


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
  const { user, logout } = useAuthStore();
  const toast = useToast();

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
      {/* Logo / Brand */}
      <div className={`flex items-center gap-3 py-4 border-b border-border flex-shrink-0 drag-region select-none ${
        window.electron?.platform === 'darwin' ? 'pl-[76px] pr-4' : 'px-4'
      }`}>
        <Logo className="w-8 h-8 flex-shrink-0" />
        <div>
          <span className="text-sm font-semibold text-text-primary tracking-tight">
            CommandCenter
          </span>
          <p className="text-2xs text-text-muted leading-none mt-0.5">PM Hub</p>
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

      {/* Bottom: Settings & User Profile */}
      <div className="px-2 pb-3 border-t border-border pt-3 flex-shrink-0 space-y-1">
        <NavLink
          to="/settings"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <Settings size={16} className="flex-shrink-0 text-text-muted" />
          <span>Settings</span>
        </NavLink>

        {user && (
          <div className="mt-2 mx-1 p-2 rounded-lg bg-bg-elevated/40 border border-border/60 flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              {user.user_metadata?.avatar_url ? (
                <img
                  src={user.user_metadata.avatar_url}
                  alt={user.user_metadata.full_name || 'User'}
                  className="w-7 h-7 rounded-full border border-border-strong flex-shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-brand-blue/10 border border-brand-blue/30 flex items-center justify-center text-xs font-semibold text-brand-blue flex-shrink-0">
                  {user.email?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
              <div className="min-w-0 leading-tight">
                <p className="text-2xs font-medium text-text-primary truncate">
                  {user.user_metadata?.full_name || 'Authorized User'}
                </p>
                <p className="text-3xs text-text-muted truncate mt-0.5">
                  {user.email}
                </p>
              </div>
            </div>
            
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 rounded text-text-muted hover:text-brand-red hover:bg-brand-red/10 transition-colors cursor-pointer flex-shrink-0"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}

        <div className="mx-1 px-3 py-2 rounded-lg bg-bg-elevated/20 border border-border/40 mt-1">
          <div className="flex justify-between items-center text-3xs text-text-muted">
            <span>Version {import.meta.env.VITE_APP_VERSION || '1.0.0'}</span>
            <span className="opacity-80 font-mono">
              {import.meta.env.VITE_APP_NAME ?? 'CommandCenter'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
