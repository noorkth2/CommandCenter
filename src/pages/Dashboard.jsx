import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderKanban,
  AlertCircle,
  TestTube2,
  Rocket,
  ArrowUpRight,
  Zap,
  Sparkles,
  TrendingUp,
  LineChart as LineChartIcon,
  Package,
  Users,
  CircleDot,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';

import { useProjectStore } from '../store/useProjectStore';
import { useIssueStore } from '../store/useIssueStore';
import { useQAStore } from '../store/useQAStore';
import { useDeploymentStore } from '../store/useDeploymentStore';
import { useSprintStore } from '../store/useSprintStore';
import { useTimeTrackingStore } from '../store/useTimeTrackingStore';
import Button from '../components/ui/Button';
import StatusBadge from '../components/shared/StatusBadge';
import PriorityBadge from '../components/shared/PriorityBadge';
import { ISSUE_STATUS_LABELS, SPRINT_STATUS_LABELS } from '../lib/constants';

export default function Dashboard() {
  const navigate = useNavigate();

  const { projects, fetch: fetchProjects } = useProjectStore();
  const { issues, fetch: fetchIssues } = useIssueStore();
  const { items: qaItems, fetch: fetchQA } = useQAStore();
  const { deployments, fetch: fetchDeployments } = useDeploymentStore();
  const { sprints, fetch: fetchSprints } = useSprintStore();
  const { entries: timeEntries, fetchEntries } = useTimeTrackingStore();

  useEffect(() => {
    fetchProjects();
    fetchIssues();
    fetchQA();
    fetchDeployments();
    fetchSprints();
    fetchEntries();
  }, []);

  const activeProjectsCount = projects.filter((p) => p.status === 'active').length;
  const criticalOpenIssuesCount = issues.filter(
    (i) => i.status !== 'done' && i.status !== 'cancelled' && (i.priority === 'p0' || i.priority === 'p1')
  ).length;

  const passedTests = qaItems.filter((i) => i.status === 'pass').length;
  const qaPassRate = qaItems.length ? Math.round((passedTests / qaItems.length) * 100) : 0;

  const prodDeployments = deployments.filter(
    (d) => d.status === 'success' && d.environment === 'production'
  ).length;

  const activeSprint = sprints.find((s) => s.status === 'active') || null;
  const activeSprintIssues = activeSprint
    ? issues.filter((i) => i.sprint_id === activeSprint.id)
    : [];
  const completedSprintIssues = activeSprintIssues.filter((i) => i.status === 'done');
  const sprintProgress = activeSprintIssues.length
    ? Math.round((completedSprintIssues.length / activeSprintIssues.length) * 100)
    : 0;

  const issueCountsByStatus = issues.reduce((acc, issue) => {
    acc[issue.status] = (acc[issue.status] || 0) + 1;
    return acc;
  }, {});

  const statusChartData = Object.keys(ISSUE_STATUS_LABELS)
    .slice(0, 7)
    .map((statusKey) => ({
      name: ISSUE_STATUS_LABELS[statusKey],
      count: issueCountsByStatus[statusKey] || 0,
    }));

  const completedSprints = sprints
    .filter((s) => s.status === 'completed')
    .slice(-8)
    .reverse();

  const velocityChartData = useMemo(() => {
    return completedSprints.map((sprint) => {
      const isCustomVelocity = sprint.velocity !== null && sprint.velocity !== undefined;
      const val = isCustomVelocity
        ? Math.round(sprint.velocity * 100)
        : issues.filter((i) => i.sprint_id === sprint.id && i.status === 'done').length;

      return {
        name: sprint.name.length > 12 ? sprint.name.slice(0, 12) + '…' : sprint.name,
        velocity: val,
      };
    });
  }, [completedSprints, issues]);

  // Project Time Budgets computations
  const projectBudgets = useMemo(() => {
    return projects
      .filter((p) => p.status === 'active' && p.time_budget_hours > 0)
      .map((p) => {
        const projectIssueIds = new Set(issues.filter((i) => i.project_id === p.id).map((i) => i.id));
        const totalMinutes = timeEntries
          .filter((e) => projectIssueIds.has(e.issue_id))
          .reduce((sum, e) => sum + (e.duration_minutes || 0), 0);

        const consumedHours = Number((totalMinutes / 60).toFixed(1));
        const budgetHours = Number(p.time_budget_hours);
        const percent = Math.min(100, Math.round((consumedHours / budgetHours) * 100));
        const remaining = Math.max(0, Number((budgetHours - consumedHours).toFixed(1)));

        return {
          id: p.id,
          name: p.name,
          budget: budgetHours,
          consumed: consumedHours,
          remaining,
          percent,
        };
      });
  }, [projects, issues, timeEntries]);

  const burndownChartData = useMemo(() => {
    if (!activeSprint || !activeSprint.start_date) return [];

    const now = new Date();
    const start = new Date(activeSprint.start_date);
    const end = activeSprint.end_date ? new Date(activeSprint.end_date) : new Date(now.getTime() + 7 * 86400000);
    const totalDays = Math.max(1, Math.ceil((end - start) / 86400000));
    const elapsedDays = Math.max(0, Math.ceil((now - start) / 86400000));
    const totalIssues = activeSprintIssues.length;

    const doneDates = activeSprintIssues
      .filter((i) => i.status === 'done' && i.completed_at)
      .map((i) => new Date(i.completed_at).toDateString());

    const points = [];
    for (let d = 0; d <= Math.min(elapsedDays, totalDays); d++) {
      const day = new Date(start.getTime() + d * 86400000);
      const completedByDay = doneDates.filter((dd) => new Date(dd) <= day).length;
      const remaining = totalIssues - completedByDay;
      const idealRemaining = Math.round(totalIssues * (1 - d / totalDays));
      points.push({
        day: d === 0 ? 'Start' : d === elapsedDays ? 'Today' : `D${d}`,
        remaining,
        ideal: idealRemaining,
      });
    }
    return points;
  }, [activeSprint, activeSprintIssues]);

  const deploymentChartData = [...deployments]
    .slice(0, 6)
    .reverse()
    .map((dep) => ({
      name: dep.name.split(' \u2014 ')[0].substring(0, 10),
      environment: dep.environment,
      status: dep.status === 'success' ? 100 : dep.status === 'in_progress' ? 50 : 0,
    }));

  const hasDeployments = deploymentChartData.length > 0;
  const fallbackDeploymentData = [
    { name: 'Deploy 1', status: 100 },
    { name: 'Deploy 2', status: 100 },
    { name: 'Deploy 3', status: 0 },
    { name: 'Deploy 4', status: 100 },
    { name: 'Deploy 5', status: 50 },
    { name: 'Deploy 6', status: 100 },
  ];

  const recentCriticalIssues = issues
    .filter((i) => i.status !== 'done' && i.status !== 'cancelled' && i.priority === 'p0')
    .slice(0, 3);

  const recentDeployments = deployments.slice(0, 3);

  const statCards = [
    {
      value: activeProjectsCount,
      label: 'Active Projects',
      icon: FolderKanban,
      tint: '',
      iconBg: 'bg-accent/10',
      iconColor: 'text-accent',
    },
    {
      value: criticalOpenIssuesCount,
      label: 'Critical Open Issues',
      icon: AlertCircle,
      tint: 'bg-success/5',
      iconBg: 'bg-success/10',
      iconColor: 'text-success',
    },
    {
      value: `${qaPassRate}%`,
      label: 'QA Pass Rate',
      icon: TestTube2,
      tint: 'bg-warning/5',
      iconBg: 'bg-warning/10',
      iconColor: 'text-warning',
    },
    {
      value: prodDeployments,
      label: 'Prod Deployments',
      icon: Rocket,
      tint: 'bg-accent/5',
      iconBg: 'bg-accent/10',
      iconColor: 'text-accent',
    },
  ];

  return (
    <div className="animate-fade-in space-y-4 pb-12">
      {/* ─── Hero Banner ─── */}
      <div className="relative overflow-hidden rounded-lg h-[160px] bg-gradient-to-br from-bg-elevated via-bg-surface to-accent/5 border border-border">
        <div className="relative z-10 h-full flex items-center justify-between px-8">
          <div className="space-y-2.5">
            <h2 className="text-2xl font-semibold text-text-primary leading-tight">
              CommandCenter &mdash; Your PM Hub
            </h2>
            <p className="text-sm text-text-secondary max-w-md leading-relaxed">
              Centralized product &amp; project management with real-time insights,
              AI-powered reports, and seamless team collaboration.
            </p>
            <button
              onClick={() => navigate('/board')}
              className="inline-flex items-center gap-1.5 h-9 px-5 rounded-full text-sm font-medium text-text-primary border border-border hover:bg-bg-elevated hover:border-border-hover transition-colors cursor-pointer"
            >
              View Board <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="hidden lg:flex items-center gap-3 opacity-40">
            <div className="w-12 h-12 rounded-full bg-bg-elevated border border-border flex items-center justify-center">
              <Package size={20} className="text-text-muted" />
            </div>
            <div className="w-10 h-10 rounded-full bg-bg-elevated border border-border flex items-center justify-center -ml-3 mt-6">
              <Users size={18} className="text-text-muted" />
            </div>
            <div className="w-11 h-11 rounded-full bg-bg-elevated border border-border flex items-center justify-center -ml-3 -mt-4">
              <CircleDot size={18} className="text-text-muted" />
            </div>
            <div className="w-9 h-9 rounded-full bg-bg-elevated border border-border flex items-center justify-center -ml-3 mt-8">
              <Zap size={16} className="text-text-muted" />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Quick Stats ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              className="card p-5 space-y-3 relative overflow-hidden"
            >
              {card.tint && (
                <div className={`absolute inset-0 ${card.tint} pointer-events-none`} />
              )}
              <div className="relative z-10 space-y-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${card.iconBg}`}>
                  <Icon size={18} className={card.iconColor} />
                </div>
                <div>
                  <p className="text-3xl font-bold text-text-primary tracking-tight">{card.value}</p>
                  <p className="text-sm text-text-muted mt-0.5">{card.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Middle Row: Active Sprint + Issue Distribution ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Active Sprint */}
        <div className="card p-5 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-accent" />
                <span className="text-sm font-semibold text-text-primary">Active Sprint</span>
              </div>
              {activeSprint && (
                <span className="text-xs font-medium text-success bg-success/15 px-2.5 py-0.5 rounded-full">
                  In Progress
                </span>
              )}
            </div>

            {activeSprint ? (
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-text-primary text-sm">{activeSprint.name}</h4>
                  {activeSprint.goals && (
                    <p className="text-sm text-text-secondary mt-1.5 line-clamp-2 leading-relaxed">
                      {activeSprint.goals}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-text-secondary">
                    <span>Progress</span>
                    <span>{sprintProgress}%</span>
                  </div>
                  <div className="progress-bar-track">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${sprintProgress}%` }}
                    />
                  </div>
                  <span className="text-xs text-text-muted">
                    {completedSprintIssues.length} of {activeSprintIssues.length} issues completed
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-text-muted space-y-3">
                <AlertCircle size={28} className="mx-auto text-text-muted opacity-40" />
                <p className="text-sm">No active sprint running</p>
                <Button variant="ghost" size="sm" onClick={() => navigate('/sprints')}>
                  Go to Sprint Planner
                </Button>
              </div>
            )}
          </div>

          {activeSprint && (
            <button
              onClick={() => navigate('/sprints')}
              className="w-full h-10 rounded-lg text-sm font-medium text-text-primary bg-bg-elevated border border-border hover:bg-bg-surface hover:border-border-hover transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              Sprint Board <ArrowUpRight size={14} />
            </button>
          )}
        </div>

        {/* Issue Distribution */}
        <div className="card p-5 space-y-3 flex flex-col">
          <span className="text-sm font-semibold text-text-primary">Issue Distribution by Status</span>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#555555" fontSize={11} tickLine={false} />
                <YAxis stroke="#555555" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(var(--text-primary-rgb), 0.03)' }}
                  contentStyle={{
                    background: 'rgba(var(--bg-elevated-rgb), 1)',
                    border: '1px solid rgba(var(--border-rgb), 1)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: 'rgba(var(--text-primary-rgb), 1)',
                  }}
                />
                <Bar dataKey="count" fill="#7c6ef5" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ─── Bottom Row: Velocity + Burndown ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Velocity */}
        <div className="card p-5 space-y-3 flex flex-col">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-accent" />
            <span className="text-sm font-semibold text-text-primary">Sprint Velocity</span>
          </div>
          <div className="flex-1 w-full min-h-0">
            {velocityChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-text-muted text-sm">
                Complete a sprint to see velocity data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={velocityChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#555555" fontSize={11} tickLine={false} />
                  <YAxis stroke="#555555" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(var(--text-primary-rgb), 0.03)' }}
                    contentStyle={{
                      background: 'rgba(var(--bg-elevated-rgb), 1)',
                      border: '1px solid rgba(var(--border-rgb), 1)',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: 'rgba(var(--text-primary-rgb), 1)',
                    }}
                  />
                  <Bar dataKey="velocity" fill="#7c6ef5" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Burndown */}
        <div className="card p-5 space-y-3 flex flex-col">
          <div className="flex items-center gap-2">
            <LineChartIcon size={16} className="text-accent" />
            <span className="text-sm font-semibold text-text-primary">Sprint Burndown</span>
          </div>
          <div className="flex-1 w-full min-h-0">
            {burndownChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-text-muted text-sm">
                {activeSprint ? 'No issues in active sprint' : 'No active sprint running'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={burndownChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(var(--border-rgb), 0.5)" />
                  <XAxis dataKey="day" stroke="#555555" fontSize={11} tickLine={false} />
                  <YAxis stroke="#555555" fontSize={11} tickLine={false} allowDecimals={false} domain={[0, 'auto']} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(var(--bg-elevated-rgb), 1)',
                      border: '1px solid rgba(var(--border-rgb), 1)',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: 'rgba(var(--text-primary-rgb), 1)',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="ideal"
                    stroke="#555555"
                    strokeWidth={1.5}
                    strokeDasharray="6 4"
                    dot={false}
                    name="Ideal"
                  />
                  <Line
                    type="monotone"
                    dataKey="remaining"
                    stroke="#7c6ef5"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#7c6ef5' }}
                    name="Actual"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ─── Project Time Budgets Row ─── */}
      {projectBudgets.length > 0 && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <FolderKanban size={16} className="text-accent" />
            <h3 className="text-sm font-semibold text-text-primary">Project Time Budgets</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projectBudgets.map((pb) => (
              <div key={pb.id} className="p-4 rounded-lg bg-bg-elevated border border-border space-y-3">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-semibold text-text-primary truncate max-w-[70%]">{pb.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    pb.percent >= 90 ? 'bg-danger/10 text-danger' : pb.percent >= 75 ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'
                  }`}>
                    {pb.percent}% used
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="h-1.5 w-full bg-bg-surface border border-border rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        pb.percent >= 90 ? 'bg-danger' : pb.percent >= 75 ? 'bg-warning' : 'bg-success'
                      }`}
                      style={{ width: `${pb.percent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-3xs text-text-muted font-mono">
                    <span>{pb.consumed} hrs logged</span>
                    <span>{pb.remaining} hrs left / {pb.budget} hrs budget</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
