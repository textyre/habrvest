import { describe, it, expect } from 'vitest';
import { FileCache } from '../FileCache.js';

describe('FileCache', () => {
  it('returns null for missing key', async () => {
    const cache = new FileCache();
    const result = await cache.get('nonexistent-key-xyz-12345');
    expect(result).toBeNull();
  });

  it('stores and retrieves data', async () => {
    const cache = new FileCache();
    const key = `test-key-${Date.now()}`;
    await cache.set(key, { foo: 'bar' });
    const result = await cache.get<{ foo: string }>(key);
    expect(result).toEqual({ foo: 'bar' });
  });
});
