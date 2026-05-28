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

  useEffect(() => {
    fetchProjects();
    fetchIssues();
    fetchQA();
    fetchDeployments();
    fetchSprints();
  }, []);

  // ─── Metrics ───────────────────────────────────────────────────────────────
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

  // ─── Chart Data ─────────────────────────────────────────────────────────────
  // 1. Issue Status Distribution
  const issueCountsByStatus = issues.reduce((acc, issue) => {
    acc[issue.status] = (acc[issue.status] || 0) + 1;
    return acc;
  }, {});

  const statusChartData = Object.keys(ISSUE_STATUS_LABELS)
    .slice(0, 7) // Show top 7 statuses for clean presentation
    .map((statusKey) => ({
      name: ISSUE_STATUS_LABELS[statusKey],
      count: issueCountsByStatus[statusKey] || 0,
    }));

  // 3. Velocity Chart — completed issues per sprint (last 8 completed sprints)
  const completedSprints = sprints
    .filter((s) => s.status === 'completed')
    .slice(-8);

  const velocityChartData = useMemo(() => {
    return completedSprints.map((sprint) => {
      const doneIssues = issues.filter(
        (i) => i.sprint_id === sprint.id && i.status === 'done'
      );
      return {
        name: sprint.name.length > 12 ? sprint.name.slice(0, 12) + '…' : sprint.name,
        completed: doneIssues.length,
      };
    });
  }, [completedSprints, issues]);

  // 4. Burndown Chart — active sprint daily remaining
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

  // 2. Recent Deployment Activity (last 6 deployments)
  const deploymentChartData = [...deployments]
    .slice(0, 6)
    .reverse()
    .map((dep) => ({
      name: dep.name.split(' — ')[0].substring(0, 10), // Shorten title
      environment: dep.environment,
      status: dep.status === 'success' ? 100 : dep.status === 'in_progress' ? 50 : 0,
    }));

  // fallback/sample chart data if empty
  const hasDeployments = deploymentChartData.length > 0;
  const fallbackDeploymentData = [
    { name: 'Deploy 1', status: 100 },
    { name: 'Deploy 2', status: 100 },
    { name: 'Deploy 3', status: 0 },
    { name: 'Deploy 4', status: 100 },
    { name: 'Deploy 5', status: 50 },
    { name: 'Deploy 6', status: 100 },
  ];

  // ─── Activity Feeds ────────────────────────────────────────────────────────
  const recentCriticalIssues = issues
    .filter((i) => i.status !== 'done' && i.status !== 'cancelled' && i.priority === 'p0')
    .slice(0, 3);

  const recentDeployments = deployments.slice(0, 3);

  return (
    <div className="animate-fade-in space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-title">Operations Dashboard</h2>
          <p className="section-subtitle">Real-time status of your development pipelines</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigate('/issues')}>
            View Board
          </Button>
          {activeSprint ? (
            <Button variant="primary" size="sm" onClick={() => navigate('/sprints')}>
              Active Sprint
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={() => navigate('/sprints')}>
              Start Sprint
            </Button>
          )}
        </div>
      </div>

      {/* Grid: 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            title: 'Active Projects',
            value: activeProjectsCount,
            label: 'tracking in workspace',
            icon: FolderKanban,
            color: 'text-brand-blue bg-brand-blue/15 border-brand-blue/30',
            glow: 'hover:glow-blue',
            path: '/projects',
          },
          {
            title: 'Critical Open Issues',
            value: criticalOpenIssuesCount,
            label: 'p0 / p1 items unresolved',
            icon: AlertCircle,
            color: 'text-brand-red bg-brand-red/15 border-brand-red/30',
            glow: 'hover:glow-red',
            path: '/issues',
          },
          {
            title: 'QA Test Pass Rate',
            value: `${qaPassRate}%`,
            label: `${passedTests} passed test cases`,
            icon: TestTube2,
            color: 'text-brand-green bg-brand-green/15 border-brand-green/30',
            glow: 'hover:glow-green',
            path: '/qa',
          },
          {
            title: 'Prod Deployments',
            value: prodDeployments,
            label: 'successful prod releases',
            icon: Rocket,
            color: 'text-brand-amber bg-brand-amber/15 border-brand-amber/30',
            glow: 'hover:glow-amber',
            path: '/deployments',
          },
        ].map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              onClick={() => navigate(card.path)}
              className={`card p-5 cursor-pointer flex items-center justify-between transition-all duration-200 ${card.glow} hover:-translate-y-0.5`}
            >
              <div className="space-y-2">
                <span className="text-xs font-semibold text-text-muted">{card.title}</span>
                <p className="text-3xl font-bold text-text-primary tracking-tight">{card.value}</p>
                <span className="text-2xs text-text-muted block">{card.label}</span>
              </div>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${card.color}`}>
                <Icon size={18} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Grid: Sprint Overview & Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Sprint Milestone Card (1/3 cols) */}
        <div className="card p-5 space-y-4 flex flex-col justify-between h-[340px]">
          <div>
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                <Zap size={14} className="text-brand-blue" />
                Active Sprint
              </span>
              <span className="badge text-[10px] bg-brand-blue/10 text-brand-blue border-brand-blue/20">
                In Progress
              </span>
            </div>

            {activeSprint ? (
              <div className="mt-4 space-y-4">
                <div>
                  <h4 className="font-semibold text-text-primary text-sm">{activeSprint.name}</h4>
                  {activeSprint.goals && (
                    <p className="text-xs text-text-secondary mt-1 line-clamp-2 leading-relaxed">
                      {activeSprint.goals}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-2xs text-text-secondary">
                    <span>Sprint progress</span>
                    <span>{sprintProgress}%</span>
                  </div>
                  <div className="progress-bar-track">
                    <div
                      className="progress-bar-fill glow-blue"
                      style={{ width: `${sprintProgress}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-text-muted block">
                    {completedSprintIssues.length} of {activeSprintIssues.length} issues completed
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-text-muted space-y-3">
                <AlertCircle size={28} className="mx-auto text-text-muted opacity-40 animate-pulse" />
                <p className="text-xs">No active sprint running</p>
                <Button variant="ghost" size="sm" onClick={() => navigate('/sprints')}>
                  Go to Sprint Planner
                </Button>
              </div>
            )}
          </div>

          {activeSprint && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/sprints')}
              className="w-full flex items-center justify-center gap-1.5"
            >
              Sprint Board <ArrowUpRight size={13} />
            </Button>
          )}
        </div>

        {/* Issue Status Chart (2/3 cols) */}
        <div className="card p-5 h-[340px] lg:col-span-2 space-y-3 flex flex-col">
          <span className="text-xs font-semibold text-text-primary">Issue Distribution by Status</span>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#5a5870" fontSize={11} tickLine={false} />
                <YAxis stroke="#5a5870" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                  contentStyle={{
                    background: '#16161a',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#e8e6f0',
                  }}
                />
                <Bar dataKey="count" fill="#5b6af8" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Grid: Velocity & Burndown Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Velocity Chart */}
        <div className="card p-5 h-[300px] space-y-3 flex flex-col">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <TrendingUp size={15} className="text-brand-purple" />
            <span className="text-xs font-semibold text-text-primary">Sprint Velocity</span>
            <span className="text-2xs text-text-muted ml-auto">Completed issues per sprint</span>
          </div>
          <div className="flex-1 w-full min-h-0">
            {velocityChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-text-muted text-xs">
                Complete a sprint to see velocity data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={velocityChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#5a5870" fontSize={11} tickLine={false} />
                  <YAxis stroke="#5a5870" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                    contentStyle={{
                      background: '#16161a',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#e8e6f0',
                    }}
                  />
                  <Bar dataKey="completed" fill="#a78bfa" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Burndown Chart */}
        <div className="card p-5 h-[300px] space-y-3 flex flex-col">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <LineChartIcon size={15} className="text-brand-amber" />
            <span className="text-xs font-semibold text-text-primary">Sprint Burndown</span>
            <span className="text-2xs text-text-muted ml-auto">Actual vs ideal remaining</span>
          </div>
          <div className="flex-1 w-full min-h-0">
            {burndownChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-text-muted text-xs">
                {activeSprint ? 'No issues in active sprint' : 'No active sprint running'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={burndownChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="day" stroke="#5a5870" fontSize={11} tickLine={false} />
                  <YAxis stroke="#5a5870" fontSize={11} tickLine={false} allowDecimals={false} domain={[0, 'auto']} />
                  <Tooltip
                    contentStyle={{
                      background: '#16161a',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#e8e6f0',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="ideal"
                    stroke="#5a5870"
                    strokeWidth={1.5}
                    strokeDasharray="6 4"
                    dot={false}
                    name="Ideal"
                  />
                  <Line
                    type="monotone"
                    dataKey="remaining"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#f59e0b' }}
                    name="Actual"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Grid: Deployment Activity & Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Deployment activity */}
        <div className="card p-5 h-[320px] lg:col-span-2 space-y-3 flex flex-col">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-primary">Recent Deployment Pipeline Activity</span>
            <span className="text-[10px] text-text-muted">Stability Index: 100%</span>
          </div>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={hasDeployments ? deploymentChartData : fallbackDeploymentData}
                margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorStatus" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3ecf8e" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3ecf8e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#5a5870" fontSize={10} tickLine={false} />
                <YAxis stroke="#5a5870" fontSize={10} tickLine={false} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    background: '#16161a',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    fontSize: '11px',
                    color: '#e8e6f0',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="status"
                  stroke="#3ecf8e"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorStatus)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right 1 Col: Urgent critical issues feed */}
        <div className="card p-5 h-[320px] space-y-3 flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-brand-red flex items-center gap-1.5 border-b border-border pb-2.5">
              <AlertCircle size={14} className="text-brand-red animate-pulse" />
              Critical Attention Feed
            </span>

            {recentCriticalIssues.length === 0 ? (
              <div className="py-12 text-center text-text-muted space-y-2">
                <Sparkles size={20} className="mx-auto text-brand-green opacity-40" />
                <p className="text-[11px]">All clear! No open P0 issues.</p>
              </div>
            ) : (
              <div className="space-y-2 mt-3 overflow-y-auto max-h-[180px] pr-1">
                {recentCriticalIssues.map((issue) => (
                  <div
                    key={issue.id}
                    onClick={() => navigate('/issues')}
                    className="p-2.5 rounded bg-bg-elevated border border-border flex items-center justify-between gap-3 cursor-pointer hover:border-border-strong transition-all"
                  >
                    <div className="min-w-0">
                      <span className="text-xs font-medium text-text-primary block truncate">
                        {issue.title}
                      </span>
                      <span className="text-[10px] text-text-muted block truncate mt-0.5">
                        {issue.projects?.name ?? 'No project'} • {issue.team ?? 'general'}
                      </span>
                    </div>
                    <PriorityBadge priority="p0" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/issues')}
            className="w-full text-2xs mt-2"
          >
            Review all active issues
          </Button>
        </div>
      </div>
    </div>
  );
}
