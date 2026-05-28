import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from './SessionProvider';

/**
 * ProtectedRoutes layout component.
 * Safeguards all sub-routes using the React Router DOM <Outlet />.
 * If no session is present, redirects immediately to /login.
 */
export default function ProtectedRoutes() {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-neutral-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          <span className="text-xs text-white/30 tracking-widest uppercase">Initializing Workspace</span>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
