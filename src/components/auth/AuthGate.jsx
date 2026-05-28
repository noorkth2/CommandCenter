/**
 * AuthGate.jsx
 * Guards direct children. Enforced by session state existence.
 * Email allowlist checks are securely handled on the Electron main process
 * before access tokens are returned to the V8 renderer process.
 */

import { Navigate } from 'react-router-dom';
import { useSession } from './SessionProvider';

export default function AuthGate({ children }) {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-neutral-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          <span className="text-xs text-white/30 tracking-widest uppercase">Loading Workspace</span>
        </div>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  return children;
}

