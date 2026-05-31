import { useEffect, useState, useCallback } from 'react';
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
  ShieldCheck,
  Layout,
  FileText,
  RotateCcw,
  Users,
  RefreshCw,
} from 'lucide-react';

import { Navigate } from 'react-router-dom';
import { useToast } from '../components/ui/Toast';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Textarea from '../components/ui/Textarea';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { SETTING_DEFAULTS } from '../store/useSettingsStore';
import { useAuthStore } from '../store/useAuthStore';

const schema = z.object({
  ai_provider: z.enum(['zen', 'gemini']).default('zen'),
  zen_api_key: z.string().optional(),
  zen_model: z.string().default('claude-sonnet-4-6'),
  gemini_api_key: z.string().optional(),
  gemini_model: z.string().default('gemini-1.5-flash'),
  chatbase_secret: z.string().optional(),
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
  jira_base_url: z.string().optional(),
  jira_email: z.string().optional(),
  jira_api_token: z.string().optional(),
  jira_project_key: z.string().optional(),
  jira_sync_enabled: z.boolean().default(false),
  jira_push_status_enabled: z.boolean().default(false),
});

const ADMIN_EMAILS = [
  'kayastha.noor1100@gmail.com',
  'niroj.mahrjan@gmail.com',
];

export default function Settings() {
  const { user } = useAuthStore();
  const isAdmin = user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase().trim());

  if (!isAdmin) {
    return <Navigate to="/access-denied" replace />;
  }

  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [showAddWorkspace, setShowAddWorkspace] = useState(false);
  const [newWorkspace, setNewWorkspace] = useState({ name: '', url: '', anonKey: '' });
  const [addingWorkspace, setAddingWorkspace] = useState(false);
  const [showJiraToken, setShowJiraToken] = useState(false);
  const [syncingJira, setSyncingJira] = useState(false);

  // ─── Access Control state ───────────────────────────────────────────────────
  const [allowedEmailsStr, setAllowedEmailsStr] = useState('');
  const [savingEmails, setSavingEmails] = useState(false);

  // ─── Board WIP Limits state ───────────────────────────────────────────────
  const defaults = SETTING_DEFAULTS.wip_limits;
  const [wipLimits, setWipLimits] = useState(defaults);
  const [savingWip, setSavingWip] = useState(false);

  // ─── AI Prompt Templates state ────────────────────────────────────────────
  const [prompts, setPrompts] = useState({
    prompt_rca: '',
    prompt_sprint_summary: '',
    prompt_deployment_note: '',
    prompt_test_summary: '',
  });
  const [savingPrompt, setSavingPrompt] = useState({});

  const PROMPT_LABELS = {
    prompt_rca: 'Root Cause Analysis (RCA)',
    prompt_sprint_summary: 'Sprint Summary',
    prompt_deployment_note: 'Deployment Note',
    prompt_test_summary: 'QA Test Summary',
  };

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
      ai_provider: 'zen',
      zen_api_key: '',
      zen_model: 'claude-sonnet-4-6',
      gemini_api_key: '',
      gemini_model: 'gemini-1.5-flash',
      chatbase_secret: '',
      smtp_host: '',
      smtp_port: '587',
      smtp_user: '',
      smtp_pass: '',
      notification_email: '',
      daily_summary_enabled: true,
      daily_summary_time: '23:00',
      jira_base_url: '',
      jira_email: '',
      jira_api_token: '',
      jira_project_key: '',
      jira_sync_enabled: false,
      jira_push_status_enabled: false,
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
        'ai_provider',
        'zen_api_key',
        'zen_model',
        'gemini_api_key',
        'gemini_model',
        'chatbase_secret',
        'smtp_host',
        'smtp_port',
        'smtp_user',
        'smtp_pass',
        'notification_email',
        'daily_summary_enabled',
        'daily_summary_time',
        'jira_base_url',
        'jira_email',
        'jira_api_token',
        'jira_project_key',
        'jira_sync_enabled',
        'jira_push_status_enabled',
      ];

      for (const key of keys) {
        const res = await window.electron.settings.get(key);
        if (res?.error) {
          console.error(`Error loading setting for ${key}:`, res.error);
        } else if (res?.data !== null && res?.data !== undefined) {
          let val = res.data;
          if (['daily_summary_enabled', 'jira_sync_enabled', 'jira_push_status_enabled'].includes(key)) {
            val = res.data === 'true' || res.data === true;
          }
          setValue(key, val);
        }
      }

      // Load allowed_emails
      const emailsRes = await window.electron.settings.get('allowed_emails');
      if (emailsRes?.data) {
        try {
          const arr = JSON.parse(emailsRes.data);
          setAllowedEmailsStr(Array.isArray(arr) ? arr.join('\n') : emailsRes.data);
        } catch {
          setAllowedEmailsStr(emailsRes.data);
        }
      } else {
        setAllowedEmailsStr(SETTING_DEFAULTS.allowed_emails.join('\n'));
      }

      // Load WIP limits
      const wipRes = await window.electron.settings.get('wip_limits');
      if (wipRes?.data) {
        try {
          const parsed = JSON.parse(wipRes.data);
          setWipLimits({ ...defaults, ...parsed });
        } catch { /* keep defaults */ }
      }

      // Load AI prompts
      const promptKeys = Object.keys(prompts);
      const loadedPrompts = { ...prompts };
      for (const pk of promptKeys) {
        const pRes = await window.electron.settings.get(pk);
        if (pRes?.data) loadedPrompts[pk] = pRes.data;
      }
      setPrompts(loadedPrompts);
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
        const val = ['daily_summary_enabled', 'jira_sync_enabled', 'jira_push_status_enabled'].includes(key)
          ? String(data[key])
          : data[key];
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

  const handleJiraSync = async () => {
    if (!window.electron?.jira?.sync) {
      toast.error('Jira Sync API not available.');
      return;
    }

    setSyncingJira(true);
    try {
      const res = await window.electron.jira.sync();
      if (res?.success) {
        toast.success(`Jira sync complete. Synced ${res.syncedCount} issues.`);
      } else {
        throw new Error(res?.error || 'Unknown error');
      }
    } catch (err) {
      toast.error(`Jira Sync failed: ${err.message}`);
    } finally {
      setSyncingJira(false);
    }
  };

  // ─── Access Control: save allowed emails ──────────────────────────────────
  const handleSaveEmails = async () => {
    if (!window.electron?.settings?.set) return;
    setSavingEmails(true);
    try {
      const emails = allowedEmailsStr
        .split(/[\n,]+/)
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      const res = await window.electron.settings.set('allowed_emails', JSON.stringify(emails));
      if (res?.error) throw new Error(res.error);
      toast.success('Allowed emails saved. Takes effect on next login.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingEmails(false);
    }
  };

  // ─── Board Config: save WIP limits ────────────────────────────────────────
  const handleSaveWipLimits = async () => {
    if (!window.electron?.settings?.set) return;
    setSavingWip(true);
    try {
      const payload = {
        in_progress: Number(wipLimits.in_progress) || defaults.in_progress,
        testing: Number(wipLimits.testing) || defaults.testing,
        uat: Number(wipLimits.uat) || defaults.uat,
      };
      const res = await window.electron.settings.set('wip_limits', JSON.stringify(payload));
      if (res?.error) throw new Error(res.error);
      toast.success('WIP limits saved. Board will update immediately.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingWip(false);
    }
  };

  // ─── AI Prompts: save / reset individual prompt ───────────────────────────
  const handleSavePrompt = async (key) => {
    if (!window.electron?.settings?.set) return;
    setSavingPrompt((p) => ({ ...p, [key]: true }));
    try {
      const res = await window.electron.settings.set(key, prompts[key]);
      if (res?.error) throw new Error(res.error);
      toast.success('Prompt template saved.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingPrompt((p) => ({ ...p, [key]: false }));
    }
  };

  const handleResetPrompt = async (key) => {
    if (!window.electron?.settings?.set) return;
    // Write empty string → claude.js falls back to hardcoded default
    const res = await window.electron.settings.set(key, '');
    if (!res?.error) {
      setPrompts((p) => ({ ...p, [key]: '' }));
      toast.success('Prompt reset to built-in default.');
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
          <div className="w-8 h-8 rounded bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
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
                      ? 'bg-success/5 border-success/20'
                      : 'bg-bg-elevated border-border hover:border-text-muted'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-7 h-7 rounded flex items-center justify-center flex-shrink-0 ${
                      isActive ? 'bg-success/20 text-success' : 'bg-bg-elevated text-text-muted'
                    }`}>
                      {isActive ? <CheckCircle size={14} /> : <Server size={14} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text-primary truncate">{ws.name}</span>
                        {isActive && (
                          <span className="text-2xs bg-success/10 text-success px-1.5 py-0.5 rounded font-medium flex-shrink-0">Active</span>
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
                    <Button variant="ghost" size="sm" className="text-danger/60 hover:text-danger" onClick={() => handleRemoveWorkspace(ws.id)}>
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

          {/* Card: AI Provider */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <div className="w-8 h-8 rounded bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                <Cpu size={16} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-text-primary">AI Service Provider</h3>
                <p className="text-2xs text-text-muted">Choose your intelligence engine</p>
              </div>
              <select
                className="bg-bg-elevated border border-border rounded px-2 py-1 text-xs text-text-primary focus:border-accent outline-none"
                {...register('ai_provider')}
              >
                <option value="zen">OpenCode Zen</option>
                <option value="gemini">Google Gemini</option>
              </select>
            </div>

            {watch('ai_provider') === 'zen' ? (
              <div className="space-y-4 animate-fade-in">
                <div className="relative">
                  <Input
                    label="Zen API Key"
                    type={showApiKey ? 'text' : 'password'}
                    placeholder="oc_..."
                    hint="Get your key at opencode.ai/auth"
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
                <Input
                  label="Zen Model"
                  placeholder="opencode/deepseek-v4-flash-free"
                  hint="e.g., opencode/deepseek-v4-flash-free or claude-3-5-sonnet"
                  error={errors.zen_model?.message}
                  {...register('zen_model')}
                />
              </div>
            ) : (
              <div className="space-y-4 animate-fade-in">
                <div className="relative">
                  <Input
                    label="Gemini API Key"
                    type={showApiKey ? 'text' : 'password'}
                    placeholder="AIza..."
                    hint="Get your key at aistudio.google.com"
                    error={errors.gemini_api_key?.message}
                    {...register('gemini_api_key')}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-8 text-text-secondary hover:text-text-primary"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <Input
                  label="Gemini Model"
                  placeholder="gemini-1.5-flash"
                  hint="e.g., gemini-1.5-flash or gemini-1.5-pro"
                  error={errors.gemini_model?.message}
                  {...register('gemini_model')}
                />
              </div>
            )}

            <div className="divider" />
            <div className="relative">
              <Input
                label="Chatbase Identity Secret"
                type={showApiKey ? 'text' : 'password'}
                placeholder="cs_..."
                hint="Used to securely identify users to Chatbase. Found in Chatbase dashboard > Settings > Security"
                error={errors.chatbase_secret?.message}
                {...register('chatbase_secret')}
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

          {/* Card: Jira Integration */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <div className="w-8 h-8 rounded bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                <RefreshCw size={16} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-text-primary">Jira Integration</h3>
                <p className="text-2xs text-text-muted">Sync issues and status with Jira Cloud</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleJiraSync}
                loading={syncingJira}
                disabled={!watch('jira_sync_enabled')}
              >
                <RefreshCw size={13} className={syncingJira ? 'animate-spin' : ''} /> Sync Now
              </Button>
            </div>

            <div className="space-y-4">
              <Input
                label="Jira Base URL"
                placeholder="https://your-domain.atlassian.net"
                error={errors.jira_base_url?.message}
                {...register('jira_base_url')}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Jira Email"
                  placeholder="user@domain.com"
                  error={errors.jira_email?.message}
                  {...register('jira_email')}
                />
                <Input
                  label="Project Key"
                  placeholder="PROJ"
                  error={errors.jira_project_key?.message}
                  {...register('jira_project_key')}
                />
              </div>

              <div className="relative">
                <Input
                  label="Jira API Token"
                  type={showJiraToken ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  hint="Create a token under Atlassian account security settings"
                  error={errors.jira_api_token?.message}
                  {...register('jira_api_token')}
                />
                <button
                  type="button"
                  className="absolute right-3 top-8 text-text-secondary hover:text-text-primary"
                  onClick={() => setShowJiraToken(!showJiraToken)}
                >
                  {showJiraToken ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <div className="divider" />

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-bg-elevated border border-border">
                  <div>
                    <span className="text-xs font-semibold text-text-primary block">Enable Live Sync</span>
                    <span className="text-2xs text-text-muted">Pull issues from Jira</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      {...register('jira_sync_enabled')}
                    />
                    <div className="w-9 h-5 bg-bg-elevated peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-text-secondary after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent peer-checked:after:bg-white" />
                  </label>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-bg-elevated border border-border">
                  <div>
                    <span className="text-xs font-semibold text-text-primary block">Two-Way Status Push</span>
                    <span className="text-2xs text-text-muted">Push CC status updates to Jira</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      {...register('jira_push_status_enabled')}
                    />
                    <div className="w-9 h-5 bg-bg-elevated peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-text-secondary after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent peer-checked:after:bg-white" />
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Automation & Alerts */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <div className="w-8 h-8 rounded bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
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
                          text-text-primary border-border focus:border-accent
                          focus:outline-none focus:ring-1 focus:ring-accent/30
                          transition-colors
                          ${errors.daily_summary_time ? 'border-danger focus:border-danger focus:ring-danger/30' : ''}
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
                    <div className="w-9 h-5 bg-bg-elevated peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-text-secondary after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent peer-checked:after:bg-white" />
                  </label>
                </div>
              </div>

              {errors.daily_summary_time && (
                <p className="text-2xs text-danger pl-1">{errors.daily_summary_time.message}</p>
              )}
            </div>
          </div>

          {/* Card: Data Export */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <div className="w-8 h-8 rounded bg-success/10 border border-success/20 flex items-center justify-center text-success">
                <Download size={16} />
              </div>
              <div>
                <h3 className="font-semibold text-text-primary">Local Database Export</h3>
                <p className="text-2xs text-text-muted">Backup full application database</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-success/5 border border-success/10">
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
              <div className="w-8 h-8 rounded bg-warning/10 border border-warning/20 flex items-center justify-center text-warning">
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

          {/* ── Access Control Card ────────────────────────────────────── */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <div className="w-8 h-8 rounded bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                <ShieldCheck size={16} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-text-primary">Access Control</h3>
                <p className="text-2xs text-text-muted">Restrict access by email address</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleSaveEmails}
                loading={savingEmails}
              >
                <Save size={13} /> Save List
              </Button>
            </div>
            <div className="space-y-2">
              <Textarea
                label="Allowed Emails"
                value={allowedEmailsStr}
                onChange={(e) => setAllowedEmailsStr(e.target.value)}
                placeholder={"email1@domain.com\nemail2@domain.com"}
                hint="Enter one email address per line or separated by commas. User emails not in this list will be blocked from accessing CommandCenter."
                rows={4}
              />
            </div>
          </div>

          {/* ── Board Configuration Card ────────────────────────────────── */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <div className="w-8 h-8 rounded bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                <Layout size={16} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-text-primary">Board Configuration</h3>
                <p className="text-2xs text-text-muted">Kanban column Work-In-Progress limits</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleSaveWipLimits}
                loading={savingWip}
              >
                <Save size={13} /> Save WIP
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Input
                label="In Progress"
                type="number"
                min={1}
                value={wipLimits.in_progress}
                onChange={(e) => setWipLimits({ ...wipLimits, in_progress: parseInt(e.target.value) || 0 })}
              />
              <Input
                label="Testing"
                type="number"
                min={1}
                value={wipLimits.testing}
                onChange={(e) => setWipLimits({ ...wipLimits, testing: parseInt(e.target.value) || 0 })}
              />
              <Input
                label="UAT"
                type="number"
                min={1}
                value={wipLimits.uat}
                onChange={(e) => setWipLimits({ ...wipLimits, uat: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

        </div>
      </form>

      {/* ── AI Prompt Templates ────────────────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-3 border-b border-border pb-3">
          <div className="w-8 h-8 rounded bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
            <FileText size={16} />
          </div>
          <div>
            <h3 className="font-semibold text-text-primary">AI Prompt Templates</h3>
            <p className="text-2xs text-text-muted">Customize prompt templates used for AI features. Leave empty or click reset to use built-in defaults.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Object.entries(PROMPT_LABELS).map(([key, label]) => (
            <div key={key} className="space-y-3 p-4 rounded-lg bg-bg-elevated border border-border">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-primary">{label}</span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleResetPrompt(key)}
                    className="text-text-muted hover:text-text-primary"
                  >
                    <RotateCcw size={12} /> Reset
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => handleSavePrompt(key)}
                    loading={savingPrompt[key]}
                  >
                    <Save size={12} /> Save
                  </Button>
                </div>
              </div>
              <Textarea
                placeholder="Leave blank to use built-in default prompt template..."
                value={prompts[key]}
                onChange={(e) => setPrompts({ ...prompts, [key]: e.target.value })}
                rows={6}
                className="font-mono text-2xs animate-fade-in"
              />
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
