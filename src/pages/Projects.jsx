import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, ExternalLink, MoreHorizontal, FolderKanban } from 'lucide-react';
import { format } from 'date-fns';

import { useProjectStore } from '../store/useProjectStore';
import { useToast } from '../components/ui/Toast';
import Button from '../components/ui/Button';
import Dialog from '../components/ui/Dialog';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import StatusBadge from '../components/shared/StatusBadge';
import PriorityBadge from '../components/shared/PriorityBadge';
import Dropdown from '../components/ui/Dropdown';
import {
  PROJECT_STATUSES, PROJECT_PRIORITIES, PROJECT_CATEGORIES,
  PROJECT_STATUS_LABELS, PROJECT_PRIORITY_LABELS, PROJECT_CATEGORY_LABELS,
} from '../lib/constants';

// ─── Validation schema ────────────────────────────────────────────────────────
const schema = z.object({
  name: z.string().min(1, 'Project name is required').max(100),
  status: z.enum(PROJECT_STATUSES),
  priority: z.enum(PROJECT_PRIORITIES),
  category: z.enum(PROJECT_CATEGORIES).optional().or(z.literal('')),
  tech_stack: z.string().optional(),
  deadline: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
const toOptions = (arr, labels) => arr.map((v) => ({ value: v, label: labels[v] ?? v }));

export default function Projects() {
  const { projects, loading, fetch, create, update, delete: deleteProject } = useProjectStore();
  const toast = useToast();

  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState(null); // Project | null
  const [confirmId, setConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { status: 'active', priority: 'p2', tech_stack: '', category: '' },
  });

  useEffect(() => { fetch(); }, [fetch]);

  const openCreate = () => {
    setEditing(null);
    reset({ status: 'active', priority: 'p2', tech_stack: '', category: '', name: '', description: '', notes: '', deadline: '' });
    setPanelOpen(true);
  };

  const openEdit = useCallback((project) => {
    setEditing(project);
    reset({
      name: project.name,
      status: project.status,
      priority: project.priority,
      category: project.category ?? '',
      tech_stack: (project.tech_stack ?? []).join(', '),
      deadline: project.deadline ?? '',
      description: project.description ?? '',
      notes: project.notes ?? '',
    });
    setPanelOpen(true);
  }, [reset]);

  const onSubmit = async (data) => {
    try {
      const payload = {
        ...data,
        category: data.category || null,
        tech_stack: data.tech_stack ? data.tech_stack.split(',').map(t => t.trim()).filter(Boolean) : [],
        deadline: data.deadline || null,
      };
      if (editing) {
        await update(editing.id, payload);
        toast.success('Project updated');
      } else {
        await create(payload);
        toast.success('Project created');
      }
      setPanelOpen(false);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    if (!confirmId) return;
    setDeleting(true);
    try {
      await deleteProject(confirmId);
      toast.success('Project deleted');
      setConfirmId(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="section-header">
        <div>
          <h2 className="section-title">Projects</h2>
          <p className="section-subtitle">{projects.length} total</p>
        </div>
        <Button variant="primary" size="sm" onClick={openCreate}>
          <Plus size={14} /> New Project
        </Button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <ProjectsSkeleton />
        ) : projects.length === 0 ? (
          <div className="empty-state">
            <FolderKanban size={40} className="empty-state-icon" />
            <p className="empty-state-title">No projects yet</p>
            <p className="empty-state-desc">Create your first project to start tracking work.</p>
            <Button variant="primary" size="sm" onClick={openCreate}><Plus size={14} /> New Project</Button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Category</th>
                  <th>Tech Stack</th>
                  <th>Deadline</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="cursor-pointer" onClick={() => openEdit(p)}>
                    <td>
                      <span className="font-medium text-text-primary">{p.name}</span>
                      {p.description && (
                        <p className="text-xs text-text-muted mt-0.5 truncate max-w-xs">{p.description}</p>
                      )}
                    </td>
                    <td><StatusBadge status={p.status} /></td>
                    <td><PriorityBadge priority={p.priority} /></td>
                    <td>
                      {p.category ? (
                        <span className="text-xs text-text-secondary capitalize">
                          {PROJECT_CATEGORY_LABELS[p.category] ?? p.category}
                        </span>
                      ) : <span className="text-text-muted text-xs">—</span>}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {(p.tech_stack ?? []).slice(0, 3).map((t) => (
                          <span key={t} className="text-xs px-1.5 py-0.5 rounded bg-bg-hover text-text-secondary border border-border">
                            {t}
                          </span>
                        ))}
                        {(p.tech_stack ?? []).length > 3 && (
                          <span className="text-xs text-text-muted">+{p.tech_stack.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      {p.deadline
                        ? <span className="text-xs text-text-secondary">{format(new Date(p.deadline), 'MMM d, yyyy')}</span>
                        : <span className="text-text-muted text-xs">—</span>
                      }
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <Dropdown
                        trigger={
                          <Button variant="icon" size="sm" aria-label="Project actions">
                            <MoreHorizontal size={15} />
                          </Button>
                        }
                        items={[
                          { label: 'Edit', icon: <Pencil size={13} />, onClick: () => openEdit(p) },
                          { separator: true },
                          { label: 'Delete', icon: <Trash2 size={13} />, danger: true, onClick: () => setConfirmId(p.id) },
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

      {/* Create / Edit Panel */}
      <Dialog
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        title={editing ? 'Edit Project' : 'New Project'}
        subtitle={editing ? editing.name : 'Fill in the details below'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPanelOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
              {editing ? 'Save Changes' : 'Create Project'}
            </Button>
          </>
        }
      >
        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
          <Input label="Project Name" placeholder="e.g. Payment Gateway Integration" required error={errors.name?.message} {...register('name')} />

          <div className="grid grid-cols-2 gap-4">
            <Select label="Status" options={toOptions(PROJECT_STATUSES, PROJECT_STATUS_LABELS)} error={errors.status?.message} {...register('status')} />
            <Select label="Priority" options={toOptions(PROJECT_PRIORITIES, PROJECT_PRIORITY_LABELS)} error={errors.priority?.message} {...register('priority')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select label="Category" placeholder="Select category" options={toOptions(PROJECT_CATEGORIES, PROJECT_CATEGORY_LABELS)} {...register('category')} />
            <Input label="Deadline" type="date" {...register('deadline')} />
          </div>

          <Input
            label="Tech Stack"
            placeholder="React, Node.js, PostgreSQL (comma-separated)"
            hint="Separate technologies with commas"
            {...register('tech_stack')}
          />

          <Textarea label="Description" placeholder="Brief project description…" rows={3} {...register('description')} />
          <Textarea label="Notes" placeholder="Internal notes, links, context…" rows={3} {...register('notes')} />
        </form>
      </Dialog>

      {/* Confirm Delete */}
      <ConfirmDialog
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={handleDelete}
        title="Delete project?"
        message="This will permanently delete the project. Issues and QA items linked to it will be unlinked but not deleted."
        loading={deleting}
      />
    </div>
  );
}

function ProjectsSkeleton() {
  return (
    <div className="p-4 space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4 items-center">
          <div className="skeleton h-5 flex-1 rounded" />
          <div className="skeleton h-5 w-20 rounded" />
          <div className="skeleton h-5 w-16 rounded" />
          <div className="skeleton h-5 w-24 rounded" />
        </div>
      ))}
    </div>
  );
}
