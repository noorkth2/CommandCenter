import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const { mockSupabaseQuery, mockSupabaseClient, mockToast } = vi.hoisted(() => {
  const query = {
    select: vi.fn(() => query),
    insert: vi.fn(() => query),
    update: vi.fn(() => query),
    delete: vi.fn(() => query),
    order: vi.fn(() => query),
    eq: vi.fn(() => query),
    single: vi.fn(),
    maybeSingle: vi.fn(),
  };
  return {
    mockSupabaseQuery: query,
    mockSupabaseClient: { from: vi.fn(() => query) },
    mockToast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() },
  };
});

vi.mock('../../lib/supabase', () => ({
  supabase: mockSupabaseClient,
}));

vi.mock('../../components/ui/Toast', () => ({
  useToast: () => mockToast,
  toast: mockToast,
}));

vi.mock('../../lib/syncQueue', () => ({
  enqueue: vi.fn(),
}));

import { enqueue } from '../../lib/syncQueue';
import { cacheFlush } from '../../lib/cache';
import { useProjectStore } from '../useProjectStore';

describe('useProjectStore', () => {
  beforeEach(() => {
    useProjectStore.setState({ projects: [], loading: false, error: null });
    cacheFlush();
    vi.clearAllMocks();
    // Re-apply chainable mock implementations
    mockSupabaseQuery.select.mockImplementation(() => mockSupabaseQuery);
    mockSupabaseQuery.insert.mockImplementation(() => mockSupabaseQuery);
    mockSupabaseQuery.update.mockImplementation(() => mockSupabaseQuery);
    mockSupabaseQuery.delete.mockImplementation(() => mockSupabaseQuery);
    mockSupabaseQuery.order.mockImplementation(() => mockSupabaseQuery);
    mockSupabaseQuery.eq.mockImplementation(() => mockSupabaseQuery);
    mockSupabaseClient.from.mockImplementation(() => mockSupabaseQuery);
  });

  // ─── fetchProjects ────────────────────────────────────────────────────────

  it('fetchProjects loads data from Supabase', async () => {
    const fakeData = [{ id: '1', name: 'Project A', status: 'active' }];
    mockSupabaseQuery.order.mockReturnValue(Promise.resolve({ data: fakeData, error: null }));

    await useProjectStore.getState().fetchProjects();
    const state = useProjectStore.getState();
    expect(state.projects).toEqual(fakeData);
    expect(state.loading).toBe(false);
  });

  it('fetchProjects handles error', async () => {
    mockSupabaseQuery.order.mockReturnValue(Promise.resolve({ data: null, error: { message: 'fail' } }));

    await useProjectStore.getState().fetchProjects();
    expect(useProjectStore.getState().error).toBe('fail');
  });

  // ─── addProject ───────────────────────────────────────────────────────────

  it('addProject optimistically adds and swaps temp ID', async () => {
    mockSupabaseQuery.single.mockResolvedValue({ data: { id: 'real-1', name: 'New', status: 'active' }, error: null });

    const result = await useProjectStore.getState().addProject({ name: 'New' });
    expect(result.data.id).toBe('real-1');
    expect(useProjectStore.getState().projects).toHaveLength(1);
  });

  it('addProject rolls back on error', async () => {
    mockSupabaseQuery.single.mockResolvedValue({ data: null, error: { message: 'Insert failed' } });

    await useProjectStore.getState().addProject({ name: 'Fail' });
    expect(useProjectStore.getState().projects).toHaveLength(0);
    expect(mockToast.error).toHaveBeenCalledWith('Insert failed');
  });

  it('addProject enqueues on network error', async () => {
    mockSupabaseQuery.single.mockRejectedValue(new Error('Failed to fetch'));

    const result = await useProjectStore.getState().addProject({ name: 'Offline' });
    expect(result.data).toBeDefined();
    expect(result.data.id).toMatch(/^__temp_/);
    expect(enqueue).toHaveBeenCalled();
    expect(useProjectStore.getState().projects).toHaveLength(1);
  });

  // ─── updateProject ────────────────────────────────────────────────────────

  it('updateProject optimistically patches and replaces on success', async () => {
    useProjectStore.setState({ projects: [{ id: '1', name: 'Old', status: 'active' }] });
    mockSupabaseQuery.single.mockResolvedValue({ data: { id: '1', name: 'Updated', status: 'on_hold' }, error: null });

    await useProjectStore.getState().updateProject('1', { name: 'Updated' });
    expect(useProjectStore.getState().projects[0].name).toBe('Updated');
  });

  it('updateProject rolls back on error', async () => {
    useProjectStore.setState({ projects: [{ id: '1', name: 'Original', status: 'active' }] });
    mockSupabaseQuery.single.mockResolvedValue({ data: null, error: { message: 'Update failed' } });

    await useProjectStore.getState().updateProject('1', { name: 'Should not apply' });
    expect(useProjectStore.getState().projects[0].name).toBe('Original');
    expect(mockToast.error).toHaveBeenCalledWith('Update failed');
  });

  // ─── deleteProject ────────────────────────────────────────────────────────

  it('deleteProject optimistically removes', async () => {
    useProjectStore.setState({ projects: [{ id: '1', name: 'Gone' }] });
    mockSupabaseQuery.eq.mockResolvedValue({ error: null });

    const result = await useProjectStore.getState().deleteProject('1');
    expect(result.success).toBe(true);
    expect(useProjectStore.getState().projects).toHaveLength(0);
  });

  it('deleteProject rolls back on error', async () => {
    useProjectStore.setState({ projects: [{ id: '1', name: 'Stay' }] });
    mockSupabaseQuery.eq.mockResolvedValue({ error: { message: 'Delete failed' } });

    await useProjectStore.getState().deleteProject('1');
    expect(useProjectStore.getState().projects).toHaveLength(1);
    expect(mockToast.error).toHaveBeenCalledWith('Delete failed');
  });

  // ─── getById ──────────────────────────────────────────────────────────────

  it('getById returns matching project or null', () => {
    useProjectStore.setState({ projects: [{ id: '1', name: 'A' }, { id: '2', name: 'B' }] });
    expect(useProjectStore.getState().getById('1')?.name).toBe('A');
    expect(useProjectStore.getState().getById('999')).toBeNull();
  });
});
