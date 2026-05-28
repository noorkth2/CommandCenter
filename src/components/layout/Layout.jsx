import { Outlet, useNavigate } from 'react-router-dom';
import { useState, useCallback, useEffect } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import ConflictResolutionModal from '../shared/ConflictResolutionModal';
import CommandPalette from '../shared/CommandPalette';
import NotificationGenerator from '../notifications/NotificationGenerator';
import { useSync } from '../../lib/SyncContext';

function ConflictModalManager() {
  const { conflicts, resolveConflict } = useSync();
  const [activeConflict, setActiveConflict] = useState(null);

  const handleClose = useCallback(() => setActiveConflict(null), []);

  const handleResolve = useCallback(async (entryId, resolution) => {
    await resolveConflict(entryId, resolution);
    setActiveConflict(null);
  }, [resolveConflict]);

  const activeConflictData = activeConflict
    ? conflicts.find((c) => c.entryId === activeConflict)
    : null;

  return (
    <>
      {/* Conflict badge in the content area - shown when there are unresolved conflicts */}
      {conflicts.length > 0 && !activeConflict && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30">
          <button
            onClick={() => setActiveConflict(conflicts[0].entryId)}
            className="flex items-center gap-2 h-9 px-4 rounded-lg bg-brand-red/15 border border-brand-red/30 text-sm text-brand-red font-medium hover:bg-brand-red/25 transition-colors shadow-overlay"
          >
            <span className="w-2 h-2 rounded-full bg-brand-red animate-pulse" />
            {conflicts.length} sync conflict{conflicts.length > 1 ? 's' : ''} — resolve
          </button>
        </div>
      )}

      {/* Conflict resolution modal */}
      {activeConflictData && (
        <ConflictResolutionModal
          conflict={activeConflictData}
          onResolve={handleResolve}
          onClose={handleClose}
        />
      )}
    </>
  );
}

/**
 * Root layout shell — fixed sidebar + top bar + scrollable content area.
 */
export default function Layout() {
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Global Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="app-layout">
      <Sidebar />
      <TopBar onOpenPalette={() => setPaletteOpen(true)} />
      <main className="main-content" id="main-content">
        <div className="p-6 max-w-[1200px] mx-auto">
          <Outlet />
        </div>
      </main>
      <ConflictModalManager />
      <NotificationGenerator />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
