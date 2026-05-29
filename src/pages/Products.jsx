import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus, Pencil, Trash2, Boxes, Users, FolderKanban,
  Building2, MoreHorizontal, ChevronRight, Layers,
} from 'lucide-react';

import { useProductStore } from '../store/useProductStore';
import { useClientStore } from '../store/useClientStore';
import { useProjectStore } from '../store/useProjectStore';
import { useToast } from '../components/ui/Toast';
import Button from '../components/ui/Button';
import Dialog from '../components/ui/Dialog';
import Input from '../components/ui/Input';
import Textarea from '../components/ui/Textarea';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Dropdown from '../components/ui/Dropdown';

// ─── Validation schema ────────────────────────────────────────────────────────
const schema = z.object({
  name: z.string().min(1, 'Product name is required').max(100),
  description: z.string().optional(),
});

// ─── Color cyclic config for dynamic feel ──────────────────────────────────────
const PRODUCT_COLORS = [
  {
    color: 'text-accent',
    bg: 'bg-accent/10',
    border: 'border-accent/25',
    dot: 'bg-accent',
  },
  {
    color: 'text-accent',
    bg: 'bg-accent/10',
    border: 'border-accent/25',
    dot: 'bg-accent',
  },
  {
    color: 'text-success',
    bg: 'bg-success/10',
    border: 'border-success/25',
    dot: 'bg-success',
  },
  {
    color: 'text-warning',
    bg: 'bg-warning/10',
    border: 'border-warning/25',
    dot: 'bg-warning',
  },
  {
    color: 'text-danger',
    bg: 'bg-danger/10',
    border: 'border-danger/25',
    dot: 'bg-danger',
  },
];

export default function Products() {
  const navigate = useNavigate();
  const { products, loading, fetch: fetchProducts, create, update, delete: deleteProduct } = useProductStore();
  const { clients, fetch: fetchClients } = useClientStore();
  const { projects, fetch: fetchProjects } = useProjectStore();
  const toast = useToast();

  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '' },
  });

  useEffect(() => {
    fetchProducts();
    fetchClients();
    fetchProjects();
  }, []);

  const openCreate = () => {
    setEditing(null);
    reset({ name: '', description: '' });
    setPanelOpen(true);
  };

  const openEdit = useCallback((product) => {
    setEditing(product);
    reset({ name: product.name, description: product.description ?? '' });
    setPanelOpen(true);
  }, [reset]);

  const onSubmit = async (data) => {
    try {
      if (editing) {
        await update(editing.id, data);
        toast.success('Product updated');
      } else {
        await create(data);
        toast.success('Product created');
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
      await deleteProduct(confirmId);
      toast.success('Product deleted');
      setConfirmId(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const getProductStats = (productId) => {
    const prodClients = clients.filter((c) => c.product_id === productId);
    const prodProjects = projects.filter((p) =>
      prodClients.some((c) => c.id === p.client_id)
    );
    return {
      clientsCount: prodClients.length,
      projectsCount: prodProjects.length,
      clientsList: prodClients,
    };
  };

  return (
    <div className="animate-fade-in space-y-6 pb-12">
      {/* Header */}
      <div className="section-header">
        <div>
          <h2 className="section-title">Products</h2>
          <p className="section-subtitle">
            Manage your dynamic product lines ({products.length} total) and monitor connected clients and projects.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={openCreate}>
          <Plus size={14} /> New Product
        </Button>
      </div>

      {/* Grid Layout */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-5 space-y-4">
              <div className="skeleton h-5 w-1/3 rounded" />
              <div className="skeleton h-3 w-3/4 rounded" />
              <div className="skeleton h-12 w-full rounded" />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="card p-12 text-center max-w-xl mx-auto mt-8">
          <Boxes size={48} className="mx-auto text-text-muted opacity-40 mb-3" />
          <h3 className="text-lg font-medium text-text-primary mb-1">No products created yet</h3>
          <p className="text-sm text-text-muted mb-6">
            Create a product line (e.g. VU Gear) to group your clients and projects.
          </p>
          <Button variant="primary" size="sm" onClick={openCreate}>
            <Plus size={14} /> Add Product
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product, idx) => {
            const colorCfg = PRODUCT_COLORS[idx % PRODUCT_COLORS.length];
            const { clientsCount, projectsCount, clientsList } = getProductStats(product.id);

            return (
              <div key={product.id} className="card flex flex-col justify-between p-5 hover:border-text-muted/30 transition-all group relative overflow-hidden">
                {/* Visual Accent */}
                <div className={`absolute top-0 left-0 right-0 h-1 ${colorCfg.dot}`} />

                <div>
                  {/* Title and Dropdown */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded flex items-center justify-center ${colorCfg.bg} border ${colorCfg.border}`}>
                        <Layers size={12} className={colorCfg.color} />
                      </div>
                      <h3 className="font-semibold text-text-primary tracking-tight text-base group-hover:text-accent transition-colors">
                        {product.name}
                      </h3>
                    </div>

                    <Dropdown
                      trigger={
                        <Button variant="icon" size="sm" aria-label="Product actions">
                          <MoreHorizontal size={14} />
                        </Button>
                      }
                      items={[
                        { label: 'Edit', icon: <Pencil size={13} />, onClick: () => openEdit(product) },
                        { separator: true },
                        { label: 'Delete', icon: <Trash2 size={13} />, danger: true, onClick: () => setConfirmId(product.id) },
                      ]}
                    />
                  </div>

                  {/* Description */}
                  <p className="text-xs text-text-muted line-clamp-2 min-h-[2rem] mb-4">
                    {product.description || 'No description provided.'}
                  </p>

                  {/* Metrics Row */}
                  <div className="grid grid-cols-2 gap-3 p-3 bg-bg-elevated border border-border rounded-lg mb-4">
                    <div className="flex items-center gap-2 cursor-pointer hover:opacity-85" onClick={() => navigate('/clients')}>
                      <Users size={14} className="text-accent" />
                      <div>
                        <span className="text-xs font-semibold text-text-primary block">{clientsCount}</span>
                        <span className="text-3xs text-text-muted uppercase tracking-wider block">Clients</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 cursor-pointer hover:opacity-85" onClick={() => navigate('/projects')}>
                      <FolderKanban size={14} className="text-accent" />
                      <div>
                        <span className="text-xs font-semibold text-text-primary block">{projectsCount}</span>
                        <span className="text-3xs text-text-muted uppercase tracking-wider block">Projects</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Nested Clients Quick view */}
                <div className="border-t border-border/60 pt-3">
                  <span className="text-3xs font-semibold text-text-muted uppercase tracking-wider block mb-2">Connected Clients</span>
                  {clientsList.length === 0 ? (
                    <span className="text-2xs text-text-muted italic block">No clients linked</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 max-h-[3.5rem] overflow-y-auto pr-1">
                      {clientsList.slice(0, 3).map((c) => (
                        <span key={c.id} className="text-3xs px-2 py-0.5 rounded bg-bg-elevated text-text-secondary border border-border/80">
                          {c.name}
                        </span>
                      ))}
                      {clientsList.length > 3 && (
                        <span className="text-3xs text-text-muted self-center">+{clientsList.length - 3} more</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        title={editing ? 'Edit Product' : 'New Product'}
        subtitle={editing ? editing.name : 'Define a new product line'}
        width="420px"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPanelOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
              {editing ? 'Save Changes' : 'Create Product'}
            </Button>
          </>
        }
      >
        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
          <Input
            label="Product Line Name"
            placeholder="e.g. VU Gear, Cloud Sync"
            required
            error={errors.name?.message}
            {...register('name')}
          />
          <Textarea
            label="Description"
            placeholder="Optional description outlining products or focus area..."
            rows={3}
            error={errors.description?.message}
            {...register('description')}
          />
        </form>
      </Dialog>

      {/* Confirm Delete */}
      <ConfirmDialog
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={handleDelete}
        title="Delete product line?"
        message="Warning: This will permanently delete this product line. All clients belonging to this product, and projects associated with those clients, will be affected (clients will be deleted and projects will be unlinked)."
        loading={deleting}
      />
    </div>
  );
}
