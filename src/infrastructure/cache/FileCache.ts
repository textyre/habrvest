import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CACHE_DIR, CACHE_TTL_MS } from '../config.js';
import { ICache } from './ICache.js';

interface CacheEntry<T> {
  ts: number;
  data: T;
}

export class FileCache implements ICache {
  async get<T>(key: string): Promise<T | null> {
    const file = this.path(key);
    try {
      const raw = await readFile(file, 'utf-8');
      const entry = JSON.parse(raw) as CacheEntry<T>;
      if (Date.now() - entry.ts > CACHE_TTL_MS) return null;
      return entry.data;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, data: T): Promise<void> {
    await mkdir(CACHE_DIR, { recursive: true });
    const entry: CacheEntry<T> = { ts: Date.now(), data };
    await writeFile(this.path(key), JSON.stringify(entry));
  }

  private path(key: string): string {
    const hash = createHash('md5').update(key).digest('hex');
    return join(CACHE_DIR, `${hash}.json`);
  }
}
