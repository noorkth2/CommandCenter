import { create } from 'zustand';

const DISMISSED_KEY = 'cc_dismissed_notifications';

function loadDismissed() {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissed(set) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]));
  } catch {}
}

/**
 * Generate notification objects from current application data.
 * Returns an array of notification-like objects sorted by severity then recency.
 *
 * @param {{ issues: Array, qaItems: Array, deployments: Array, sprints: Array, projects: Array }} data
 */
function generateFromData({ issues, qaItems, deployments, sprints, projects }) {
  const notifications = [];
  const now = new Date();

  // 1. QA failures — items stuck in 'fail' for more than 24h
  const failingQA = (qaItems || []).filter(
    (q) => q.status === 'fail' && q.created_at && (now - new Date(q.created_at)) > 86400000
  );
  for (const qa of failingQA) {
    notifications.push({
      id: `qa_failure:${qa.id}`,
      type: 'qa_failure',
      title: 'QA Test Failure',
      message: `${qa.test_case} has been failing for over 24h`,
      severity: 'warning',
      read: false,
      created_at: qa.updated_at || qa.created_at,
      related_id: qa.id,
      related_type: 'qa',
    });
  }

  // 2. Sprint deadlines — active sprints ending within 2 days
  const activeSprint = (sprints || []).find((s) => s.status === 'active');
  if (activeSprint?.end_date) {
    const endDate = new Date(activeSprint.end_date);
    const daysUntilEnd = Math.ceil((endDate - now) / 86400000);
    if (daysUntilEnd <= 2 && daysUntilEnd >= 0) {
      const sprintIssues = (issues || []).filter((i) => i.sprint_id === activeSprint.id);
      const remaining = sprintIssues.filter((i) => i.status !== 'done').length;
      notifications.push({
        id: `sprint_deadline:${activeSprint.id}`,
        type: 'sprint_deadline',
        title: `Sprint ending ${daysUntilEnd === 0 ? 'today' : `in ${daysUntilEnd} day${daysUntilEnd > 1 ? 's' : ''}`}`,
        message: `${activeSprint.name} — ${remaining} issue${remaining !== 1 ? 's' : ''} remaining`,
        severity: daysUntilEnd === 0 ? 'critical' : 'warning',
        read: false,
        created_at: now.toISOString(),
        related_id: activeSprint.id,
        related_type: 'sprint',
      });
    }
  }

  // 3. Failed deployments
  const failedDeps = (deployments || []).filter((d) => d.status === 'failed');
  for (const dep of failedDeps) {
    notifications.push({
      id: `deployment_failed:${dep.id}`,
      type: 'deployment_failed',
      title: 'Deployment Failed',
      message: `${dep.name} — ${dep.environment} environment`,
      severity: 'critical',
      read: false,
      created_at: dep.updated_at || dep.created_at,
      related_id: dep.id,
      related_type: 'deployment',
    });
  }

  // 4. Overdue issues — past deadline, not done/cancelled
  const overdue = (issues || []).filter((i) => {
    if (!i.deadline || i.status === 'done' || i.status === 'cancelled') return false;
    const deadline = new Date(i.deadline);
    return deadline < now;
  });
  for (const issue of overdue) {
    const projectName = issue.projects?.name || '';
    const suffix = projectName ? ` — ${projectName}` : '';
    notifications.push({
      id: `issue_overdue:${issue.id}`,
      type: 'issue_overdue',
      title: 'Overdue Issue',
      message: `${issue.title}${suffix}`,
      severity: 'warning',
      read: false,
      created_at: issue.updated_at || issue.created_at,
      related_id: issue.id,
      related_type: 'issue',
    });
  }

  // Sort: critical first, then warning, then info; within same severity by recency (newest first)
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  notifications.sort((a, b) => {
    const sa = severityOrder[a.severity] ?? 2;
    const sb = severityOrder[b.severity] ?? 2;
    if (sa !== sb) return sa - sb;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  return notifications;
}

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  dismissedIds: loadDismissed(),
  unreadCount: 0,
  lastGenerated: null,

  generate: (data) => {
    const all = generateFromData(data);
    const dismissedIds = get().dismissedIds;
    const filtered = all.filter((n) => !dismissedIds.has(n.id));
    const unreadCount = filtered.filter((n) => !n.read).length;
    set({ notifications: filtered, unreadCount, lastGenerated: Date.now() });
    return { all, filtered };
  },

  markRead: (id) => {
    set((s) => {
      const notifications = s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      );
      const unreadCount = notifications.filter((n) => !n.read).length;
      return { notifications, unreadCount };
    });
  },

  markAllRead: () => {
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },

  dismiss: (id) => {
    set((s) => {
      const dismissedIds = new Set(s.dismissedIds);
      dismissedIds.add(id);
      saveDismissed(dismissedIds);
      const notifications = s.notifications.filter((n) => n.id !== id);
      const unreadCount = notifications.filter((n) => !n.read).length;
      return { notifications, dismissedIds, unreadCount };
    });
  },

  dismissAll: () => {
    set((s) => {
      const dismissedIds = new Set(s.dismissedIds);
      s.notifications.forEach((n) => dismissedIds.add(n.id));
      saveDismissed(dismissedIds);
      return { notifications: [], dismissedIds, unreadCount: 0 };
    });
  },
}));
