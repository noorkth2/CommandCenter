import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const { mockSupabaseQuery, mockSupabaseClient, mockToast } = vi.hoisted(() => {
  const query = {
    select: vi.fn(() => query),
    insert: vi.fn(() => query),
    update: vi.fn(() => query),
    delete: vi.fn(() => query),
    upsert: vi.fn(() => query),
    order: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    single: vi.fn(),
    maybeSingle: vi.fn(),
  };
  return {
    mockSupabaseQuery: query,
    mockSupabaseClient: {
      from: vi.fn(() => query),
      auth: { getSession: vi.fn(), signOut: vi.fn() },
    },
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

import { useIssueStore, canTransition } from '../useIssueStore';
import { enqueue } from '../../lib/syncQueue';
import { cacheFlush } from '../../lib/cache';

describe('canTransition', () => {
  it('allows valid transitions', () => {
    expect(canTransition('backlog', 'todo')).toBe(true);
    expect(canTransition('in_progress', 'testing')).toBe(true);
    expect(canTransition('testing', 'uat')).toBe(true);
    expect(canTransition('done', 'backlog')).toBe(false);
  });

  it('rejects invalid transitions', () => {
    expect(canTransition('backlog', 'production')).toBe(false);
    expect(canTransition('done', 'todo')).toBe(false);
    expect(canTransition('cancelled', 'backlog')).toBe(true);
    expect(canTransition('cancelled', 'in_progress')).toBe(false);
    expect(canTransition('rolled_back', 'backlog')).toBe(true);
  });
});

// Helper to reset mock chain + terminal values
function resetMocks() {
  vi.clearAllMocks();
  // Chainable methods — re-apply factory so they survive clearAllMocks
  mockSupabaseQuery.select.mockImplementation(() => mockSupabaseQuery);
  mockSupabaseQuery.insert.mockImplementation(() => mockSupabaseQuery);
  mockSupabaseQuery.update.mockImplementation(() => mockSupabaseQuery);
  mockSupabaseQuery.delete.mockImplementation(() => mockSupabaseQuery);
  mockSupabaseQuery.upsert.mockImplementation(() => mockSupabaseQuery);
  mockSupabaseQuery.order.mockImplementation(() => mockSupabaseQuery);
  mockSupabaseQuery.eq.mockImplementation(() => mockSupabaseQuery);
  mockSupabaseQuery.in.mockImplementation(() => mockSupabaseQuery);
  mockSupabaseClient.from.mockImplementation(() => mockSupabaseQuery);
}

describe('useIssueStore', () => {
  beforeEach(() => {
    useIssueStore.setState({ issues: [], loading: false, error: null });
    cacheFlush();
    resetMocks();
  });

  // ─── fetchIssues ──────────────────────────────────────────────────────────

  it('fetchIssues loads data into store', async () => {
    const fakeData = [{ id: '1', title: 'Test issue', status: 'backlog' }];
    mockSupabaseQuery.order.mockReturnValue(Promise.resolve({ data: fakeData, error: null }));

    await useIssueStore.getState().fetchIssues();
    const state = useIssueStore.getState();
    expect(state.issues).toEqual(fakeData);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('fetchIssues handles error', async () => {
    mockSupabaseQuery.order.mockReturnValue(Promise.resolve({ data: null, error: { message: 'DB error' } }));

    await useIssueStore.getState().fetchIssues();
    const state = useIssueStore.getState();
    expect(state.issues).toEqual([]);
    expect(state.error).toBe('DB error');
  });

  // ─── addIssue ─────────────────────────────────────────────────────────────

  it('addIssue optimistically adds and swaps temp ID on success', async () => {
    mockSupabaseQuery.single.mockResolvedValue({ data: { id: 'real-1', title: 'New', status: 'backlog' }, error: null });

    const result = await useIssueStore.getState().addIssue({ title: 'New' });
    expect(result.data.id).toBe('real-1');
    expect(useIssueStore.getState().issues).toHaveLength(1);
    expect(useIssueStore.getState().issues[0].id).toBe('real-1');
  });

  it('addIssue rolls back on error', async () => {
    mockSupabaseQuery.single.mockResolvedValue({ data: null, error: { message: 'Insert failed' } });

    const result = await useIssueStore.getState().addIssue({ title: 'Fail' });
    expect(result.error).toBe('Insert failed');
    expect(useIssueStore.getState().issues).toHaveLength(0);
    expect(mockToast.error).toHaveBeenCalledWith('Insert failed');
  });

  it('addIssue enqueues on network error and keeps optimistic', async () => {
    mockSupabaseQuery.single.mockRejectedValue(new Error('Failed to fetch'));

    const result = await useIssueStore.getState().addIssue({ title: 'Offline' });
    expect(result.data).toBeDefined();
    expect(result.data.id).toMatch(/^__temp_/);
    expect(enqueue).toHaveBeenCalled();
    expect(useIssueStore.getState().issues).toHaveLength(1);
  });

  it('addIssue sanitizes empty string foreign keys to null', async () => {
    mockSupabaseQuery.single.mockResolvedValue({
      data: { id: 'real-2', title: 'Sanitized', project_id: null, sprint_id: null },
      error: null,
    });

    const result = await useIssueStore.getState().addIssue({
      title: 'Sanitized',
      project_id: '',
      sprint_id: '',
      client_id: '',
      product_id: '',
    });

    expect(result.data.project_id).toBeNull();
    expect(result.data.sprint_id).toBeNull();
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('issues');
    expect(mockSupabaseQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
      project_id: null,
      sprint_id: null,
      client_id: null,
      product_id: null,
    }));
  });

  // ─── updateIssue ──────────────────────────────────────────────────────────

  it('updateIssue optimistically patches and replaces on success', async () => {
    useIssueStore.setState({ issues: [{ id: '1', title: 'Old', status: 'backlog' }] });
    mockSupabaseQuery.single.mockResolvedValue({ data: { id: '1', title: 'Updated', status: 'todo' }, error: null });

    await useIssueStore.getState().updateIssue('1', { title: 'Updated' });
    const state = useIssueStore.getState();
    expect(state.issues[0].title).toBe('Updated');
  });

  it('updateIssue rolls back on error', async () => {
    useIssueStore.setState({ issues: [{ id: '1', title: 'Original', status: 'backlog' }] });
    mockSupabaseQuery.single.mockResolvedValue({ data: null, error: { message: 'Update failed' } });

    await useIssueStore.getState().updateIssue('1', { title: 'Should not apply' });
    expect(useIssueStore.getState().issues[0].title).toBe('Original');
    expect(mockToast.error).toHaveBeenCalledWith('Update failed');
  });

  it('updateIssue sanitizes empty string foreign keys to null', async () => {
    useIssueStore.setState({ issues: [{ id: '1', title: 'Issue', project_id: 'p-1', status: 'backlog' }] });
    mockSupabaseQuery.single.mockResolvedValue({
      data: { id: '1', title: 'Issue', project_id: null, sprint_id: null, status: 'backlog' },
      error: null,
    });

    await useIssueStore.getState().updateIssue('1', { project_id: '', sprint_id: '' });
    expect(mockSupabaseQuery.update).toHaveBeenCalledWith(expect.objectContaining({
      project_id: null,
      sprint_id: null,
    }));
  });

  // ─── deleteIssue ──────────────────────────────────────────────────────────

  it('deleteIssue optimistically removes', async () => {
    useIssueStore.setState({ issues: [{ id: '1', title: 'Gone' }] });
    mockSupabaseQuery.eq.mockResolvedValue({ error: null });

    const result = await useIssueStore.getState().deleteIssue('1');
    expect(result.success).toBe(true);
    expect(useIssueStore.getState().issues).toHaveLength(0);
  });

  it('deleteIssue rolls back on error', async () => {
    useIssueStore.setState({ issues: [{ id: '1', title: 'Stay' }] });
    mockSupabaseQuery.eq.mockResolvedValue({ error: { message: 'Delete failed' } });

    await useIssueStore.getState().deleteIssue('1');
    expect(useIssueStore.getState().issues).toHaveLength(1);
    expect(mockToast.error).toHaveBeenCalledWith('Delete failed');
  });

  // ─── transitionStatus ─────────────────────────────────────────────────────

  it('transitionStatus calls updateIssue with valid transition', async () => {
    useIssueStore.setState({ issues: [{ id: '1', title: 'Issue', status: 'backlog' }] });
    mockSupabaseQuery.single.mockResolvedValue({ data: { id: '1', title: 'Issue', status: 'todo' }, error: null });

    const result = await useIssueStore.getState().transitionStatus('1', 'todo');
    expect(result.data.status).toBe('todo');
  });

  it('transitionStatus rejects invalid transition', async () => {
    useIssueStore.setState({ issues: [{ id: '1', title: 'Issue', status: 'done' }] });
    const result = await useIssueStore.getState().transitionStatus('1', 'backlog');
    expect(result.error).toBeDefined();
  });

  // ─── helpers ──────────────────────────────────────────────────────────────

  it('getByProject filters issues by project_id', () => {
    useIssueStore.setState({
      issues: [
        { id: '1', project_id: 'p1', title: 'A' },
        { id: '2', project_id: 'p2', title: 'B' },
      ],
    });
    expect(useIssueStore.getState().getByProject('p1')).toHaveLength(1);
    expect(useIssueStore.getState().getByProject('p1')[0].id).toBe('1');
  });

  it('getByStatus filters by status', () => {
    useIssueStore.setState({
      issues: [
        { id: '1', status: 'backlog' },
        { id: '2', status: 'todo' },
      ],
    });
    expect(useIssueStore.getState().getByStatus('backlog')).toHaveLength(1);
  });
});
