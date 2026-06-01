import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderKanban,
  AlertCircle,
  TestTube2,
  Clock,
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

  const mttr = useMemo(() => {
    const resolvedIssues = issues.filter(
      (i) => i.status === 'done' && i.completed_at && i.created_at
    );
    if (resolvedIssues.length === 0) return '—';

    const totalResolutionTimeMs = resolvedIssues.reduce((sum, issue) => {
      const created = new Date(issue.created_at);
      const completed = new Date(issue.completed_at);
      return sum + Math.max(0, completed - created);
    }, 0);

    const averageHours = totalResolutionTimeMs / (1000 * 60 * 60 * resolvedIssues.length);
    return averageHours < 24
      ? `${averageHours.toFixed(1)}h`
      : `${(averageHours / 24).toFixed(1)}d`;
  }, [issues]);

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
      value: mttr,
      label: 'Avg. Resolution (MTTR)',
      icon: Clock,
      tint: 'bg-accent/5',
      iconBg: 'bg-accent/10',
      iconColor: 'text-accent',
    },
    {
      value: `${qaPassRate}%`,
      label: 'QA Pass Rate',
      icon: TestTube2,
      tint: 'bg-warning/5',
      iconBg: 'bg-warning/10',
      iconColor: 'text-warning',
    },
  ];

  return (
    <div className="animate-fade-in space-y-6 pb-12">
      {/* ─── Hero Banner ─── */}
      <div className="relative overflow-hidden rounded-xl h-[180px] glass glow-accent border-border/60">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-transparent opacity-50" />
        <div className="relative z-10 h-full flex items-center justify-between px-10">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-[10px] font-bold text-accent uppercase tracking-widest animate-pulse">
              <Sparkles size={12} />
              Platform v2.1 Pro Max
            </div>
            <div className="space-y-1">
              <h2 className="text-3xl font-bold text-text-primary leading-tight tracking-tight">
                CommandCenter
              </h2>
              <p className="text-sm text-text-secondary max-w-md leading-relaxed font-medium">
                Your high-performance workspace for project intelligence, 
                delivery automation, and strategic team alignment.
              </p>
            </div>
            <button
              onClick={() => navigate('/board')}
              className="btn-primary btn-md rounded-full shadow-lg shadow-accent/20"
            >
              Enter Sprint Board <ArrowUpRight size={16} />
            </button>
          </div>
          
          <div className="hidden lg:flex items-center gap-6 select-none">
            <div className="grid grid-cols-2 gap-3 opacity-20 transform rotate-12 scale-110">
              <div className="w-16 h-16 rounded-2xl bg-accent/20 border-2 border-accent/30 flex items-center justify-center">
                <Package size={28} className="text-accent" />
              </div>
              <div className="w-16 h-16 rounded-2xl bg-text-primary/10 border-2 border-text-primary/20 flex items-center justify-center mt-6">
                <Users size={28} className="text-text-primary" />
              </div>
              <div className="w-16 h-16 rounded-2xl bg-text-primary/10 border-2 border-text-primary/20 flex items-center justify-center -mt-6">
                <CircleDot size={28} className="text-text-primary" />
              </div>
              <div className="w-16 h-16 rounded-2xl bg-success/20 border-2 border-success/30 flex items-center justify-center">
                <Zap size={28} className="text-success" />
              </div>
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
              className="card-interactive p-6 space-y-4 relative overflow-hidden group"
            >
              <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-500 ${card.iconColor.replace('text-', 'bg-')}`} />
              <div className="relative z-10 space-y-4">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-sm ${card.iconBg}`}>
                  <Icon size={20} className={card.iconColor} />
                </div>
                <div>
                  <p className="text-3xl font-bold text-text-primary tracking-tighter leading-none">{card.value}</p>
                  <p className="text-xs font-bold text-text-muted mt-2 uppercase tracking-widest">{card.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Bento Grid Layout ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Active Sprint - Bento Large */}
        <div className="lg:col-span-7 card p-6 space-y-6 flex flex-col justify-between group hover:border-accent/30 transition-all duration-300">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Zap size={16} className="text-accent" />
                </div>
                <span className="text-sm font-bold text-text-primary uppercase tracking-widest">Active Sprint</span>
              </div>
              {activeSprint && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-success/10 border border-success/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                  <span className="text-[10px] font-bold text-success uppercase tracking-wider">
                    {SPRINT_STATUS_LABELS[activeSprint.status]}
                  </span>
                </div>
              )}
            </div>

            {activeSprint ? (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
                <div className="md:col-span-3 space-y-4">
                  <div>
                    <h4 className="font-bold text-text-primary text-lg tracking-tight">{activeSprint.name}</h4>
                    {activeSprint.goals && (
                      <p className="text-sm text-text-secondary mt-2 line-clamp-3 leading-relaxed font-medium">
                        {activeSprint.goals}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs font-bold text-text-muted uppercase tracking-widest">
                    <span className="flex items-center gap-1.5"><Clock size={12} /> {new Date(activeSprint.start_date).toLocaleDateString()}</span>
                    <span>&mdash;</span>
                    <span className="flex items-center gap-1.5">Ends {activeSprint.end_date ? new Date(activeSprint.end_date).toLocaleDateString() : 'TBD'}</span>
                  </div>
                </div>

                <div className="md:col-span-2 space-y-5 flex flex-col justify-center border-l border-border/40 pl-8">
                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Sprint Progress</span>
                      <span className="text-lg font-bold text-text-primary">{sprintProgress}%</span>
                    </div>
                    <div className="progress-bar-track h-2">
                      <div
                        className="progress-bar-fill shadow-[0_0_10px_rgba(var(--accent-rgb),0.3)]"
                        style={{ width: `${sprintProgress}%` }}
                      />
                    </div>
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                      {completedSprintIssues.length} / {activeSprintIssues.length} Tasks Finalized
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-text-muted space-y-4">
                <div className="w-16 h-16 rounded-full bg-bg-elevated border border-border flex items-center justify-center mx-auto opacity-40">
                  <AlertCircle size={28} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-text-secondary">No active sprint running</p>
                  <p className="text-xs text-text-muted">Initiate a new sprint to begin tracking velocity.</p>
                </div>
                <Button variant="secondary" size="sm" className="rounded-full px-6" onClick={() => navigate('/sprints')}>
                  Go to Sprint Planner
                </Button>
              </div>
            )}
          </div>

          {activeSprint && (
            <div className="pt-2">
              <button
                onClick={() => navigate('/board')}
                className="btn-secondary w-full h-11 rounded-xl shadow-sm group-hover:bg-bg-elevated/80"
              >
                Sprint Kanban Board <ArrowUpRight size={16} className="text-text-muted group-hover:text-accent group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
              </button>
            </div>
          )}
        </div>

        {/* Issue Distribution - Bento Small */}
        <div className="lg:col-span-5 card p-6 space-y-4 flex flex-col hover:border-accent/20 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-text-primary uppercase tracking-widest">Status Distribution</span>
            <div className="p-1.5 rounded-lg bg-bg-elevated/40 border border-border/40">
              <TrendingUp size={14} className="text-text-muted" />
            </div>
          </div>
          <div className="flex-1 w-full min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(var(--border-rgb), 0.3)" />
                <XAxis 
                  dataKey="name" 
                  stroke="rgba(var(--text-muted-rgb), 0.5)" 
                  fontSize={10} 
                  fontWeight={600}
                  tickLine={false} 
                  axisLine={false}
                  tick={{ dy: 10 }}
                />
                <YAxis 
                  stroke="rgba(var(--text-muted-rgb), 0.5)" 
                  fontSize={10} 
                  fontWeight={600}
                  tickLine={false} 
                  axisLine={false}
                  allowDecimals={false} 
                />
                <Tooltip
                  cursor={{ fill: 'rgba(var(--accent-rgb), 0.05)', radius: 4 }}
                  contentStyle={{
                    background: 'rgba(var(--bg-elevated-rgb), 0.9)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(var(--border-rgb), 1)',
                    borderRadius: '12px',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                    padding: '12px',
                    fontSize: '12px',
                    fontWeight: '600',
                  }}
                />
                <Bar 
                  dataKey="count" 
                  fill="url(#colorAccent)" 
                  radius={[6, 6, 0, 0]} 
                  maxBarSize={32} 
                />
                <defs>
                  <linearGradient id="colorAccent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(var(--accent-rgb), 1)" />
                    <stop offset="100%" stopColor="rgba(var(--accent-rgb), 0.6)" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Velocity Chart - Bento Small */}
        <div className="lg:col-span-5 card p-6 space-y-4 flex flex-col hover:border-accent/20 transition-all duration-300">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <TrendingUp size={16} className="text-accent" />
            </div>
            <span className="text-sm font-bold text-text-primary uppercase tracking-widest">Sprint Velocity</span>
          </div>
          <div className="flex-1 w-full min-h-[220px]">
            {velocityChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-text-muted text-xs font-medium bg-bg-elevated/20 rounded-xl border border-dashed border-border/60">
                Awaiting historical sprint data...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={velocityChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(var(--border-rgb), 0.3)" />
                  <XAxis 
                    dataKey="name" 
                    stroke="rgba(var(--text-muted-rgb), 0.5)" 
                    fontSize={10} 
                    fontWeight={600}
                    tickLine={false} 
                    axisLine={false}
                    tick={{ dy: 10 }}
                  />
                  <YAxis 
                    stroke="rgba(var(--text-muted-rgb), 0.5)" 
                    fontSize={10} 
                    fontWeight={600}
                    tickLine={false} 
                    axisLine={false}
                    allowDecimals={false} 
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(var(--accent-rgb), 0.05)', radius: 4 }}
                    contentStyle={{
                      background: 'rgba(var(--bg-elevated-rgb), 0.9)',
                      backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(var(--border-rgb), 1)',
                      borderRadius: '12px',
                      padding: '12px',
                      fontSize: '12px',
                      fontWeight: '600',
                    }}
                  />
                  <Bar dataKey="velocity" fill="#7c6ef5" radius={[6, 6, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Burndown Chart - Bento Large */}
        <div className="lg:col-span-7 card p-6 space-y-4 flex flex-col hover:border-accent/20 transition-all duration-300">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <LineChartIcon size={16} className="text-accent" />
            </div>
            <span className="text-sm font-bold text-text-primary uppercase tracking-widest">Sprint Burndown</span>
          </div>
          <div className="flex-1 w-full min-h-[220px]">
            {burndownChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-text-muted text-xs font-medium bg-bg-elevated/20 rounded-xl border border-dashed border-border/60">
                {activeSprint ? 'Tracking active sprint issues...' : 'No active burn data available.'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={burndownChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(var(--border-rgb), 0.3)" />
                  <XAxis 
                    dataKey="day" 
                    stroke="rgba(var(--text-muted-rgb), 0.5)" 
                    fontSize={10} 
                    fontWeight={600}
                    tickLine={false} 
                    axisLine={false}
                    tick={{ dy: 10 }}
                  />
                  <YAxis 
                    stroke="rgba(var(--text-muted-rgb), 0.5)" 
                    fontSize={10} 
                    fontWeight={600}
                    tickLine={false} 
                    axisLine={false}
                    allowDecimals={false} 
                    domain={[0, 'auto']} 
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(var(--bg-elevated-rgb), 0.9)',
                      backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(var(--border-rgb), 1)',
                      borderRadius: '12px',
                      padding: '12px',
                      fontSize: '12px',
                      fontWeight: '600',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="ideal"
                    stroke="rgba(var(--text-muted-rgb), 0.4)"
                    strokeWidth={2}
                    strokeDasharray="8 6"
                    dot={false}
                    name="Ideal Trend"
                  />
                  <Line
                    type="monotone"
                    dataKey="remaining"
                    stroke="#7c6ef5"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#7c6ef5', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                    name="Actual Burn"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ─── Project Time Budgets Row ─── */}
      {projectBudgets.length > 0 && (
        <div className="card p-6 space-y-6">
          <div className="flex items-center gap-3 border-b border-border/60 pb-5">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <FolderKanban size={16} className="text-accent" />
            </div>
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-widest">Project Time Budgets</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {projectBudgets.map((pb) => (
              <div key={pb.id} className="p-5 rounded-xl bg-bg-elevated/30 border border-border/60 space-y-4 hover:bg-bg-elevated/50 transition-colors group">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-bold text-text-primary truncate max-w-[70%] tracking-tight group-hover:text-accent transition-colors">{pb.name}</span>
                  <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm ${
                    pb.percent >= 90 ? 'bg-danger/10 text-danger border border-danger/20' : pb.percent >= 75 ? 'bg-warning/10 text-warning border border-warning/20' : 'bg-success/10 text-success border border-success/20'
                  }`}>
                    {pb.percent}%
                  </div>
                </div>
                <div className="space-y-2.5">
                  <div className="h-2 w-full bg-bg-surface border border-border/40 rounded-full overflow-hidden shadow-inner">
                    <div
                      className={`h-full transition-all duration-700 ease-out shadow-sm ${
                        pb.percent >= 90 ? 'bg-danger' : pb.percent >= 75 ? 'bg-warning' : 'bg-success'
                      }`}
                      style={{ width: `${pb.percent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-text-muted font-bold uppercase tracking-widest">
                    <span>{pb.consumed}h <span className="opacity-50">logged</span></span>
                    <span>{pb.remaining}h <span className="opacity-50">left</span></span>
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
