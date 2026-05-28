import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { onSyncEvent, queueDepth, getPendingEntries, removeEntry, updateEntry, drainQueue } from './syncQueue';
import { supabase } from './supabase';
import { useToast } from '../components/ui/Toast';

const SyncContext = createContext(null);

export function SyncProvider({ children }) {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [conflicts, setConflicts] = useState([]);
  const [entries, setEntries] = useState([]);
  const intervalRef = useRef(null);

  const refresh = useCallback(() => {
    setPendingCount(queueDepth());
    setEntries(getPendingEntries());
  }, []);

  // Subscribe to sync events
  useEffect(() => {
    const unsub = onSyncEvent((event) => {
      refresh();
      if (event.type === 'drained' && event.queueDepth === 0) {
        setIsSyncing(false);
      }
    });
    refresh();
    return unsub;
  }, [refresh]);

  // Poll queue depth for the StatusBar
  useEffect(() => {
    intervalRef.current = setInterval(refresh, 3000);
    return () => clearInterval(intervalRef.current);
  }, [refresh]);

  const resolveConflict = useCallback(async (conflictId, resolution) => {
    const conflict = conflicts.find((c) => c.entryId === conflictId);
    if (!conflict) return;

    if (resolution === 'keep_server') {
      removeEntry(conflictId);
      setConflicts((prev) => prev.filter((c) => c.entryId !== conflictId));
    } else if (resolution === 'overwrite_server') {
      updateEntry(conflictId, { updated_at: new Date().toISOString() });
      setConflicts((prev) => prev.filter((c) => c.entryId !== conflictId));
      // Immediately try to drain
      setIsSyncing(true);
      await drainQueue(supabase);
      setIsSyncing(false);
      refresh();
    } else if (resolution === 'keep_local') {
      removeEntry(conflictId);
      setConflicts((prev) => prev.filter((c) => c.entryId !== conflictId));
    }
  }, [conflicts, refresh]);

  const manualSync = useCallback(async () => {
    setIsSyncing(true);
    const result = await drainQueue(supabase);
    setIsSyncing(false);
    if (result.conflicts?.length > 0) {
      setConflicts((prev) => [...prev, ...result.conflicts]);
    }
    refresh();
  }, [refresh]);

  const value = {
    pendingCount,
    isSyncing,
    conflicts,
    entries,
    resolveConflict,
    manualSync,
    refresh,
  };

  return (
    <SyncContext.Provider value={value}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used within a SyncProvider');
  return ctx;
}
