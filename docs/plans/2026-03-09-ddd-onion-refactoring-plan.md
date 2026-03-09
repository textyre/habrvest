# DDD + Onion Architecture Refactoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure habrvest from a flat `src/` layout into a full DDD + Onion Architecture with a 3-level OOP hierarchy (Interface → Abstract Base → Concrete) for sources, formatters, and sorter.

**Architecture:** Domain layer holds pure contracts and value objects. Shared layer holds abstract base classes with common logic. Sources and Formatters are concrete implementations extending those bases. Infrastructure holds only HTTP/cache/file I/O. Presentation holds the CLI composition root.

**Tech Stack:** TypeScript, Node.js ESM, Commander, tsx, Vitest (added for tests)

**Design doc:** `docs/plans/2026-03-09-ddd-onion-refactoring-design.md`

---

## Setup: Add Vitest

**Files:**
- Modify: `package.json`

**Step 1: Install vitest**

```bash
npm install --save-dev vitest @vitest/coverage-v8
```

**Step 2: Add test script to package.json**

In `package.json`, add to `scripts`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 3: Verify vitest works**

```bash
npx vitest run
```
Expected: "No test files found" (not an error, just empty)

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add vitest for testing"
```

---

## Task 1: Domain — Enums

**Files:**
- Create: `src/domain/shared/Order.ts`
- Create: `src/domain/shared/SortField.ts`
- Create: `src/domain/shared/OutputFormat.ts`
- Create: `src/domain/shared/TopPeriod.ts`

**Step 1: Create enums (move from types.ts)**

`src/domain/shared/Order.ts`:
```typescript
export type Order = 'date' | 'relevance' | 'rating';
```

`src/domain/shared/SortField.ts`:
```typescript
export type SortField = 'votes' | 'bookmarks' | 'comments' | 'date' | 'views';
```

`src/domain/shared/OutputFormat.ts`:
```typescript
export type OutputFormat = 'md' | 'json' | 'csv';
```

`src/domain/shared/TopPeriod.ts`:
```typescript
export type TopPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'alltime';
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors (old types.ts still exists, no conflicts yet)

**Step 3: Commit**

```bash
git add src/domain/
git commit -m "feat: add domain shared enums"
```

---

## Task 2: Domain — Article value object and ports

**Files:**
- Create: `src/domain/article/Article.ts`
- Create: `src/domain/article/IFormatter.ts`
- Create: `src/domain/article/ISorter.ts`
- Create: `src/domain/article/ITransformer.ts`

**Step 1: Create Article value object**

`src/domain/article/Article.ts`:
```typescript
export interface Article {
  date: string;
  title: string;
  url: string;
  readingTime: number;
  hubs: string[];
  tags: string[];
  votes: number;
  votesPlus: number;
  votesMinus: number;
  bookmarks: number;
  comments: number;
  views: number;
}
```

**Step 2: Create formatter port**

`src/domain/article/IFormatter.ts`:
```typescript
import { Article } from './Article.js';

export interface IFormatter {
  format(articles: Article[]): string;
}
```

**Step 3: Create sorter port**

`src/domain/article/ISorter.ts`:
```typescript
import { Article } from './Article.js';
import { SortField } from '../shared/SortField.js';

export interface ISorter {
  sort(articles: Article[], field: SortField, ascending: boolean): Article[];
}
```

**Step 4: Create transformer port**

`src/domain/article/ITransformer.ts`:
```typescript
import { Article } from './Article.js';
import { Publication } from '../source/Publication.js';

export interface ITransformer {
  transform(publications: Record<string, Publication>, ids: string[]): Article[];
}
```

**Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: error about missing `src/domain/source/Publication.ts` — that's OK, we create it next.

**Step 6: Commit (after Task 3 makes it compile)**

Wait until Task 3 is done, then commit together.

---

## Task 3: Domain — Source contracts

**Files:**
- Create: `src/domain/source/Publication.ts`
- Create: `src/domain/source/FetchResult.ts`
- Create: `src/domain/source/ISourceClient.ts`

**Step 1: Create Publication (raw API type)**

`src/domain/source/Publication.ts`:
```typescript
export interface Publication {
  id: string;
  timePublished: string;
  titleHtml: string;
  readingTime: number;
  complexity: string | null;
  author: {
    alias: string;
    fullname: string | null;
  };
  statistics: {
    commentsCount: number;
    favoritesCount: number;
    score: number;
    votesCount: number;
    votesCountPlus: number;
    votesCountMinus: number;
    readingCount: number;
  };
  hubs: Array<{ alias: string; title: string; type: string }>;
  tags: Array<{ titleHtml: string }>;
}
```

**Step 2: Create FetchResult**

`src/domain/source/FetchResult.ts`:
```typescript
import { Publication } from './Publication.js';

export interface FetchResult {
  publications: Record<string, Publication>;
  ids: string[];
  totalPages: number;
  errors: number;
}
```

**Step 3: Create ISourceClient — pure contract**

`src/domain/source/ISourceClient.ts`:
```typescript
import { FetchResult } from './FetchResult.js';

export interface ISourceClient {
  fetch(...args: unknown[]): Promise<FetchResult>;
}
```

**Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no new errors from domain/ files

**Step 5: Commit domain layer**

```bash
git add src/domain/
git commit -m "feat: add domain layer — Article, enums, source contracts"
```

---

## Task 4: Infrastructure — ILogger and Logger

**Files:**
- Create: `src/infrastructure/logger/ILogger.ts`
- Create: `src/infrastructure/logger/Logger.ts`

**Step 1: Create ILogger interface**

`src/infrastructure/logger/ILogger.ts`:
```typescript
export interface ILogger {
  info(msg: string): void;
  error(msg: string): void;
  progress(current: number, total: number): void;
}
```

**Step 2: Create Logger implementation**

`src/infrastructure/logger/Logger.ts`:
```typescript
import { ILogger } from './ILogger.js';

export class Logger implements ILogger {
  info(msg: string): void {
    process.stderr.write(msg + '\n');
  }

  error(msg: string): void {
    process.stderr.write(`Error: ${msg}\n`);
  }

  progress(current: number, total: number): void {
    process.stderr.write(`  ${current}/${total}\n`);
  }
}
```

**Step 3: Write test**

`src/infrastructure/logger/__tests__/Logger.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { Logger } from '../Logger.js';

describe('Logger', () => {
  it('writes info to stderr', () => {
    const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const logger = new Logger();
    logger.info('hello');
    expect(write).toHaveBeenCalledWith('hello\n');
    write.mockRestore();
  });

  it('writes error with prefix', () => {
    const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const logger = new Logger();
    logger.error('oops');
    expect(write).toHaveBeenCalledWith('Error: oops\n');
    write.mockRestore();
  });
});
```

**Step 4: Run test**

```bash
npx vitest run src/infrastructure/logger/__tests__/Logger.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/infrastructure/logger/
git commit -m "feat: add infrastructure Logger with ILogger interface"
```

---

## Task 5: Infrastructure — ICache and FileCache

**Files:**
- Create: `src/infrastructure/cache/ICache.ts`
- Create: `src/infrastructure/cache/FileCache.ts`

**Step 1: Create ICache interface**

`src/infrastructure/cache/ICache.ts`:
```typescript
export interface ICache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, data: T): Promise<void>;
}
```

**Step 2: Create FileCache**

`src/infrastructure/cache/FileCache.ts`:
```typescript
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
```

**Step 3: Move config.ts to infrastructure**

`src/infrastructure/config.ts` — copy content from `src/config.ts`:
```typescript
export const HABR_API_URL = 'https://habr.com/kek/v2/articles/';
export const HABR_BASE_URL = 'https://habr.com';
export const THROTTLE_MS = 500;
export const MAX_RETRIES = 2;
export const REQUEST_TIMEOUT_MS = 15_000;
export const MAX_PAGE = 50;
export const CACHE_TTL_MS = 30 * 60 * 1000;
export const CACHE_DIR = `${process.env.HOME}/.cache/habrvest`;
```

**Step 4: Write test for FileCache**

`src/infrastructure/cache/__tests__/FileCache.test.ts`:
```typescript
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
```

**Step 5: Run tests**

```bash
npx vitest run src/infrastructure/cache/__tests__/FileCache.test.ts
```
Expected: PASS

**Step 6: Commit**

```bash
git add src/infrastructure/
git commit -m "feat: add infrastructure ICache, FileCache, config"
```

---

## Task 6: Infrastructure — Throttler and HttpClient

**Files:**
- Create: `src/infrastructure/http/IThrottler.ts`
- Create: `src/infrastructure/http/Throttler.ts`
- Create: `src/infrastructure/http/HttpClient.ts`
- Create: `src/infrastructure/http/IHttpClient.ts`

**Step 1: Create IThrottler**

`src/infrastructure/http/IThrottler.ts`:
```typescript
export interface IThrottler {
  acquire(): Promise<void>;
}
```

**Step 2: Create Throttler**

`src/infrastructure/http/Throttler.ts`:
```typescript
import { IThrottler } from './IThrottler.js';

export class Throttler implements IThrottler {
  private lastRequestTime = 0;

  constructor(private readonly minIntervalMs: number) {}

  async acquire(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minIntervalMs) {
      await new Promise<void>((r) => setTimeout(r, this.minIntervalMs - elapsed));
    }
    this.lastRequestTime = Date.now();
  }
}
```

**Step 3: Create IHttpClient**

`src/infrastructure/http/IHttpClient.ts`:
```typescript
export interface IHttpClient {
  fetchJson<T>(url: string): Promise<T>;
}
```

**Step 4: Create HttpClient**

`src/infrastructure/http/HttpClient.ts` — copy from `src/http-client.ts`, update imports:
```typescript
import { MAX_RETRIES, REQUEST_TIMEOUT_MS } from '../config.js';
import { FileCache } from '../cache/FileCache.js';
import { ICache } from '../cache/ICache.js';
import { IHttpClient } from './IHttpClient.js';
import { IThrottler } from './IThrottler.js';
import { ILogger } from '../logger/ILogger.js';

export class HttpClient implements IHttpClient {
  private readonly cache: ICache;

  constructor(
    private readonly throttler: IThrottler,
    private readonly logger: ILogger,
    cache?: ICache,
  ) {
    this.cache = cache ?? new FileCache();
  }

  // ... rest of implementation identical to src/http-client.ts
  // (copy all private methods: tryFetch, handleNetworkError, handleRateLimit,
  //  handleAntiDdos, handleHttpError, validateContentType, parseJson, sleep)
}
```

Note: Copy all method bodies verbatim from `src/http-client.ts`. Only change the imports at the top.

**Step 5: Write Throttler test**

`src/infrastructure/http/__tests__/Throttler.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { Throttler } from '../Throttler.js';

describe('Throttler', () => {
  it('allows immediate first request', async () => {
    const throttler = new Throttler(100);
    const start = Date.now();
    await throttler.acquire();
    expect(Date.now() - start).toBeLessThan(50);
  });

  it('delays second request within interval', async () => {
    const throttler = new Throttler(200);
    await throttler.acquire();
    const start = Date.now();
    await throttler.acquire();
    expect(Date.now() - start).toBeGreaterThanOrEqual(150);
  });
});
```

**Step 6: Run tests**

```bash
npx vitest run src/infrastructure/http/__tests__/Throttler.test.ts
```
Expected: PASS

**Step 7: Compile check**

```bash
npx tsc --noEmit
```
Expected: no errors from infrastructure/

**Step 8: Commit**

```bash
git add src/infrastructure/http/
git commit -m "feat: add infrastructure HttpClient, Throttler with interfaces"
```

---

## Task 7: Shared — BaseSorter

**Files:**
- Create: `src/shared/sorter/BaseSorter.ts`
- Create: `src/shared/sorter/__tests__/BaseSorter.test.ts`

**Step 1: Write failing test**

`src/shared/sorter/__tests__/BaseSorter.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { BaseSorter } from '../BaseSorter.js';
import { Article } from '../../../domain/article/Article.js';

const makeArticle = (overrides: Partial<Article>): Article => ({
  date: '2024-01-01T00:00:00Z',
  title: 'Test',
  url: 'https://example.com',
  readingTime: 5,
  hubs: [],
  tags: [],
  votes: 0,
  votesPlus: 0,
  votesMinus: 0,
  bookmarks: 0,
  comments: 0,
  views: 0,
  ...overrides,
});

describe('BaseSorter', () => {
  let sorter: BaseSorter;
  beforeEach(() => { sorter = new BaseSorter(); });

  it('sorts by votes descending by default', () => {
    const articles = [makeArticle({ votes: 1 }), makeArticle({ votes: 10 }), makeArticle({ votes: 5 })];
    const result = sorter.sort(articles, 'votes', false);
    expect(result.map(a => a.votes)).toEqual([10, 5, 1]);
  });

  it('sorts by votes ascending', () => {
    const articles = [makeArticle({ votes: 10 }), makeArticle({ votes: 1 })];
    const result = sorter.sort(articles, 'votes', true);
    expect(result.map(a => a.votes)).toEqual([1, 10]);
  });

  it('sorts by bookmarks', () => {
    const articles = [makeArticle({ bookmarks: 3 }), makeArticle({ bookmarks: 10 })];
    const result = sorter.sort(articles, 'bookmarks', false);
    expect(result.map(a => a.bookmarks)).toEqual([10, 3]);
  });

  it('sorts by date', () => {
    const articles = [
      makeArticle({ date: '2024-01-01T00:00:00Z' }),
      makeArticle({ date: '2024-06-01T00:00:00Z' }),
    ];
    const result = sorter.sort(articles, 'date', false);
    expect(result[0].date).toBe('2024-06-01T00:00:00Z');
  });

  it('does not mutate original array', () => {
    const articles = [makeArticle({ votes: 5 }), makeArticle({ votes: 1 })];
    const original = [...articles];
    sorter.sort(articles, 'votes', false);
    expect(articles).toEqual(original);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/shared/sorter/__tests__/BaseSorter.test.ts
```
Expected: FAIL — "Cannot find module"

**Step 3: Create BaseSorter**

`src/shared/sorter/BaseSorter.ts`:
```typescript
import { Article } from '../../domain/article/Article.js';
import { ISorter } from '../../domain/article/ISorter.js';
import { SortField } from '../../domain/shared/SortField.js';

export class BaseSorter implements ISorter {
  sort(articles: Article[], field: SortField, ascending: boolean): Article[] {
    const sorted = [...articles].sort(this.comparatorFor(field));
    return ascending ? sorted : sorted.reverse();
  }

  protected byVotes(a: Article, b: Article): number {
    return a.votes - b.votes;
  }

  protected byBookmarks(a: Article, b: Article): number {
    return a.bookmarks - b.bookmarks;
  }

  protected byComments(a: Article, b: Article): number {
    return a.comments - b.comments;
  }

  protected byViews(a: Article, b: Article): number {
    return a.views - b.views;
  }

  protected byDate(a: Article, b: Article): number {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  }

  private comparatorFor(field: SortField): (a: Article, b: Article) => number {
    const map: Record<SortField, (a: Article, b: Article) => number> = {
      votes: this.byVotes.bind(this),
      bookmarks: this.byBookmarks.bind(this),
      comments: this.byComments.bind(this),
      views: this.byViews.bind(this),
      date: this.byDate.bind(this),
    };
    return map[field];
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/shared/sorter/__tests__/BaseSorter.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/sorter/
git commit -m "feat: add shared BaseSorter with protected sort methods"
```

---

## Task 8: Shared — BaseFormatter and ArticleTransformer

**Files:**
- Create: `src/shared/formatter/BaseFormatter.ts`
- Create: `src/shared/transformer/ArticleTransformer.ts`

**Step 1: Create BaseFormatter**

`src/shared/formatter/BaseFormatter.ts`:
```typescript
import { Article } from '../../domain/article/Article.js';
import { IFormatter } from '../../domain/article/IFormatter.js';

export abstract class BaseFormatter implements IFormatter {
  abstract format(articles: Article[]): string;

  protected escapeCell(str: string): string {
    return str.replace(/\|/g, '\\|').replace(/\n/g, ' ');
  }

  protected escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  protected truncate(str: string, max: number): string {
    return str.length > max ? str.slice(0, max - 1) + '…' : str;
  }

  protected formatDate(iso: string): string {
    return iso.slice(0, 10);
  }
}
```

**Step 2: Create ArticleTransformer**

`src/shared/transformer/ArticleTransformer.ts`:
```typescript
import he from 'he';
import { HABR_BASE_URL } from '../../infrastructure/config.js';
import { Article } from '../../domain/article/Article.js';
import { Publication } from '../../domain/source/Publication.js';
import { ITransformer } from '../../domain/article/ITransformer.js';

export class ArticleTransformer implements ITransformer {
  transform(publications: Record<string, Publication>, ids: string[]): Article[] {
    return ids
      .map((id) => publications[id])
      .filter(Boolean)
      .map((pub) => this.transformOne(pub));
  }

  private transformOne(pub: Publication): Article {
    return {
      date: pub.timePublished,
      title: this.stripHtml(pub.titleHtml),
      url: `${HABR_BASE_URL}/ru/articles/${pub.id}/`,
      readingTime: pub.readingTime,
      hubs: pub.hubs.map((h) => h.title),
      tags: pub.tags.map((t) => this.stripHtml(t.titleHtml)),
      votes: pub.statistics.score,
      votesPlus: pub.statistics.votesCountPlus,
      votesMinus: pub.statistics.votesCountMinus,
      bookmarks: pub.statistics.favoritesCount,
      comments: pub.statistics.commentsCount,
      views: pub.statistics.readingCount,
    };
  }

  private stripHtml(html: string): string {
    return he.decode(html.replace(/<[^>]*>/g, ''));
  }
}
```

**Step 3: Write transformer test**

`src/shared/transformer/__tests__/ArticleTransformer.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { ArticleTransformer } from '../ArticleTransformer.js';
import { Publication } from '../../../domain/source/Publication.js';

const makePublication = (overrides: Partial<Publication> = {}): Publication => ({
  id: '123',
  timePublished: '2024-01-15T10:00:00Z',
  titleHtml: '<b>Hello &amp; World</b>',
  readingTime: 5,
  complexity: null,
  author: { alias: 'user', fullname: null },
  statistics: {
    commentsCount: 3,
    favoritesCount: 10,
    score: 42,
    votesCount: 50,
    votesCountPlus: 46,
    votesCountMinus: 4,
    readingCount: 1000,
  },
  hubs: [{ alias: 'web', title: 'Web', type: 'hub' }],
  tags: [{ titleHtml: '<i>tag1</i>' }],
  ...overrides,
});

describe('ArticleTransformer', () => {
  const transformer = new ArticleTransformer();

  it('strips HTML from title', () => {
    const [article] = transformer.transform({ '123': makePublication() }, ['123']);
    expect(article.title).toBe('Hello & World');
  });

  it('maps statistics correctly', () => {
    const [article] = transformer.transform({ '123': makePublication() }, ['123']);
    expect(article.votes).toBe(42);
    expect(article.bookmarks).toBe(10);
    expect(article.comments).toBe(3);
    expect(article.views).toBe(1000);
  });

  it('builds correct URL', () => {
    const [article] = transformer.transform({ '123': makePublication() }, ['123']);
    expect(article.url).toContain('/ru/articles/123/');
  });

  it('skips missing ids', () => {
    const result = transformer.transform({}, ['999']);
    expect(result).toHaveLength(0);
  });
});
```

**Step 4: Run tests**

```bash
npx vitest run src/shared/
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/
git commit -m "feat: add shared BaseFormatter and ArticleTransformer"
```

---

## Task 9: Formatters — concrete implementations

**Files:**
- Create: `src/formatters/MarkdownFormatter.ts`
- Create: `src/formatters/JsonFormatter.ts`
- Create: `src/formatters/CsvFormatter.ts`
- Create: `src/formatters/FormatterRegistry.ts`

**Step 1: Create MarkdownFormatter**

`src/formatters/MarkdownFormatter.ts`:
```typescript
import { Article } from '../domain/article/Article.js';
import { BaseFormatter } from '../shared/formatter/BaseFormatter.js';

export class MarkdownFormatter extends BaseFormatter {
  format(articles: Article[]): string {
    if (articles.length === 0) return 'No articles found.';

    const header = '| # | Date | Title | Votes | Bookmarks | Comments | Time | Hubs | Tags |';
    const sep = '|---|------|-------|------:|----------:|---------:|-----:|------|------|';

    const rows = articles.map((a, i) => {
      const title = this.escapeCell(this.truncate(a.title, 60));
      const hubs = this.escapeCell(a.hubs.slice(0, 3).join(', '));
      const tags = this.escapeCell(a.tags.join(', '));
      const sign = a.votes > 0 ? '+' : '';
      return `| ${i + 1} | ${this.formatDate(a.date)} | [${title}](${a.url}) | ${sign}${a.votes} | ${a.bookmarks} | ${a.comments} | ${a.readingTime}m | ${hubs} | ${tags} |`;
    });

    return [header, sep, ...rows].join('\n');
  }
}
```

**Step 2: Create JsonFormatter**

`src/formatters/JsonFormatter.ts`:
```typescript
import { Article } from '../domain/article/Article.js';
import { BaseFormatter } from '../shared/formatter/BaseFormatter.js';

export class JsonFormatter extends BaseFormatter {
  format(articles: Article[]): string {
    return JSON.stringify(articles, null, 2);
  }
}
```

**Step 3: Create CsvFormatter**

`src/formatters/CsvFormatter.ts`:
```typescript
import { Article } from '../domain/article/Article.js';
import { BaseFormatter } from '../shared/formatter/BaseFormatter.js';

const HEADERS = ['date', 'title', 'url', 'votes', 'votesPlus', 'votesMinus', 'bookmarks', 'comments', 'views', 'readingTime', 'hubs', 'tags'];

export class CsvFormatter extends BaseFormatter {
  format(articles: Article[]): string {
    const header = HEADERS.join(',');
    const rows = articles.map((a) =>
      [
        a.date.slice(0, 10),
        this.escapeCsv(a.title),
        a.url,
        a.votes,
        a.votesPlus,
        a.votesMinus,
        a.bookmarks,
        a.comments,
        a.views,
        a.readingTime,
        this.escapeCsv(a.hubs.join('; ')),
        this.escapeCsv(a.tags.join('; ')),
      ].join(','),
    );
    return [header, ...rows].join('\n');
  }
}
```

**Step 4: Create FormatterRegistry**

`src/formatters/FormatterRegistry.ts`:
```typescript
import { IFormatter } from '../domain/article/IFormatter.js';
import { OutputFormat } from '../domain/shared/OutputFormat.js';

export class FormatterRegistry {
  constructor(private readonly formatters: Record<OutputFormat, IFormatter>) {}

  get(format: OutputFormat): IFormatter {
    return this.formatters[format];
  }
}
```

**Step 5: Write formatter test**

`src/formatters/__tests__/MarkdownFormatter.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { MarkdownFormatter } from '../MarkdownFormatter.js';
import { Article } from '../../domain/article/Article.js';

const makeArticle = (): Article => ({
  date: '2024-01-15T10:00:00Z',
  title: 'My Article',
  url: 'https://habr.com/ru/articles/123/',
  readingTime: 5,
  hubs: ['Web'],
  tags: ['js'],
  votes: 42,
  votesPlus: 45,
  votesMinus: 3,
  bookmarks: 10,
  comments: 3,
  views: 1000,
});

describe('MarkdownFormatter', () => {
  const formatter = new MarkdownFormatter();

  it('returns "No articles found." for empty array', () => {
    expect(formatter.format([])).toBe('No articles found.');
  });

  it('includes header row', () => {
    const result = formatter.format([makeArticle()]);
    expect(result).toContain('| # | Date |');
  });

  it('formats article as table row', () => {
    const result = formatter.format([makeArticle()]);
    expect(result).toContain('My Article');
    expect(result).toContain('+42');
  });

  it('escapes pipe characters in title', () => {
    const article = makeArticle();
    article.title = 'A | B';
    const result = formatter.format([article]);
    expect(result).toContain('A \\| B');
  });
});
```

**Step 6: Run tests**

```bash
npx vitest run src/formatters/
```
Expected: PASS

**Step 7: Commit**

```bash
git add src/formatters/
git commit -m "feat: add concrete formatters extending BaseFormatter"
```

---

## Task 10: Sources — BaseSourceClient

**Files:**
- Create: `src/sources/BaseSourceClient.ts`

**Step 1: Write failing test**

`src/sources/__tests__/BaseSourceClient.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { BaseSourceClient } from '../BaseSourceClient.js';
import { FetchResult } from '../../domain/source/FetchResult.js';
import { Publication } from '../../domain/source/Publication.js';

// Minimal concrete subclass for testing
class TestClient extends BaseSourceClient {
  public calls: number[] = [];
  public failPages: Set<number> = new Set();

  protected async fetchPage(page: number): Promise<{ pagesCount: number; publicationIds: string[]; publicationRefs: Record<string, Publication> }> {
    this.calls.push(page);
    if (this.failPages.has(page)) throw new Error(`Page ${page} failed`);
    return {
      pagesCount: 3,
      publicationIds: [`id-${page}`],
      publicationRefs: { [`id-${page}`]: { id: `id-${page}` } as Publication },
    };
  }
}

describe('BaseSourceClient', () => {
  it('fetches first page and returns early if maxPages=1', async () => {
    const client = new TestClient(console as any);
    const result = await client.fetchPages(1);
    expect(result.ids).toEqual(['id-1']);
    expect(client.calls).toEqual([1]);
  });

  it('fetches multiple pages sequentially', async () => {
    const client = new TestClient(console as any);
    const result = await client.fetchPages(3);
    expect(client.calls).toEqual([1, 2, 3]);
    expect(result.ids).toHaveLength(3);
  });

  it('deduplicates ids across pages', async () => {
    class DupClient extends BaseSourceClient {
      protected async fetchPage(page: number) {
        return { pagesCount: 2, publicationIds: ['same-id'], publicationRefs: { 'same-id': { id: 'same-id' } as Publication } };
      }
    }
    const client = new DupClient(console as any);
    const result = await client.fetchPages(2);
    expect(result.ids).toHaveLength(1);
  });

  it('counts errors for failed pages', async () => {
    const client = new TestClient(console as any);
    client.failPages.add(2);
    const result = await client.fetchPages(3);
    expect(result.errors).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/sources/__tests__/BaseSourceClient.test.ts
```
Expected: FAIL

**Step 3: Create BaseSourceClient**

`src/sources/BaseSourceClient.ts`:
```typescript
import { FetchResult } from '../domain/source/FetchResult.js';
import { Publication } from '../domain/source/Publication.js';
import { ISourceClient } from '../domain/source/ISourceClient.js';
import { ILogger } from '../infrastructure/logger/ILogger.js';
import { MAX_PAGE } from '../infrastructure/config.js';

interface PageResponse {
  pagesCount: number;
  publicationIds: string[];
  publicationRefs: Record<string, Publication>;
}

export abstract class BaseSourceClient {
  constructor(protected readonly logger: ILogger) {}

  /**
   * Subclasses implement this to build the URL and fetch one page.
   */
  protected abstract fetchPage(page: number): Promise<PageResponse>;

  /**
   * Common pagination loop: sequential fetching, deduplication, error counting.
   */
  async fetchPages(maxPages: number): Promise<FetchResult> {
    const first = await this.fetchPage(1);
    const totalPages = first.pagesCount;

    if (totalPages === 0) {
      return { publications: {}, ids: [], totalPages: 0, errors: 0 };
    }

    const seen = new Set<string>(first.publicationIds);
    const allIds = [...first.publicationIds];
    const allPubs = { ...first.publicationRefs };

    let pagesToFetch = maxPages === 0 ? totalPages : Math.min(maxPages, totalPages);

    if (pagesToFetch > MAX_PAGE) {
      this.logger.info(`  Note: capping at ${MAX_PAGE} pages`);
      pagesToFetch = MAX_PAGE;
    }

    if (pagesToFetch <= 1) {
      return { publications: allPubs, ids: allIds, totalPages, errors: 0 };
    }

    let errors = 0;

    // Strictly sequential — parallel requests trigger anti-DDoS (503 + IP ban)
    for (let page = 2; page <= pagesToFetch; page++) {
      const result = await this.fetchPageSafe(page);

      if (result) {
        for (const id of result.publicationIds) {
          if (!seen.has(id)) {
            seen.add(id);
            allIds.push(id);
          }
        }
        Object.assign(allPubs, result.publicationRefs);
      } else {
        errors++;
      }

      this.logger.progress(page, pagesToFetch);
    }

    return { publications: allPubs, ids: allIds, totalPages, errors };
  }

  private async fetchPageSafe(page: number): Promise<PageResponse | null> {
    try {
      return await this.fetchPage(page);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Page ${page} failed: ${msg}`);
      return null;
    }
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/sources/__tests__/BaseSourceClient.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/sources/
git commit -m "feat: add BaseSourceClient with pagination, dedup, error counting"
```

---

## Task 11: Sources — Habr concrete clients

**Files:**
- Create: `src/sources/habr/HabrSearchClient.ts`
- Create: `src/sources/habr/HabrHubClient.ts`
- Create: `src/sources/medium/MediumClient.ts`

**Step 1: Create HabrSearchClient**

`src/sources/habr/HabrSearchClient.ts`:
```typescript
import { BaseSourceClient } from '../BaseSourceClient.js';
import { ILogger } from '../../infrastructure/logger/ILogger.js';
import { IHttpClient } from '../../infrastructure/http/IHttpClient.js';
import { HABR_API_URL } from '../../infrastructure/config.js';
import { FetchResult } from '../../domain/source/FetchResult.js';
import { Order } from '../../domain/shared/Order.js';

interface HabrResponse {
  pagesCount: number;
  publicationIds: string[];
  publicationRefs: Record<string, any>;
}

export class HabrSearchClient extends BaseSourceClient {
  private query = '';
  private order: Order = 'relevance';

  constructor(
    private readonly http: IHttpClient,
    logger: ILogger,
  ) {
    super(logger);
  }

  async search(query: string, order: Order, maxPages: number): Promise<FetchResult> {
    this.query = query;
    this.order = order;
    this.logger.info(`Fetching search: "${query}" (${maxPages} pages)...`);
    return this.fetchPages(maxPages);
  }

  protected async fetchPage(page: number): Promise<HabrResponse> {
    const params = new URLSearchParams({
      query: this.query,
      target_type: 'posts',
      order: this.order,
      page: String(page),
      fl: 'ru',
      hl: 'ru',
    });
    return this.http.fetchJson<HabrResponse>(`${HABR_API_URL}?${params}`);
  }
}
```

**Step 2: Create HabrHubClient**

`src/sources/habr/HabrHubClient.ts`:
```typescript
import { BaseSourceClient } from '../BaseSourceClient.js';
import { ILogger } from '../../infrastructure/logger/ILogger.js';
import { IHttpClient } from '../../infrastructure/http/IHttpClient.js';
import { HABR_API_URL } from '../../infrastructure/config.js';
import { FetchResult } from '../../domain/source/FetchResult.js';
import { TopPeriod } from '../../domain/shared/TopPeriod.js';

const HUB_URL_PATTERN = /habr\.com\/ru\/hubs\/([^/]+)/;

interface HabrResponse {
  pagesCount: number;
  publicationIds: string[];
  publicationRefs: Record<string, any>;
}

export class HabrHubClient extends BaseSourceClient {
  private currentAlias = '';
  private currentTop?: TopPeriod;

  constructor(
    private readonly http: IHttpClient,
    logger: ILogger,
  ) {
    super(logger);
  }

  async fetchHubs(hubs: string[], maxPages: number, top?: TopPeriod): Promise<FetchResult> {
    const aliases = hubs.map(HabrHubClient.parseAlias);
    const allIds: string[] = [];
    const allPubs: FetchResult['publications'] = {};
    let totalPages = 0;
    let errors = 0;
    const seen = new Set<string>();

    for (const alias of aliases) {
      const label = top ? `Fetching hub: ${alias} (top/${top})` : `Fetching hub: ${alias}`;
      this.logger.info(label);
      this.currentAlias = alias;
      this.currentTop = top;
      const result = await this.fetchPages(maxPages);
      totalPages += result.totalPages;
      errors += result.errors;

      for (const id of result.ids) {
        if (!seen.has(id)) {
          seen.add(id);
          allIds.push(id);
        }
      }
      Object.assign(allPubs, result.publications);
    }

    return { publications: allPubs, ids: allIds, totalPages, errors };
  }

  protected async fetchPage(page: number): Promise<HabrResponse> {
    const params = new URLSearchParams({
      hub: this.currentAlias,
      sort: 'all',
      fl: 'ru',
      hl: 'ru',
      page: String(page),
    });
    if (this.currentTop) params.set('period', this.currentTop);
    return this.http.fetchJson<HabrResponse>(`${HABR_API_URL}?${params}`);
  }

  static parseAlias(input: string): string {
    const match = input.match(HUB_URL_PATTERN);
    return match ? match[1] : input;
  }
}
```

**Step 3: Create MediumClient stub**

`src/sources/medium/MediumClient.ts`:
```typescript
import { BaseSourceClient } from '../BaseSourceClient.js';
import { FetchResult } from '../../domain/source/FetchResult.js';

export class MediumClient extends BaseSourceClient {
  async search(_query: string, _maxPages: number): Promise<FetchResult> {
    throw new Error('MediumClient not yet implemented');
  }

  protected async fetchPage(_page: number): Promise<never> {
    throw new Error('MediumClient not yet implemented');
  }
}
```

**Step 4: Compile check**

```bash
npx tsc --noEmit
```
Expected: no errors from new sources/

**Step 5: Commit**

```bash
git add src/sources/
git commit -m "feat: add HabrSearchClient, HabrHubClient, MediumClient stub"
```

---

## Task 12: Application — App.ts

**Files:**
- Create: `src/application/App.ts`

**Step 1: Create App**

`src/application/App.ts`:
```typescript
import { FormatterRegistry } from '../formatters/FormatterRegistry.js';
import { ILogger } from '../infrastructure/logger/ILogger.js';
import { ISorter } from '../domain/article/ISorter.js';
import { ITransformer } from '../domain/article/ITransformer.js';
import { HabrSearchClient } from '../sources/habr/HabrSearchClient.js';
import { HabrHubClient } from '../sources/habr/HabrHubClient.js';
import { Order } from '../domain/shared/Order.js';
import { SortField } from '../domain/shared/SortField.js';
import { OutputFormat } from '../domain/shared/OutputFormat.js';
import { TopPeriod } from '../domain/shared/TopPeriod.js';

export interface SearchOptions {
  order: Order;
  sort: SortField;
  asc: boolean;
  pages: number;
  format: OutputFormat;
  limit?: number;
}

export interface HubOptions {
  sort: SortField;
  asc: boolean;
  pages: number;
  format: OutputFormat;
  limit?: number;
  period: TopPeriod;
}

export class App {
  constructor(
    private readonly searchClient: HabrSearchClient,
    private readonly hubClient: HabrHubClient,
    private readonly transformer: ITransformer,
    private readonly sorter: ISorter,
    private readonly formatters: FormatterRegistry,
    private readonly logger: ILogger,
  ) {}

  async search(query: string, options: SearchOptions): Promise<string> {
    const { publications, ids, totalPages, errors } = await this.searchClient.search(
      query,
      options.order,
      options.pages,
    );

    if (ids.length === 0) {
      this.logger.info(`No articles found for "${query}"`);
      return '';
    }

    return this.processAndFormat({ publications, ids, totalPages, errors }, options);
  }

  async hub(aliases: string[], options: HubOptions): Promise<string> {
    const { publications, ids, totalPages, errors } = await this.hubClient.fetchHubs(
      aliases,
      options.pages,
      options.period,
    );

    if (ids.length === 0) {
      this.logger.info('No articles found in the specified hub(s)');
      return '';
    }

    return this.processAndFormat({ publications, ids, totalPages, errors }, options);
  }

  private processAndFormat(
    result: { publications: any; ids: string[]; totalPages: number; errors: number },
    options: { sort: SortField; asc: boolean; format: OutputFormat; limit?: number },
  ): string {
    let articles = this.transformer.transform(result.publications, result.ids);
    articles = this.sorter.sort(articles, options.sort, options.asc);
    if (options.limit) articles = articles.slice(0, options.limit);

    let summary = `Found ${result.ids.length} articles (${result.totalPages} pages total)`;
    if (result.errors > 0) summary += ` [${result.errors} page(s) failed]`;
    this.logger.info(summary);

    return this.formatters.get(options.format).format(articles);
  }
}
```

**Step 2: Compile check**

```bash
npx tsc --noEmit
```
Expected: no errors

**Step 3: Commit**

```bash
git add src/application/
git commit -m "feat: add application App with search and hub orchestration"
```

---

## Task 13: Presentation — CLI commands and composition root

**Files:**
- Create: `src/presentation/cli/commands/SearchCommand.ts`
- Create: `src/presentation/cli/commands/HubCommand.ts`
- Create: `src/presentation/cli/index.ts`

**Step 1: Create SearchCommand**

`src/presentation/cli/commands/SearchCommand.ts`:
```typescript
import { Command } from 'commander';
import { App } from '../../../application/App.js';
import { ILogger } from '../../../infrastructure/logger/ILogger.js';
import { Order, SortField, OutputFormat } from '../../../domain/shared/index.js';

export function createSearchCommand(app: App, logger: ILogger): Command {
  return new Command('search')
    .description('Search articles by query')
    .argument('<query>', 'Search query. Use brackets for tag search: "[ansible]"')
    .option('-o, --order <order>', 'Server-side order: date, relevance, rating', 'relevance')
    .option('-s, --sort <field>', 'Client-side sort: votes, bookmarks, comments, date, views', 'votes')
    .option('--asc', 'Sort ascending (default: descending)', false)
    .option('-p, --pages <number>', 'Pages to fetch (0 = all)', '1')
    .option('-f, --format <format>', 'Output format: md, json, csv', 'md')
    .option('-n, --limit <number>', 'Max articles to display')
    .action(async (query: string, opts: Record<string, string | boolean>) => {
      try {
        const result = await app.search(query, {
          order: opts.order as Order,
          sort: opts.sort as SortField,
          asc: opts.asc as boolean,
          pages: parseInt(opts.pages as string, 10),
          format: opts.format as OutputFormat,
          limit: opts.limit ? parseInt(opts.limit as string, 10) : undefined,
        });
        if (result) console.log(result);
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}
```

**Step 2: Create HubCommand**

`src/presentation/cli/commands/HubCommand.ts`:
```typescript
import { Command } from 'commander';
import { App } from '../../../application/App.js';
import { ILogger } from '../../../infrastructure/logger/ILogger.js';
import { SortField, OutputFormat, TopPeriod } from '../../../domain/shared/index.js';

export function createHubCommand(app: App, logger: ILogger): Command {
  return new Command('hub')
    .description('Fetch articles from hub(s)')
    .argument('<aliases...>', 'Hub aliases or URLs')
    .option('-s, --sort <field>', 'Client-side sort: votes, bookmarks, comments, date, views', 'votes')
    .option('--asc', 'Sort ascending (default: descending)', false)
    .option('-p, --pages <number>', 'Pages to fetch (0 = all)', '5')
    .option('-f, --format <format>', 'Output format: md, json, csv', 'md')
    .option('-n, --limit <number>', 'Max articles to display', '100')
    .option('--period <period>', 'Top period: daily, weekly, monthly, yearly, alltime', 'alltime')
    .action(async (aliases: string[], opts: Record<string, string | boolean>) => {
      try {
        const result = await app.hub(aliases, {
          sort: opts.sort as SortField,
          asc: opts.asc as boolean,
          pages: parseInt(opts.pages as string, 10),
          format: opts.format as OutputFormat,
          limit: parseInt(opts.limit as string, 10),
          period: opts.period as TopPeriod,
        });
        if (result) console.log(result);
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}
```

**Step 3: Create barrel for domain/shared**

`src/domain/shared/index.ts`:
```typescript
export type { Order } from './Order.js';
export type { SortField } from './SortField.js';
export type { OutputFormat } from './OutputFormat.js';
export type { TopPeriod } from './TopPeriod.js';
```

**Step 4: Create new composition root**

`src/presentation/cli/index.ts`:
```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { THROTTLE_MS } from '../../infrastructure/config.js';
import { Logger } from '../../infrastructure/logger/Logger.js';
import { Throttler } from '../../infrastructure/http/Throttler.js';
import { HttpClient } from '../../infrastructure/http/HttpClient.js';
import { HabrSearchClient } from '../../sources/habr/HabrSearchClient.js';
import { HabrHubClient } from '../../sources/habr/HabrHubClient.js';
import { ArticleTransformer } from '../../shared/transformer/ArticleTransformer.js';
import { BaseSorter } from '../../shared/sorter/BaseSorter.js';
import { MarkdownFormatter } from '../../formatters/MarkdownFormatter.js';
import { JsonFormatter } from '../../formatters/JsonFormatter.js';
import { CsvFormatter } from '../../formatters/CsvFormatter.js';
import { FormatterRegistry } from '../../formatters/FormatterRegistry.js';
import { App } from '../../application/App.js';
import { createSearchCommand } from './commands/SearchCommand.js';
import { createHubCommand } from './commands/HubCommand.js';

// Composition root
const logger = new Logger();
const throttler = new Throttler(THROTTLE_MS);
const httpClient = new HttpClient(throttler, logger);
const searchClient = new HabrSearchClient(httpClient, logger);
const hubClient = new HabrHubClient(httpClient, logger);
const transformer = new ArticleTransformer();
const sorter = new BaseSorter();
const formatters = new FormatterRegistry({
  md: new MarkdownFormatter(),
  json: new JsonFormatter(),
  csv: new CsvFormatter(),
});
const app = new App(searchClient, hubClient, transformer, sorter, formatters, logger);

// CLI
const program = new Command();
program.name('habrvest').description('CLI tool for searching Habr.com articles').version('1.0.0');
program.addCommand(createSearchCommand(app, logger), { isDefault: true });
program.addCommand(createHubCommand(app, logger));
program.parse();
```

**Step 5: Update package.json bin to point to new entry**

In `package.json`, update `bin`:
```json
"bin": {
  "harvest": "./dist/presentation/cli/index.js",
  "habrvest": "./dist/presentation/cli/index.js"
}
```

And update `scripts.start`:
```json
"start": "tsx src/presentation/cli/index.ts"
```

**Step 6: Smoke test CLI**

```bash
npx tsx src/presentation/cli/index.ts --help
```
Expected: shows help with search and hub commands

**Step 7: Compile check**

```bash
npx tsc --noEmit
```
Expected: no errors

**Step 8: Commit**

```bash
git add src/presentation/ src/domain/shared/index.ts package.json
git commit -m "feat: add presentation CLI layer with SearchCommand and HubCommand"
```

---

## Task 14: Update tsconfig and remove old files

**Files:**
- Modify: `tsconfig.json`
- Delete: `src/types.ts`, `src/config.ts`, `src/logger.ts`, `src/throttler.ts`, `src/http-client.ts`, `src/cache.ts`, `src/transformer.ts`, `src/sorter.ts`, `src/habr-client.ts`, `src/hub-client.ts`, `src/app.ts`, `src/index.ts`, `src/formatters/` (old)

**Step 1: Check tsconfig**

```bash
cat tsconfig.json
```
Ensure `outDir` covers the new structure. If `rootDir` is `src`, no change needed.

**Step 2: Full compile to confirm no errors**

```bash
npx tsc --noEmit
```
Expected: PASS before deleting old files.

**Step 3: Delete old files**

```bash
rm src/types.ts src/config.ts src/logger.ts src/throttler.ts src/http-client.ts src/cache.ts src/transformer.ts src/sorter.ts src/habr-client.ts src/hub-client.ts src/app.ts src/index.ts
rm -rf src/formatters/
```

**Step 4: Compile after deletion**

```bash
npx tsc --noEmit
```
Expected: no errors — all imports resolved through new paths

**Step 5: Run all tests**

```bash
npx vitest run
```
Expected: all PASS

**Step 6: Final smoke test**

```bash
npx tsx src/presentation/cli/index.ts search "rust" -n 3
```
Expected: markdown table with 3 articles

**Step 7: Commit**

```bash
git add -A
git commit -m "refactor: remove old flat src/ files after DDD Onion migration"
```

---

## Final Checklist

- [ ] `npx tsc --noEmit` — no errors
- [ ] `npx vitest run` — all tests pass
- [ ] `npx tsx src/presentation/cli/index.ts search "test" -n 1` — returns article
- [ ] `npx tsx src/presentation/cli/index.ts hub "python" -n 3` — returns articles
- [ ] No files remain in old `src/` flat structure
