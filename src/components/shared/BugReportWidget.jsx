import { useState } from 'react';
import { AlertCircle, Camera, Monitor, Cpu, Clock, HardDrive } from 'lucide-react';
import { useIssueStore } from '../../store/useIssueStore';
import { useProjectStore } from '../../store/useProjectStore';
import { useSprintStore } from '../../store/useSprintStore';
import { useToast } from '../ui/Toast';
import Dialog from '../ui/Dialog';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Textarea from '../ui/Textarea';

export default function BugReportWidget() {
  const [open, setOpen] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [context, setContext] = useState(null);
  const [screenshot, setScreenshot] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const { create } = useIssueStore();
  const { projects } = useProjectStore();
  const { sprints } = useSprintStore();
  const toast = useToast();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    project_id: '',
    sprint_id: '',
    priority: 'p1',
  });

  const handleOpen = async () => {
    setCapturing(true);
    try {
      if (window.electron?.bugReport?.captureContext) {
        const result = await window.electron.bugReport.captureContext();
        if (result.error) throw new Error(result.error);
        setContext(result.data.context);
        setScreenshot(result.data.screenshot);
      }
      setOpen(true);
    } catch (err) {
      console.error('[BugReportWidget] Capture failed:', err);
      toast.error('Failed to capture environment: ' + err.message);
      // Still open the dialog but without context
      setOpen(true);
    } finally {
      setCapturing(false);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!formData.title) return toast.error('Title is required');

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        status: 'backlog',
        team: 'qa',
        environment: 'production',
        environment_context: context || {},
        attachments: screenshot ? [{ type: 'screenshot', data: screenshot, label: 'Bug Report Screenshot' }] : [],
        labels: ['bug', 'automatic-capture'],
      };

      await create(payload);
      toast.success('Bug report submitted successfully');
      setOpen(false);
      // Reset
      setFormData({ title: '', description: '', project_id: '', sprint_id: '', priority: 'p1' });
      setContext(null);
      setScreenshot(null);
    } catch (err) {
      toast.error('Submission failed: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={handleOpen}
        disabled={capturing}
        className="flex items-center gap-1.5 h-8 px-3 rounded border border-danger/30 bg-danger/5 hover:bg-danger/10 text-danger transition-colors cursor-pointer disabled:opacity-50"
        title="Report a bug with automatic context capture"
      >
        <AlertCircle size={14} className={capturing ? 'animate-pulse' : ''} />
        <span className="text-xs font-medium">Report Bug</span>
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Report Bug"
        subtitle="Automatic environment context captured"
        width="600px"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSubmit} loading={submitting}>
              Submit Bug Report
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="space-y-4">
            <Input
              label="Title"
              placeholder="What's wrong?"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />

            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Project"
                placeholder="Select project"
                options={projects.map(p => ({ value: p.id, label: p.name }))}
                value={formData.project_id}
                onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
              />
              <Select
                label="Priority"
                options={[
                  { value: 'p0', label: 'P0 - Critical' },
                  { value: 'p1', label: 'P1 - High' },
                  { value: 'p2', label: 'P2 - Medium' },
                  { value: 'p3', label: 'P3 - Low' },
                ]}
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              />
            </div>

            <Textarea
              label="Description"
              placeholder="Explain how to reproduce the issue..."
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          {/* Technical Context Summary */}
          {context && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-text-primary flex items-center gap-2">
                <Cpu size={14} className="text-accent" />
                Environment Metadata
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded bg-bg-elevated border border-border flex items-center gap-2">
                  <Monitor size={12} className="text-text-muted" />
                  <span className="text-2xs text-text-secondary">OS: {context.os} ({context.arch})</span>
                </div>
                <div className="p-2 rounded bg-bg-elevated border border-border flex items-center gap-2">
                  <HardDrive size={12} className="text-text-muted" />
                  <span className="text-2xs text-text-secondary">Version: {context.version}</span>
                </div>
                <div className="p-2 rounded bg-bg-elevated border border-border flex items-center gap-2">
                  <Monitor size={12} className="text-text-muted" />
                  <span className="text-2xs text-text-secondary">Screen: {context.screen?.width}x{context.screen?.height}</span>
                </div>
                <div className="p-2 rounded bg-bg-elevated border border-border flex items-center gap-2">
                  <Clock size={12} className="text-text-muted" />
                  <span className="text-2xs text-text-secondary truncate">{new Date(context.timestamp).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* Screenshot Preview */}
          {screenshot && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-text-primary flex items-center gap-2">
                <Camera size={14} className="text-accent" />
                Captured Screenshot
              </h4>
              <div className="relative group rounded-lg overflow-hidden border border-border bg-black/20 aspect-video">
                <img src={screenshot} alt="Captured Screenshot" className="w-full h-full object-contain" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-2xs text-white font-medium">Automatic Capture</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </Dialog>
    </>
  );
}
