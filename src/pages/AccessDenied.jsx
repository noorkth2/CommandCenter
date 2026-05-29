import { useAuthStore } from '../store/useAuthStore';
import { ShieldAlert, LogOut } from 'lucide-react';
import { useToast } from '../components/ui/Toast';

export default function AccessDenied() {
  const { user, logout, loading } = useAuthStore();
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
    <div className="relative min-h-screen w-full flex items-center justify-center bg-bg-base overflow-hidden select-none">
      {/* Background glow effects */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-danger/5 blur-[150px] pointer-events-none animate-pulse duration-[6000ms]" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-warning/5 blur-[150px] pointer-events-none animate-pulse duration-[8000ms]" />

      <div className="w-full max-w-[420px] px-6 z-10 animate-scale-in">
        <div className="relative bg-bg-surface/60 backdrop-blur-xl border border-danger/20 rounded-2xl p-8 md:p-10 text-center">
          
          {/* Warning Icon */}
          <div className="mx-auto w-14 h-14 rounded-full bg-danger/10 flex items-center justify-center mb-6 border border-danger/30 shadow-lg shadow-danger/5 animate-pulse">
            <ShieldAlert className="text-danger" size={26} />
          </div>

          {/* Heading */}
          <h1 className="text-lg font-bold text-text-primary mb-2">Access Denied</h1>
          <p className="text-xs text-text-secondary mb-6 leading-relaxed">
            Your account is not authorized to access this CommandCenter workspace.
          </p>

          {/* Info Card */}
          <div className="bg-bg-elevated/40 border border-border rounded-lg p-4 mb-8 text-left">
            <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-1">
              Logged in as:
            </div>
            <div className="text-xs font-mono text-text-primary break-all">
              {user?.email || 'Unknown User'}
            </div>
          </div>

          {/* Sign Out Button */}
          <button
            disabled={loading}
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-xs font-semibold
              bg-danger/10 hover:bg-danger/20 border border-danger/30 text-danger
              transition-all duration-200 cursor-pointer shadow-sm active:scale-[0.98]
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-danger/30 border-t-danger rounded-full animate-spin" />
            ) : (
              <LogOut size={14} />
            )}
            <span>Sign Out & Try Another Account</span>
          </button>
        </div>
      </div>
    </div>
  );
}
