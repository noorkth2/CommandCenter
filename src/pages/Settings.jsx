import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Eye,
  EyeOff,
  Save,
  Download,
  Mail,
  Key,
  Cpu,
  AlertCircle,
  Clock,
  Layers,
  Plus,
  Trash2,
  CheckCircle,
  Server,
} from 'lucide-react';

import { useToast } from '../components/ui/Toast';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { useWorkspaceStore } from '../store/useWorkspaceStore';

const schema = z.object({
  zen_api_key: z.string().optional(),
  smtp_host: z.string().optional(),
  smtp_port: z.string().optional(),
  smtp_user: z.string().optional(),
  smtp_pass: z.string().optional(),
  notification_email: z.string().email('Invalid email address').optional().or(z.literal('')),
  daily_summary_enabled: z.boolean().default(true),
  daily_summary_time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be in HH:MM format')
    .default('23:00'),
});

export default function Settings() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [showAddWorkspace, setShowAddWorkspace] = useState(false);
  const [newWorkspace, setNewWorkspace] = useState({ name: '', url: '', anonKey: '' });
  const [addingWorkspace, setAddingWorkspace] = useState(false);

  const { workspaces, activeId, activeWorkspace, loading: wsLoading, switchWorkspace, addWorkspace, removeWorkspace, loadWorkspaces } = useWorkspaceStore();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      zen_api_key: '',
      smtp_host: '',
      smtp_port: '587',
      smtp_user: '',
      smtp_pass: '',
      notification_email: '',
      daily_summary_enabled: true,
      daily_summary_time: '23:00',
    },
  });

  const dailySummaryEnabled = watch('daily_summary_enabled');

  // Load all settings on mount
  useEffect(() => {
    async function loadSettings() {
      if (!window.electron?.settings?.get) {
        toast.error('Electron settings API not available. Using mock mode.');
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const keys = [
          'zen_api_key',
          'smtp_host',
          'smtp_port',
          'smtp_user',
          'smtp_pass',
          'notification_email',
          'daily_summary_enabled',
          'daily_summary_time',
        ];

        for (const key of keys) {
          const res = await window.electron.settings.get(key);
          if (res?.error) {
            console.error(`Error loading setting for ${key}:`, res.error);
          } else if (res?.data !== null && res?.data !== undefined) {
            let val = res.data;
            if (key === 'daily_summary_enabled') {
              val = res.data === 'true' || res.data === true;
            }
            setValue(key, val);
          }
        }
      } catch (err) {
        toast.error(`Failed to load settings: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, [setValue, toast]);

  // Load workspaces on mount
  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  const handleAddWorkspace = async () => {
    if (!newWorkspace.name || !newWorkspace.url || !newWorkspace.anonKey) {
      toast.error('All fields are required.');
      return;
    }
    setAddingWorkspace(true);
    const res = await addWorkspace(newWorkspace);
    setAddingWorkspace(false);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success(`Workspace "${newWorkspace.name}" added.`);
      setNewWorkspace({ name: '', url: '', anonKey: '' });
      setShowAddWorkspace(false);
    }
  };

  const handleSwitchWorkspace = async (id) => {
    await switchWorkspace(id);
    toast.success('Switched workspace. Reloading data...');
  };

  const handleRemoveWorkspace = async (id) => {
    await removeWorkspace(id);
    toast.success('Workspace removed.');
  };

  const onSubmit = async (data) => {
    if (!window.electron?.settings?.set) {
      toast.error('Electron settings API not available.');
      return;
    }

    try {
      const keys = Object.keys(data);
      for (const key of keys) {
        const val = key === 'daily_summary_enabled' ? String(data[key]) : data[key];
        const res = await window.electron.settings.set(key, val);
        if (res?.error) {
          throw new Error(`Failed to save setting "${key}": ${res.error}`);
        }
      }
      toast.success('Settings saved successfully');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleExport = async () => {
    if (!window.electron?.export?.all) {
      toast.error('Export API not available.');
      return;
    }

    setExporting(true);
    try {
      const res = await window.electron.export.all();
      if (res?.error) throw new Error(res.error);

      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `commandcenter_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Data exported successfully');
    } catch (err) {
      toast.error(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-10 w-48 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="skeleton h-64 rounded-lg" />
          <div className="skeleton h-64 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-title">Settings</h2>
          <p className="section-subtitle">Configure keys, integrations, and automation schedules</p>
        </div>
        <Button
          variant="primary"
          onClick={handleSubmit(onSubmit)}
          loading={isSubmitting}
          disabled={!isDirty}
        >
          <Save size={14} /> Save Changes
        </Button>
      </div>

      {/* ── Workspace Card ─────────────────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-3 border-b border-border pb-3">
          <div className="w-8 h-8 rounded bg-brand-cyan/10 border border-brand-cyan/20 flex items-center justify-center text-brand-cyan">
            <Layers size={16} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-text-primary">Workspaces</h3>
            <p className="text-2xs text-text-muted">Manage multiple Supabase project connections</p>
          </div>
          <Button variant="primary" size="sm" onClick={() => setShowAddWorkspace(!showAddWorkspace)}>
            <Plus size={13} /> Add Workspace
          </Button>
        </div>

        {/* Add workspace form */}
        {showAddWorkspace && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 rounded-lg bg-bg-elevated border border-border animate-fade-in">
            <div className="sm:col-span-1">
              <Input
                placeholder="Name"
                value={newWorkspace.name}
                onChange={(e) => setNewWorkspace({ ...newWorkspace, name: e.target.value })}
              />
            </div>
            <div className="sm:col-span-1">
              <Input
                placeholder="Supabase URL"
                value={newWorkspace.url}
                onChange={(e) => setNewWorkspace({ ...newWorkspace, url: e.target.value })}
              />
            </div>
            <div className="sm:col-span-1">
              <Input
                type="password"
                placeholder="Anon Key"
                value={newWorkspace.anonKey}
                onChange={(e) => setNewWorkspace({ ...newWorkspace, anonKey: e.target.value })}
              />
            </div>
            <div className="flex items-end gap-2 sm:col-span-1">
              <Button variant="primary" size="sm" onClick={handleAddWorkspace} loading={addingWorkspace} className="flex-1">
                <CheckCircle size={13} /> Save
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setShowAddWorkspace(false); setNewWorkspace({ name: '', url: '', anonKey: '' }); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {wsLoading ? (
          <div className="space-y-2">
            <div className="skeleton h-12 rounded" />
            <div className="skeleton h-12 rounded" />
          </div>
        ) : workspaces.length === 0 ? (
          <div className="p-4 rounded-lg bg-bg-elevated border border-border text-center">
            <Server size={24} className="mx-auto mb-2 text-text-muted" />
            <p className="text-xs text-text-secondary">No workspaces configured yet.</p>
            <p className="text-2xs text-text-muted mt-1">Add one above or use <code className="text-text-primary bg-bg-surface px-1 rounded">VITE_SUPABASE_*</code> env vars as fallback.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {workspaces.map((ws) => {
              const isActive = ws.id === activeId;
              return (
                <div
                  key={ws.id}
                  className={`flex items-center justify-between gap-3 p-3 rounded-lg border transition-colors ${
                    isActive
                      ? 'bg-brand-green/5 border-brand-green/20'
                      : 'bg-bg-elevated border-border hover:border-text-muted'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-7 h-7 rounded flex items-center justify-center flex-shrink-0 ${
                      isActive ? 'bg-brand-green/20 text-brand-green' : 'bg-bg-hover text-text-muted'
                    }`}>
                      {isActive ? <CheckCircle size={14} /> : <Server size={14} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text-primary truncate">{ws.name}</span>
                        {isActive && (
                          <span className="text-2xs bg-brand-green/10 text-brand-green px-1.5 py-0.5 rounded font-medium flex-shrink-0">Active</span>
                        )}
                      </div>
                      <p className="text-2xs text-text-muted truncate">{ws.url}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!isActive && (
                      <Button variant="secondary" size="sm" onClick={() => handleSwitchWorkspace(ws.id)}>
                        <CheckCircle size={12} /> Switch
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="text-brand-red/60 hover:text-brand-red" onClick={() => handleRemoveWorkspace(ws.id)}>
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Left Column ─────────────────────────────────────────────────── */}
        <div className="space-y-6">

          {/* Card: AI Provider (OpenCode Zen) */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <div className="w-8 h-8 rounded bg-brand-purple/10 border border-brand-purple/20 flex items-center justify-center text-brand-purple">
                <Cpu size={16} />
              </div>
              <div>
                <h3 className="font-semibold text-text-primary">AI Provider — OpenCode Zen</h3>
                <p className="text-2xs text-text-muted">Set up AI report generation via OpenCode Zen</p>
              </div>
            </div>

            <div className="relative">
              <Input
                label="Zen API Key"
                type={showApiKey ? 'text' : 'password'}
                placeholder="oc_..."
                hint="Used to generate RCAs, daily summaries, and deployment notes. Get your key at opencode.ai/auth"
                error={errors.zen_api_key?.message}
                {...register('zen_api_key')}
              />
              <button
                type="button"
                className="absolute right-3 top-8 text-text-secondary hover:text-text-primary"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Card: Automation & Alerts */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <div className="w-8 h-8 rounded bg-brand-blue/10 border border-brand-blue/20 flex items-center justify-center text-brand-blue">
                <AlertCircle size={16} />
              </div>
              <div>
                <h3 className="font-semibold text-text-primary">Automation Settings</h3>
                <p className="text-2xs text-text-muted">Control automatic report runs</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Toggle + Time Picker row */}
              <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-bg-elevated border border-border">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-text-primary block">Daily Sprint Summary</span>
                  <span className="text-2xs text-text-muted">Auto-compile closed items at night</span>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  {/* Time picker — visible when enabled */}
                  {dailySummaryEnabled && (
                    <div className="flex items-center gap-2 animate-fade-in">
                      <Clock size={13} className="text-text-muted flex-shrink-0" />
                      <input
                        type="time"
                        className={`
                          h-7 rounded border px-2 text-xs font-mono bg-bg-surface
                          text-text-primary border-border focus:border-brand-blue
                          focus:outline-none focus:ring-1 focus:ring-brand-blue/30
                          transition-colors
                          ${errors.daily_summary_time ? 'border-brand-red focus:border-brand-red focus:ring-brand-red/30' : ''}
                        `}
                        {...register('daily_summary_time')}
                      />
                    </div>
                  )}

                  {/* Enable/disable toggle */}
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      {...register('daily_summary_enabled')}
                    />
                    <div className="w-9 h-5 bg-bg-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-text-secondary after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-blue peer-checked:after:bg-white" />
                  </label>
                </div>
              </div>

              {errors.daily_summary_time && (
                <p className="text-2xs text-brand-red pl-1">{errors.daily_summary_time.message}</p>
              )}
            </div>
          </div>

          {/* Card: Data Export */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <div className="w-8 h-8 rounded bg-brand-green/10 border border-brand-green/20 flex items-center justify-center text-brand-green">
                <Download size={16} />
              </div>
              <div>
                <h3 className="font-semibold text-text-primary">Local Database Export</h3>
                <p className="text-2xs text-text-muted">Backup full application database</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-brand-green/5 border border-brand-green/10">
              <span className="text-xs text-text-secondary flex-1">
                Generate a single-file JSON backup of all projects, issues, QA reports, and deployment histories.
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleExport}
                loading={exporting}
                className="flex-shrink-0"
              >
                <Download size={13} /> Export JSON
              </Button>
            </div>
          </div>
        </div>

        {/* ── Right Column ─────────────────────────────────────────────────── */}
        <div className="space-y-6">

          {/* Card: SMTP */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <div className="w-8 h-8 rounded bg-brand-amber/10 border border-brand-amber/20 flex items-center justify-center text-brand-amber">
                <Mail size={16} />
              </div>
              <div>
                <h3 className="font-semibold text-text-primary">SMTP E-Mail Server</h3>
                <p className="text-2xs text-text-muted">Configure Nodemailer alerts client</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Input
                  label="SMTP Host"
                  placeholder="smtp.mailtrap.io"
                  error={errors.smtp_host?.message}
                  {...register('smtp_host')}
                />
              </div>
              <div>
                <Input
                  label="SMTP Port"
                  placeholder="587"
                  error={errors.smtp_port?.message}
                  {...register('smtp_port')}
                />
              </div>
            </div>

            <Input
              label="SMTP Username / Client User"
              placeholder="user@example.com"
              error={errors.smtp_user?.message}
              {...register('smtp_user')}
            />

            <div className="relative">
              <Input
                label="SMTP Password"
                type={showSmtpPass ? 'text' : 'password'}
                placeholder="••••••••••••"
                error={errors.smtp_pass?.message}
                {...register('smtp_pass')}
              />
              <button
                type="button"
                className="absolute right-3 top-8 text-text-secondary hover:text-text-primary"
                onClick={() => setShowSmtpPass(!showSmtpPass)}
              >
                {showSmtpPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <div className="divider" />

            <Input
              label="Recipient Alert Notification Email"
              type="email"
              placeholder="alerts@domain.com"
              hint="Address where all scheduled summaries and deployment alerts are sent."
              error={errors.notification_email?.message}
              {...register('notification_email')}
            />
          </div>
        </div>
      </form>
    </div>
  );
}
