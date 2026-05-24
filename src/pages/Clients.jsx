import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus, Pencil, Trash2, Users, FolderKanban,
  ChevronDown, ChevronRight, Building2, MoreHorizontal,
} from 'lucide-react';

import { useClientStore } from '../store/useClientStore';
import { useProductStore } from '../store/useProductStore';
import { useProjectStore } from '../store/useProjectStore';
import { useToast } from '../components/ui/Toast';
import Button from '../components/ui/Button';
import Dialog from '../components/ui/Dialog';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import StatusBadge from '../components/shared/StatusBadge';
import PriorityBadge from '../components/shared/PriorityBadge';
import Dropdown from '../components/ui/Dropdown';

// ─── Validation schema ────────────────────────────────────────────────────────
const schema = z.object({
  name: z.string().min(1, 'Client name is required').max(120),
  product_id: z.string().uuid('Product Line is required'),
});

// ─── Color cyclic config for dynamic feel ──────────────────────────────────────
const PRODUCT_COLORS = [
  {
    color: 'text-brand-blue',
    bg: 'bg-brand-blue/10',
    border: 'border-brand-blue/25',
    dot: 'bg-brand-blue',
  },
  {
    color: 'text-brand-purple',
    bg: 'bg-brand-purple/10',
    border: 'border-brand-purple/25',
    dot: 'bg-brand-purple',
  },
  {
    color: 'text-brand-green',
    bg: 'bg-brand-green/10',
    border: 'border-brand-green/25',
    dot: 'bg-brand-green',
  },
  {
    color: 'text-brand-amber',
    bg: 'bg-brand-amber/10',
    border: 'border-brand-amber/25',
    dot: 'bg-brand-amber',
  },
  {
    color: 'text-brand-red',
    bg: 'bg-brand-red/10',
    border: 'border-brand-red/25',
    dot: 'bg-brand-red',
  },
];

const getProductColorConfig = (productName, index) => {
  if (productName === 'VU Gear') return PRODUCT_COLORS[0];
  if (productName === 'IP GEAR') return PRODUCT_COLORS[1];
  if (productName === 'EB GEAR') return PRODUCT_COLORS[2];
  return PRODUCT_COLORS[index % PRODUCT_COLORS.length];
};

export default function Clients() {
  const navigate = useNavigate();
  const { clients, loading: clientsLoading, fetch: fetchClients, create, update, delete: deleteClient } = useClientStore();
  const { products, loading: productsLoading, fetch: fetchProducts } = useProductStore();
  const { projects, fetch: fetchProjects } = useProjectStore();
  const toast = useToast();

  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [expanded, setExpanded] = useState({});

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', product_id: '' },
  });

  const loading = clientsLoading || productsLoading;

  useEffect(() => {
    fetchProducts();
    fetchClients();
    fetchProjects();
  }, []);

  const openCreate = () => {
    setEditing(null);
    reset({ name: '', product_id: products[0]?.id ?? '' });
    setPanelOpen(true);
  };

  const openEdit = useCallback((client) => {
    setEditing(client);
    reset({ name: client.name, product_id: client.product_id });
    setPanelOpen(true);
  }, [reset, products]);

  const onSubmit = async (data) => {
    try {
      if (editing) {
        await update(editing.id, data);
        toast.success('Client updated');
      } else {
        await create(data);
        toast.success('Client created');
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
      await deleteClient(confirmId);
      toast.success('Client deleted');
      setConfirmId(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const toggleExpanded = (id) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const getClientProjects = (clientId) =>
    projects.filter((p) => p.client_id === clientId);

  const getLineStats = (productId) => {
    const lineClients = clients.filter((c) => c.product_id === productId);
    const lineProjects = projects.filter((p) =>
      lineClients.some((c) => c.id === p.client_id)
    );
    return { clients: lineClients.length, projects: lineProjects.length };
  };

  return (
    <div className="animate-fade-in space-y-6 pb-12">
      {/* Header */}
      <div className="section-header">
        <div>
          <h2 className="section-title">Clients</h2>
          <p className="section-subtitle">
            {clients.length} clients across {products.length} product lines
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={openCreate} disabled={products.length === 0}>
          <Plus size={14} /> New Client
        </Button>
      </div>

      {/* Product Line Columns */}
      {products.length === 0 && !loading ? (
        <div className="card p-12 text-center max-w-xl mx-auto mt-8">
          <Building2 size={48} className="mx-auto text-text-muted opacity-40 mb-3" />
          <h3 className="text-lg font-medium text-text-primary mb-1">No products created yet</h3>
          <p className="text-xs text-text-muted mb-6">
            You need to create at least one Product Line before managing clients.
          </p>
          <Button variant="primary" size="sm" onClick={() => navigate('/products')}>
            Go to Products
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product, idx) => {
            const cfg = getProductColorConfig(product.name, idx);
            const lineClients = clients.filter((c) => c.product_id === product.id);
            const stats = getLineStats(product.id);

            return (
              <div key={product.id} className="flex flex-col gap-3">
                {/* Column Header */}
                <div className={`flex items-center justify-between px-4 py-3 rounded-lg border ${cfg.bg} ${cfg.border}`}>
                  <div className="flex items-center gap-2.5">
                    <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                    <span className={`font-semibold text-sm ${cfg.color}`}>{product.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-2xs text-text-muted">
                    <span>{stats.clients} clients</span>
                    <span>·</span>
                    <span>{stats.projects} projects</span>
                  </div>
                </div>

                {/* Client Cards */}
                {loading ? (
                  <div className="space-y-2">
                    {[1, 2].map((i) => (
                      <div key={i} className="card p-4 space-y-2">
                        <div className="skeleton h-4 w-3/4 rounded" />
                        <div className="skeleton h-3 w-1/2 rounded" />
                      </div>
                    ))}
                  </div>
                ) : lineClients.length === 0 ? (
                  <div className="card p-6 text-center">
                    <Building2 size={24} className="mx-auto text-text-muted opacity-40 mb-2" />
                    <p className="text-xs text-text-muted">No clients yet</p>
                    <button
                      onClick={openCreate}
                      className="text-xs text-brand-blue hover:underline mt-1"
                    >
                      Add one
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {lineClients.map((client) => {
                      const clientProjects = getClientProjects(client.id);
                      const isOpen = expanded[client.id];

                      return (
                        <div key={client.id} className="card overflow-hidden">
                          {/* Client Row */}
                          <div
                            className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-bg-hover transition-colors group"
                            onClick={() => toggleExpanded(client.id)}
                          >
                            <div
                              className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${cfg.bg} border ${cfg.border}`}
                            >
                              <Users size={13} className={cfg.color} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-text-primary truncate">
                                {client.name}
                              </p>
                              <p className="text-2xs text-text-muted">
                                {clientProjects.length} project{clientProjects.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Dropdown
                                trigger={
                                  <Button variant="icon" size="sm" aria-label="Client actions">
                                    <MoreHorizontal size={14} />
                                  </Button>
                                }
                                items={[
                                  { label: 'Edit', icon: <Pencil size={13} />, onClick: () => openEdit(client) },
                                  { separator: true },
                                  { label: 'Delete', icon: <Trash2 size={13} />, danger: true, onClick: () => setConfirmId(client.id) },
                                ]}
                              />
                            </div>
                            <span className="text-text-muted flex-shrink-0">
                              {isOpen
                                ? <ChevronDown size={14} />
                                : <ChevronRight size={14} />
                              }
                            </span>
                          </div>

                          {/* Expanded Projects List */}
                          {isOpen && (
                            <div className="border-t border-border">
                              {clientProjects.length === 0 ? (
                                <div className="px-4 py-3 flex items-center justify-between">
                                  <p className="text-xs text-text-muted">No projects linked to this client</p>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-2xs h-6 px-2"
                                    onClick={() => navigate('/projects')}
                                  >
                                    <Plus size={11} /> Add
                                  </Button>
                                </div>
                              ) : (
                                <div className="divide-y divide-border">
                                  {clientProjects.map((proj) => (
                                    <div
                                      key={proj.id}
                                      onClick={() => navigate('/projects')}
                                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-bg-hover transition-colors cursor-pointer"
                                    >
                                      <FolderKanban size={13} className="text-text-muted flex-shrink-0" />
                                      <span className="text-xs text-text-primary flex-1 truncate">
                                        {proj.name}
                                      </span>
                                      <div className="flex items-center gap-1.5 flex-shrink-0">
                                        <StatusBadge status={proj.status} />
                                        <PriorityBadge priority={proj.priority} />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Panel */}
      <Dialog
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        title={editing ? 'Edit Client' : 'New Client'}
        subtitle={editing ? editing.name : 'Add a new client under a product line'}
        width="420px"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPanelOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
              {editing ? 'Save Changes' : 'Create Client'}
            </Button>
          </>
        }
      >
        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
          <Input
            label="Client Name"
            placeholder="e.g. Acme Corporation"
            required
            error={errors.name?.message}
            {...register('name')}
          />
          <Select
            label="Product Line"
            options={products.map((p) => ({ value: p.id, label: p.name }))}
            error={errors.product_id?.message}
            {...register('product_id')}
          />
        </form>
      </Dialog>

      {/* Confirm Delete */}
      <ConfirmDialog
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={handleDelete}
        title="Delete client?"
        message="This will permanently delete the client. Any projects linked to this client will be unlinked but not deleted."
        loading={deleting}
      />
    </div>
  );
}
