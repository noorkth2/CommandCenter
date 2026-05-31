/**
 * IssuesKanban.jsx
 * Drag-and-drop kanban for issues using @hello-pangea/dnd.
 * Drop into src/components/issues/IssuesKanban.jsx
 * Uses the same DnD library already installed for Sprints.
 *
 * Props:
 *   issues     — Issue[] (pre-filtered by project or sprint if needed)
 *   onCardClick — (issue) => void — opens detail modal
 */

import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useIssueStore } from '../../store/useIssueStore';
import { useToast } from '../ui/Toast';
import PriorityBadge from '../shared/PriorityBadge';
import SeverityBadge from '../shared/SeverityBadge';
import { PRIORITY_COLORS } from '../../lib/constants';
import { ShieldAlert } from 'lucide-react';

const COLUMNS = [
  { id: 'backlog',         label: 'Backlog',          color: 'bg-neutral-700' },
  { id: 'todo',            label: 'Todo',              color: 'bg-neutral-600' },
  { id: 'in_progress',     label: 'In Progress',       color: 'bg-blue-600' },
  { id: 'testing',         label: 'Testing',           color: 'bg-purple-600' },
  { id: 'uat',             label: 'UAT',               color: 'bg-indigo-600' },
  { id: 'ready_to_deploy', label: 'Ready to Deploy',   color: 'bg-yellow-600' },
  { id: 'production',      label: 'Production',        color: 'bg-green-600' },
  { id: 'monitoring',      label: 'Monitoring',        color: 'bg-teal-600' },
  { id: 'done',            label: 'Done',              color: 'bg-emerald-700' },
];

export default function IssuesKanban({ issues = [], onCardClick }) {
  const { transitionStatus } = useIssueStore();
  const toast = useToast();

  const byStatus = COLUMNS.reduce((acc, col) => {
    acc[col.id] = issues.filter((i) => i.status === col.id);
    return acc;
  }, {});

  const onDragEnd = async ({ source, destination, draggableId }) => {
    if (!destination) return;
    if (source.droppableId === destination.droppableId) return;

    // Epic 5: Definition of Done Check
    if (destination.droppableId === 'done') {
      const issue = issues.find(i => i.id === draggableId);
      const dod = issue?.definition_of_done ?? [];
      const incomplete = dod.filter(item => !item.checked);
      
      if (incomplete.length > 0) {
        toast.error(`Cannot complete issue: ${incomplete.length} DoD items remaining.`);
        return;
      }
    }

    const result = await transitionStatus(draggableId, destination.droppableId);
    if (result?.error) {
      console.warn('[Kanban] Transition blocked:', result.error);
    }
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4 h-full min-h-0">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            column={col}
            items={byStatus[col.id]}
            onCardClick={onCardClick}
          />
        ))}
      </div>
    </DragDropContext>
  );
}

function KanbanColumn({ column, items, onCardClick }) {
  return (
    <div className="flex-shrink-0 w-60 flex flex-col bg-neutral-900 rounded-lg border border-white/5">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${column.color}`} />
          <span className="text-xs font-medium text-white/70 uppercase tracking-wider">
            {column.label}
          </span>
        </div>
        <span className="text-xs text-white/30 bg-white/5 rounded px-1.5 py-0.5">
          {items.length}
        </span>
      </div>

      {/* Cards */}
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 flex flex-col gap-2 p-2 overflow-y-auto min-h-[60px] transition-colors
              ${snapshot.isDraggingOver ? 'bg-white/5' : ''}`}
          >
            {items.map((issue, index) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                index={index}
                onClick={() => onCardClick?.(issue)}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

function IssueCard({ issue, index, onClick }) {
  return (
    <Draggable draggableId={issue.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          className={`bg-neutral-800 border border-white/5 rounded-md p-2.5 cursor-pointer
            hover:border-white/15 hover:bg-neutral-750 transition-all select-none
            ${snapshot.isDragging ? 'shadow-xl ring-1 ring-white/10 rotate-1' : ''}`}
        >
          {/* Title */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-xs text-white/80 font-medium leading-snug line-clamp-2">
              {issue.title}
            </p>
            {issue.is_tech_debt && (
              <ShieldAlert size={12} className="text-warning flex-shrink-0" title="Technical Debt" />
            )}
          </div>

          {/* Footer row */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1">
                <PriorityBadge priority={issue.priority} />
                <SeverityBadge severity={issue.severity} />
              </div>

              {issue.assignee && (
                <span
                  title={issue.assignee}
                  className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                >
                  {issue.assignee.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-1">
              {issue.labels?.slice(0, 3).map((label) => (
                <span
                  key={label}
                  className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/40 border border-white/5"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}
