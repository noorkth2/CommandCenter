import { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useToast } from '../components/ui/Toast';
import { LogIn } from 'lucide-react';
import Logo from '../components/shared/Logo';
import { Navigate } from 'react-router-dom';

export default function Login() {
  const { loginWithGoogle, loading, session } = useAuthStore();
  const [localLoading, setLocalLoading] = useState(false);
  const toast = useToast();

  if (session) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = async () => {
    setLocalLoading(true);
    try {
      await loginWithGoogle();
      toast.success('Login successful!');
    } catch (err) {
      toast.error(err.message || 'Login failed. Please try again.');
    } finally {
      setLocalLoading(false);
    }
  };

  const isLoggingIn = loading || localLoading;

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-bg-base overflow-hidden select-none">
      {/* Background glow effects */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-brand-blue/10 blur-[150px] pointer-events-none animate-pulse duration-[6000ms]" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-brand-purple/10 blur-[150px] pointer-events-none animate-pulse duration-[8000ms]" />

      {/* Grid lines styling overlay */}
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.15) 1px, transparent 0)',
          backgroundSize: '24px 24px'
        }}
      />

      {/* Center login card */}
      <div className="w-full max-w-[420px] px-6 z-10">
        <div className="relative bg-bg-surface/60 backdrop-blur-xl border border-border-strong rounded-2xl shadow-overlay p-8 md:p-10 text-center animate-scale-in">
          {/* Logo badge */}
          <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-tr from-brand-blue to-brand-purple p-[1px] shadow-lg shadow-brand-blue/20 flex items-center justify-center mb-6">
            <div className="w-full h-full bg-bg-surface rounded-[11px] flex items-center justify-center">
              <Logo className="w-6 h-6" />
            </div>
          </div>

          {/* Heading */}
          <h1 className="text-xl font-bold tracking-tight mb-2">
            <span className="bg-gradient-to-r from-text-primary via-brand-blue to-brand-purple bg-clip-text text-transparent">
              CommandCenter
            </span>
          </h1>
          <p className="text-xs text-text-secondary mb-8 max-w-[280px] mx-auto leading-relaxed">
            The premium desktop PM hub. Access is restricted to authorized email accounts.
          </p>

          {/* Login Button */}
          <button
            disabled={isLoggingIn}
            onClick={handleLogin}
            className={`
              w-full flex items-center justify-center gap-3 px-5 py-3 rounded-lg text-xs font-semibold
              border border-border-strong bg-bg-surface hover:bg-bg-hover hover:border-text-muted
              transition-all duration-200 cursor-pointer shadow-sm active:scale-[0.98]
              disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
              relative overflow-hidden group
            `}
          >
            {/* Hover light sweep effect */}
            <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-[-25deg] translate-x-[-150%] group-hover:translate-x-[250%] transition-transform duration-[1200ms] ease-out" />

            {isLoggingIn ? (
              <div className="w-4 h-4 border-2 border-text-muted border-t-brand-blue rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.68 1.54 14.98 1 12 1 7.35 1 3.37 3.67 1.39 7.56l3.85 2.99c.92-2.75 3.5-4.51 6.76-4.51z"
                />
                <path
                  fill="#4285F4"
                  d="M23.49 12.27c0-.81-.07-1.59-.2-2.34H12v4.44h6.44c-.28 1.48-1.11 2.73-2.37 3.58l3.68 2.85c2.15-1.98 3.38-4.9 3.38-8.53z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.24 14.55c-.24-.72-.38-1.5-.38-2.3s.14-1.58.38-2.3L1.39 6.96C.5 8.74 0 10.74 0 12.8s.5 4.06 1.39 5.84l3.85-2.99z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.68-2.85c-1.02.68-2.33 1.09-3.96 1.09-3.26 0-5.84-1.76-6.76-4.51L1.39 16.8C3.37 20.69 7.35 23 12 23z"
                />
              </svg>
            )}

            <span>{isLoggingIn ? 'Connecting...' : 'Sign in with Google'}</span>
          </button>
        </div>

        {/* Footer info */}
        <p className="text-[10px] text-text-muted text-center mt-6 tracking-wide uppercase">
          Build v1.2.0 • Secured via Supabase
        </p>
      </div>
    </div>
  );
}
