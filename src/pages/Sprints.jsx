import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus,
  Play,
  CheckSquare,
  ChevronRight,
  Sparkles,
  Calendar,
  AlertCircle,
  FileText,
  Clock,
  ArrowRight,
  FolderOpen,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

import { useSprintStore } from '../store/useSprintStore';
import { useIssueStore } from '../store/useIssueStore';
import { useProjectStore } from '../store/useProjectStore';
import { useAI } from '../hooks/useAI';
import { useToast } from '../components/ui/Toast';
import Button from '../components/ui/Button';
import Dialog from '../components/ui/Dialog';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';
import StatusBadge from '../components/shared/StatusBadge';
import PriorityBadge from '../components/shared/PriorityBadge';
import { SPRINT_STATUS_LABELS } from '../lib/constants';

const sprintSchema = z.object({
  name: z.string().min(1, 'Sprint name is required'),
  goals: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

export default function Sprints() {
  const toast = useToast();
  const {
    sprints,
    loading: sprintsLoading,
    fetch: fetchSprints,
    create: createSprint,
    update: updateSprint,
    start: startSprint,
    complete: completeSprint,
  } = useSprintStore();

  const {
    issues,
    loading: issuesLoading,
    fetch: fetchIssues,
    update: updateIssue,
  } = useIssueStore();

  const { projects, fetch: fetchProjects } = useProjectStore();
  const { generateInline, generating: aiGenerating } = useAI();

  const [activeTab, setActiveTab] = useState('active'); // active | planning | history
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [selectedSprintId, setSelectedSprintId] = useState('');
  const [moveDestination, setMoveDestination] = useState('backlog'); // backlog | sprint_id
  const [plannedPoints, setPlannedPoints] = useState(0);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(sprintSchema),
    defaultValues: { name: '', goals: '', start_date: '', end_date: '' },
  });

  const fetchData = useCallback(async () => {
    await fetchSprints();
    await fetchIssues(); // Load all issues in memory for planning/active lists
    await fetchProjects();
  }, [fetchSprints, fetchIssues, fetchProjects]);

  useEffect(() => {
    fetchData();
  }, []);

  const activeSprint = sprints.find((s) => s.status === 'active') || null;
  const upcomingSprints = sprints.filter((s) => s.status === 'upcoming');
  const completedSprints = sprints.filter((s) => s.status === 'completed');

  // Issues associated with the active sprint
  const activeSprintIssues = activeSprint
    ? issues.filter((i) => i.sprint_id === activeSprint.id)
    : [];

  const completedIssues = activeSprintIssues.filter((i) => i.status === 'done');
  const incompleteIssues = activeSprintIssues.filter((i) => i.status !== 'done' && i.status !== 'cancelled');

  const progressPercent = activeSprintIssues.length
    ? Math.round((completedIssues.length / activeSprintIssues.length) * 100)
    : 0;

  const techDebtIssues = activeSprintIssues.filter(i => i.is_tech_debt);
  const techDebtPercent = activeSprintIssues.length
    ? Math.round((techDebtIssues.length / activeSprintIssues.length) * 100)
    : 0;

  // Backlog issues (no sprint_id, not done, not cancelled)
  const backlogIssues = issues.filter(
    (i) => !i.sprint_id && i.status !== 'done' && i.status !== 'cancelled'
  );

  const handleCreateSprint = async (data) => {
    try {
      const payload = {
        name: data.name,
        goals: data.goals || null,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        status: 'upcoming',
        completed_tasks_count: 0,
      };
      await createSprint(payload);
      toast.success('Upcoming sprint created');
      setCreateDialogOpen(false);
      reset();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleStartSprint = async (id) => {
    try {
      // Check if there is already an active sprint
      if (activeSprint) {
        toast.error('Complete the current active sprint before starting a new one.');
        return;
      }
      await startSprint(id);
      toast.success('Sprint started successfully!');
      await fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleCompleteSprintClick = () => {
    if (!activeSprint) return;
    setSelectedSprintId(activeSprint.id);
    setPlannedPoints(activeSprintIssues.length);
    setCompleteDialogOpen(true);
  };

  const handleCompleteSprintConfirm = async () => {
    try {
      // 1. Move incomplete issues based on user selection
      for (const issue of incompleteIssues) {
        if (moveDestination === 'backlog') {
          await updateIssue(issue.id, { sprint_id: null });
        } else if (moveDestination !== 'backlog' && moveDestination) {
          await updateIssue(issue.id, { sprint_id: moveDestination });
        }
      }

      // 2. Complete the sprint, calculating completed count, planned, and velocity
      await completeSprint(activeSprint.id, activeSprintIssues, plannedPoints);

      toast.success('Sprint completed successfully!');
      setCompleteDialogOpen(false);
      await fetchData();
    } catch (err) {
      toast.error(`Completion failed: ${err.message}`);
    }
  };

  const handleGenerateSummary = async () => {
    if (!activeSprint) return;

    try {
      // Form issues data payload — pass all sprint issues, fallback handles empty
      const issuesPayload = completedIssues.map((i) => ({
        title: i.title,
        description: i.description,
        team: i.team,
        labels: i.labels,
      }));

      const summary = await generateInline('sprint_summary', issuesPayload);
      if (!summary) {
        throw new Error('Failed to generate sprint summary content');
      }

      // Update the active sprint with the AI Summary
      await updateSprint(activeSprint.id, { ai_summary: summary });
      toast.success('Sprint summary generated successfully!');
      await fetchSprints();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleAssignIssue = async (issueId, sprintId) => {
    try {
      await updateIssue(issueId, { sprint_id: sprintId || null });
      toast.success(sprintId ? 'Issue assigned to sprint' : 'Issue returned to backlog');
      await fetchIssues();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="animate-fade-in space-y-6 pb-12">
      {/* Header */}
      <div className="section-header">
        <div>
          <h2 className="section-title">Sprint Workspace</h2>
          <p className="section-subtitle">Plan and track your development milestones</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'planning' && (
            <Button variant="primary" size="sm" onClick={() => setCreateDialogOpen(true)}>
              <Plus size={14} /> New Sprint
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border pb-px gap-4">
        {[
          { id: 'active', label: 'Active Sprint' },
          { id: 'planning', label: 'Planning & Backlog' },
          { id: 'history', label: 'Sprint History' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`text-sm pb-3 font-medium border-b-2 px-1 transition-all ${
              activeTab === tab.id
                ? 'border-accent text-accent'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active Tab Content */}
      {activeTab === 'active' && (
        <div className="space-y-6">
          {sprintsLoading ? (
            <div className="skeleton h-48 w-full rounded-lg" />
          ) : !activeSprint ? (
            <div className="card empty-state py-16">
              <Calendar size={40} className="empty-state-icon text-text-muted" />
              <p className="empty-state-title">No Active Sprint</p>
              <p className="empty-state-desc">
                There is currently no active sprint running. Head over to the Planning tab to start one.
              </p>
              <Button variant="primary" size="sm" onClick={() => setActiveTab('planning')}>
                Go to Planning
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Columns: Sprint board / details */}
              <div className="lg:col-span-2 space-y-6">
                {/* Sprint Header details card */}
                <div className="card p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div>
                      <h3 className="font-semibold text-text-primary text-base">{activeSprint.name}</h3>
                      {activeSprint.goals && (
                        <p className="text-xs text-text-secondary mt-1">{activeSprint.goals}</p>
                      )}
                    </div>
                    <Button variant="secondary" size="sm" onClick={handleCompleteSprintClick}>
                      Complete Sprint
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <span className="text-[10px] text-text-muted uppercase block font-medium">Start Date</span>
                      <span className="text-xs font-semibold text-text-secondary">
                        {activeSprint.start_date || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-text-muted uppercase block font-medium">End Date</span>
                      <span className="text-xs font-semibold text-text-secondary">
                        {activeSprint.end_date || '—'}
                      </span>
                    </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                    <div className="col-span-2">
                      <span className="text-[10px] text-text-muted uppercase block font-medium mb-1">
                        Sprint Progress ({progressPercent}%)
                      </span>
                      <div className="progress-bar-track">
                        <div
                          className="progress-bar-fill"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-text-muted block mt-1">
                        {completedIssues.length} of {activeSprintIssues.length} issues completed
                      </span>
                    </div>

                    <div className="col-span-2">
                      <span className="text-[10px] text-text-muted uppercase block font-medium mb-1 flex items-center justify-between">
                        Tech Debt Allocation ({techDebtPercent}%)
                        {techDebtPercent > 15 && (
                          <span className="text-[10px] text-danger font-bold flex items-center gap-1">
                            <AlertCircle size={10} /> Over Budget
                          </span>
                        )}
                      </span>
                      <div className="h-2 w-full bg-bg-elevated rounded-full overflow-hidden border border-border">
                        <div
                          className={`h-full transition-all ${techDebtPercent > 15 ? 'bg-danger' : 'bg-warning'}`}
                          style={{ width: `${techDebtPercent}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-text-muted block mt-1">
                        {techDebtIssues.length} of {activeSprintIssues.length} issues are tech debt
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sprint Issues List */}
                <div className="card p-5 space-y-4">

                  <h4 className="font-semibold text-text-primary text-sm">Sprint Issues</h4>

                  {activeSprintIssues.length === 0 ? (
                    <p className="text-xs text-text-muted">No issues added to this sprint yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                      {activeSprintIssues.map((issue) => (
                        <div
                          key={issue.id}
                          className="p-3 bg-bg-elevated border border-border rounded-lg flex items-center justify-between gap-4 hover:border-border-hover transition-colors"
                        >
                          <div className="min-w-0">
                            <span className="font-medium text-text-primary text-xs block truncate">
                              {issue.title}
                            </span>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-2xs text-text-muted capitalize">
                                {issue.projects?.name ?? 'No Project'}
                              </span>
                              {issue.team && (
                                <span className="badge text-[10px] bg-bg-surface border-border text-text-muted font-normal">
                                  {issue.team}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 flex-shrink-0">
                            <PriorityBadge priority={issue.priority} />
                            <StatusBadge status={issue.status} />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="!h-6 !px-1.5 !text-2xs border border-border bg-bg-surface"
                              onClick={() => handleAssignIssue(issue.id, null)}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: AI summary / report panel */}
              <div className="space-y-6">
                <div className="card p-5 space-y-4 flex flex-col justify-between min-h-[300px]">
                  <div>
                    <div className="flex items-center justify-between border-b border-border pb-3 mb-3">
                      <div className="flex items-center gap-2">
                        <Sparkles size={15} className="text-accent" />
                        <h4 className="font-semibold text-text-primary text-sm">AI Sprint Summary</h4>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="!h-7 !px-2 border border-accent/20 text-accent hover:bg-accent/5"
                        onClick={handleGenerateSummary}
                        loading={aiGenerating}
                      >
                        <Sparkles size={11} /> Generate
                      </Button>
                    </div>

                    {activeSprint.ai_summary ? (
                      <div className="prose prose-invert prose-xs leading-relaxed text-text-secondary text-xs max-h-80 overflow-y-auto pr-1">
                        <ReactMarkdown>{activeSprint.ai_summary}</ReactMarkdown>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-text-muted space-y-2">
                        <Sparkles size={24} className="mx-auto text-text-muted opacity-40 animate-pulse" />
                        <p className="text-xs">No AI summary generated for this active sprint yet.</p>
                        <p className="text-[10px] max-w-xs mx-auto">
                          Click **Generate** to automatically analyze and summarize completed tasks in
                           this sprint via AI report generation.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'planning' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Sprints (Active / Upcoming) */}
          <div className="lg:col-span-1 space-y-4">
            <h3 className="font-semibold text-text-primary text-sm flex items-center gap-2">
              <Calendar size={15} className="text-accent" />
              Active & Upcoming Sprints
            </h3>

            {sprintsLoading && sprints.length === 0 ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="skeleton h-24 rounded-lg" />
              ))
            ) : sprints.filter((s) => s.status !== 'completed').length === 0 ? (
              <div className="card p-6 text-center text-text-muted text-xs">
                No active or upcoming sprints. Click **New Sprint** to create one.
              </div>
            ) : (
              <div className="space-y-3">
                {sprints
                  .filter((s) => s.status !== 'completed')
                  .map((sprint) => {
                    const sprintIssues = issues.filter((i) => i.sprint_id === sprint.id);
                    return (
                      <div
                        key={sprint.id}
                        className={`card p-4 space-y-3 border transition-all ${
                          sprint.status === 'active' ? 'border-accent/30 bg-accent/5' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between border-b border-border/40 pb-2">
                          <div>
                            <h4 className="font-semibold text-text-primary text-xs">{sprint.name}</h4>
                            <span className="text-[10px] text-text-muted mt-0.5 block capitalize">
                              Status: {SPRINT_STATUS_LABELS[sprint.status]}
                            </span>
                          </div>
                          {sprint.status === 'upcoming' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="!h-6 !px-2 bg-accent/10 text-accent hover:bg-accent/20"
                              onClick={() => handleStartSprint(sprint.id)}
                            >
                              <Play size={9} /> Start
                            </Button>
                          )}
                        </div>

                        <div className="text-[11px] text-text-secondary space-y-1">
                          {sprint.goals && <p className="truncate">Goal: {sprint.goals}</p>}
                          <div className="flex justify-between">
                            <span>Issues Assigned:</span>
                            <span className="font-medium text-text-primary">{sprintIssues.length}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Right 2 Columns: Backlog List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-text-primary text-sm flex items-center gap-2">
                <FolderOpen size={15} className="text-warning" />
                Unassigned Backlog ({backlogIssues.length} issues)
              </h3>
            </div>

            <div className="card overflow-hidden">
              {issuesLoading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="skeleton h-10 w-full" />
                  ))}
                </div>
              ) : backlogIssues.length === 0 ? (
                <div className="p-12 text-center text-text-muted text-xs">
                  Backlog is clean! No unassigned active issues.
                </div>
              ) : (
                <div className="table-wrapper max-h-[480px] overflow-y-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Project</th>
                        <th>Priority</th>
                        <th>Team</th>
                        <th className="w-48 text-right">Sprint Allocation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backlogIssues.map((issue) => (
                        <tr key={issue.id}>
                          <td>
                            <span className="text-xs font-semibold text-text-primary block truncate max-w-xs">
                              {issue.title}
                            </span>
                          </td>
                          <td>
                            <span className="text-xs text-text-muted">
                              {issue.projects?.name ?? '—'}
                            </span>
                          </td>
                          <td>
                            <PriorityBadge priority={issue.priority} />
                          </td>
                          <td>
                            <span className="text-2xs capitalize text-text-secondary">
                              {issue.team ?? '—'}
                            </span>
                          </td>
                          <td className="text-right">
                            <Select
                              placeholder="Assign to sprint"
                              options={sprints
                                .filter((s) => s.status !== 'completed')
                                .map((s) => ({ value: s.id, label: s.name }))}
                              className="!h-7 text-xs !py-0.5 inline-block w-40"
                              onChange={(e) => handleAssignIssue(issue.id, e.target.value)}
                              value=""
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-4">
          <h3 className="font-semibold text-text-primary text-sm flex items-center gap-2">
            <Clock size={15} className="text-accent" />
            Completed Sprint Logs
          </h3>

          {sprintsLoading && sprints.length === 0 ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-24 rounded-lg" />
            ))
          ) : completedSprints.length === 0 ? (
            <div className="card p-12 text-center text-text-muted text-xs">
              No completed sprint history logged yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {completedSprints.map((sprint) => (
                <div key={sprint.id} className="card p-5 space-y-4 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <h4 className="font-semibold text-text-primary text-sm">{sprint.name}</h4>
                      <span className="badge text-xs bg-success/10 text-success border-success/20">
                        {sprint.completed_tasks_count} completed
                      </span>
                    </div>

                    <div className="text-[11px] text-text-secondary space-y-1">
                      {sprint.goals && <p>Goal: {sprint.goals}</p>}
                      <p>
                        Dates: {sprint.start_date} <ArrowRight size={8} className="inline mx-1" />{' '}
                        {sprint.end_date}
                      </p>
                      {sprint.velocity !== undefined && sprint.velocity !== null && (
                        <div className="flex justify-between mt-2 pt-2 border-t border-border">
                          <span>Planned: <strong>{sprint.planned_points || 0}</strong></span>
                          <span>Completed: <strong>{sprint.completed_points || 0}</strong></span>
                          <span>Velocity: <strong className="text-success">{Math.round(sprint.velocity * 100)}%</strong></span>
                        </div>
                      )}
                    </div>
                  </div>

                  {sprint.ai_summary && (
                    <details className="mt-2 group">
                      <summary className="text-2xs text-accent cursor-pointer select-none font-medium outline-none hover:underline">
                        View AI Summary
                      </summary>
                      <div className="mt-2 p-3 bg-bg-elevated rounded border border-border/80 prose prose-invert prose-xs text-text-secondary text-2xs leading-relaxed max-h-40 overflow-y-auto">
                        <ReactMarkdown>{sprint.ai_summary}</ReactMarkdown>
                      </div>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* dialog: Create Sprint */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        title="Create Sprint"
        subtitle="Schedule a new development iteration sprint"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSubmit(handleCreateSprint)} loading={isSubmitting}>
              Create Sprint
            </Button>
          </>
        }
      >
        <form className="space-y-4">
          <Input
            label="Sprint Name"
            placeholder="e.g. Sprint 12 — Auth Integration"
            required
            error={errors.name?.message}
            {...register('name')}
          />
          <Textarea
            label="Sprint Goals"
            placeholder="What needs to be achieved in this iteration milestone?"
            rows={3}
            error={errors.goals?.message}
            {...register('goals')}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Start Date" type="date" error={errors.start_date?.message} {...register('start_date')} />
            <Input label="End Date" type="date" error={errors.end_date?.message} {...register('end_date')} />
          </div>
        </form>
      </Dialog>

      {/* dialog: Complete Sprint confirmation with backlog migration */}
      <Dialog
        open={completeDialogOpen}
        onClose={() => setCompleteDialogOpen(false)}
        title="Complete Sprint Milestone"
        subtitle={`Closing sprint: ${activeSprint?.name}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCompleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCompleteSprintConfirm}>
              Close Sprint
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-3.5 bg-danger/5 border border-danger/10 rounded-lg text-xs text-text-secondary flex gap-3 items-start">
            <AlertCircle size={16} className="text-danger flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-text-primary">Sprint Issues Allocation</p>
              <p className="mt-1 leading-relaxed">
                There are still <strong className="text-danger">{incompleteIssues.length} unresolved</strong> issues
                linked to this active sprint. You must choose what to do with these items before completing the sprint.
              </p>
            </div>
          </div>

          <Select
            label="Move Incomplete Issues To"
            value={moveDestination}
            onChange={(e) => setMoveDestination(e.target.value)}
            options={[
              { value: 'backlog', label: 'Unassigned Backlog' },
              ...sprints
                .filter((s) => s.status === 'upcoming')
                .map((s) => ({ value: s.id, label: `Upcoming: ${s.name}` })),
            ]}
          />

          <Input
            label="Planned Scope / Points (Default is number of sprint tasks)"
            type="number"
            min={1}
            value={plannedPoints}
            onChange={(e) => setPlannedPoints(parseInt(e.target.value) || 0)}
          />
        </div>
      </Dialog>
    </div>
  );
}
