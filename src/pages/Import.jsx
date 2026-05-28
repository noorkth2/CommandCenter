import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  FileJson,
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  ArrowRight,
  Download,
  ChevronDown,
  ChevronUp,
  Database,
} from 'lucide-react';

import { useProductStore } from '../store/useProductStore';
import { useClientStore } from '../store/useClientStore';
import { useProjectStore } from '../store/useProjectStore';
import { useIssueStore } from '../store/useIssueStore';
import { useQAStore } from '../store/useQAStore';
import { useDeploymentStore } from '../store/useDeploymentStore';
import { useSprintStore } from '../store/useSprintStore';
import { useAutomationStore } from '../store/useAutomationStore';
import { useToast } from '../components/ui/Toast';
import Button from '../components/ui/Button';
import {
  parseCSV,
  parseJiraCSV,
  parseIssuesCSV,
  parseQACSV,
  detectConflicts,
  executeJsonImport,
  executeCsvImport,
} from '../lib/importUtils';

const SOURCE_TYPES = [
  {
    id: 'json',
    title: 'CommandCenter JSON Backup',
    desc: 'Full database export — products, clients, projects, issues, QA, deployments, sprints, automations',
    icon: FileJson,
    color: 'text-brand-blue',
    bgColor: 'bg-brand-blue/10 border-brand-blue/20',
  },
  {
    id: 'csv_issues',
    title: 'CSV Issues',
    desc: 'Import issues from a CSV file with columns: title, status, priority, labels, assignee, description, project_id, sprint_id',
    icon: FileText,
    color: 'text-brand-purple',
    bgColor: 'bg-brand-purple/10 border-brand-purple/20',
  },
  {
    id: 'csv_qa',
    title: 'CSV QA Tests',
    desc: 'Import QA test cases from CSV: test_case, severity, status, module, project_id',
    icon: FileText,
    color: 'text-brand-green',
    bgColor: 'bg-brand-green/10 border-brand-green/20',
  },
  {
    id: 'jira',
    title: 'Jira CSV Export',
    desc: 'Import issues from Jira CSV — auto-maps statuses, priorities, labels, and assignees',
    icon: Download,
    color: 'text-brand-amber',
    bgColor: 'bg-brand-amber/10 border-brand-amber/20',
  },
];

const STORE_MAP = {
  products: { get: () => useProductStore.getState(), key: 'name', label: 'Products' },
  clients: { get: () => useClientStore.getState(), key: 'name', label: 'Clients' },
  projects: { get: () => useProjectStore.getState(), key: 'name', label: 'Projects' },
  issues: { get: () => useIssueStore.getState(), key: 'title', label: 'Issues' },
  qa_items: { get: () => useQAStore.getState(), key: 'test_case', label: 'QA Tests' },
  deployments: { get: () => useDeploymentStore.getState(), key: 'name', label: 'Deployments' },
  sprints: { get: () => useSprintStore.getState(), key: 'name', label: 'Sprints' },
  automations: { get: () => useAutomationStore.getState(), key: 'name', label: 'Automations' },
};

export default function Import() {
  const toast = useToast();
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [step, setStep] = useState(0);
  const [sourceType, setSourceType] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [existingData, setExistingData] = useState(null);
  const [conflicts, setConflicts] = useState(null);
  const [selectAll, setSelectAll] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  // Fetch existing data for conflict detection
  const fetchExisting = useCallback(async () => {
    const data = {};
    for (const [table, store] of Object.entries(STORE_MAP)) {
      const s = store.get();
      if (typeof s.fetch === 'function') await s.fetch();
      data[table] = s[table] || s.items || s.projects || s.issues || s.sprints || s.deployments || s.automations || [];
    }
    setExistingData(data);
    return data;
  }, []);

  // Load existing data on mount
  useEffect(() => {
    fetchExisting();
  }, [fetchExisting]);

  // Handle file selection
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);
    setConflicts(null);
    setResults(null);

    try {
      const text = await file.text();
      let parsed;
      let existing = existingData;

      if (!existing) existing = await fetchExisting();

      switch (sourceType) {
        case 'json': {
          const data = JSON.parse(text);
          if (!data || typeof data !== 'object') throw new Error('Invalid JSON: expected an object with table arrays');
          parsed = { type: 'json', tables: data };
          break;
        }
        case 'csv_issues': {
          const items = parseIssuesCSV(text);
          if (items.length === 0) throw new Error('No valid rows found');
          const withConflicts = detectConflicts(items, existing.issues || [], 'title');
          parsed = { type: 'csv', entity: 'issues', items: withConflicts };
          break;
        }
        case 'csv_qa': {
          const items = parseQACSV(text);
          if (items.length === 0) throw new Error('No valid rows found');
          const withConflicts = detectConflicts(items, existing.qa_items || [], 'test_case');
          parsed = { type: 'csv', entity: 'qa_items', items: withConflicts };
          break;
        }
        case 'jira': {
          const items = parseJiraCSV(text);
          if (items.length === 0) throw new Error('No valid rows found');
          const withConflicts = detectConflicts(items, existing.issues || [], 'title');
          parsed = { type: 'csv', entity: 'issues', items: withConflicts, source: 'jira' };
          break;
        }
        default:
          throw new Error('Unknown source type');
      }

      setParsedData(parsed);
      setStep(2);
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    }
  };

  // Count stats
  const stats = useMemo(() => {
    if (!parsedData) return null;
    if (parsedData.type === 'json') {
      const tables = parsedData.tables;
      const total = Object.values(tables).reduce((s, arr) => s + (arr?.length || 0), 0);
      return { total, conflicts: 0, tableCount: Object.keys(tables).length };
    }
    const items = parsedData.items;
    const conflictCount = items.filter((i) => i._status === 'conflict').length;
    return { total: items.length, conflicts: conflictCount, tableCount: 1 };
  }, [parsedData]);

  // Download sample template file
  const downloadSample = (type) => {
    let content = '';
    let filename = '';

    switch (type) {
      case 'csv_issues':
        content = 'title,status,priority,labels,assignee,description,project_id,sprint_id\n'
          + '"Fix login timeout",in_progress,p1,"bug,urgent",alice@co.com,"Session expires after 30s instead of 2h",,, \n'
          + '"Add dark mode toggle",todo,p2,enhancement,bob@co.com,"Global theme switch in settings header",,, \n';
        filename = 'sample_issues.csv';
        break;
      case 'csv_qa':
        content = 'test_case,severity,status,module,project_id,steps_to_reproduce,expected_result,actual_result,environment,notes\n'
          + '"User login flow",critical,pass,auth,,,,"User logs in successfully",staging, \n'
          + '"Checkout calculation",high,fail,cart,,,"Total does not include tax",,staging,"Needs backend fix"\n';
        filename = 'sample_qa.csv';
        break;
      case 'jira':
        content = 'Issue key,Summary,Issue Type,Status,Priority,Assignee,Labels,Description,Project,Sprint\n'
          + 'PROJ-123,"Login page crashes on submit",Bug,In Progress,High,john@co.com,frontend,"React router throws on form submit",Project Alpha,Sprint 12\n'
          + 'PROJ-124,"Add export button",Story,Todo,Medium,jane@co.com,enhancement,"CSV download button in reports view",Project Alpha,Sprint 12\n'
          + 'PROJ-125,"API timeout",Bug,Backlog,Highest,bob@co.com,"backend,urgent","GET /api/users returns 504 after 10s",API Service,Backlog\n';
        filename = 'sample_jira.csv';
        break;
      case 'json': {
        const sample = {
          _version: '1.0.0',
          products: [{ name: 'Sample Product', description: 'A product line' }],
          clients: [{ name: 'Acme Corp', product_id: '' }],
          projects: [{ name: 'Website Redesign', status: 'active', priority: 'p1', category: 'client' }],
          issues: [{ title: 'Fix homepage broken layout', status: 'todo', priority: 'p1', labels: ['bug', 'frontend'] }],
          qa_items: [{ test_case: 'Verify homepage loads', severity: 'critical', status: 'pass', module: 'frontend' }],
          deployments: [{ name: 'v2.1.0', environment: 'production', status: 'success' }],
          sprints: [{ name: 'Sprint 1', status: 'active', start_date: '2025-01-01', end_date: '2025-01-14' }],
          automations: [{ name: 'Deploy notify', enabled: true, trigger_type: 'deployment_completed', action_type: 'send_email', trigger_config: {}, action_config: {} }],
          ai_reports: [],
          _exported_at: new Date().toISOString(),
        };
        content = JSON.stringify(sample, null, 2);
        filename = 'sample_backup.json';
        break;
      }
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Toggle skip on an item
  const toggleSkip = (idx) => {
    setParsedData((prev) => {
      if (prev.type === 'json') {
        // Not implemented per-item for JSON — too complex
        return prev;
      }
      const items = [...prev.items];
      items[idx] = { ...items[idx], _skip: !items[idx]._skip };
      return { ...prev, items };
    });
  };

  const toggleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    if (parsedData?.type !== 'json') {
      setParsedData((prev) => ({
        ...prev,
        items: prev.items.map((i) => ({ ...i, _skip: !newSelectAll })),
      }));
    }
  };

  // Execute import
  const handleExecute = async () => {
    setExecuting(true);
    setError(null);

    try {
      if (parsedData.type === 'json') {
        const stores = {};
        for (const [table] of Object.entries(STORE_MAP)) {
          const s = STORE_MAP[table].get();
          stores[table] = s;
        }
        const r = await executeJsonImport(parsedData.tables, stores);
        setResults(r);
      } else {
        const entity = parsedData.entity;
        const store = STORE_MAP[entity]?.get();
        if (!store) throw new Error(`No store found for ${entity}`);
        const r = await executeCsvImport(parsedData.items, store, entity);
        setResults({ [entity]: r });
      }

      toast.success('Import completed');
      setStep(3);
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setExecuting(false);
    }
  };

  const reset = () => {
    setStep(0);
    setSourceType(null);
    setParsedData(null);
    setFileName('');
    setConflicts(null);
    setResults(null);
    setError(null);
  };

  const totalCreated = results
    ? Object.values(results).reduce((s, r) => s + (r.created || 0), 0)
    : 0;
  const totalSkipped = results
    ? Object.values(results).reduce((s, r) => s + (r.skipped || 0), 0)
    : 0;
  const totalFailed = results
    ? Object.values(results).reduce((s, r) => s + (r.failed || 0), 0)
    : 0;

  return (
    <div className="animate-fade-in space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-title">Import Data</h2>
          <p className="section-subtitle">Migrate data from backups, CSV files, or Jira exports</p>
        </div>
        {step > 0 && (
          <Button variant="ghost" size="sm" onClick={reset}>
            Start Over
          </Button>
        )}
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 text-xs">
        {['Source', 'Preview', 'Review', 'Done'].map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded ${
              step === i
                ? 'bg-brand-blue/10 text-brand-blue font-medium'
                : step > i
                  ? 'bg-brand-green/10 text-brand-green'
                  : 'bg-bg-elevated text-text-muted'
            }`}>
              {step > i ? <CheckCircle2 size={12} /> : <span>{i + 1}</span>}
              <span>{label}</span>
            </div>
            {i < 3 && <span className="text-text-muted">→</span>}
          </div>
        ))}
      </div>

      {/* Step 0: Source Type Selection */}
      {step === 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SOURCE_TYPES.map((st) => {
            const Icon = st.icon;
            const isSelected = sourceType === st.id;
            return (
              <div
                key={st.id}
                onClick={() => setSourceType(st.id)}
                className={`card p-5 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 ${
                  isSelected ? 'ring-2 ring-brand-blue/50' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${st.bgColor} ${st.color} flex-shrink-0`}>
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-text-primary">{st.title}</h3>
                      <button
                        onClick={(e) => { e.stopPropagation(); downloadSample(st.id); }}
                        className="flex items-center gap-1 px-2 py-1 rounded text-2xs text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors flex-shrink-0 cursor-pointer"
                        title="Download sample template"
                      >
                        <Download size={11} />
                        Sample
                      </button>
                    </div>
                    <p className="text-2xs text-text-secondary mt-1 leading-relaxed">{st.desc}</p>
                  </div>
                </div>
              </div>
            );
          })}

          {sourceType && (
            <div className="sm:col-span-2 flex justify-end pt-2">
              <Button variant="primary" onClick={() => { setStep(1); fileRef.current?.click(); }}>
                <Upload size={14} /> Select File
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Step 1: File Upload (auto-advances to step 2) */}
      {step === 1 && (
        <div className="card p-12 text-center">
          <input
            ref={fileRef}
            type="file"
            accept={sourceType === 'json' ? '.json' : '.csv'}
            onChange={handleFile}
            className="hidden"
          />
          <Upload size={36} className="mx-auto mb-4 text-text-muted opacity-40" />
          <p className="text-sm text-text-primary font-medium mb-1">Select a file to import</p>
          <p className="text-xs text-text-muted mb-4">
            {sourceType === 'json' ? 'Choose a .json backup file' : 'Choose a .csv file'}
          </p>
          <Button variant="primary" onClick={() => fileRef.current?.click()}>
            Browse Files
          </Button>
        </div>
      )}

      {/* Step 2: Dry-Run / Conflict Review */}
      {step === 2 && parsedData && (
        <>
          {/* Summary bar */}
          {stats && (
            <div className="card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-xs">
                    <FileJson size={14} className="text-text-muted" />
                    <span className="text-text-primary">{fileName}</span>
                  </div>
                  <span className="text-2xs text-text-muted">|</span>
                  <span className="text-xs text-text-muted">{stats.total} item{stats.total !== 1 ? 's' : ''}</span>
                  {stats.conflicts > 0 && (
                    <>
                      <span className="text-2xs text-text-muted">|</span>
                      <span className="text-xs text-brand-amber">{stats.conflicts} conflict{stats.conflicts !== 1 ? 's' : ''}</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {parsedData.type !== 'json' && (
                    <Button variant="ghost" size="sm" onClick={toggleSelectAll}>
                      {selectAll ? 'Deselect All' : 'Select All'}
                    </Button>
                  )}
                  <Button variant="primary" size="sm" onClick={handleExecute} loading={executing}>
                    <Database size={14} /> Import {stats.total} Items
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* JSON Import - show tables */}
          {parsedData.type === 'json' && (
            <div className="space-y-4">
              {Object.entries(parsedData.tables).map(([table, items]) => {
                if (!items?.length) return null;
                const label = STORE_MAP[table]?.label || table;
                const key = STORE_MAP[table]?.key || 'name';
                return (
                  <div key={table} className="card p-4 space-y-2">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <span className="text-xs font-semibold text-text-primary">{label}</span>
                      <span className="text-2xs text-text-muted">{items.length} item{items.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto space-y-1">
                      {items.slice(0, 50).map((item, i) => (
                        <div key={i} className="text-xs text-text-secondary truncate py-0.5">
                          {item[key] || item.title || item.test_case || '(unnamed)'}
                        </div>
                      ))}
                      {items.length > 50 && (
                        <p className="text-2xs text-text-muted pt-1">… and {items.length - 50} more</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* CSV / Jira Import - show items with conflict status */}
          {parsedData.type !== 'json' && (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-bg-elevated">
                      <th className="text-left px-4 py-2.5 text-text-muted font-medium w-8"></th>
                      <th className="text-left px-4 py-2.5 text-text-muted font-medium">Title</th>
                      <th className="text-left px-4 py-2.5 text-text-muted font-medium">Status</th>
                      <th className="text-left px-4 py-2.5 text-text-muted font-medium">Priority</th>
                      <th className="text-left px-4 py-2.5 text-text-muted font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.items.map((item, idx) => (
                      <tr
                        key={idx}
                        className={`border-b border-border/50 hover:bg-bg-hover/50 transition-colors ${
                          item._skip ? 'opacity-40' : ''
                        }`}
                      >
                        <td className="px-4 py-2.5">
                          <input
                            type="checkbox"
                            checked={!item._skip}
                            onChange={() => toggleSkip(idx)}
                            className="accent-brand-blue"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-text-primary font-medium truncate max-w-[280px]">
                          {item.title || item.test_case}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-text-secondary">{item.status || '-'}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-text-secondary">{item.priority || item.severity || '-'}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          {item._status === 'conflict' ? (
                            <span className="inline-flex items-center gap-1 text-brand-amber">
                              <AlertCircle size={11} />
                              Exists
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-brand-green">
                              <CheckCircle2 size={11} />
                              New
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 rounded bg-brand-red/10 border border-brand-red/20 text-xs text-brand-red">
              <AlertCircle size={13} />
              {error}
            </div>
          )}
        </>
      )}

      {/* Step 3: Results */}
      {step === 3 && results && (
        <div className="space-y-4">
          <div className="card p-6 text-center space-y-4">
            {totalFailed === 0 ? (
              <CheckCircle2 size={40} className="mx-auto text-brand-green" />
            ) : (
              <AlertCircle size={40} className="mx-auto text-brand-amber" />
            )}
            <div>
              <h3 className="text-base font-semibold text-text-primary">Import Complete</h3>
              <p className="text-sm text-text-secondary mt-1">
                {totalCreated} created, {totalSkipped} skipped, {totalFailed} failed
              </p>
            </div>
          </div>

          {/* Per-table results */}
          <div className="space-y-3">
            {Object.entries(results).map(([table, r]) => {
              if (r.created === 0 && r.skipped === 0 && r.failed === 0) return null;
              const label = STORE_MAP[table]?.label || table;
              return (
                <div key={table} className="card p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-primary">{label}</span>
                    <div className="flex items-center gap-3 text-2xs">
                      <span className="text-brand-green">{r.created} created</span>
                      {r.skipped > 0 && <span className="text-text-muted">{r.skipped} skipped</span>}
                      {r.failed > 0 && <span className="text-brand-red">{r.failed} failed</span>}
                    </div>
                  </div>
                  {r.errors?.length > 0 && (
                    <div className="space-y-1 max-h-[120px] overflow-y-auto">
                      {r.errors.map((err, i) => (
                        <p key={i} className="text-2xs text-brand-red">{err}</p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={reset}>
              Import Another File
            </Button>
            <Button variant="primary" size="sm" onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
