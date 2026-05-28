import { useState, useEffect } from 'react';
import { Play, Square, Clock } from 'lucide-react';
import { useTimeTrackingStore } from '../../store/useTimeTrackingStore';
import { useToast } from '../ui/Toast';

function formatElapsed(startedAt) {
  const diff = Date.now() - new Date(startedAt).getTime();
  const totalSec = Math.floor(diff / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

export default function TimerControl({ issueId, issueTitle, size = 'sm' }) {
  const toast = useToast();
  const { activeTimer, startTimer, stopTimer } = useTimeTrackingStore();
  const [elapsed, setElapsed] = useState('');

  const isRunning = activeTimer?.issue_id === issueId;

  useEffect(() => {
    if (!isRunning || !activeTimer) {
      setElapsed('');
      return;
    }
    setElapsed(formatElapsed(activeTimer.started_at));
    const interval = setInterval(() => {
      setElapsed(formatElapsed(activeTimer.started_at));
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning, activeTimer]);

  const handleStart = async () => {
    try {
      await startTimer(issueId);
      toast.success(`Timer started for "${issueTitle}"`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleStop = async () => {
    try {
      const result = await stopTimer();
      if (result) {
        toast.success(`Logged ${result.duration_minutes}m for "${issueTitle}"`);
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (isRunning) {
    return (
      <button
        onClick={handleStop}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium bg-brand-red/15 text-brand-red border border-brand-red/30 hover:bg-brand-red/25 transition-colors cursor-pointer animate-pulse"
        title="Stop timer"
      >
        <Square size={11} />
        {elapsed}
      </button>
    );
  }

  return (
    <button
      onClick={handleStart}
      disabled={!!activeTimer}
      className={`inline-flex items-center gap-1.5 rounded text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
        size === 'xs'
          ? 'px-2 py-1 text-2xs bg-bg-elevated border border-border text-text-muted hover:border-border-strong'
          : 'px-2.5 py-1.5 bg-brand-green/15 text-brand-green border border-brand-green/30 hover:bg-brand-green/25'
      }`}
      title={activeTimer ? 'Another timer is running' : 'Start timer'}
    >
      {activeTimer ? (
        <Clock size={11} className="text-text-muted" />
      ) : (
        <Play size={11} />
      )}
      {activeTimer ? 'Timer in use' : 'Start Timer'}
    </button>
  );
}
