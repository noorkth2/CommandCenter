import { useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table';
import { format } from 'date-fns';
import { MoreHorizontal, ShieldAlert } from 'lucide-react';
import StatusBadge from '../shared/StatusBadge';
import PriorityBadge from '../shared/PriorityBadge';
import SeverityBadge from '../shared/SeverityBadge';
import Dropdown from '../ui/Dropdown';
import Button from '../ui/Button';

export default function IssuesList({ issues, onEdit, onDelete }) {
  const columns = useMemo(
    () => [
      {
        accessorKey: 'title',
        header: 'Title',
        cell: (info) => (
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-medium text-text-primary text-xs leading-tight">
                {info.getValue()}
              </span>
              {info.row.original.is_tech_debt && (
                <ShieldAlert size={12} className="text-warning flex-shrink-0" title="Technical Debt" />
              )}
            </div>
            <div className="flex gap-1 mt-1">
              {(info.row.original.labels ?? []).slice(0, 3).map((l) => (
                <span
                  key={l}
                  className="badge bg-bg-elevated text-text-muted border-border text-[10px] px-1"
                >
                  {l}
                </span>
              ))}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: (info) => <StatusBadge status={info.getValue()} />,
      },
      {
        id: 'priority_severity',
        header: 'Priority / Severity',
        cell: (info) => (
          <div className="flex flex-col gap-1">
            <PriorityBadge priority={info.row.original.priority} />
            <SeverityBadge severity={info.row.original.severity} />
          </div>
        ),
      },
      {
        accessorKey: 'projects.name',
        header: 'Project',
        cell: (info) => (
          <span className="text-xs text-text-secondary truncate block max-w-[120px]">
            {info.getValue() ?? '—'}
          </span>
        ),
      },
      {
        accessorKey: 'team',
        header: 'Team',
        cell: (info) => (
          <span className="text-xs text-text-secondary capitalize">
            {info.getValue() ?? '—'}
          </span>
        ),
      },
      {
        accessorKey: 'created_at',
        header: 'Created',
        cell: (info) => (
          <span className="text-xs text-text-muted">
            {format(new Date(info.getValue()), 'MMM d')}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: (info) => (
          <div onClick={(e) => e.stopPropagation()}>
            <Dropdown
              trigger={
                <Button variant="icon">
                  <MoreHorizontal size={14} />
                </Button>
              }
              items={[
                { label: 'Edit', onClick: () => onEdit(info.row.original) },
                { separator: true },
                {
                  label: 'Delete',
                  danger: true,
                  onClick: () => onDelete(info.row.original.id),
                },
              ]}
            />
          </div>
        ),
      },
    ],
    [onEdit, onDelete]
  );

  const table = useReactTable({
    data: issues,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="table-wrapper border border-border rounded-lg overflow-hidden bg-bg-surface">
      <table className="data-table">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="text-left py-2 px-3 bg-bg-elevated border-b border-border text-2xs font-semibold text-text-muted uppercase tracking-wider">
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onEdit(row.original)}
              className="hover:bg-bg-elevated/50 transition-colors cursor-pointer border-b border-border/50 last:border-0"
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="py-2 px-3 align-middle">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
