import { useEffect, useRef } from 'react';
import { useNotificationStore } from '../../store/useNotificationStore';
import { useIssueStore } from '../../store/useIssueStore';
import { useQAStore } from '../../store/useQAStore';
import { useDeploymentStore } from '../../store/useDeploymentStore';
import { useSprintStore } from '../../store/useSprintStore';
import { useProjectStore } from '../../store/useProjectStore';

const POLL_INTERVAL = 300000; // 5 minutes

export default function NotificationGenerator() {
  const generate = useNotificationStore((s) => s.generate);
  const lastGenerated = useNotificationStore((s) => s.lastGenerated);

  const { issues, fetch: fetchIssues } = useIssueStore();
  const { items: qaItems, fetch: fetchQA } = useQAStore();
  const { deployments, fetch: fetchDeployments } = useDeploymentStore();
  const { sprints, fetch: fetchSprints } = useSprintStore();
  const { projects, fetch: fetchProjects } = useProjectStore();

  const lastNotifiedRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    const run = async () => {
      // Skip while window is not visible — avoids wasted Supabase queries in background
      if (document.visibilityState === 'hidden') return;

      // Ensure data is loaded
      if (issues.length === 0) await fetchIssues();
      if (qaItems.length === 0) await fetchQA();
      if (deployments.length === 0) await fetchDeployments();
      if (sprints.length === 0) await fetchSprints();
      if (projects.length === 0) await fetchProjects();

      const { all, filtered } = generate({
        issues,
        qaItems,
        deployments,
        sprints,
        projects,
      });

      // Send desktop notifications for new critical items
      const critical = all.filter((n) => n.severity === 'critical');
      if (critical.length > 0 && window.electron?.notification?.show) {
        const prevIds = lastNotifiedRef.current || new Set();
        for (const n of critical) {
          if (!prevIds.has(n.id)) {
            window.electron.notification.show({
              title: `[${n.severity.toUpperCase()}] ${n.title}`,
              body: n.message,
              urgency: 'critical',
            });
          }
        }
        lastNotifiedRef.current = new Set(all.map((n) => n.id));
      }
    };

    const startPolling = () => {
      if (intervalRef.current) return;
      run();
      intervalRef.current = setInterval(run, POLL_INTERVAL);
    };

    const stopPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        startPolling();
      } else {
        stopPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    startPolling();

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []); // Only on mount — stores are the same instance throughout

  return null;
}
