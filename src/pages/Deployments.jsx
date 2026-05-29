import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, MoreHorizontal, Rocket, RotateCcw, Mail, Sparkles } from 'lucide-react';
import { format } from 'date-fns';

import { useDeploymentStore } from '../store/useDeploymentStore';
import { useProjectStore } from '../store/useProjectStore';
import { useAI } from '../hooks/useAI';
import { useAutomations } from '../hooks/useAutomations';
import { useToast } from '../components/ui/Toast';
import Button from '../components/ui/Button';
import Dialog from '../components/ui/Dialog';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import StatusBadge from '../components/shared/StatusBadge';
import AIGenerateButton from '../components/shared/AIGenerateButton';
import Dropdown from '../components/ui/Dropdown';
import {
  DEPLOYMENT_STATUSES, DEPLOYMENT_ENVIRONMENTS, DEPLOYMENT_SERVICES,
  DEPLOYMENT_STATUS_LABELS,
} from '../lib/constants';

const toOptions = (arr, labels) => arr.map(v => ({ value: v, label: labels?.[v] ?? v }));

const schema = z.object({
  name: z.string().min(1, 'Deployment name is required'),
  project_id: z.string().optional(),
  environment: z.enum(DEPLOYMENT_ENVIRONMENTS),
  status: z.enum(DEPLOYMENT_STATUSES),
  rollback_plan: z.string().optional(),
  expected_downtime: z.string().optional(),
  notes: z.string().optional(),
  deployed_at: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.status === 'in_progress' && !data.rollback_plan?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Rollback plan is required before starting deployment', path: ['rollback_plan'] });
  }
  if (data.status === 'production' && !data.deployed_at) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Deployed At timestamp is required for production status', path: ['deployed_at'] });
  }
});

export default function Deployments() {
  const { deployments, loading, fetch, create, update, delete: deleteDeployment, updateChecklist } = useDeploymentStore();
  const { projects, fetch: fetchProjects } = useProjectStore();
  const { generate, generateInline, generating } = useAI();
  const { trigger } = useAutomations();
  const toast = useToast();

  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedServices, setSelectedServices] = useState([]);
  const [emailPreview, setEmailPreview] = useState(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  // Checklist local states
  const [checklist, setChecklist] = useState([]);
  const [newItemText, setNewItemText] = useState('');
  const [suggestingChecklist, setSuggestingChecklist] = useState(false);

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { status: 'planned', environment: 'dev' },
  });

  useEffect(() => { fetch(); fetchProjects(); }, []);

  const openCreate = () => {
    setEditing(null);
    setSelectedServices([]);
    reset({ status: 'planned', environment: 'dev' });
    setPanelOpen(true);
  };

  const openEdit = useCallback((dep) => {
    setEditing(dep);
    setSelectedServices(dep.services_affected ?? []);
    setChecklist(dep.checklist ?? []);
    setNewItemText('');
    reset({
      name: dep.name,
      project_id: dep.project_id ?? '',
      environment: dep.environment,
      status: dep.status,
      rollback_plan: dep.rollback_plan ?? '',
      expected_downtime: dep.expected_downtime ?? '',
      notes: dep.notes ?? '',
      deployed_at: dep.deployed_at ? dep.deployed_at.slice(0, 16) : '',
    });
    setPanelOpen(true);
  }, [reset]);

  const toggleService = (svc) => {
    setSelectedServices(prev =>
      prev.includes(svc) ? prev.filter(s => s !== svc) : [...prev, svc]
    );
  };

  const handleAddChecklistItem = async () => {
    if (!newItemText.trim()) return;
    const newItem = {
      id: window.crypto.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2),
      text: newItemText.trim(),
      done: false,
    };
    const nextChecklist = [...checklist, newItem];
    setChecklist(nextChecklist);
    setNewItemText('');
    if (editing) {
      await updateChecklist(editing.id, nextChecklist);
    }
  };

  const handleToggleChecklistItem = async (itemId) => {
    const nextChecklist = checklist.map((item) =>
      item.id === itemId ? { ...item, done: !item.done } : item
    );
    setChecklist(nextChecklist);
    if (editing) {
      await updateChecklist(editing.id, nextChecklist);
    }
  };

  const handleRemoveChecklistItem = async (itemId) => {
    const nextChecklist = checklist.filter((item) => item.id !== itemId);
    setChecklist(nextChecklist);
    if (editing) {
      await updateChecklist(editing.id, nextChecklist);
    }
  };

  const handleSuggestChecklist = async () => {
    if (!editing) return;
    setSuggestingChecklist(true);
    try {
      const content = await generateInline('checklist', editing);
      if (content) {
        let items = [];
        try {
          let cleanContent = content.trim();
          if (cleanContent.startsWith('```')) {
            cleanContent = cleanContent.replace(/^```(json)?/, '').replace(/```$/, '').trim();
          }
          items = JSON.parse(cleanContent);
        } catch {
          items = content
            .split('\n')
            .map((l) => l.replace(/^[-\*\d\s\.]+/g, '').trim())
            .filter((l) => l.length > 0 && l.length < 150);
        }

        if (Array.isArray(items) && items.length > 0) {
          const newItems = items.map((text) => ({
            id: window.crypto.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2),
            text,
            done: false,
          }));
          const nextChecklist = [...checklist, ...newItems];
          setChecklist(nextChecklist);
          await updateChecklist(editing.id, nextChecklist);
          toast.success(`Suggested ${newItems.length} tasks!`);
        } else {
          toast.error('AI returned empty/invalid checklist format.');
        }
      } else {
        toast.error('AI failed to suggest items.');
      }
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setSuggestingChecklist(false);
    }
  };

  const onSubmit = async (data) => {
    try {
      const payload = {
        ...data,
        project_id: data.project_id || null,
        services_affected: selectedServices,
        deployed_at: data.deployed_at ? new Date(data.deployed_at).toISOString() : null,
      };
      let result;
      if (editing) {
        result = await update(editing.id, payload);
        toast.success('Deployment updated');
        // Fire automation on production completion
        if (data.status === 'success' && editing.environment === 'production') {
          await trigger('deployment_completed', result);
        }
      } else {
        result = await create(payload);
        toast.success('Deployment logged');
      }
      setPanelOpen(false);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleGenerateEmail = async () => {
    if (!editing) return;
    const content = await generateInline('deployment_note', editing);
    if (content) {
      setEmailPreview(content);
      setEmailModalOpen(true);
    } else {
      toast.error('Email generation failed');
    }
  };

  const handleSendEmail = async () => {
    if (!window.electron?.email?.send) {
      toast.error('Email not available outside Electron');
      return;
    }
    setSendingEmail(true);
    try {
      const result = await window.electron.email.send({
        subject: `Deployment: ${editing?.name}`,
        html: `<pre style="font-family: system-ui; white-space: pre-wrap;">${emailPreview}</pre>`,
      });
      if (result.success) { toast.success('Email sent'); setEmailModalOpen(false); }
      else toast.error(result.error);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSendingEmail(false);
    }
  };

  const handleMarkRolledBack = async (dep) => {
    try {
      await update(dep.id, { status: 'rolled_back' });
      toast.success('Marked as rolled back');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteDeployment(confirmId);
      toast.success('Deployment deleted');
      setConfirmId(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="section-header">
        <div>
          <h2 className="section-title">Deployments</h2>
          <p className="section-subtitle">{deployments.length} total deployments</p>
        </div>
        <Button variant="primary" size="sm" onClick={openCreate}>
          <Plus size={14} /> Log Deployment
        </Button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="flex gap-4"><div className="skeleton h-5 flex-1" /><div className="skeleton h-5 w-24" /></div>)}
          </div>
        ) : deployments.length === 0 ? (
          <div className="empty-state">
            <Rocket size={40} className="empty-state-icon" />
            <p className="empty-state-title">No deployments logged</p>
            <Button variant="primary" size="sm" onClick={openCreate}><Plus size={14} /> Log Deployment</Button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Project</th>
                  <th>Environment</th>
                  <th>Status</th>
                  <th>Services</th>
                  <th>Deployed At</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {deployments.map((dep) => (
                  <tr key={dep.id} className="cursor-pointer" onClick={() => openEdit(dep)}>
                    <td><span className="font-medium text-text-primary">{dep.name}</span></td>
                    <td><span className="text-xs text-text-secondary">{dep.projects?.name ?? '—'}</span></td>
                    <td>
                      <span className={`badge text-xs ${dep.environment === 'production' ? 'bg-danger/10 text-danger border-danger/20' : dep.environment === 'staging' ? 'bg-warning/10 text-warning border-warning/20' : 'bg-text-muted/10 text-text-muted border-text-muted/20'}`}>
                        {dep.environment}
                      </span>
                    </td>
                    <td><StatusBadge status={dep.status} /></td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {(dep.services_affected ?? []).slice(0, 2).map(s => (
                          <span key={s} className="text-xs px-1.5 py-0.5 rounded bg-bg-elevated text-text-muted border border-border">{s}</span>
                        ))}
                        {(dep.services_affected ?? []).length > 2 && <span className="text-xs text-text-muted">+{dep.services_affected.length - 2}</span>}
                      </div>
                    </td>
                    <td>
                      <span className="text-xs text-text-muted">
                        {dep.deployed_at ? format(new Date(dep.deployed_at), 'MMM d, HH:mm') : '—'}
                      </span>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <Dropdown
                        trigger={<Button variant="icon"><MoreHorizontal size={15} /></Button>}
                        items={[
                          { label: 'Edit', onClick: () => openEdit(dep) },
                          ...(dep.status === 'failed' ? [{ label: 'Mark Rolled Back', icon: <RotateCcw size={13} />, onClick: () => handleMarkRolledBack(dep) }] : []),
                          { separator: true },
                          { label: 'Delete', danger: true, onClick: () => setConfirmId(dep.id) },
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

      {/* Deployment Panel */}
      <Dialog
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        title={editing ? 'Edit Deployment' : 'Log Deployment'}
        width="640px"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="flex gap-2">
              {editing && (
                <>
                  <AIGenerateButton onClick={handleGenerateEmail} loading={generating} label="Generate Email" />
                  <Button variant="danger" size="sm" onClick={() => setConfirmId(editing.id)}><Trash2 size={13} /></Button>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setPanelOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleSubmit(onSubmit)} loading={isSubmitting}>{editing ? 'Save' : 'Log'}</Button>
            </div>
          </div>
        }
      >
        <form className="space-y-5">
          <Input label="Deployment Name" placeholder='e.g. "v1.3.2 — Payment Fix"' required error={errors.name?.message} {...register('name')} />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Project" placeholder="Select project" options={projects.map(p => ({ value: p.id, label: p.name }))} {...register('project_id')} />
            <Select label="Environment" options={toOptions(DEPLOYMENT_ENVIRONMENTS)} error={errors.environment?.message} {...register('environment')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Status" options={toOptions(DEPLOYMENT_STATUSES, DEPLOYMENT_STATUS_LABELS)} error={errors.status?.message} {...register('status')} />
            <Input label="Expected Downtime" placeholder='e.g. "5 minutes"' {...register('expected_downtime')} />
          </div>

          {/* Services affected */}
          <div className="form-group">
            <label className="form-label">Services Affected</label>
            <div className="flex flex-wrap gap-2">
              {DEPLOYMENT_SERVICES.map(svc => (
                <button
                  key={svc}
                  type="button"
                  onClick={() => toggleService(svc)}
                  className={`text-xs px-2.5 py-1.5 rounded border transition-all ${selectedServices.includes(svc) ? 'bg-accent/15 border-accent/40 text-accent' : 'bg-bg-elevated border-border text-text-muted hover:border-border-hover hover:text-text-secondary'}`}
                >
                  {svc}
                </button>
              ))}
            </div>
          </div>

          <Input label="Deployed At" type="datetime-local" error={errors.deployed_at?.message} {...register('deployed_at')} />
          <Textarea label="Rollback Plan" placeholder="Steps to revert this deployment if it fails…" rows={3} error={errors.rollback_plan?.message} {...register('rollback_plan')} hint="Required before setting status to In Progress" />
          <Textarea label="Notes / Incident Log" placeholder="Deployment notes, issues encountered, decisions made…" rows={3} {...register('notes')} />
        </form>

        {/* Checklist section */}
        {editing && (
          <div className="mt-6 pt-4 border-t border-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-primary">Deployment Checklist</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-accent hover:text-accent-hover"
                onClick={handleSuggestChecklist}
                loading={suggestingChecklist}
              >
                <Sparkles size={12} className="mr-1" /> Suggest Tasks
              </Button>
            </div>

            {/* Progress bar */}
            {checklist.length > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-3xs text-text-muted">
                  <span>Progress</span>
                  <span>
                    {checklist.filter((c) => c.done).length} of {checklist.length} tasks completed
                  </span>
                </div>
                <div className="h-1.5 w-full bg-bg-surface border border-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-success transition-all duration-300"
                    style={{
                      width: `${(checklist.filter((c) => c.done).length / checklist.length) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Input to add task */}
            <div className="flex gap-2">
              <Input
                placeholder="Add checklist task..."
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddChecklistItem();
                  }
                }}
                className="flex-1"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAddChecklistItem}
              >
                <Plus size={13} /> Add
              </Button>
            </div>

            {/* Tasks list */}
            {checklist.length > 0 ? (
              <div className="space-y-1.5 max-h-[180px] overflow-y-auto pt-2">
                {checklist.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 rounded bg-bg-elevated border border-border hover:border-text-muted transition-colors"
                  >
                    <label className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() => handleToggleChecklistItem(item.id)}
                        className="rounded border-border text-accent focus:ring-accent/30 focus:outline-none"
                      />
                      <span
                        className={`text-2xs truncate select-none ${
                          item.done ? 'line-through text-text-muted' : 'text-text-primary'
                        }`}
                      >
                        {item.text}
                      </span>
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-danger/60 hover:text-danger p-1"
                      onClick={() => handleRemoveChecklistItem(item.id)}
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-2xs text-text-muted">No checklist tasks logged yet</p>
            )}
          </div>
        )}
      </Dialog>

      {/* Email preview modal */}
      {emailModalOpen && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
          <div className="fixed inset-0 bg-black/60 animate-fade-in" onClick={() => setEmailModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-bg-elevated border border-border-hover rounded-xl p-6 animate-scale-in z-10">
            <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2"><Mail size={15} /> Email Preview</h3>
            <div className="bg-bg-base border border-border rounded p-4 text-sm text-text-secondary whitespace-pre-wrap max-h-64 overflow-y-auto mb-4">
              {emailPreview}
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setEmailModalOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleSendEmail} loading={sendingEmail}>
                <Mail size={13} /> Send Email
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <ConfirmDialog
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={handleDelete}
        title="Delete deployment?"
        message="This will permanently delete this deployment record."
        loading={deleting}
      />
    </div>
  );
}
