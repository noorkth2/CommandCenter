import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, FolderKanban, MoreHorizontal } from 'lucide-react';
import { format } from 'date-fns';

import { useProjectStore } from '../store/useProjectStore';
import { useClientStore } from '../store/useClientStore';
import { useProductStore } from '../store/useProductStore';
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
  client_id: z.string().uuid('Invalid client selection').optional().or(z.literal('')),
  running: z.boolean().optional(),
});

const toOptions = (arr, labels) => arr.map((v) => ({ value: v, label: labels[v] ?? v }));

export default function Projects() {
  const { projects, loading: projectsLoading, fetch: fetchProjects, create, update, delete: deleteProject } = useProjectStore();
  const { clients, fetch: fetchClients } = useClientStore();
  const { products, fetch: fetchProducts } = useProductStore();
  const toast = useToast();

  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState(null); // Project | null
  const [confirmId, setConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Filters State
  const [filterProduct, setFilterProduct] = useState('all');
  const [filterClient, setFilterClient] = useState('all');

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { status: 'active', priority: 'p2', tech_stack: '', category: '', name: '', description: '', notes: '', deadline: '', client_id: '', running: true },
  });

  const loading = projectsLoading;

  useEffect(() => {
    fetchProjects();
    fetchClients();
    fetchProducts();
  }, []);

  const openCreate = () => {
    setEditing(null);
    reset({
      status: 'active',
      priority: 'p2',
      tech_stack: '',
      category: '',
      name: '',
      description: '',
      notes: '',
      deadline: '',
      client_id: '',
      running: true,
    });
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
      client_id: project.client_id ?? '',
      running: project.running ?? true,
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
        client_id: data.client_id || null,
        running: data.running !== undefined ? data.running : true,
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

  // Filter project records based on selectors
  const filteredProjects = projects.filter((p) => {
    if (filterProduct !== 'all') {
      if (!p.clients || p.clients.product_id !== filterProduct) return false;
    }
    if (filterClient !== 'all') {
      if (p.client_id !== filterClient) return false;
    }
    return true;
  });

  return (
    <div className="animate-fade-in space-y-6 pb-12">
      {/* Header */}
      <div className="section-header">
        <div>
          <h2 className="section-title">Projects</h2>
          <p className="section-subtitle">{filteredProjects.length} visible ({projects.length} total)</p>
        </div>
        <Button variant="primary" size="sm" onClick={openCreate}>
          <Plus size={14} /> New Project
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 p-4 card">
        <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider">Filter Hierarchy:</span>
        <div className="w-48">
          <select
            value={filterProduct}
            onChange={(e) => {
              setFilterProduct(e.target.value);
              setFilterClient('all');
            }}
            className="input-base text-xs py-1.5 h-auto cursor-pointer"
          >
            <option value="all">All Products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="w-48">
          <select
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value)}
            className="input-base text-xs py-1.5 h-auto cursor-pointer"
            disabled={filterProduct !== 'all' && clients.filter(c => c.product_id === filterProduct).length === 0}
          >
            <option value="all">All Clients</option>
            {clients
              .filter((c) => filterProduct === 'all' || c.product_id === filterProduct)
              .map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
          </select>
        </div>
        {(filterProduct !== 'all' || filterClient !== 'all') && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              setFilterProduct('all');
              setFilterClient('all');
            }}
            className="text-brand-red hover:bg-brand-red/10 h-7"
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <ProjectsSkeleton />
        ) : filteredProjects.length === 0 ? (
          <div className="empty-state">
            <FolderKanban size={40} className="empty-state-icon" />
            <p className="empty-state-title">No matching projects found</p>
            <p className="empty-state-desc">Try resetting your filter options or add a new project.</p>
            <Button variant="primary" size="sm" onClick={openCreate}>
              <Plus size={14} /> New Project
            </Button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name &amp; Hierarchy</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Category</th>
                  <th>Running</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((p) => (
                  <tr key={p.id} className="cursor-pointer" onClick={() => openEdit(p)}>
                    {/* Name — hierarchy, tech stack and deadline all inline */}
                    <td className="max-w-sm">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-text-primary">{p.name}</span>
                        {p.clients ? (
                          <span className="text-3xs text-brand-blue font-medium tracking-wide uppercase">
                            {p.clients.products?.name} • {p.clients.name}
                          </span>
                        ) : (
                          <span className="text-3xs text-text-muted italic">No client assigned</span>
                        )}
                        {(p.tech_stack ?? []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {(p.tech_stack ?? []).slice(0, 4).map((t) => (
                              <span key={t} className="text-3xs px-1.5 py-0.5 rounded bg-bg-hover text-text-muted border border-border">
                                {t}
                              </span>
                            ))}
                            {(p.tech_stack ?? []).length > 4 && (
                              <span className="text-3xs text-text-muted">+{p.tech_stack.length - 4}</span>
                            )}
                          </div>
                        )}
                        {p.deadline && (
                          <span className="text-3xs text-text-muted">
                            📅 {format(new Date(p.deadline), 'MMM d, yyyy')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td><StatusBadge status={p.status} /></td>
                    <td><PriorityBadge priority={p.priority} /></td>
                    <td>
                      {p.category
                        ? <span className="text-xs text-text-secondary">{PROJECT_CATEGORY_LABELS[p.category] ?? p.category}</span>
                        : <span className="text-text-muted text-xs">—</span>}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        title={p.running ? 'Click to pause' : 'Click to mark as running'}
                        onClick={async (e) => {
                          e.stopPropagation();
                          await update(p.id, { running: !p.running });
                          toast.success('Running status updated');
                        }}
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-medium border transition-colors duration-150 cursor-pointer ${
                          p.running
                            ? 'bg-brand-green/10 border-brand-green/30 text-brand-green hover:bg-brand-green/20'
                            : 'bg-bg-hover border-border text-text-muted hover:border-border-strong'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${p.running ? 'bg-brand-green' : 'bg-text-muted'}`} />
                        {p.running ? 'Running' : 'Paused'}
                      </button>
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

          <Select
            label="Client"
            placeholder="Select client (optional)"
            options={clients.map((c) => ({
              value: c.id,
              label: `${c.name} (${c.products?.name ?? 'No Product Line'})`
            }))}
            error={errors.client_id?.message}
            {...register('client_id')}
          />

          <div className="grid grid-cols-2 gap-4">
            <Select label="Status" options={toOptions(PROJECT_STATUSES, PROJECT_STATUS_LABELS)} error={errors.status?.message} {...register('status')} />
            <Select label="Priority" options={toOptions(PROJECT_PRIORITIES, PROJECT_PRIORITY_LABELS)} error={errors.priority?.message} {...register('priority')} />
          </div>

          <div className="grid grid-cols-[1fr_140px_auto] gap-4 items-end">
            <Select label="Category" placeholder="Select category" options={toOptions(PROJECT_CATEGORIES, PROJECT_CATEGORY_LABELS)} {...register('category')} />
            <div className="form-group">
              <label className="form-label">Deadline</label>
              <input type="date" className="input-base text-xs h-8" {...register('deadline')} />
            </div>
            {/* Running toggle */}
            <div className="form-group">
              <label className="form-label">Running</label>
              <label className="flex items-center gap-2 h-8 cursor-pointer select-none">
                <input type="checkbox" className="sr-only peer" {...register('running')} />
                <div className="relative w-9 h-5 bg-bg-hover rounded-full border border-border
                  peer-checked:bg-brand-blue peer-checked:border-brand-blue
                  after:content-[''] after:absolute after:top-0.5 after:left-0.5
                  after:bg-white after:rounded-full after:h-4 after:w-4
                  after:transition-all peer-checked:after:translate-x-4
                  transition-colors duration-150" />
                <span className="text-xs text-text-secondary peer-checked:text-brand-blue">On</span>
              </label>
            </div>
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
