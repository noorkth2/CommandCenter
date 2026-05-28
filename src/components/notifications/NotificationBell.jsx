import { useState, useRef, useEffect } from 'react';
import { Bell, BellOff, CheckCheck, X, Trash2, AlertTriangle, AlertCircle, Clock, XCircle } from 'lucide-react';
import { useNotificationStore } from '../../store/useNotificationStore';

const TYPE_ICONS = {
  qa_failure: { icon: XCircle, color: 'text-brand-amber' },
  sprint_deadline: { icon: Clock, color: 'text-brand-amber' },
  deployment_failed: { icon: AlertCircle, color: 'text-brand-red' },
  issue_overdue: { icon: AlertTriangle, color: 'text-brand-amber' },
};

function timeAgo(dateStr) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const { notifications, unreadCount, markRead, markAllRead, dismiss, dismissAll } =
    useNotificationStore();

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative flex items-center justify-center w-8 h-8 rounded border border-border bg-bg-elevated hover:border-border-strong transition-colors cursor-pointer"
        title="Notifications"
      >
        {unreadCount > 0 ? (
          <>
            <Bell size={14} className="text-brand-amber" />
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-brand-red text-white text-[9px] font-bold flex items-center justify-center leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </>
        ) : (
          <BellOff size={14} className="text-text-muted" />
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-[360px] bg-bg-elevated border border-border rounded-lg shadow-xl z-50 max-h-[480px] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-xs font-semibold text-text-primary">Notifications</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={() => { markAllRead(); }}
                  className="text-2xs text-brand-blue hover:text-brand-blue/80 transition-colors cursor-pointer"
                >
                  <CheckCheck size={13} className="inline mr-1" />
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-12 text-center text-text-muted space-y-2">
                <BellOff size={24} className="mx-auto opacity-40" />
                <p className="text-xs">No notifications</p>
                <p className="text-2xs">All clear — nothing needs attention</p>
              </div>
            ) : (
              <div className="space-y-0">
                {notifications.map((n) => {
                  const meta = TYPE_ICONS[n.type] || { icon: AlertTriangle, color: 'text-text-muted' };
                  const Icon = meta.icon;

                  return (
                    <div
                      key={n.id}
                      className={`flex items-start gap-3 px-4 py-3 border-b border-border/50 transition-colors hover:bg-bg-hover/50 ${
                        !n.read ? 'bg-brand-blue/3' : ''
                      }`}
                    >
                      <div className={`mt-0.5 flex-shrink-0 ${meta.color}`}>
                        <Icon size={15} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-text-primary truncate">
                            {n.title}
                          </span>
                          <span className="text-2xs text-text-muted flex-shrink-0">{timeAgo(n.created_at)}</span>
                        </div>
                        <p className="text-2xs text-text-secondary mt-0.5 line-clamp-2">{n.message}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!n.read && (
                          <button
                            onClick={() => markRead(n.id)}
                            className="p-1 rounded text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                            title="Mark read"
                          >
                            <CheckCheck size={12} />
                          </button>
                        )}
                        <button
                          onClick={() => dismiss(n.id)}
                          className="p-1 rounded text-text-muted hover:text-brand-red transition-colors cursor-pointer"
                          title="Dismiss"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-border flex items-center justify-between">
              <span className="text-2xs text-text-muted">{notifications.length} notification{notifications.length !== 1 ? 's' : ''}</span>
              <button
                onClick={() => dismissAll()}
                className="text-2xs text-text-muted hover:text-brand-red transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Trash2 size={11} />
                Dismiss all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
