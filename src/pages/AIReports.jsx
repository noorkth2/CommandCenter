import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';
import {
  BrainCircuit,
  Search,
  Mail,
  Trash2,
  FileText,
  Clock,
  CheckCircle,
  Eye,
} from 'lucide-react';

import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui/Toast';
import Button from '../components/ui/Button';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { AI_REPORT_TYPE_LABELS } from '../lib/constants';

const TYPE_COLORS = {
  rca: 'bg-brand-red/10 text-brand-red border-brand-red/20',
  sprint_summary: 'bg-brand-purple/10 text-brand-purple border-brand-purple/20',
  deployment_note: 'bg-brand-blue/10 text-brand-blue border-brand-blue/20',
  test_summary: 'bg-brand-green/10 text-brand-green border-brand-green/20',
};

export default function AIReports() {
  const toast = useToast();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTypeTab, setActiveTypeTab] = useState('all');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch reports from Supabase
  const fetchReports = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('ai_reports')
        .select('*')
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      setReports(data ?? []);

      // Proactively keep selected report in sync
      if (selectedReport) {
        const updated = data.find((r) => r.id === selectedReport.id);
        setSelectedReport(updated || null);
      }
    } catch (err) {
      toast.error(`Failed to fetch AI reports: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleDelete = async () => {
    if (!confirmId) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('ai_reports').delete().eq('id', confirmId);
      if (error) throw error;

      toast.success('Report deleted successfully');
      if (selectedReport?.id === confirmId) {
        setSelectedReport(null);
      }
      setConfirmId(null);
      await fetchReports();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleSendEmail = async (report) => {
    if (!window.electron?.email?.send) {
      toast.error('Email sending not supported in this environment.');
      return;
    }

    setSendingEmail(true);
    try {
      // 1. GetSMTP recipient from settings if available
      const settingsEmailRes = await window.electron.settings.get('notification_email');
      const toAddress = settingsEmailRes?.data || undefined;

      if (!toAddress) {
        throw new Error(
          'No notification email address configured. Set it in Settings → SMTP Server.'
        );
      }

      // Format simple template
      const htmlBody = `
        <div style="font-family: system-ui, sans-serif; max-width: 650px; margin: 0 auto; padding: 24px; background: #0e0e10; color: #e8e6f0; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08);">
          <h2 style="color: #5b6af8; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 12px; margin-top: 0;">${report.title}</h2>
          <div style="line-height: 1.6; font-size: 14px; color: #8a8799; white-space: pre-wrap;">${report.content}</div>
          <p style="font-size: 11px; color: #5a5870; margin-top: 24px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 12px;">Sent by CommandCenter AI Engine</p>
        </div>
      `;

      const result = await window.electron.email.send({
        to: toAddress,
        subject: report.title,
        html: htmlBody,
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      // Mark report as published/not draft anymore
      const { error: updateError } = await supabase
        .from('ai_reports')
        .update({ is_draft: false })
        .eq('id', report.id);

      if (updateError) {
        console.error('Failed to update draft status:', updateError.message);
      }

      toast.success(`Report emailed to ${toAddress}`);
      await fetchReports();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSendingEmail(false);
    }
  };

  const handleMarkPublished = async (report) => {
    try {
      const { error } = await supabase
        .from('ai_reports')
        .update({ is_draft: !report.is_draft })
        .eq('id', report.id);
      if (error) throw error;

      toast.success(report.is_draft ? 'Published successfully' : 'Moved back to drafts');
      await fetchReports();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Filters logic
  const filteredReports = reports.filter((r) => {
    const matchesSearch =
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = activeTypeTab === 'all' || r.type === activeTypeTab;
    return matchesSearch && matchesType;
  });

  return (
    <div className="animate-fade-in flex flex-col h-[calc(100vh-var(--topbar-height)-3rem)]">
      {/* Header section */}
      <div className="section-header flex-shrink-0">
        <div>
          <h2 className="section-title">AI Reports</h2>
          <p className="section-subtitle">{reports.length} generated records</p>
        </div>
      </div>

      {/* Split view main area */}
      <div className="flex-1 flex gap-5 overflow-hidden min-h-0">
        {/* Left Pane: List Directory */}
        <div className="w-[360px] flex flex-col gap-3 flex-shrink-0 bg-bg-surface border border-border rounded-lg p-3 overflow-hidden">
          {/* Search bar */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-text-muted" />
            <input
              type="text"
              placeholder="Search reports…"
              className="input-base pl-9 text-xs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Type filters */}
          <div className="flex gap-1 overflow-x-auto pb-1 flex-shrink-0 scrollbar-none border-b border-border">
            {[
              { id: 'all', label: 'All' },
              { id: 'rca', label: 'RCA' },
              { id: 'sprint_summary', label: 'Sprint' },
              { id: 'deployment_note', label: 'Deploy' },
              { id: 'test_summary', label: 'QA' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTypeTab(tab.id)}
                className={`text-2xs px-2.5 py-1 rounded transition-all whitespace-nowrap ${
                  activeTypeTab === tab.id
                    ? 'bg-brand-blue/15 text-brand-blue border border-brand-blue/30 font-medium'
                    : 'bg-transparent text-text-muted hover:text-text-secondary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* List area */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {loading && reports.length === 0 ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-3 bg-bg-elevated border border-border rounded-md space-y-2">
                  <div className="skeleton h-3 w-16" />
                  <div className="skeleton h-4 w-full" />
                  <div className="skeleton h-3 w-28" />
                </div>
              ))
            ) : filteredReports.length === 0 ? (
              <div className="empty-state py-8">
                <FileText size={30} className="empty-state-icon" />
                <p className="empty-state-title text-sm">No reports found</p>
              </div>
            ) : (
              filteredReports.map((report) => (
                <div
                  key={report.id}
                  onClick={() => setSelectedReport(report)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all hover:bg-bg-hover ${
                    selectedReport?.id === report.id
                      ? 'bg-brand-blue/5 border-brand-blue/30 text-text-primary shadow-sm'
                      : 'bg-bg-surface border-border text-text-secondary'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span
                      className={`badge text-[10px] px-1.5 py-0.5 border ${
                        TYPE_COLORS[report.type] ?? 'bg-bg-hover text-text-muted border-border'
                      }`}
                    >
                      {AI_REPORT_TYPE_LABELS[report.type] ?? report.type}
                    </span>
                    <span className="text-[10px] text-text-muted flex items-center gap-1">
                      <Clock size={10} />
                      {format(new Date(report.created_at), 'MMM d, HH:mm')}
                    </span>
                  </div>

                  <h4 className="text-xs font-semibold text-text-primary truncate">{report.title}</h4>
                  <p className="text-2xs text-text-muted mt-1 truncate-2">{report.content}</p>

                  <div className="flex items-center gap-1.5 mt-2">
                    {report.is_draft ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-amber animate-pulse" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-green" />
                    )}
                    <span className="text-[10px] text-text-muted">
                      {report.is_draft ? 'Draft' : 'Sent / Published'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Pane: Report Reader */}
        <div className="flex-1 bg-bg-surface border border-border rounded-lg overflow-hidden flex flex-col">
          {selectedReport ? (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Reader Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-bg-surface flex-shrink-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`badge text-xs border ${TYPE_COLORS[selectedReport.type]}`}>
                      {AI_REPORT_TYPE_LABELS[selectedReport.type]}
                    </span>
                    <span className="text-2xs text-text-muted flex items-center gap-1">
                      <Clock size={11} />
                      {format(new Date(selectedReport.created_at), 'MMMM d, yyyy HH:mm')}
                    </span>
                  </div>
                  <h3 className="font-semibold text-text-primary truncate text-sm">
                    {selectedReport.title}
                  </h3>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleMarkPublished(selectedReport)}
                    title={selectedReport.is_draft ? 'Mark published' : 'Mark draft'}
                  >
                    {selectedReport.is_draft ? (
                      <>
                        <CheckCircle size={13} className="text-brand-green" /> Published
                      </>
                    ) : (
                      <>
                        <Clock size={13} className="text-brand-amber" /> Mark Draft
                      </>
                    )}
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleSendEmail(selectedReport)}
                    loading={sendingEmail}
                  >
                    <Mail size={13} /> Email Alert
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => setConfirmId(selectedReport.id)}>
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>

              {/* Reader Content Body */}
              <div className="flex-1 overflow-y-auto px-8 py-6 prose prose-invert max-w-none prose-sm selection:bg-brand-blue/20">
                <div className="glass border border-border/60 rounded-xl p-6 glow-blue leading-relaxed text-text-secondary text-sm">
                  <ReactMarkdown>{selectedReport.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-bg-surface">
              <BrainCircuit size={48} className="text-text-muted animate-pulse mb-3" />
              <h4 className="text-sm font-semibold text-text-primary">No Report Selected</h4>
              <p className="text-xs text-text-muted mt-1 max-w-xs leading-relaxed">
                Choose an AI-generated report from the list on the left to read its findings, send it as
                an email alert, or review its metrics.
              </p>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={handleDelete}
        title="Delete AI report?"
        message="This will permanently delete this report. This action cannot be undone."
        loading={deleting}
      />
    </div>
  );
}
