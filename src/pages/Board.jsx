import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  ArrowUpRight,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

import { useIssueStore } from '../store/useIssueStore';
import { useSprintStore } from '../store/useSprintStore';
import { useProjectStore } from '../store/useProjectStore';
import { useToast } from '../components/ui/Toast';
import Button from '../components/ui/Button';
import Dialog from '../components/ui/Dialog';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';
import PriorityBadge from '../components/shared/PriorityBadge';
import {
  ISSUE_STATUSES,
  ISSUE_STATUS_LABELS,
  ISSUE_PRIORITIES,
  ISSUE_TEAMS,
  ISSUE_TEAM_LABELS,
  PROJECT_PRIORITY_LABELS,
} from '../lib/constants';

const BOARD_COLUMNS = [
  'backlog', 'todo', 'in_progress', 'testing',
  'uat', 'ready_to_deploy', 'done',
];

const WIP_LIMITS = {
  backlog: null,
  todo: null,
  in_progress: 5,
  testing: 4,
  uat: 3,
  ready_to_deploy: null,
  done: null,
};

const COLUMN_COLORS = {
  backlog: 'text-text-muted',
  todo: 'text-brand-blue',
  in_progress: 'text-brand-purple',
  testing: 'text-brand-amber',
  uat: 'text-brand-amber',
  ready_to_deploy: 'text-brand-green',
  done: 'text-brand-green',
};

export default function Board() {
  const navigate = useNavigate();
  const toast = useToast();

  const { issues, loading, fetch: fetchIssues, create, transitionStatus } = useIssueStore();
  const { sprints, fetch: fetchSprints } = useSprintStore();
  const { projects, fetch: fetchProjects } = useProjectStore();

  const [selectedSprintId, setSelectedSprintId] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState('p2');
  const [newStatus, setNewStatus] = useState('backlog');
  const [creating, setCreating] = useState(false);
  const [showSprintDropdown, setShowSprintDropdown] = useState(false);

  useEffect(() => {
    fetchIssues();
    fetchSprints();
    fetchProjects();
  }, []);

  const activeSprint = sprints.find((s) => s.status === 'active') || null;
  const upcomingSprints = sprints.filter((s) => s.status === 'upcoming');
  const completedSprints = sprints.filter((s) => s.status === 'completed').slice(-5);

  const sprintOptions = useMemo(() => {
    const all = [];
    if (activeSprint) all.push({ ...activeSprint, label: `Active: ${activeSprint.name}` });
    upcomingSprints.forEach((s) => all.push({ ...s, label: s.name }));
    completedSprints.forEach((s) => all.push({ ...s, label: `Completed: ${s.name}` }));
    return all;
  }, [activeSprint, upcomingSprints, completedSprints]);

  useEffect(() => {
    if (!selectedSprintId && activeSprint) {
      setSelectedSprintId(activeSprint.id);
    }
  }, [activeSprint, selectedSprintId]);

  const selectedSprint = sprintOptions.find((s) => s.id === selectedSprintId) || null;

  const sprintIssues = useMemo(() => {
    if (!selectedSprintId) return [];
    return issues.filter((i) => i.sprint_id === selectedSprintId);
  }, [issues, selectedSprintId]);

  const issuesByStatus = useMemo(() => {
    const map = {};
    BOARD_COLUMNS.forEach((s) => { map[s] = []; });
    sprintIssues.forEach((i) => {
      if (map[i.status]) map[i.status].push(i);
      else map[i.status] = [i];
    });
    return map;
  }, [sprintIssues]);

  const totalIssues = sprintIssues.length;
  const completedCount = sprintIssues.filter((i) => i.status === 'done').length;
  const sprintProgress = totalIssues ? Math.round((completedCount / totalIssues) * 100) : 0;

  const onDragEnd = async (result) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const newStatus = destination.droppableId;
    const issue = sprintIssues.find((i) => i.id === draggableId);
    if (!issue || issue.status === newStatus) return;

    // Check WIP limit
    const limit = WIP_LIMITS[newStatus];
    if (limit && issuesByStatus[newStatus].length >= limit) {
      toast.error(`WIP limit reached for ${ISSUE_STATUS_LABELS[newStatus]} (max ${limit})`);
      return;
    }

    try {
      await transitionStatus(draggableId, newStatus);
      toast.success(`Moved to ${ISSUE_STATUS_LABELS[newStatus]}`);
    } catch (err) {
      toast.error('Failed to update status: ' + err.message);
    }
  };

  const handleQuickCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const payload = {
        title: newTitle.trim(),
        status: newStatus,
        priority: newPriority,
        sprint_id: selectedSprintId || undefined,
        labels: [],
      };
      await create(payload);
      toast.success('Issue created');
      setNewTitle('');
      setPanelOpen(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const selectedSprintName = selectedSprint?.label || 'Select Sprint';

  return (
    <div className="animate-fade-in space-y-4 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-title">Sprint Board</h2>
          <p className="section-subtitle">Drag-and-drop sprint management</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedSprint && (
            <Button variant="secondary" size="sm" onClick={() => navigate('/sprints')}>
              Sprint Details <ArrowUpRight size={13} />
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={() => { setNewStatus('backlog'); setPanelOpen(true); }}>
            <Plus size={14} /> Add Issue
          </Button>
        </div>
      </div>

      {/* Sprint Selector + Progress */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Sprint dropdown */}
          <div className="relative flex-shrink-0 min-w-[240px]">
            <button
              onClick={() => setShowSprintDropdown(!showSprintDropdown)}
              className="w-full flex items-center justify-between gap-2 h-9 px-3 rounded border border-border bg-bg-surface text-sm text-text-primary hover:border-border-strong transition-colors"
            >
              <span className="truncate">{selectedSprintName}</span>
              <ChevronDown size={14} className="text-text-muted flex-shrink-0" />
            </button>
            {showSprintDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSprintDropdown(false)} />
                <div className="absolute top-full left-0 mt-1 w-full bg-bg-elevated border border-border rounded-lg shadow-lg z-20 py-1 max-h-[240px] overflow-y-auto">
                  {sprintOptions.length === 0 && (
                    <p className="px-3 py-2 text-xs text-text-muted">No sprints found</p>
                  )}
                  {sprintOptions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => { setSelectedSprintId(s.id); setShowSprintDropdown(false); }}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-bg-hover transition-colors ${
                        s.id === selectedSprintId ? 'text-brand-blue bg-brand-blue/5' : 'text-text-secondary'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Progress bar */}
          {selectedSprint && totalIssues > 0 && (
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex justify-between text-2xs text-text-muted">
                <span>{completedCount} / {totalIssues} done</span>
                <span>{sprintProgress}%</span>
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill glow-blue" style={{ width: `${sprintProgress}%` }} />
              </div>
            </div>
          )}

          {!selectedSprint && (
            <p className="text-xs text-text-muted flex-1">Select a sprint to view its board</p>
          )}
        </div>
      </div>

      {/* Kanban Board */}
      {loading ? (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {BOARD_COLUMNS.map((s) => (
            <div key={s} className="kanban-column flex-shrink-0">
              <div className="skeleton h-8 w-28 rounded mb-3" />
              <div className="space-y-2">
                <div className="skeleton h-24 rounded" />
                <div className="skeleton h-20 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : !selectedSprint ? (
        <div className="card p-16 text-center">
          <div className="w-12 h-12 rounded-xl bg-bg-elevated border border-border flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={24} className="text-text-muted opacity-40" />
          </div>
          <p className="text-sm text-text-primary font-medium mb-1">Select a sprint</p>
          <p className="text-xs text-text-muted">Choose a sprint above to view its board columns</p>
        </div>
      ) : sprintIssues.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="w-12 h-12 rounded-xl bg-bg-elevated border border-border flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={24} className="text-text-muted opacity-40" />
          </div>
          <p className="text-sm text-text-primary font-medium mb-1">No issues in this sprint</p>
          <p className="text-xs text-text-muted mb-4">Add your first issue to get started</p>
          <Button variant="primary" size="sm" onClick={() => { setNewStatus('backlog'); setPanelOpen(true); }}>
            <Plus size={14} /> Create First Issue
          </Button>
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '500px' }}>
            {BOARD_COLUMNS.map((status) => {
              const col = issuesByStatus[status] ?? [];
              const limit = WIP_LIMITS[status];
              const atWipLimit = limit && col.length >= limit;

              return (
                <Droppable key={status} droppableId={status}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`kanban-column flex-shrink-0 min-w-[240px] ${snapshot.isDraggingOver ? 'drag-over rounded-lg ring-1 ring-brand-blue/30' : ''}`}
                    >
                      <div className="kanban-column-header">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full bg-current ${COLUMN_COLORS[status]}`} />
                          <span className={COLUMN_COLORS[status]}>{ISSUE_STATUS_LABELS[status]}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className={`text-xs ${atWipLimit ? 'text-brand-red font-semibold' : 'text-text-muted'}`}>
                            {col.length}{limit ? `/${limit}` : ''}
                          </span>
                          <button
                            onClick={() => { setNewStatus(status); setPanelOpen(true); }}
                            className="btn-icon w-5 h-5 ml-1"
                            title={`Add to ${ISSUE_STATUS_LABELS[status]}`}
                          >
                            <Plus size={11} />
                          </button>
                        </div>
                      </div>

                      {atWipLimit && (
                        <div className="flex items-center gap-1 px-2 py-1 mb-2 rounded bg-brand-red/10 border border-brand-red/20 text-2xs text-brand-red">
                          <AlertCircle size={10} />
                          WIP limit reached
                        </div>
                      )}

                      <div className="flex flex-col gap-2 min-h-[120px]">
                        {col.map((issue, idx) => (
                          <Draggable key={issue.id} draggableId={issue.id} index={idx}>
                            {(drag, snap) => (
                              <div
                                ref={drag.innerRef}
                                {...drag.draggableProps}
                                {...drag.dragHandleProps}
                                className={`kanban-card transition-all duration-150 ${snap.isDragging ? 'shadow-elevated rotate-1 scale-[1.02]' : 'hover:border-brand-blue/30 hover:shadow-sm'}`}
                                onClick={() => navigate(`/issues`)}
                              >
                                <p className="text-sm text-text-primary font-medium leading-snug line-clamp-2 mb-2">
                                  {issue.title}
                                </p>
                                <div className="flex flex-wrap gap-1 mb-2">
                                  <PriorityBadge priority={issue.priority} />
                                  {(issue.labels ?? []).slice(0, 2).map((l) => (
                                    <span key={l} className="badge bg-bg-hover text-text-muted border-border text-xs">{l}</span>
                                  ))}
                                </div>
                                {issue.assignee && (
                                  <p className="text-2xs text-text-muted truncate">{issue.assignee}</p>
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

      {/* Quick Create Dialog */}
      <Dialog open={panelOpen} onClose={() => setPanelOpen(false)} title="Add Issue to Board">
        <div className="space-y-4">
          <Input
            label="Title"
            placeholder="Issue title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleQuickCreate(); }}
            autoFocus
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Status"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              options={BOARD_COLUMNS.map((s) => ({ value: s, label: ISSUE_STATUS_LABELS[s] }))}
            />
            <Select
              label="Priority"
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value)}
              options={ISSUE_PRIORITIES.map((p) => ({ value: p, label: PROJECT_PRIORITY_LABELS[p] }))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setPanelOpen(false)}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleQuickCreate} loading={creating}>
              <Plus size={14} /> Create
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
