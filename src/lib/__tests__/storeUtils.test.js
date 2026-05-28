import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  tempId,
  optimisticAdd,
  optimisticUpdate,
  optimisticRemove,
  rollbackAdd,
  rollbackUpdate,
  rollbackRemove,
  safeMutate,
  isConflictError,
} from '../storeUtils';

// Mock syncQueue
vi.mock('../syncQueue', () => ({
  enqueue: vi.fn(),
}));

import { enqueue } from '../syncQueue';

describe('tempId', () => {
  it('generates a temp ID with __temp_ prefix', () => {
    const id = tempId();
    expect(id).toMatch(/^__temp_/);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => tempId()));
    expect(ids.size).toBe(100);
  });
});

describe('optimisticAdd', () => {
  it('appends item with temp ID and created_at', () => {
    const items = [{ id: '1', name: 'existing' }];
    const result = optimisticAdd(items, { name: 'new' }, '__temp_abc');
    expect(result).toHaveLength(2);
    expect(result[1].id).toBe('__temp_abc');
    expect(result[1].name).toBe('new');
    expect(result[1].created_at).toBeDefined();
    expect(result[0].id).toBe('1');
  });
});

describe('optimisticUpdate', () => {
  it('patches item by ID', () => {
    const items = [{ id: '1', name: 'old' }, { id: '2', name: 'other' }];
    const result = optimisticUpdate(items, '1', { name: 'updated' });
    expect(result[0].name).toBe('updated');
    expect(result[1].name).toBe('other');
  });

  it('returns same array if ID not found', () => {
    const items = [{ id: '1', name: 'a' }];
    const result = optimisticUpdate(items, '999', { name: 'b' });
    expect(result[0].name).toBe('a');
  });
});

describe('optimisticRemove', () => {
  it('removes item by ID', () => {
    const items = [{ id: '1' }, { id: '2' }, { id: '3' }];
    const result = optimisticRemove(items, '2');
    expect(result).toHaveLength(2);
    expect(result.map((i) => i.id)).toEqual(['1', '3']);
  });
});

describe('rollbackAdd', () => {
  it('removes the temp item', () => {
    const items = [{ id: '1' }, { id: '__temp_x' }];
    expect(rollbackAdd(items, '__temp_x')).toHaveLength(1);
  });
});

describe('rollbackUpdate', () => {
  it('restores previous version', () => {
    const items = [{ id: '1', name: 'corrupted' }];
    const prev = { id: '1', name: 'original' };
    const result = rollbackUpdate(items, '1', prev);
    expect(result[0].name).toBe('original');
  });
});

describe('rollbackRemove', () => {
  it('restores the full previous array', () => {
    const items = [{ id: '2' }];
    const prev = [{ id: '1' }, { id: '2' }];
    expect(rollbackRemove(items, prev)).toEqual(prev);
  });
});

describe('safeMutate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns ok and data on success', async () => {
    const mutationFn = vi.fn().mockResolvedValue({ data: { id: '1' }, error: null });
    const result = await safeMutate(
      { table: 'issues', op: 'upsert', payload: { title: 'test' } },
      mutationFn
    );
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ id: '1' });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('throws on non-network error', async () => {
    const mutationFn = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Database constraint violation' },
    });
    await expect(
      safeMutate(
        { table: 'issues', op: 'upsert', payload: {} },
        mutationFn
      )
    ).rejects.toThrow('Database constraint violation');
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('enqueues on network error and returns offline', async () => {
    const mutationFn = vi.fn().mockRejectedValue(new Error('Failed to fetch'));
    const result = await safeMutate(
      { table: 'issues', op: 'upsert', payload: { title: 'offline' } },
      mutationFn
    );
    expect(result.ok).toBe(true);
    expect(result.offline).toBe(true);
    expect(enqueue).toHaveBeenCalledWith({
      table: 'issues',
      op: 'upsert',
      payload: { title: 'offline' },
    });
  });

  it('catches failed to fetch variations', async () => {
    const errors = ['Failed to fetch', 'NetworkError', 'Load failed', 'net::ERR_CONNECTION_REFUSED'];
    for (const msg of errors) {
      vi.clearAllMocks();
      const fn = vi.fn().mockRejectedValue(new Error(msg));
      const result = await safeMutate({ table: 't', op: 'upsert', payload: {} }, fn);
      expect(result.offline).toBe(true);
    }
  });
});

describe('isConflictError', () => {
  it('detects 409 status', () => {
    expect(isConflictError({ status: 409 })).toBe(true);
  });

  it('detects P0001 code', () => {
    expect(isConflictError({ code: 'P0001' })).toBe(true);
  });

  it('detects conflict in message', () => {
    expect(isConflictError({ message: 'version conflict detected' })).toBe(true);
  });

  it('returns false for unrelated errors', () => {
    expect(isConflictError({ message: 'not found', code: 'PGRST116' })).toBe(false);
    expect(isConflictError({})).toBe(false);
    expect(isConflictError(null)).toBe(false);
  });
});
