import { Outlet, useNavigate } from 'react-router-dom';
import { useState, useCallback, useEffect, useRef } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import ConflictResolutionModal from '../shared/ConflictResolutionModal';
import CommandPalette from '../shared/CommandPalette';
import NotificationGenerator from '../notifications/NotificationGenerator';
import ChatbaseLoader from '../shared/ChatbaseLoader';
import { useSync } from '../../lib/SyncContext';

/**
 * ConflictModalManager — renders the conflict resolution modal.
 * Accepts an externally-controlled open trigger so the TopBar badge can open it.
 */
function ConflictModalManager({ onRegisterOpen }) {
  const { conflicts, resolveConflict } = useSync();
  const [activeConflict, setActiveConflict] = useState(null);

  const openNext = useCallback(() => {
    if (conflicts.length > 0) setActiveConflict(conflicts[0].entryId);
  }, [conflicts]);

  // Expose the openNext trigger to the parent Layout
  useEffect(() => {
    onRegisterOpen?.(openNext);
  }, [openNext, onRegisterOpen]);

  const handleClose = useCallback(() => setActiveConflict(null), []);

  const handleResolve = useCallback(async (entryId, resolution) => {
    await resolveConflict(entryId, resolution);
    setActiveConflict(null);
  }, [resolveConflict]);

  const activeConflictData = activeConflict
    ? conflicts.find((c) => c.entryId === activeConflict)
    : null;

  if (!activeConflictData) return null;

  return (
    <ConflictResolutionModal
      conflict={activeConflictData}
      onResolve={handleResolve}
      onClose={handleClose}
    />
  );
}

/**
 * Root layout shell — fixed sidebar + top bar + scrollable content area.
 */
export default function Layout() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  // Ref to the ConflictModalManager's openNext function so TopBar can trigger it
  const openConflictRef = useRef(null);

  const handleOpenConflict = useCallback(() => {
    openConflictRef.current?.();
  }, []);

  const handleRegisterOpen = useCallback((fn) => {
    openConflictRef.current = fn;
  }, []);

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
      <TopBar
        onOpenPalette={() => setPaletteOpen(true)}
        onOpenConflicts={handleOpenConflict}
        onOpenAssistant={() => setAssistantOpen(true)}
      />
      <main className="main-content" id="main-content">
        <div className="p-8 max-w-[1400px] mx-auto">
          <Outlet />
        </div>
      </main>
      <ChatbaseLoader />
      <AIAssistant open={assistantOpen} onClose={() => setAssistantOpen(false)} />
      <ConflictModalManager onRegisterOpen={handleRegisterOpen} />
      <NotificationGenerator />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
