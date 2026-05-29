import { useEffect, useState, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Columns, List, Trash2, Copy, Sparkles, MoreHorizontal, CircleDot } from 'lucide-react';
import { format } from 'date-fns';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

import { useIssueStore } from '../store/useIssueStore';
import { useProjectStore } from '../store/useProjectStore';
import { useSprintStore } from '../store/useSprintStore';
import { useQAStore } from '../store/useQAStore';
import { useIssueLinkStore } from '../store/useIssueLinkStore';
import { useAI } from '../hooks/useAI';
import { useAutomations } from '../hooks/useAutomations';
import { useTimeTrackingStore } from '../store/useTimeTrackingStore';
import TimerControl from '../components/timetracking/TimerControl';
import { useToast } from '../components/ui/Toast';
import Button from '../components/ui/Button';
import Dialog from '../components/ui/Dialog';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import StatusBadge from '../components/shared/StatusBadge';
import PriorityBadge from '../components/shared/PriorityBadge';
import AIGenerateButton from '../components/shared/AIGenerateButton';
import Dropdown from '../components/ui/Dropdown';
import {
  ISSUE_STATUSES, ISSUE_STATUS_LABELS, ISSUE_PRIORITIES,
  ISSUE_TEAMS, ISSUE_TEAM_LABELS, ISSUE_ENVIRONMENTS, PROJECT_PRIORITY_LABELS,
} from '../lib/constants';

// ─── Kanban columns definition ────────────────────────────────────────────────
const BOARD_COLUMNS = [
  'backlog', 'todo', 'in_progress', 'testing',
  'uat', 'ready_to_deploy', 'production', 'monitoring', 'done',
];

const COLUMN_COLORS = {
  backlog: 'text-text-muted',
  todo: 'text-accent',
  in_progress: 'text-accent',
  testing: 'text-warning',
  uat: 'text-warning',
  ready_to_deploy: 'text-success',
  production: 'text-success',
  monitoring: 'text-accent',
  done: 'text-success',
};

// ─── Validation ───────────────────────────────────────────────────────────────
const schema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().optional(),
  status: z.enum(ISSUE_STATUSES),
  priority: z.enum(['p0', 'p1', 'p2', 'p3']),
  labels: z.string().optional(),
  project_id: z.string().optional(),
  sprint_id: z.string().optional(),
  team: z.string().optional(),
  environment: z.string().optional(),
  assignee: z.string().optional(),
  steps_to_reproduce: z.string().optional(),
  expected_result: z.string().optional(),
  actual_result: z.string().optional(),
});

const toOptions = (arr, labels) => arr.map((v) => ({ value: v, label: labels[v] ?? v }));
const statusOptions = toOptions(ISSUE_STATUSES, ISSUE_STATUS_LABELS);

export default function Issues() {
  const { issues, loading, fetch, create, update, updateStatusOptimistic, delete: deleteIssue } = useIssueStore();
  const { projects, fetch: fetchProjects } = useProjectStore();
  const { sprints, fetch: fetchSprints } = useSprintStore();
  const { create: createQA } = useQAStore();
  const { generate, triage: runAiTriage, generating: aiGenerating } = useAI();
  const { trigger } = useAutomations();
  const toast = useToast();

  const [view, setView] = useState('board'); // 'board' | 'list'
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [generatingRca, setGeneratingRca] = useState(false);
  const [issueTimeEntries, setIssueTimeEntries] = useState([]);
  const [timeTotal, setTimeTotal] = useState(0);

  // Issue relationship linking states
  const { links: linkedIssues, fetchLinksForIssue, addLink, removeLink } = useIssueLinkStore();
  const [linkIssueId, setLinkIssueId] = useState('');
  const [linkType, setLinkType] = useState('related');

  // AI Triage states
  const [triageDialogOpen, setTriageDialogOpen] = useState(false);
  const [triageResults, setTriageResults] = useState([]);
  const [triaging, setTriaging] = useState(false);
  const [selectedTriageIds, setSelectedTriageIds] = useState(new Set());

  const { register, handleSubmit, reset, watch, control, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { status: 'backlog', priority: 'p2', labels: '' },
  });

  const watchedLabels = watch('labels', '');

  useEffect(() => {
    fetch();
    fetchProjects();
    fetchSprints();
  }, [fetch, fetchProjects, fetchSprints]);

  const openCreate = (defaultStatus = 'backlog') => {
    setEditing(null);
    reset({ status: defaultStatus, priority: 'p2', labels: '', title: '' });
    setPanelOpen(true);
  };

  const openEdit = useCallback(async (issue) => {
    setEditing(issue);
    reset({
      title: issue.title,
      description: issue.description ?? '',
      status: issue.status,
      priority: issue.priority,
      labels: (issue.labels ?? []).join(', '),
      project_id: issue.project_id ?? '',
      sprint_id: issue.sprint_id ?? '',
      team: issue.team ?? '',
      environment: issue.environment ?? '',
      assignee: issue.assignee ?? '',
      steps_to_reproduce: issue.steps_to_reproduce ?? '',
      expected_result: issue.expected_result ?? '',
      actual_result: issue.actual_result ?? '',
    });
    // Load time entries for this issue
    try {
      const { fetchByIssue } = useTimeTrackingStore.getState();
      const entries = await fetchByIssue(issue.id);
      setIssueTimeEntries(entries);
      setTimeTotal(entries.reduce((s, e) => s + (e.duration_minutes || 0), 0));
    } catch { /* silent */ }
    // Load issue links
    try {
      await fetchLinksForIssue(issue.id);
    } catch { /* silent */ }
    setPanelOpen(true);
  }, [reset, fetchLinksForIssue]);

  const onSubmit = async (data) => {
    try {
      const payload = {
        ...data,
        labels: data.labels ? data.labels.split(',').map(l => l.trim()).filter(Boolean) : [],
        project_id: data.project_id || null,
        sprint_id: data.sprint_id || null,
        team: data.team || null,
        environment: data.environment || null,
      };
      if (editing) {
        await update(editing.id, payload);
        toast.success('Issue updated');
      } else {
        const newIssue = await create(payload);
        toast.success('Issue created');
        // Fire automations
        await trigger('issue_created', newIssue);
      }
      setPanelOpen(false);
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Drag-and-drop
  const onDragEnd = async (result) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const newStatus = destination.droppableId;
    const issue = issues.find(i => i.id === draggableId);
    if (!issue || issue.status === newStatus) return;

    try {
      await updateStatusOptimistic(draggableId, newStatus);
      if (newStatus === 'production') {
        await trigger('deployment_completed', { ...issue, status: newStatus });
      }
    } catch (err) {
      toast.error('Failed to update status: ' + err.message);
    }
  };

  const issuesByStatus = issues.reduce((acc, i) => {
    if (!acc[i.status]) acc[i.status] = [];
    acc[i.status].push(i);
    return acc;
  }, {});

  const handleGenerateRCA = async () => {
    if (!editing) return;
    setGeneratingRca(true);
    const report = await generate('rca', editing, {
      title: `Incident Report: ${editing.title}`,
      related_id: editing.id,
      related_type: 'issue',
    });
    setGeneratingRca(false);
    if (report) toast.success('Incident report saved to AI Reports');
    else toast.error('RCA generation failed — please try again');
  };

  const handleCreateQA = async () => {
    if (!editing) return;
    try {
      await createQA({
        test_case: `[Issue] ${editing.title}`,
        project_id: editing.project_id,
        issue_id: editing.id,
        severity: editing.priority === 'p0' ? 'critical' : editing.priority === 'p1' ? 'high' : 'medium',
        status: 'to_test',
        steps_to_reproduce: editing.steps_to_reproduce,
        expected_result: editing.expected_result,
        environment: editing.environment,
      });
      toast.success('QA entry created');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteIssue(confirmId);
      toast.success('Issue deleted');
      setConfirmId(null);
      if (panelOpen) setPanelOpen(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const backlogIssues = issues.filter((i) => i.status === 'backlog');

  const handleRunTriage = async () => {
    setTriaging(true);
    try {
      const suggestions = await runAiTriage(backlogIssues);
      if (suggestions && Array.isArray(suggestions)) {
        const mapped = suggestions.map((s) => {
          const original = backlogIssues.find((bi) => bi.id === s.id);
          return {
            ...s,
            title: original ? original.title : 'Unknown Issue',
          };
        });
        setTriageResults(mapped);
        setSelectedTriageIds(new Set(mapped.map(m => m.id)));
      } else {
        toast.error('AI Triage failed to return valid suggestions.');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setTriaging(false);
    }
  };

  const handleApplyTriage = async () => {
    let successCount = 0;
    try {
      for (const result of triageResults) {
        if (selectedTriageIds.has(result.id)) {
          await update(result.id, {
            priority: result.suggested_priority,
            team: result.suggested_team,
          });
          successCount++;
        }
      }
      toast.success(`Successfully triaged ${successCount} issues!`);
      setTriageDialogOpen(false);
      setTriageResults([]);
      setSelectedTriageIds(new Set());
    } catch (err) {
      toast.error(`Error triaging: ${err.message}`);
    }
  };

  const currentLabels = watchedLabels
    ? watchedLabels.split(',').map(l => l.trim()).filter(Boolean)
    : [];

  const isCritical = currentLabels.includes('critical');

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="section-header">
        <div>
          <h2 className="section-title">Issues</h2>
          <p className="section-subtitle">{issues.filter(i => !['done','cancelled'].includes(i.status)).length} open</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center gap-0.5 bg-bg-elevated border border-border rounded p-0.5">
            <button onClick={() => setView('board')} className={`btn-icon w-7 h-7 ${view === 'board' ? 'bg-bg-elevated text-text-primary' : ''}`} title="Board view">
              <Columns size={13} />
            </button>
            <button onClick={() => setView('list')} className={`btn-icon w-7 h-7 ${view === 'list' ? 'bg-bg-elevated text-text-primary' : ''}`} title="List view">
              <List size={13} />
            </button>
          </div>
          <Button variant="secondary" size="sm" onClick={() => { setTriageDialogOpen(true); setTriageResults([]); setSelectedTriageIds(new Set()); }}>
            <Sparkles size={13} className="mr-1" /> AI Triage
          </Button>
          <Button variant="primary" size="sm" onClick={() => openCreate()}>
            <Plus size={14} /> New Issue
          </Button>
        </div>
      </div>

      {/* Board View */}
      {view === 'board' && !loading && (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-4">
            {BOARD_COLUMNS.map((status) => {
              const col = issuesByStatus[status] ?? [];
              return (
                <Droppable key={status} droppableId={status}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`kanban-column flex-shrink-0 ${snapshot.isDraggingOver ? 'drag-over rounded-lg' : ''}`}
                    >
                      <div className="kanban-column-header">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full bg-current ${COLUMN_COLORS[status]}`} />
                          <span className={COLUMN_COLORS[status]}>{ISSUE_STATUS_LABELS[status]}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-text-muted">{col.length}</span>
                          <button onClick={() => openCreate(status)} className="btn-icon w-5 h-5 ml-1" title={`Add to ${ISSUE_STATUS_LABELS[status]}`}>
                            <Plus size={11} />
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 min-h-[200px]">
                        {col.map((issue, idx) => (
                          <Draggable key={issue.id} draggableId={issue.id} index={idx}>
                            {(drag, snap) => (
                              <div
                                ref={drag.innerRef}
                                {...drag.draggableProps}
                                {...drag.dragHandleProps}
                                className={`kanban-card ${snap.isDragging ? 'rotate-1 scale-[1.02]' : ''}`}
                                onClick={() => openEdit(issue)}
                              >
                                <p className="text-sm text-text-primary font-medium leading-snug line-clamp-2 mb-2">
                                  {issue.title}
                                </p>
                                <div className="flex flex-wrap gap-1 mb-2">
                                  <PriorityBadge priority={issue.priority} />
                                  {(issue.labels ?? []).slice(0, 2).map(l => (
                                    <span key={l} className="badge bg-bg-elevated text-text-muted border-border text-xs">{l}</span>
                                  ))}
                                  {(issue.labels ?? []).length > 2 && (
                                    <span className="text-2xs text-text-muted">+{issue.labels.length - 2}</span>
                                  )}
                                </div>
                                {issue.projects?.name && (
                                  <p className="text-2xs text-text-muted truncate">{issue.projects.name}</p>
                                )}
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    </div>
                  )}
                </Droppable>
              );
            })}
          </div>
        </DragDropContext>
      )}

      {/* List View */}
      {view === 'list' && !loading && (
        <div className="card overflow-hidden">
          {issues.length === 0 ? (
            <div className="empty-state">
              <CircleDot size={40} className="empty-state-icon" />
              <p className="empty-state-title">No issues yet</p>
              <Button variant="primary" size="sm" onClick={() => openCreate()}><Plus size={14} /> New Issue</Button>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Project</th>
                    <th>Team</th>
                    <th>Created</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {issues.map((issue) => (
                    <tr key={issue.id} className="cursor-pointer" onClick={() => openEdit(issue)}>
                      <td>
                        <span className="font-medium text-text-primary">{issue.title}</span>
                        {(issue.labels ?? []).length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {issue.labels.slice(0, 3).map(l => (
                              <span key={l} className="badge bg-bg-elevated text-text-muted border-border">{l}</span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td><StatusBadge status={issue.status} /></td>
                      <td><PriorityBadge priority={issue.priority} /></td>
                      <td><span className="text-xs text-text-secondary">{issue.projects?.name ?? '—'}</span></td>
                      <td><span className="text-xs text-text-secondary capitalize">{issue.team ?? '—'}</span></td>
                      <td><span className="text-xs text-text-muted">{format(new Date(issue.created_at), 'MMM d')}</span></td>
                      <td onClick={e => e.stopPropagation()}>
                        <Dropdown
                          trigger={<Button variant="icon"><MoreHorizontal size={15} /></Button>}
                          items={[
                            { label: 'Edit', onClick: () => openEdit(issue) },
                            { separator: true },
                            { label: 'Delete', danger: true, onClick: () => setConfirmId(issue.id) },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16 text-text-muted text-sm">
          Loading issues…
        </div>
      )}

      {/* Issue Detail Panel */}
      <Dialog
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        title={editing ? 'Edit Issue' : 'New Issue'}
        subtitle={editing?.title}
        width="680px"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              {editing && (
                <>
                  <AIGenerateButton onClick={handleGenerateRCA} loading={generatingRca} label="Generate RCA" />
                  <Button variant="ghost" size="sm" onClick={handleCreateQA}>
                    <Copy size={13} /> Create QA Entry
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => setConfirmId(editing.id)}>
                    <Trash2 size={13} />
                  </Button>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => setPanelOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
                {editing ? 'Save Changes' : 'Create Issue'}
              </Button>
            </div>
          </div>
        }
      >
        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
          <Input label="Title" placeholder="Brief description of the issue" required error={errors.title?.message} {...register('title')} />

          <div className="grid grid-cols-2 gap-4">
            <Select label="Status" options={statusOptions} error={errors.status?.message} {...register('status')} />
            <Select label="Priority" options={toOptions(ISSUE_PRIORITIES, PROJECT_PRIORITY_LABELS)} {...register('priority')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Project"
              placeholder="Select project"
              options={projects.map(p => ({ value: p.id, label: p.name }))}
              {...register('project_id')}
            />
            <Select
              label="Sprint"
              placeholder="Select sprint"
              options={sprints.map(s => ({ value: s.id, label: s.name }))}
              {...register('sprint_id')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select label="Team" placeholder="Select team" options={toOptions(ISSUE_TEAMS, ISSUE_TEAM_LABELS)} {...register('team')} />
            <Select label="Environment" placeholder="Select environment" options={toOptions(ISSUE_ENVIRONMENTS, { local: 'Local', staging: 'Staging', production: 'Production' })} {...register('environment')} />
          </div>

          <Input label="Assignee" placeholder="Name or email" {...register('assignee')} />

          <Input
            label="Labels"
            placeholder="bug, critical, backend (comma-separated)"
            hint="Use 'bug' or 'critical' to trigger automations"
            {...register('labels')}
          />

          <Textarea label="Description" placeholder="Detailed description of the issue…" rows={3} {...register('description')} />
          <Textarea label="Steps to Reproduce" placeholder="1. Go to...\n2. Click on...\n3. See error" rows={3} {...register('steps_to_reproduce')} />

          <div className="grid grid-cols-2 gap-4">
            <Textarea label="Expected Result" placeholder="What should happen" rows={2} {...register('expected_result')} />
            <Textarea label="Actual Result" placeholder="What actually happened" rows={2} {...register('actual_result')} />
          </div>
        </form>

        {/* Time Tracking Section */}
        {editing && (
          <div className="mt-6 pt-4 border-t border-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-primary">Time Tracking</span>
              <div className="flex items-center gap-2">
                <TimerControl issueId={editing.id} issueTitle={editing.title} />
              </div>
            </div>
            {timeTotal > 0 && (
              <p className="text-2xs text-text-muted">
                Total: {Math.floor(timeTotal / 60)}h {timeTotal % 60}m
              </p>
            )}
            {issueTimeEntries.length > 0 ? (
              <div className="space-y-1 max-h-[150px] overflow-y-auto">
                {issueTimeEntries.slice(0, 10).map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between p-2 rounded bg-bg-elevated border border-border">
                    <div className="min-w-0 flex-1">
                      {entry.description && (
                        <p className="text-2xs text-text-secondary truncate">{entry.description}</p>
                      )}
                      <p className="text-2xs text-text-muted">{entry.date}</p>
                    </div>
                    <span className="text-2xs font-mono text-text-secondary flex-shrink-0 ml-2">
                      {Math.floor((entry.duration_minutes || 0) / 60)}h {(entry.duration_minutes || 0) % 60}m
                    </span>
                  </div>
                ))}
                {issueTimeEntries.length > 10 && (
                  <p className="text-2xs text-text-muted text-center pt-1">+ {issueTimeEntries.length - 10} more</p>
                )}
              </div>
            ) : (
              <p className="text-2xs text-text-muted">No time logged yet</p>
            )}
          </div>
        )}

        {/* Linked Issues Section */}
        {editing && (
          <div className="mt-6 pt-4 border-t border-border space-y-3">
            <h4 className="text-xs font-semibold text-text-primary">Linked Issues</h4>
            
            {/* Add Link form */}
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Select
                  label="Link to Issue"
                  placeholder="Select issue to link..."
                  value={linkIssueId}
                  onChange={(e) => setLinkIssueId(e.target.value)}
                  options={issues
                    .filter((i) => i.id !== editing.id)
                    .map((i) => ({ value: i.id, label: `[${i.status.toUpperCase()}] ${i.title}` }))}
                />
              </div>
              <div className="w-40">
                <Select
                  label="Relationship"
                  value={linkType}
                  onChange={(e) => setLinkType(e.target.value)}
                  options={[
                    { value: 'related', label: 'Related to' },
                    { value: 'blocks', label: 'Blocks' },
                    { value: 'blocked_by', label: 'Blocked by' },
                    { value: 'duplicate', label: 'Duplicate of' },
                  ]}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={async () => {
                  if (!linkIssueId) return;
                  await addLink(editing.id, linkIssueId, linkType);
                  setLinkIssueId('');
                }}
              >
                <Plus size={13} /> Link
              </Button>
            </div>

            {/* List of links */}
            {linkedIssues.length > 0 ? (
              <div className="space-y-1.5 max-h-[150px] overflow-y-auto pt-2">
                {linkedIssues.map((link) => {
                  const isSource = link.issue_id === editing.id;
                  const relatedIssue = isSource ? link.linked_issue : link.issue;
                  let displayType = link.link_type;
                  if (!isSource) {
                    if (link.link_type === 'blocks') displayType = 'blocked_by';
                    else if (link.link_type === 'blocked_by') displayType = 'blocks';
                  }

                  const badgeColors = {
                    blocks: 'bg-danger/10 text-danger border-danger/20',
                    blocked_by: 'bg-warning/10 text-warning border-warning/20',
                    duplicate: 'bg-text-muted/10 text-text-muted border-border',
                    related: 'bg-accent/10 text-accent border-accent/20',
                  };

                  return (
                    <div key={link.id} className="flex items-center justify-between p-2 rounded bg-bg-elevated border border-border hover:border-text-muted transition-colors">
                      <div className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer" onClick={() => openEdit(relatedIssue)}>
                        <span className={`badge text-3xs uppercase font-mono px-1.5 py-0.5 border ${badgeColors[displayType] || 'bg-bg-elevated'}`}>
                          {displayType.replace('_', ' ')}
                        </span>
                        <span className="text-2xs text-text-primary hover:underline truncate flex-1">
                          {relatedIssue?.title ?? 'Unknown Issue'}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-danger/60 hover:text-danger p-1"
                        onClick={() => removeLink(link.id)}
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-2xs text-text-muted">No linked issues</p>
            )}
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={handleDelete}
        title="Delete issue?"
        message="This will permanently delete the issue and unlink any associated QA items."
        loading={deleting}
      />

      {/* dialog: AI Triage */}
      <Dialog
        open={triageDialogOpen}
        onClose={() => setTriageDialogOpen(false)}
        title="AI Backlog Triage"
        subtitle="Analyze backlog issues and automatically suggest priority and team assignments"
        width="800px"
        footer={
          <div className="flex justify-between items-center w-full">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleRunTriage}
              loading={triaging}
              disabled={backlogIssues.length === 0}
            >
              <Sparkles size={13} className="mr-1" /> Run AI Triage
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setTriageDialogOpen(false)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={handleApplyTriage}
                disabled={selectedTriageIds.size === 0}
              >
                Apply Selected ({selectedTriageIds.size})
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-text-secondary">
            This tool uses AI to scan all issues currently in the <strong>Backlog</strong> and suggest a priority level and responsible team.
          </p>

          {backlogIssues.length === 0 ? (
            <div className="p-8 text-center bg-bg-elevated border border-border rounded-lg text-xs text-text-muted">
              No issues in the backlog to triage.
            </div>
          ) : triageResults.length === 0 ? (
            <div className="p-12 text-center bg-bg-elevated border border-border rounded-lg space-y-2">
              <Sparkles size={28} className="mx-auto text-accent opacity-55 animate-pulse" />
              <p className="text-xs text-text-secondary">Click "Run AI Triage" to begin analysis.</p>
              <p className="text-3xs text-text-muted">Found {backlogIssues.length} backlog issues ready for triage.</p>
            </div>
          ) : (
            <div className="table-wrapper max-h-[350px] overflow-y-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-8">
                      <input
                        type="checkbox"
                        checked={selectedTriageIds.size === triageResults.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTriageIds(new Set(triageResults.map(r => r.id)));
                          } else {
                            setSelectedTriageIds(new Set());
                          }
                        }}
                        className="rounded border-border text-accent focus:ring-accent/30"
                      />
                    </th>
                    <th>Issue Title</th>
                    <th>Suggested Priority</th>
                    <th>Suggested Team</th>
                    <th>Confidence</th>
                    <th>Reasoning</th>
                  </tr>
                </thead>
                <tbody>
                  {triageResults.map((item) => {
                    const isSelected = selectedTriageIds.has(item.id);
                    return (
                      <tr
                        key={item.id}
                        className={`cursor-pointer ${isSelected ? 'bg-accent/5' : ''}`}
                        onClick={() => {
                          const next = new Set(selectedTriageIds);
                          if (next.has(item.id)) next.delete(item.id);
                          else next.add(item.id);
                          setSelectedTriageIds(next);
                        }}
                      >
                        <td onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              const next = new Set(selectedTriageIds);
                              if (next.has(item.id)) next.delete(item.id);
                              else next.add(item.id);
                              setSelectedTriageIds(next);
                            }}
                            className="rounded border-border text-accent focus:ring-accent/30"
                          />
                        </td>
                        <td>
                          <span className="text-xs text-text-primary block truncate max-w-xs">{item.title}</span>
                        </td>
                        <td>
                          <PriorityBadge priority={item.suggested_priority} />
                        </td>
                        <td>
                          <span className="badge text-3xs uppercase bg-bg-elevated border-border text-text-secondary font-normal">
                            {item.suggested_team}
                          </span>
                        </td>
                        <td>
                          <span className={`text-2xs font-semibold ${
                            item.confidence >= 0.8 ? 'text-success' : item.confidence >= 0.5 ? 'text-warning' : 'text-text-muted'
                          }`}>
                            {Math.round(item.confidence * 100)}%
                          </span>
                        </td>
                        <td>
                          <span className="text-3xs text-text-secondary leading-normal">{item.reasoning}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
}
