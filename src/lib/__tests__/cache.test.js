import { describe, it, expect, beforeEach } from 'vitest';
import { cacheGet, cacheSet, cacheInvalidate, cacheFlush, cacheSize } from '../cache';

describe('cache', () => {
  beforeEach(() => {
    cacheFlush();
  });

  it('returns undefined for missing key', () => {
    expect(cacheGet('nonexistent')).toBeUndefined();
  });

  it('stores and retrieves a value', () => {
    cacheSet('key1', { hello: 'world' });
    expect(cacheGet('key1')).toEqual({ hello: 'world' });
  });

  it('returns undefined after TTL expires', async () => {
    cacheSet('expires', 'data', 10); // 10ms TTL
    expect(cacheGet('expires')).toBe('data');
    await new Promise((r) => setTimeout(r, 20));
    expect(cacheGet('expires')).toBeUndefined();
  });

  it('invalidates a single key', () => {
    cacheSet('a', 1);
    cacheSet('b', 2);
    cacheInvalidate('a');
    expect(cacheGet('a')).toBeUndefined();
    expect(cacheGet('b')).toBe(2);
  });

  it('invalidates keys by prefix', () => {
    cacheSet('issues:all', 1);
    cacheSet('issues:open', 2);
    cacheSet('projects:all', 3);
    cacheInvalidate('issues:*');
    expect(cacheGet('issues:all')).toBeUndefined();
    expect(cacheGet('issues:open')).toBeUndefined();
    expect(cacheGet('projects:all')).toBe(3);
  });

  it('flushes all keys', () => {
    cacheSet('x', 1);
    cacheSet('y', 2);
    cacheFlush();
    expect(cacheSize()).toBe(0);
    expect(cacheGet('x')).toBeUndefined();
    expect(cacheGet('y')).toBeUndefined();
  });

  it('reports correct live count', () => {
    cacheSet('a', 1);
    cacheSet('b', 2);
    expect(cacheSize()).toBe(2);
    cacheFlush();
    expect(cacheSize()).toBe(0);
  });

  it('overwrites existing key', () => {
    cacheSet('k', 'old');
    cacheSet('k', 'new');
    expect(cacheGet('k')).toBe('new');
  });
});
