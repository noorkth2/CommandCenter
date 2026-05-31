import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, MoreHorizontal, Download, TestTube2, CheckSquare, Square } from 'lucide-react';
import { format } from 'date-fns';

import { useQAStore } from '../store/useQAStore';
import { useProjectStore } from '../store/useProjectStore';
import { useIssueStore } from '../store/useIssueStore';
import { useToast } from '../components/ui/Toast';
import Button from '../components/ui/Button';
import Dialog from '../components/ui/Dialog';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import StatusBadge from '../components/shared/StatusBadge';
import Dropdown from '../components/ui/Dropdown';
import {
  QA_STATUSES, QA_SEVERITIES, QA_PRIORITIES, QA_TEST_TYPES,
  QA_STATUS_LABELS, QA_TEST_TYPE_LABELS, PROJECT_PRIORITY_LABELS,
} from '../lib/constants';

const SEVERITY_COLORS = {
  critical: 'text-danger',
  high: 'text-warning',
  medium: 'text-accent',
  low: 'text-text-muted',
};

const schema = z.object({
  test_case: z.string().min(1, 'Test case title is required'),
  project_id: z.string().optional(),
  issue_id: z.string().optional(),
  module: z.string().optional(),
  test_type: z.enum(QA_TEST_TYPES).optional().or(z.literal('')),
  severity: z.enum(QA_SEVERITIES),
  priority: z.enum(['p0', 'p1', 'p2', 'p3']),
  status: z.enum(QA_STATUSES),
  steps_to_reproduce: z.string().optional(),
  expected_result: z.string().optional(),
  actual_result: z.string().optional(),
  environment: z.string().optional(),
  notes: z.string().optional(),
  tested_on: z.string().optional(),
});

const toOptions = (arr, labels) => arr.map(v => ({ value: v, label: labels[v] ?? v }));

export default function QATracker() {
  const { items, loading, fetch, create, update, delete: deleteItem, selected, toggleSelected, selectAll, clearSelection, bulkUpdateStatus, bulkUpdateSeverity, getStats } = useQAStore();
  const { projects, fetch: fetchProjects } = useProjectStore();
  const { issues, fetch: fetchIssues } = useIssueStore();
  const toast = useToast();

  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [filters, setFilters] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cc_qa_filters') ?? '{}'); }
    catch { return {}; }
  });

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { severity: 'medium', status: 'to_test' },
  });

  const watchedStatus = watch('status');

  useEffect(() => { fetch(filters); fetchProjects(); fetchIssues(); }, []);

  useEffect(() => {
    localStorage.setItem('cc_qa_filters', JSON.stringify(filters));
    fetch(filters);
  }, [filters]);

  const stats = getStats();

  const openCreate = (prefill = {}) => {
    setEditing(null);
    reset({ severity: 'medium', priority: 'p2', status: 'to_test', ...prefill });
    setPanelOpen(true);
  };

  const openEdit = useCallback((item) => {
    setEditing(item);
    reset({
      test_case: item.test_case,
      project_id: item.project_id ?? '',
      issue_id: item.issue_id ?? '',
      module: item.module ?? '',
      test_type: item.test_type ?? '',
      severity: item.severity,
      priority: item.priority ?? 'p2',
      status: item.status,
      steps_to_reproduce: item.steps_to_reproduce ?? '',
      expected_result: item.expected_result ?? '',
      actual_result: item.actual_result ?? '',
      environment: item.environment ?? '',
      notes: item.notes ?? '',
      tested_on: item.tested_on ?? '',
    });
    setPanelOpen(true);
  }, [reset]);

  const onSubmit = async (data) => {
    try {
      const payload = {
        ...data,
        project_id: data.project_id || null,
        issue_id: data.issue_id || null,
        test_type: data.test_type || null,
        environment: data.environment || null,
        tested_on: data.tested_on || null,
      };
      if (editing) {
        await update(editing.id, payload);
        toast.success('QA item updated');
      } else {
        await create(payload);
        toast.success('QA item created');
      }
      setPanelOpen(false);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteItem(confirmId);
      toast.success('QA item deleted');
      setConfirmId(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const exportCSV = () => {
    const selectedItems = items.filter(i => selected.has(i.id));
    const rows = selectedItems.map(i => [
      `"${i.test_case}"`, i.status, i.severity, i.module ?? '',
      i.test_type ?? '', i.environment ?? '', i.tested_on ?? '',
    ]);
    const csv = ['Test Case,Status,Severity,Module,Type,Environment,Tested On', ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `qa_export_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${selectedItems.length} items`);
  };

  const selectedArr = Array.from(selected);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="section-header">
        <div>
          <h2 className="section-title">QA Tracker</h2>
          <p className="section-subtitle">{stats.total} test cases</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => openCreate()}>
          <Plus size={14} /> New Test
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        {[
          { label: 'Total', value: stats.total, color: 'text-text-primary' },
          { label: 'Pass', value: stats.pass, color: 'text-success' },
          { label: 'Fail', value: stats.fail, color: 'text-danger' },
          { label: 'Blocked', value: stats.blocked, color: 'text-warning' },
          { label: 'To Test', value: stats.to_test, color: 'text-accent' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-4 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-text-muted mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-3 mb-4 flex items-center gap-3 flex-wrap">
        <Select
          placeholder="All Projects"
          options={projects.map(p => ({ value: p.id, label: p.name }))}
          value={filters.project_id ?? ''}
          onChange={e => setFilters(f => ({ ...f, project_id: e.target.value || undefined }))}
          className="w-40"
        />
        <Select
          placeholder="All Statuses"
          options={toOptions(QA_STATUSES, QA_STATUS_LABELS)}
          value={filters.status ?? ''}
          onChange={e => setFilters(f => ({ ...f, status: e.target.value || undefined }))}
          className="w-36"
        />
        <Select
          placeholder="All Severities"
          options={[
            { value: 'critical', label: 'Critical' },
            { value: 'high', label: 'High' },
            { value: 'medium', label: 'Medium' },
            { value: 'low', label: 'Low' },
          ]}
          value={filters.severity ?? ''}
          onChange={e => setFilters(f => ({ ...f, severity: e.target.value || undefined }))}
          className="w-36"
        />
        <input
          className="input-base w-36"
          placeholder="Filter module…"
          value={filters.module ?? ''}
          onChange={e => setFilters(f => ({ ...f, module: e.target.value || undefined }))}
        />
        {Object.keys(filters).length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setFilters({})}>Clear filters</Button>
        )}
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="card p-3 mb-4 flex items-center gap-3 bg-accent/5 border-accent/20">
          <span className="text-sm text-accent font-medium">{selected.size} selected</span>
          <Select
            placeholder="Change Status"
            options={toOptions(QA_STATUSES, QA_STATUS_LABELS)}
            className="w-36"
            onChange={async e => {
              if (e.target.value) {
                await bulkUpdateStatus(selectedArr, e.target.value);
                toast.success(`Status updated for ${selected.size} items`);
              }
            }}
          />
          <Select
            placeholder="Change Severity"
            options={[{ value: 'critical', label: 'Critical' }, { value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }]}
            className="w-36"
            onChange={async e => {
              if (e.target.value) {
                await bulkUpdateSeverity(selectedArr, e.target.value);
                toast.success(`Severity updated for ${selected.size} items`);
              }
            }}
          />
          <Button variant="ghost" size="sm" onClick={exportCSV}>
            <Download size={13} /> Export CSV
          </Button>
          <Button variant="ghost" size="sm" onClick={clearSelection}>Clear</Button>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-4"><div className="skeleton h-5 flex-1" /><div className="skeleton h-5 w-20" /><div className="skeleton h-5 w-16" /></div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <TestTube2 size={40} className="empty-state-icon" />
            <p className="empty-state-title">No test cases yet</p>
            <Button variant="primary" size="sm" onClick={() => openCreate()}><Plus size={14} /> New Test</Button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-10">
                    <button onClick={() => selected.size === items.length ? clearSelection() : selectAll()} className="btn-icon w-5 h-5">
                      {selected.size === items.length ? <CheckSquare size={13} className="text-accent" /> : <Square size={13} />}
                    </button>
                  </th>
                  <th>Test Case</th>
                  <th>Project</th>
                  <th>Module</th>
                  <th>Type</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Env</th>
                  <th>Tested On</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className={`cursor-pointer ${selected.has(item.id) ? 'bg-accent/5' : ''}`}>
                    <td onClick={e => { e.stopPropagation(); toggleSelected(item.id); }}>
                      <button className="btn-icon w-5 h-5">
                        {selected.has(item.id) ? <CheckSquare size={13} className="text-accent" /> : <Square size={13} />}
                      </button>
                    </td>
                    <td onClick={() => openEdit(item)}>
                      <span className="font-medium text-text-primary">{item.test_case}</span>
                      {item.issues?.title && <p className="text-xs text-text-muted mt-0.5">↳ {item.issues.title}</p>}
                    </td>
                    <td onClick={() => openEdit(item)}><span className="text-xs text-text-secondary">{item.projects?.name ?? '—'}</span></td>
                    <td onClick={() => openEdit(item)}><span className="text-xs text-text-secondary">{item.module ?? '—'}</span></td>
                    <td onClick={() => openEdit(item)}><span className="text-xs text-text-secondary">{QA_TEST_TYPE_LABELS[item.test_type] ?? '—'}</span></td>
                    <td onClick={() => openEdit(item)}>
                      <span className={`text-xs font-medium capitalize ${SEVERITY_COLORS[item.severity]}`}>{item.severity}</span>
                    </td>
                    <td onClick={() => openEdit(item)}><StatusBadge status={item.status} /></td>
                    <td onClick={() => openEdit(item)}><span className="text-xs text-text-secondary capitalize">{item.environment ?? '—'}</span></td>
                    <td onClick={() => openEdit(item)}>
                      <span className="text-xs text-text-muted">{item.tested_on ? format(new Date(item.tested_on), 'MMM d') : '—'}</span>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <Dropdown
                        trigger={<Button variant="icon"><MoreHorizontal size={15} /></Button>}
                        items={[
                          { label: 'Edit', onClick: () => openEdit(item) },
                          { separator: true },
                          { label: 'Delete', danger: true, onClick: () => setConfirmId(item.id) },
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

      {/* QA Item Panel */}
      <Dialog
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        title={editing ? 'Edit Test Case' : 'New Test Case'}
        width="640px"
        footer={
          <div className="flex items-center justify-between w-full">
            <div>
              {editing && <Button variant="danger" size="sm" onClick={() => setConfirmId(editing.id)}><Trash2 size={13} /></Button>}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setPanelOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleSubmit(onSubmit)} loading={isSubmitting}>{editing ? 'Save' : 'Create'}</Button>
            </div>
          </div>
        }
      >
        <form className="space-y-5">
          <Input label="Test Case" placeholder="Verify that payment succeeds with valid card" required error={errors.test_case?.message} {...register('test_case')} />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Project" placeholder="Select project" options={projects.map(p => ({ value: p.id, label: p.name }))} {...register('project_id')} />
            <Select label="Linked Issue" placeholder="Select issue" options={issues.map(i => ({ value: i.id, label: i.title }))} {...register('issue_id')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Module" placeholder="e.g. Payments, Auth" {...register('module')} />
            <Select label="Test Type" placeholder="Select type" options={toOptions(QA_TEST_TYPES, QA_TEST_TYPE_LABELS)} {...register('test_type')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid grid-cols-2 gap-2">
              <Select label="Severity" options={[{ value: 'critical', label: 'Critical' }, { value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }]} {...register('severity')} />
              <Select label="Priority" options={toOptions(QA_PRIORITIES, PROJECT_PRIORITY_LABELS)} {...register('priority')} />
            </div>
            <Select label="Status" options={toOptions(QA_STATUSES, QA_STATUS_LABELS)} {...register('status')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Environment" placeholder="Select environment" options={[{ value: 'local', label: 'Local' }, { value: 'staging', label: 'Staging' }, { value: 'production', label: 'Production' }]} {...register('environment')} />
            <Input label="Tested On" type="date" {...register('tested_on')} />
          </div>
          <Textarea label="Steps to Reproduce" placeholder="1. Navigate to...\n2. Click..." rows={3} {...register('steps_to_reproduce')} />
          <div className="grid grid-cols-2 gap-4">
            <Textarea label="Expected Result" rows={2} {...register('expected_result')} />
            <Textarea label="Actual Result" rows={2} hint={watchedStatus !== 'fail' ? 'Fill when status = Fail' : undefined} {...register('actual_result')} />
          </div>
          <Textarea label="Notes" rows={2} {...register('notes')} />
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={handleDelete}
        title="Delete test case?"
        message="This will permanently delete the test case."
        loading={deleting}
      />
    </div>
  );
}
