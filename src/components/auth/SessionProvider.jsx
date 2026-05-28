import { createContext, useContext, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { checkIsConfigured } from '../../lib/supabase';
import { cacheFlush } from '../../lib/cache';
import { clearQueue } from '../../lib/syncQueue';

const SessionContext = createContext(null);

const isConfigured = checkIsConfigured();

/**
 * SessionProvider component.
 * Exposes a standardized React context for session, user, and loading state.
 */
export function SessionProvider({ children }) {
  const { session, user, loading, error, initialize, logout } = useAuthStore();

  useEffect(() => {
    if (isConfigured) {
      initialize();
    }
  }, [initialize]);

  /** Purge all local state before signing out */
  const handleLogout = useCallback(async () => {
    cacheFlush();
    clearQueue();
    await logout();
  }, [logout]);

  const value = {
    session,
    user,
    loading,
    error,
    logout: handleLogout,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

/**
 * Hook to consume active authenticated session.
 */
export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
