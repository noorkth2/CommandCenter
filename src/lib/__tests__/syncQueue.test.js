import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  enqueue,
  drainQueue,
  queueDepth,
  clearQueue,
  getPendingEntries,
  removeEntry,
  updateEntry,
  onSyncEvent,
} from '../syncQueue';

describe('syncQueue', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('enqueue / queueDepth / clearQueue', () => {
    it('starts empty', () => {
      expect(queueDepth()).toBe(0);
    });

    it('enqueues an entry', () => {
      enqueue({ table: 'issues', op: 'upsert', payload: { id: '1' } });
      expect(queueDepth()).toBe(1);
    });

    it('clearQueue empties the queue', () => {
      enqueue({ table: 'issues', op: 'upsert', payload: { id: '1' } });
      enqueue({ table: 'projects', op: 'delete', payload: { id: '2' } });
      expect(queueDepth()).toBe(2);
      clearQueue();
      expect(queueDepth()).toBe(0);
    });
  });

  describe('getPendingEntries', () => {
    it('returns queued entries with metadata', () => {
      enqueue({ table: 't', op: 'upsert', payload: { x: 1 } });
      const entries = getPendingEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].table).toBe('t');
      expect(entries[0].op).toBe('upsert');
      expect(entries[0].id).toBeDefined();
      expect(entries[0].retries).toBe(0);
    });
  });

  describe('removeEntry', () => {
    it('removes a specific entry by ID', () => {
      enqueue({ table: 't', op: 'upsert', payload: { id: 'a' } });
      const entries = getPendingEntries();
      const eid = entries[0].id;
      removeEntry(eid);
      expect(queueDepth()).toBe(0);
    });
  });

  describe('updateEntry', () => {
    it('updates a specific entry payload', () => {
      enqueue({ table: 't', op: 'upsert', payload: { id: '1', name: 'old' } });
      const entries = getPendingEntries();
      const eid = entries[0].id;
      updateEntry(eid, { name: 'new' });
      const updated = getPendingEntries();
      expect(updated[0].payload.name).toBe('new');
      expect(updated[0].retries).toBe(0);
    });
  });

  describe('onSyncEvent', () => {
    it('emits enqueued event', () => {
      const listener = vi.fn();
      const unsub = onSyncEvent(listener);
      enqueue({ table: 't', op: 'upsert', payload: {} });
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].type).toBe('enqueued');
      unsub();
    });

    it('emits cleared event', () => {
      const listener = vi.fn();
      onSyncEvent(listener);
      clearQueue();
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'cleared' })
      );
    });
  });

  describe('drainQueue', () => {
    it('does nothing for empty queue', async () => {
      const client = { from: vi.fn() };
      const result = await drainQueue(client);
      expect(result.conflicts).toEqual([]);
      expect(client.from).not.toHaveBeenCalled();
    });

    it('replays upsert entries', async () => {
      enqueue({ table: 'issues', op: 'upsert', payload: { id: '1', title: 'test' } });

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        upsert: vi.fn().mockResolvedValue({ error: null }),
      };
      const client = { from: vi.fn().mockReturnValue(mockQuery) };

      await drainQueue(client);
      expect(client.from).toHaveBeenCalledWith('issues');
      expect(mockQuery.upsert).toHaveBeenCalledWith({ id: '1', title: 'test' });
      expect(queueDepth()).toBe(0);
    });

    it('replays delete entries', async () => {
      enqueue({ table: 'issues', op: 'delete', payload: { id: '1' } });

      const mockQuery = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      const client = { from: vi.fn().mockReturnValue(mockQuery) };

      await drainQueue(client);
      expect(client.from).toHaveBeenCalledWith('issues');
      expect(mockQuery.eq).toHaveBeenCalledWith('id', '1');
      expect(queueDepth()).toBe(0);
    });

    it('skips entries not yet due for retry', async () => {
      localStorage.setItem('cc_sync_queue', JSON.stringify([{
        id: 'future',
        table: 'issues',
        op: 'upsert',
        payload: { id: '1' },
        retries: 0,
        nextAttempt: Date.now() + 100_000,
      }]));

      const client = { from: vi.fn() };
      await drainQueue(client);
      expect(client.from).not.toHaveBeenCalled();
    });

    it('increments retries on failure', async () => {
      enqueue({ table: 'issues', op: 'upsert', payload: { id: '1' } });

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        upsert: vi.fn().mockResolvedValue({ error: new Error('DB timeout') }),
      };
      const client = { from: vi.fn().mockReturnValue(mockQuery) };

      await drainQueue(client);

      const entries = getPendingEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].retries).toBe(1);
    });

    it('drops entry after max retries', async () => {
      localStorage.setItem('cc_sync_queue', JSON.stringify([{
        id: 'doomed',
        table: 'issues',
        op: 'upsert',
        payload: { id: '1' },
        retries: 4,
        nextAttempt: 0,
      }]));

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        upsert: vi.fn().mockResolvedValue({ error: new Error('fails again') }),
      };
      const client = { from: vi.fn().mockReturnValue(mockQuery) };

      await drainQueue(client);
      expect(queueDepth()).toBe(0);
    });
  });
});
