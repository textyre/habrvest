import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CACHE_DIR, CACHE_TTL_MS } from './config.js';

interface CacheEntry<T> {
  ts: number;
  data: T;
}

export class FileCache {
  async get<T>(url: string): Promise<T | null> {
    const file = this.path(url);
    try {
      const raw = await readFile(file, 'utf-8');
      const entry = JSON.parse(raw) as CacheEntry<T>;
      if (Date.now() - entry.ts > CACHE_TTL_MS) return null;
      return entry.data;
    } catch {
      return null;
    }
  }

  async set<T>(url: string, data: T): Promise<void> {
    await mkdir(CACHE_DIR, { recursive: true });
    const entry: CacheEntry<T> = { ts: Date.now(), data };
    await writeFile(this.path(url), JSON.stringify(entry));
  }

  private path(url: string): string {
    const key = createHash('md5').update(url).digest('hex');
    return join(CACHE_DIR, `${key}.json`);
  }
}
