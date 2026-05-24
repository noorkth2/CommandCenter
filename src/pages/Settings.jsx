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
  CheckCircle,
} from 'lucide-react';

import { useToast } from '../components/ui/Toast';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

const schema = z.object({
  claude_api_key: z.string().optional(),
  smtp_host: z.string().optional(),
  smtp_port: z.string().optional(),
  smtp_user: z.string().optional(),
  smtp_pass: z.string().optional(),
  notification_email: z.string().email('Invalid email address').optional().or(z.literal('')),
  daily_summary_enabled: z.boolean().default(true),
  daily_summary_time: z.string().regex(/^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/, 'Must be in HH:MM format').default('23:00'),
});

export default function Settings() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSmtpPass, setShowSmtpPass] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      claude_api_key: '',
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
          'claude_api_key',
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
          } else if (res?.data !== null) {
            let val = res.data;
            if (key === 'daily_summary_enabled') {
              val = res.data === 'true';
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
      if (res?.error) {
        throw new Error(res.error);
      }

      const blob = new Blob([JSON.stringify(res.data, null, 2)], {
        type: 'application/json',
      });
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

      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: AI & Notifications */}
        <div className="space-y-6">
          {/* Card: AI Configuration */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <div className="w-8 h-8 rounded bg-brand-purple/10 border border-brand-purple/20 flex items-center justify-center text-brand-purple">
                <Cpu size={16} />
              </div>
              <div>
                <h3 className="font-semibold text-text-primary">Claude AI Configuration</h3>
                <p className="text-2xs text-text-muted">Set up Anthropic API credentials</p>
              </div>
            </div>

            <div className="relative">
              <Input
                label="Claude API Key"
                type={showApiKey ? 'text' : 'password'}
                placeholder="sk-ant-..."
                hint="Used to generate RCAs, daily summaries, and deployment notes."
                error={errors.claude_api_key?.message}
                {...register('claude_api_key')}
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
              <div className="flex items-center justify-between p-3 rounded-lg bg-bg-elevated border border-border">
                <div>
                  <span className="text-sm font-medium text-text-primary block">Daily Sprint Summary</span>
                  <span className="text-2xs text-text-muted">Auto-compile closed items at night</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    {...register('daily_summary_enabled')}
                  />
                  <div className="w-9 h-5 bg-bg-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-text-secondary after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-blue peer-checked:after:bg-white" />
                </label>
              </div>

              {dailySummaryEnabled && (
                <div className="grid grid-cols-2 gap-4 animate-fade-in">
                  <Input
                    label="Summary Time"
                    type="text"
                    placeholder="23:00"
                    hint="24h format (e.g. 23:00)"
                    error={errors.daily_summary_time?.message}
                    {...register('daily_summary_time')}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Card: Data Utility */}
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
              <div className="flex-1">
                <span className="text-xs text-text-secondary block">
                  Click below to generate a single-file JSON backup of all projects, issues, QA reports,
                  and deployment histories.
                </span>
              </div>
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

        {/* Right Column: Mail Configuration */}
        <div className="space-y-6">
          {/* Card: SMTP E-Mail Integration */}
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
