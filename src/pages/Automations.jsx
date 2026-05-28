import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus,
  Play,
  Trash2,
  Zap,
  ToggleLeft,
  ToggleRight,
  Code,
  Mail,
  Bug,
  Calendar,
  Activity,
} from 'lucide-react';
import { format } from 'date-fns';

import { useAutomationStore } from '../store/useAutomationStore';
import { useToast } from '../components/ui/Toast';
import Button from '../components/ui/Button';
import Dialog from '../components/ui/Dialog';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import {
  AUTOMATION_TRIGGER_TYPES,
  AUTOMATION_ACTION_TYPES,
  AUTOMATION_TRIGGER_LABELS,
  AUTOMATION_ACTION_LABELS,
} from '../lib/constants';

// Hide the stub action that isn't implemented yet
const VISIBLE_ACTION_TYPES = AUTOMATION_ACTION_TYPES.filter(
  (t) => t !== 'create_notion_page'
);

const triggerSchema = z.object({
  name: z.string().min(1, 'Automation name is required'),
  description: z.string().optional(),
  trigger_type: z.enum(AUTOMATION_TRIGGER_TYPES),
  action_type: z.enum(AUTOMATION_ACTION_TYPES),
  trigger_config: z.string().refine((str) => {
    if (!str.trim()) return true;
    try { JSON.parse(str); return true; } catch { return false; }
  }, 'Must be valid JSON'),
  action_config: z.string().refine((str) => {
    if (!str.trim()) return true;
    try { JSON.parse(str); return true; } catch { return false; }
  }, 'Must be valid JSON'),
});

const toOptions = (arr, labels) => arr.map((v) => ({ value: v, label: labels[v] ?? v }));

export default function Automations() {
  const {
    automations,
    loading,
    fetch,
    create,
    update,
    delete: deleteRule,
    toggle,
    manualTrigger,
  } = useAutomationStore();

  const toast = useToast();

  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [triggeringId, setTriggeringId] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(triggerSchema),
    defaultValues: {
      name: '',
      description: '',
      trigger_type: 'issue_created',
      action_type: 'create_qa_entry',
      trigger_config: '{}',
      action_config: '{}',
    },
  });

  useEffect(() => {
    fetch();
  }, [fetch]);

  const openCreate = () => {
    setEditing(null);
    reset({
      name: '',
      description: '',
      trigger_type: 'issue_created',
      action_type: 'create_qa_entry',
      trigger_config: '{}',
      action_config: '{}',
    });
    setPanelOpen(true);
  };

  const openEdit = useCallback(
    (rule) => {
      setEditing(rule);
      reset({
        name: rule.name,
        description: rule.description ?? '',
        trigger_type: rule.trigger_type,
        action_type: rule.action_type,
        trigger_config: JSON.stringify(rule.trigger_config ?? {}, null, 2),
        action_config: JSON.stringify(rule.action_config ?? {}, null, 2),
      });
      setPanelOpen(true);
    },
    [reset]
  );

  const onSubmit = async (data) => {
    try {
      const payload = {
        name: data.name,
        description: data.description || null,
        trigger_type: data.trigger_type,
        action_type: data.action_type,
        trigger_config: data.trigger_config.trim() ? JSON.parse(data.trigger_config) : {},
        action_config: data.action_config.trim() ? JSON.parse(data.action_config) : {},
      };

      if (editing) {
        await update(editing.id, payload);
        toast.success('Automation updated successfully');
      } else {
        await create({ ...payload, enabled: true });
        toast.success('Automation rule created');
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
      await deleteRule(confirmId);
      toast.success('Automation rule deleted');
      setConfirmId(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleManualTrigger = async (id, name) => {
    setTriggeringId(id);
    try {
      await manualTrigger(id);
      toast.success(`Fired manual execution of: "${name}"`);
    } catch (err) {
      toast.error(`Trigger failed: ${err.message}`);
    } finally {
      setTriggeringId(null);
    }
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'create_qa_entry':
        return <Bug size={13} className="text-brand-red" />;
      case 'send_email':
        return <Mail size={13} className="text-brand-amber" />;
      case 'generate_ai_report':
        return <Code size={13} className="text-brand-purple" />;
      default:
        return <Zap size={13} className="text-brand-blue" />;
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="section-header">
        <div>
          <h2 className="section-title">Automations</h2>
          <p className="section-subtitle">Manage triggers, alerts, and automatic QA entry triggers</p>
        </div>
        <Button variant="primary" size="sm" onClick={openCreate}>
          <Plus size={14} /> New Automation
        </Button>
      </div>

      {/* Grid of Automation Rules */}
      {loading && automations.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-44 rounded-lg" />
          ))}
        </div>
      ) : automations.length === 0 ? (
        <div className="card empty-state">
          <Zap size={40} className="empty-state-icon" />
          <p className="empty-state-title">No automations created yet</p>
          <p className="empty-state-desc">
            Define conditions under which items should trigger actions, alerts, or summaries automatically.
          </p>
          <Button variant="primary" size="sm" onClick={openCreate}>
            <Plus size={14} /> New Automation
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {automations.map((rule) => (
            <div
              key={rule.id}
              onClick={() => openEdit(rule)}
              className="card p-5 cursor-pointer hover:border-border-strong hover:shadow-card hover:-translate-y-px transition-all duration-150 flex flex-col justify-between h-52 relative group"
            >
              {/* Top: name + toggle */}
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-text-primary truncate">{rule.name}</h3>
                    {rule.description && (
                      <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                        {rule.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => toggle(rule.id)}
                      className="btn-icon w-8 h-8 rounded hover:bg-bg-hover flex items-center justify-center"
                      title={rule.enabled ? 'Disable automation' : 'Enable automation'}
                    >
                      {rule.enabled ? (
                        <ToggleRight size={22} className="text-brand-blue" />
                      ) : (
                        <ToggleLeft size={22} className="text-text-muted" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Trigger / Action badges */}
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="badge text-2xs bg-bg-elevated border-border text-text-secondary flex items-center gap-1.5">
                    <Calendar size={11} className="text-text-muted" />
                    Trigger: <span className="font-medium text-text-primary">{AUTOMATION_TRIGGER_LABELS[rule.trigger_type]}</span>
                  </span>
                  <span className="badge text-2xs bg-bg-elevated border-border text-text-secondary flex items-center gap-1.5">
                    {getActionIcon(rule.action_type)}
                    Action: <span className="font-medium text-text-primary">{AUTOMATION_ACTION_LABELS[rule.action_type]}</span>
                  </span>
                  {/* Trigger count badge */}
                  <span className="badge text-2xs bg-brand-blue/10 border-brand-blue/20 text-brand-blue flex items-center gap-1">
                    <Activity size={10} />
                    <span className="font-semibold">{rule.trigger_count ?? 0}</span>
                    <span className="text-brand-blue/70">{rule.trigger_count === 1 ? 'run' : 'runs'}</span>
                  </span>
                </div>
              </div>

              {/* Bottom: last triggered + actions */}
              <div className="border-t border-border pt-3 flex items-center justify-between text-2xs text-text-muted mt-3">
                <div>
                  {rule.last_triggered_at ? (
                    <span>Last run: {format(new Date(rule.last_triggered_at), 'MMM d, HH:mm')}</span>
                  ) : (
                    <span className="italic">Never triggered</span>
                  )}
                </div>

                <div
                  className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={triggeringId === rule.id}
                    onClick={() => handleManualTrigger(rule.id, rule.name)}
                    className="!h-7 !px-2 bg-bg-elevated border border-border text-text-secondary hover:text-text-primary"
                    title="Manual Test Run"
                  >
                    <Play size={10} className="text-brand-blue" /> Test
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setConfirmId(rule.id)}
                    className="!h-7 !w-7 !p-0"
                  >
                    <Trash2 size={11} />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor Dialog */}
      <Dialog
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        title={editing ? 'Edit Automation Rule' : 'New Automation Rule'}
        width="600px"
        footer={
          <div className="flex items-center justify-between w-full">
            <div>
              {editing && (
                <Button variant="danger" size="sm" onClick={() => setConfirmId(editing.id)}>
                  <Trash2 size={13} /> Delete Rule
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setPanelOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
                {editing ? 'Save Rule' : 'Create Rule'}
              </Button>
            </div>
          </div>
        }
      >
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <Input
            label="Rule Name"
            placeholder="e.g., Bug → QA Test Case creation"
            required
            error={errors.name?.message}
            {...register('name')}
          />

          <Textarea
            label="Description"
            placeholder="What does this rule do?"
            rows={2}
            error={errors.description?.message}
            {...register('description')}
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Trigger Event"
              options={toOptions(AUTOMATION_TRIGGER_TYPES, AUTOMATION_TRIGGER_LABELS)}
              error={errors.trigger_type?.message}
              {...register('trigger_type')}
            />
            <Select
              label="Action to Execute"
              options={toOptions(VISIBLE_ACTION_TYPES, AUTOMATION_ACTION_LABELS)}
              error={errors.action_type?.message}
              {...register('action_type')}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <Textarea
              label="Trigger Config (JSON)"
              placeholder={'{\n  "labels": ["bug"]\n}'}
              rows={4}
              error={errors.trigger_config?.message}
              hint='Match conditions (e.g. {"labels": ["bug"]} or {"environment": "production"})'
              className="font-mono text-xs"
              {...register('trigger_config')}
            />

            <Textarea
              label="Action Config (JSON)"
              placeholder={'{\n  "severity": "high",\n  "status": "to_test"\n}'}
              rows={4}
              error={errors.action_config?.message}
              hint='Payload configs (e.g. {"subject_template": "Alert: {name}"})'
              className="font-mono text-xs"
              {...register('action_config')}
            />
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={handleDelete}
        title="Delete automation rule?"
        message="This will permanently delete this automation rule, and scheduled events relating to it will stop."
        loading={deleting}
      />
    </div>
  );
}
