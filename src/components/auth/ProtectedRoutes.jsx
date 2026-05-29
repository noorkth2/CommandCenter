import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from './SessionProvider';
import { supabase } from '../../lib/supabase';

/**
 * Hardcoded fallback allowlist — used when the DB setting is absent or empty.
 * If you add a new allowed email, also run migration 008 to update the DB.
 */
const FALLBACK_ALLOWED_EMAILS = [
  'kayastha.noor1100@gmail.com',
  'niroj.mahrjan@gmail.com',
];

/**
 * ProtectedRoutes layout component.
 * Safeguards all sub-routes using the React Router DOM <Outlet />.
 *
 * Access control flow:
 *  1. Redirect to /login if no session
 *  2. Fetch allowed_emails from settings table
 *  3. If user's email is not in the list → redirect to /access-denied
 *  4. Falls back to FALLBACK_ALLOWED_EMAILS if the setting is missing
 */
export default function ProtectedRoutes() {
  const { session, loading } = useSession();
  const [allowlistReady, setAllowlistReady] = useState(false);
  const [isAllowed, setIsAllowed] = useState(false);

  useEffect(() => {
    if (!session?.user?.email) return;

    let cancelled = false;

    async function checkAllowlist() {
      let allowedEmails = FALLBACK_ALLOWED_EMAILS;

      try {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'allowed_emails')
          .single();

        if (!error && data?.value) {
          const parsed = JSON.parse(data.value);
          if (Array.isArray(parsed) && parsed.length > 0) {
            allowedEmails = parsed.map((e) => e.toLowerCase().trim());
          }
        }
      } catch {
        // Supabase unavailable or settings table not found — use fallback
        console.warn('[ProtectedRoutes] Could not load allowed_emails from settings. Using fallback list.');
      }

      if (!cancelled) {
        const email = session.user.email.toLowerCase().trim();
        setIsAllowed(allowedEmails.includes(email));
        setAllowlistReady(true);
      }
    }

    checkAllowlist();
    return () => { cancelled = true; };
  }, [session]);

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

  // Wait for allowlist check before rendering protected content
  if (!allowlistReady) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-neutral-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          <span className="text-xs text-white/30 tracking-widest uppercase">Verifying Access</span>
        </div>
      </div>
    );
  }

  if (!isAllowed) {
    return <Navigate to="/access-denied" replace />;
  }

  return <Outlet />;
}
