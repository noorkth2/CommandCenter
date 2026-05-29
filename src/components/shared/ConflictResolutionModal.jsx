import { useState } from 'react';
import { AlertTriangle, ArrowRight, Check, RefreshCw, X } from 'lucide-react';
import Button, { clsx } from '../ui/Button';

const TABLE_LABELS = {
  issues: 'Issue',
  projects: 'Project',
  qa_items: 'QA Item',
  deployments: 'Deployment',
  sprints: 'Sprint',
  automations: 'Automation',
  products: 'Product',
  clients: 'Client',
};

function diffFields(local, server) {
  const fields = [];
  const allKeys = new Set([...Object.keys(local), ...Object.keys(server)]);
  for (const key of allKeys) {
    if (key === 'id' || key === 'created_at' || key === 'updated_at') continue;
    const lv = local[key];
    const sv = server[key];
    if (JSON.stringify(lv) !== JSON.stringify(sv)) {
      fields.push({ key, local: lv, server: sv });
    }
  }
  return fields;
}

export default function ConflictResolutionModal({ conflict, onResolve, onClose }) {
  const [resolving, setResolving] = useState(null);

  if (!conflict) return null;

  const { table, localPayload, serverRow } = conflict;
  const label = TABLE_LABELS[table] ?? table;
  const title = localPayload?.title ?? serverRow?.title ?? localPayload?.name ?? serverRow?.name ?? '(untitled)';
  const diffs = diffFields(localPayload, serverRow);

  const handleResolve = async (resolution) => {
    setResolving(resolution);
    try {
      await onResolve(conflict.entryId, resolution);
    } finally {
      setResolving(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-bg-surface border border-border rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-warning/15 flex items-center justify-center">
              <AlertTriangle size={16} className="text-warning" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Sync Conflict</h2>
              <p className="text-xs text-text-muted mt-0.5">
                {label} &quot;{title}&quot; was modified on another device while you were offline
              </p>
            </div>
          </div>
          <Button variant="icon" onClick={onClose} aria-label="Close">
            <X size={16} />
          </Button>
        </div>

        {/* Diff */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {diffs.length === 0 && (
            <p className="text-sm text-text-muted text-center py-4">
              No field-level differences detected. The record may have been touched on the server.
            </p>
          )}
          {diffs.map(({ key, local, server }) => (
            <div key={key} className="rounded border border-border overflow-hidden">
              <div className="px-3 py-1.5 bg-bg-elevated border-b border-border text-xs font-medium text-text-muted uppercase tracking-wider">
                {key.replace(/_/g, ' ')}
              </div>
              <div className="grid grid-cols-2 divide-x divide-border">
                <div className="p-3 bg-danger/5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-danger" />
                    <span className="text-2xs font-medium text-danger uppercase">Your version</span>
                  </div>
                  <p className="text-xs text-text-primary whitespace-pre-wrap break-words">
                    {local != null ? String(local) : <span className="text-text-muted italic">empty</span>}
                  </p>
                </div>
                <div className="p-3 bg-accent/5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                    <span className="text-2xs font-medium text-accent uppercase">Server version</span>
                  </div>
                  <p className="text-xs text-text-primary whitespace-pre-wrap break-words">
                    {server != null ? String(server) : <span className="text-text-muted italic">empty</span>}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <Button
            variant="ghost"
            onClick={() => handleResolve('keep_local')}
            loading={resolving === 'keep_local'}
          >
            <X size={14} />
            Discard My Changes
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleResolve('keep_server')}
            loading={resolving === 'keep_server'}
          >
            <Check size={14} />
            Keep Server Version
          </Button>
          <Button
            variant="primary"
            onClick={() => handleResolve('overwrite_server')}
            loading={resolving === 'overwrite_server'}
          >
            <RefreshCw size={14} />
            Overwrite with Mine
          </Button>
        </div>
      </div>
    </div>
  );
}
