# Medium + Browser Architecture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Рефакторинг BaseSourceClient на итераторную модель, реализация заменяемого browser-слоя через DI, полная реализация MediumClient с разделёнными ответственностями, перенос всех JS-скриптов.

**Architecture:** BaseSourceClient рефакторится на hasMore()/fetchNext() + CollectionAccumulator. Браузерный слой в infrastructure/browser/ — контракты + одна реализация (Playwright) через DI. MediumClient расширяет BaseBrowserSourceClient, делегирует парсинг MediumPageParser и маппинг MediumArticleMapper.

**Tech Stack:** TypeScript, Playwright, Vitest, Commander

**Design doc:** `docs/plans/2026-03-09-medium-browser-architecture-design.md`

---

## Task 1: CollectionAccumulator

Выносим дедупликацию и накопление результата из BaseSourceClient в отдельный класс.

**Files:**
- Create: `src/sources/CollectionAccumulator.ts`
- Create: `src/sources/__tests__/CollectionAccumulator.test.ts`

**Step 1: Write failing test**

`src/sources/__tests__/CollectionAccumulator.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { CollectionAccumulator } from '../CollectionAccumulator.js';
import { Publication } from '../../domain/source/Publication.js';

const makePub = (id: string): Publication => ({ id } as Publication);

describe('CollectionAccumulator', () => {
  it('accumulates ids and publications', () => {
    const acc = new CollectionAccumulator();
    acc.add(['a', 'b'], { a: makePub('a'), b: makePub('b') });
    const result = acc.toFetchResult(2, 0);
    expect(result.ids).toEqual(['a', 'b']);
    expect(result.publications['a'].id).toBe('a');
  });

  it('deduplicates ids', () => {
    const acc = new CollectionAccumulator();
    acc.add(['a'], { a: makePub('a') });
    acc.add(['a', 'b'], { a: makePub('a'), b: makePub('b') });
    const result = acc.toFetchResult(2, 0);
    expect(result.ids).toEqual(['a', 'b']);
  });

  it('reports totalPages and errors', () => {
    const acc = new CollectionAccumulator();
    const result = acc.toFetchResult(5, 2);
    expect(result.totalPages).toBe(5);
    expect(result.errors).toBe(2);
  });
});
```

**Step 2: Run test — must FAIL**
```bash
npx vitest run src/sources/__tests__/CollectionAccumulator.test.ts
```

**Step 3: Implement**

`src/sources/CollectionAccumulator.ts`:
```typescript
import { FetchResult } from '../domain/source/FetchResult.js';
import { Publication } from '../domain/source/Publication.js';

export class CollectionAccumulator {
  private readonly seen = new Set<string>();
  private readonly ids: string[] = [];
  private readonly publications: Record<string, Publication> = {};

  add(newIds: string[], newPubs: Record<string, Publication>): void {
    for (const id of newIds) {
      if (!this.seen.has(id)) {
        this.seen.add(id);
        this.ids.push(id);
      }
    }
    Object.assign(this.publications, newPubs);
  }

  toFetchResult(totalPages: number, errors: number): FetchResult {
    return {
      ids: [...this.ids],
      publications: { ...this.publications },
      totalPages,
      errors,
    };
  }
}
```

**Step 4: Run test — must PASS**
```bash
npx vitest run src/sources/__tests__/CollectionAccumulator.test.ts
```

**Step 5: Commit**
```bash
git add src/sources/CollectionAccumulator.ts src/sources/__tests__/CollectionAccumulator.test.ts
git commit -m "feat: add CollectionAccumulator for dedup and result accumulation"
```

---

## Task 2: Рефакторинг BaseSourceClient на итераторную модель

**Files:**
- Modify: `src/sources/BaseSourceClient.ts`
- Modify: `src/sources/__tests__/BaseSourceClient.test.ts`

**Step 1: Переписать BaseSourceClient**

`src/sources/BaseSourceClient.ts`:
```typescript
import { FetchResult } from '../domain/source/FetchResult.js';
import { Publication } from '../domain/source/Publication.js';
import { ILogger } from '../infrastructure/logger/ILogger.js';
import { MAX_PAGE } from '../infrastructure/config.js';
import { CollectionAccumulator } from './CollectionAccumulator.js';

export interface PageResponse {
  totalPages: number;
  ids: string[];
  publications: Record<string, Publication>;
}

export abstract class BaseSourceClient {
  protected totalPages = 0;
  protected currentPage = 0;
  protected maxPages = 0;

  constructor(protected readonly logger: ILogger) {}

  protected abstract hasMore(): boolean;
  protected abstract fetchNext(): Promise<PageResponse>;

  async collect(maxPages: number): Promise<FetchResult> {
    this.maxPages = maxPages;
    this.currentPage = 0;

    const acc = new CollectionAccumulator();
    let errors = 0;

    while (this.hasMore()) {
      try {
        const response = await this.fetchNext();
        this.totalPages = response.totalPages;
        acc.add(response.ids, response.publications);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Fetch failed: ${msg}`);
        errors++;
      }
      this.logger.progress(this.currentPage, this.effectiveMax());
    }

    return acc.toFetchResult(this.totalPages, errors);
  }

  protected effectiveMax(): number {
    const limit = this.maxPages === 0 ? this.totalPages : Math.min(this.maxPages, this.totalPages);
    return Math.min(limit, MAX_PAGE);
  }
}
```

**Step 2: Обновить тесты BaseSourceClient**

`src/sources/__tests__/BaseSourceClient.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { BaseSourceClient, PageResponse } from '../BaseSourceClient.js';

const mockLogger = { info: () => {}, error: () => {}, progress: () => {} };

class TestClient extends BaseSourceClient {
  private page = 0;
  public fetchedPages: number[] = [];
  public failPages: Set<number> = new Set();

  protected hasMore(): boolean {
    const max = this.maxPages === 0 ? 3 : Math.min(this.maxPages, 3);
    return this.page < max;
  }

  protected async fetchNext(): Promise<PageResponse> {
    this.page++;
    this.currentPage = this.page;
    this.fetchedPages.push(this.page);
    if (this.failPages.has(this.page)) throw new Error(`fail`);
    return {
      totalPages: 3,
      ids: [`id-${this.page}`],
      publications: { [`id-${this.page}`]: { id: `id-${this.page}` } as any },
    };
  }
}

describe('BaseSourceClient', () => {
  it('collects pages via hasMore/fetchNext', async () => {
    const client = new TestClient(mockLogger);
    const result = await client.collect(3);
    expect(client.fetchedPages).toEqual([1, 2, 3]);
    expect(result.ids).toHaveLength(3);
  });

  it('respects maxPages limit', async () => {
    const client = new TestClient(mockLogger);
    const result = await client.collect(1);
    expect(client.fetchedPages).toEqual([1]);
    expect(result.ids).toHaveLength(1);
  });

  it('counts errors for failed fetches', async () => {
    const client = new TestClient(mockLogger);
    client.failPages.add(2);
    const result = await client.collect(3);
    expect(result.errors).toBe(1);
  });
});
```

**Step 3: Run tests**
```bash
npx vitest run src/sources/__tests__/BaseSourceClient.test.ts
```
Expected: PASS

**Step 4: Commit**
```bash
git add src/sources/BaseSourceClient.ts src/sources/__tests__/BaseSourceClient.test.ts
git commit -m "refactor: BaseSourceClient to hasMore/fetchNext iterator model"
```

---

## Task 3: Адаптировать HabrSearchClient и HabrHubClient

**Files:**
- Modify: `src/sources/habr/HabrSearchClient.ts`
- Modify: `src/sources/habr/HabrHubClient.ts`

**Step 1: Обновить HabrSearchClient**

`src/sources/habr/HabrSearchClient.ts`:
```typescript
import { BaseSourceClient, PageResponse } from '../BaseSourceClient.js';
import { ILogger } from '../../infrastructure/logger/ILogger.js';
import { IHttpClient } from '../../infrastructure/http/IHttpClient.js';
import { HABR_API_URL } from '../../infrastructure/config.js';
import { FetchResult } from '../../domain/source/FetchResult.js';
import { Order } from '../../domain/shared/Order.js';

interface HabrPageResponse {
  pagesCount: number;
  publicationIds: string[];
  publicationRefs: Record<string, any>;
}

export class HabrSearchClient extends BaseSourceClient {
  private query = '';
  private order: Order = 'relevance';
  private page = 0;

  constructor(
    private readonly http: IHttpClient,
    logger: ILogger,
  ) {
    super(logger);
  }

  async search(query: string, order: Order, maxPages: number): Promise<FetchResult> {
    this.query = query;
    this.order = order;
    this.page = 0;
    this.totalPages = 0;
    this.logger.info(`Fetching search: "${query}"...`);
    return this.collect(maxPages);
  }

  protected hasMore(): boolean {
    if (this.page === 0) return true; // first fetch always
    return this.page < this.effectiveMax();
  }

  protected async fetchNext(): Promise<PageResponse> {
    this.page++;
    this.currentPage = this.page;
    const params = new URLSearchParams({
      query: this.query,
      target_type: 'posts',
      order: this.order,
      page: String(this.page),
      fl: 'ru',
      hl: 'ru',
    });
    const res = await this.http.fetchJson<HabrPageResponse>(`${HABR_API_URL}?${params}`);
    return {
      totalPages: res.pagesCount,
      ids: res.publicationIds,
      publications: res.publicationRefs,
    };
  }
}
```

**Step 2: Обновить HabrHubClient**

`src/sources/habr/HabrHubClient.ts`:
```typescript
import { BaseSourceClient, PageResponse } from '../BaseSourceClient.js';
import { ILogger } from '../../infrastructure/logger/ILogger.js';
import { IHttpClient } from '../../infrastructure/http/IHttpClient.js';
import { HABR_API_URL } from '../../infrastructure/config.js';
import { FetchResult } from '../../domain/source/FetchResult.js';
import { TopPeriod } from '../../domain/shared/TopPeriod.js';
import { CollectionAccumulator } from '../CollectionAccumulator.js';

const HUB_URL_PATTERN = /habr\.com\/ru\/hubs\/([^/]+)/;

interface HabrPageResponse {
  pagesCount: number;
  publicationIds: string[];
  publicationRefs: Record<string, any>;
}

export class HabrHubClient extends BaseSourceClient {
  private currentAlias = '';
  private currentTop?: TopPeriod;
  private page = 0;

  constructor(
    private readonly http: IHttpClient,
    logger: ILogger,
  ) {
    super(logger);
  }

  async fetchHubs(hubs: string[], maxPages: number, top?: TopPeriod): Promise<FetchResult> {
    const aliases = hubs.map(HabrHubClient.parseAlias);
    const acc = new CollectionAccumulator();
    let totalPages = 0;
    let errors = 0;

    for (const alias of aliases) {
      this.logger.info(top ? `Fetching hub: ${alias} (top/${top})` : `Fetching hub: ${alias}`);
      this.currentAlias = alias;
      this.currentTop = top;
      this.page = 0;
      this.totalPages = 0;

      const result = await this.collect(maxPages);
      totalPages += result.totalPages;
      errors += result.errors;
      acc.add(result.ids, result.publications);
    }

    return acc.toFetchResult(totalPages, errors);
  }

  protected hasMore(): boolean {
    if (this.page === 0) return true;
    return this.page < this.effectiveMax();
  }

  protected async fetchNext(): Promise<PageResponse> {
    this.page++;
    this.currentPage = this.page;
    const params = new URLSearchParams({
      hub: this.currentAlias,
      sort: 'all',
      fl: 'ru',
      hl: 'ru',
      page: String(this.page),
    });
    if (this.currentTop) params.set('period', this.currentTop);
    const res = await this.http.fetchJson<HabrPageResponse>(`${HABR_API_URL}?${params}`);
    return {
      totalPages: res.pagesCount,
      ids: res.publicationIds,
      publications: res.publicationRefs,
    };
  }

  static parseAlias(input: string): string {
    const match = input.match(HUB_URL_PATTERN);
    return match ? match[1] : input;
  }
}
```

**Step 3: Compile check**
```bash
npx tsc --noEmit
```
Expected: no errors

**Step 4: Run all existing tests**
```bash
npx vitest run
```
Expected: all PASS

**Step 5: Commit**
```bash
git add src/sources/habr/
git commit -m "refactor: adapt HabrSearchClient and HabrHubClient to iterator model"
```

---

## Task 4: Infrastructure Browser — контракты

**Files:**
- Create: `src/infrastructure/browser/IPage.ts`
- Create: `src/infrastructure/browser/ISession.ts`
- Create: `src/infrastructure/browser/IBrowser.ts`

**Step 1: Создать IPage**

`src/infrastructure/browser/IPage.ts`:
```typescript
export interface IPage {
  goto(url: string, options?: { waitUntil?: string; timeout?: number }): Promise<void>;
  evaluate<T>(fn: () => T): Promise<T>;
  waitForTimeout(ms: number): Promise<void>;
  close(): Promise<void>;
}
```

**Step 2: Создать ISession**

`src/infrastructure/browser/ISession.ts`:
```typescript
import { IPage } from './IPage.js';

export interface ISession {
  newPage(): Promise<IPage>;
  close(): Promise<void>;
}
```

**Step 3: Создать IBrowser**

`src/infrastructure/browser/IBrowser.ts`:
```typescript
import { ISession } from './ISession.js';

export interface IBrowser {
  connect(): Promise<void>;
  createSession(cookiesPath: string): Promise<ISession>;
  close(): Promise<void>;
}
```

**Step 4: Compile check**
```bash
npx tsc --noEmit
```

**Step 5: Commit**
```bash
git add src/infrastructure/browser/
git commit -m "feat: add browser infrastructure contracts IBrowser, ISession, IPage"
```

---

## Task 5: Infrastructure Browser — реализации Playwright + BrowserFactory

**Files:**
- Create: `src/infrastructure/browser/Browser.ts`
- Create: `src/infrastructure/browser/Session.ts`
- Create: `src/infrastructure/browser/BrowserFactory.ts`

**Step 1: Создать Browser**

`src/infrastructure/browser/Browser.ts`:
```typescript
import { BrowserType, Browser as PlaywrightBrowser, BrowserContext } from 'playwright';
import { readFileSync } from 'node:fs';
import { IBrowser } from './IBrowser.js';
import { ISession } from './ISession.js';
import { Session } from './Session.js';

export class Browser implements IBrowser {
  private browser: PlaywrightBrowser | null = null;

  constructor(private readonly chromium: BrowserType) {}

  async connect(): Promise<void> {
    this.browser = await this.chromium.connectOverCDP('http://localhost:9222');
  }

  async createSession(cookiesPath: string): Promise<ISession> {
    if (!this.browser) throw new Error('Browser not connected. Call connect() first.');
    const context: BrowserContext = this.browser.contexts()[0] ?? await this.browser.newContext();
    const cookies = JSON.parse(readFileSync(cookiesPath, 'utf-8'));
    await context.addCookies(cookies);
    return new Session(context);
  }

  async close(): Promise<void> {
    await this.browser?.close();
    this.browser = null;
  }
}
```

**Step 2: Создать Session**

`src/infrastructure/browser/Session.ts`:
```typescript
import { BrowserContext, Page } from 'playwright';
import { ISession } from './ISession.js';
import { IPage } from './IPage.js';

export class Session implements ISession {
  constructor(private readonly context: BrowserContext) {}

  async newPage(): Promise<IPage> {
    const page: Page = await this.context.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });
    return page as unknown as IPage;
  }

  async close(): Promise<void> {
    await this.context.close();
  }
}
```

**Step 3: Создать BrowserFactory**

`src/infrastructure/browser/BrowserFactory.ts`:
```typescript
import { BrowserType } from 'playwright';
import { IBrowser } from './IBrowser.js';
import { Browser } from './Browser.js';

export class BrowserFactory {
  constructor(private readonly chromium: BrowserType) {}

  create(): IBrowser {
    return new Browser(this.chromium);
  }
}
```

**Step 4: Compile check**
```bash
npx tsc --noEmit
```
Expected: no errors

**Step 5: Commit**
```bash
git add src/infrastructure/browser/Browser.ts src/infrastructure/browser/Session.ts src/infrastructure/browser/BrowserFactory.ts
git commit -m "feat: add Playwright browser infrastructure implementations"
```

---

## Task 6: BaseBrowserSourceClient

**Files:**
- Create: `src/sources/BaseBrowserSourceClient.ts`

**Step 1: Создать BaseBrowserSourceClient**

`src/sources/BaseBrowserSourceClient.ts`:
```typescript
import { BaseSourceClient } from './BaseSourceClient.js';
import { IBrowser } from '../infrastructure/browser/IBrowser.js';
import { ISession } from '../infrastructure/browser/ISession.js';
import { IPage } from '../infrastructure/browser/IPage.js';
import { BrowserFactory } from '../infrastructure/browser/BrowserFactory.js';
import { ILogger } from '../infrastructure/logger/ILogger.js';
import { FetchResult } from '../domain/source/FetchResult.js';

export abstract class BaseBrowserSourceClient extends BaseSourceClient {
  constructor(
    protected readonly browserFactory: BrowserFactory,
    protected readonly cookiesPath: string,
    logger: ILogger,
  ) {
    super(logger);
  }

  // Оркестрирует браузерную сессию, делегирует обход наследнику
  protected async withSession<T>(fn: (page: IPage) => Promise<T>): Promise<T> {
    const browser: IBrowser = this.browserFactory.create();
    await browser.connect();
    const session: ISession = await browser.createSession(this.cookiesPath);
    const page: IPage = await session.newPage();
    try {
      return await fn(page);
    } finally {
      await page.close();
      await session.close();
      await browser.close();
    }
  }
}
```

**Step 2: Compile check**
```bash
npx tsc --noEmit
```

**Step 3: Commit**
```bash
git add src/sources/BaseBrowserSourceClient.ts
git commit -m "feat: add BaseBrowserSourceClient with browser session orchestration"
```

---

## Task 7: MediumPageParser

**Files:**
- Create: `src/sources/medium/MediumPageParser.ts`
- Create: `src/sources/medium/__tests__/MediumPageParser.test.ts`

**Step 1: Создать MediumPageParser**

`src/sources/medium/MediumPageParser.ts`:
```typescript
import { IPage } from '../../infrastructure/browser/IPage.js';

export interface MediumArticleRaw {
  title: string;
  url: string;
  author: string;
  date: string;
  claps: string;
  description: string;
  isMember: boolean;
}

export class MediumPageParser {
  async parse(page: IPage): Promise<MediumArticleRaw[]> {
    return page.evaluate((): MediumArticleRaw[] => {
      const cards = document.querySelectorAll('[data-testid="post-preview"]');
      return Array.from(cards).map((card) => {
        const linkEl = card.querySelector('[data-href]');
        const url = (linkEl?.getAttribute('data-href') ?? '').split('?')[0];
        const title = card.querySelector('h2')?.textContent?.trim() ?? '';
        const authorLinks = card.querySelectorAll('a[rel="noopener follow"] p');
        const author = authorLinks[authorLinks.length - 1]?.textContent?.trim() ?? '';
        const timeEl = card.querySelector('time');
        const date = timeEl?.getAttribute('datetime') ?? timeEl?.textContent?.trim() ?? '';
        const description = card.querySelector('h3, h4')?.textContent?.trim() ?? '';
        const allSpans = Array.from(card.querySelectorAll('p, span'));
        const clapsEl = allSpans.find((s) => /^\d[\d,.]*[KM]?$/.test(s.textContent?.trim() ?? ''));
        const claps = clapsEl?.textContent?.trim() ?? '';
        const isMember = card.innerHTML.includes('Member-only') || card.innerHTML.includes('member-only');
        return { title, url, author, date, claps, description, isMember };
      }).filter((a) => Boolean(a.title && a.url));
    });
  }

  async scrollAndParse(page: IPage): Promise<MediumArticleRaw[]> {
    await page.waitForTimeout(2000);

    // Scroll to load all articles
    for (let i = 0; i < 10; i++) {
      const before = await page.evaluate(() => document.body.scrollHeight);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1500);
      const after = await page.evaluate(() => document.body.scrollHeight);
      if (after === before) break;
    }

    return this.parse(page);
  }
}
```

**Step 2: Write test**

`src/sources/medium/__tests__/MediumPageParser.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { MediumPageParser } from '../MediumPageParser.js';
import { IPage } from '../../../infrastructure/browser/IPage.js';

const makePage = (articles: any[]): IPage => ({
  goto: vi.fn(),
  evaluate: vi.fn().mockResolvedValue(articles),
  waitForTimeout: vi.fn().mockResolvedValue(undefined),
  close: vi.fn(),
});

describe('MediumPageParser', () => {
  const parser = new MediumPageParser();

  it('returns parsed articles from page', async () => {
    const page = makePage([
      { title: 'Test', url: 'https://medium.com/test', author: 'Alice', date: '2024-01-01', claps: '100', description: 'desc', isMember: false },
    ]);
    const result = await parser.parse(page);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Test');
    expect(result[0].claps).toBe('100');
  });

  it('returns empty array if no articles', async () => {
    const page = makePage([]);
    const result = await parser.parse(page);
    expect(result).toHaveLength(0);
  });
});
```

**Step 3: Run tests**
```bash
npx vitest run src/sources/medium/__tests__/MediumPageParser.test.ts
```
Expected: PASS

**Step 4: Commit**
```bash
git add src/sources/medium/MediumPageParser.ts src/sources/medium/__tests__/MediumPageParser.test.ts
git commit -m "feat: add MediumPageParser for DOM scraping"
```

---

## Task 8: MediumArticleMapper

**Files:**
- Create: `src/sources/medium/MediumArticleMapper.ts`
- Create: `src/sources/medium/__tests__/MediumArticleMapper.test.ts`

**Step 1: Write failing test**

`src/sources/medium/__tests__/MediumArticleMapper.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { MediumArticleMapper } from '../MediumArticleMapper.js';
import { MediumArticleRaw } from '../MediumPageParser.js';

const makeRaw = (overrides: Partial<MediumArticleRaw> = {}): MediumArticleRaw => ({
  title: 'Test Article',
  url: 'https://medium.com/@user/test-abc123',
  author: 'Alice',
  date: '2024-01-15T10:00:00Z',
  claps: '1.5K',
  description: 'A description',
  isMember: false,
  ...overrides,
});

describe('MediumArticleMapper', () => {
  const mapper = new MediumArticleMapper();

  it('maps claps string to score', () => {
    const pub = mapper.toPublication(makeRaw({ claps: '1.5K' }));
    expect(pub.statistics.score).toBe(1500);
  });

  it('maps M suffix', () => {
    const pub = mapper.toPublication(makeRaw({ claps: '2M' }));
    expect(pub.statistics.score).toBe(2_000_000);
  });

  it('maps empty claps to 0', () => {
    const pub = mapper.toPublication(makeRaw({ claps: '' }));
    expect(pub.statistics.score).toBe(0);
  });

  it('sets isMember as tag', () => {
    const pub = mapper.toPublication(makeRaw({ isMember: true }));
    expect(pub.tags[0].titleHtml).toBe('member-only');
  });

  it('sets author alias', () => {
    const pub = mapper.toPublication(makeRaw({ author: 'Bob' }));
    expect(pub.author.alias).toBe('Bob');
  });

  it('uses encoded url as id', () => {
    const raw = makeRaw({ url: 'https://medium.com/test' });
    const pub = mapper.toPublication(raw);
    expect(pub.id).toBe(encodeURIComponent(raw.url));
  });
});
```

**Step 2: Run — must FAIL**
```bash
npx vitest run src/sources/medium/__tests__/MediumArticleMapper.test.ts
```

**Step 3: Implement**

`src/sources/medium/MediumArticleMapper.ts`:
```typescript
import { Publication } from '../../domain/source/Publication.js';
import { MediumArticleRaw } from './MediumPageParser.js';

export class MediumArticleMapper {
  toPublication(raw: MediumArticleRaw): Publication {
    const id = encodeURIComponent(raw.url);
    const claps = this.parseClaps(raw.claps);
    return {
      id,
      timePublished: raw.date,
      titleHtml: raw.title,
      readingTime: 0,
      complexity: null,
      author: { alias: raw.author, fullname: raw.author },
      statistics: {
        commentsCount: 0,
        favoritesCount: 0,
        score: claps,
        votesCount: claps,
        votesCountPlus: claps,
        votesCountMinus: 0,
        readingCount: 0,
      },
      hubs: [],
      tags: raw.isMember ? [{ titleHtml: 'member-only' }] : [],
    };
  }

  private parseClaps(claps: string): number {
    if (!claps) return 0;
    if (claps.endsWith('K')) return Math.round(parseFloat(claps) * 1000);
    if (claps.endsWith('M')) return Math.round(parseFloat(claps) * 1_000_000);
    return parseInt(claps, 10) || 0;
  }
}
```

**Step 4: Run — must PASS**
```bash
npx vitest run src/sources/medium/__tests__/MediumArticleMapper.test.ts
```

**Step 5: Commit**
```bash
git add src/sources/medium/MediumArticleMapper.ts src/sources/medium/__tests__/MediumArticleMapper.test.ts
git commit -m "feat: add MediumArticleMapper with claps parsing"
```

---

## Task 9: MediumClient (рефакторинг)

**Files:**
- Modify: `src/sources/medium/MediumClient.ts`

**Step 1: Переписать MediumClient**

`src/sources/medium/MediumClient.ts`:
```typescript
import { BaseBrowserSourceClient } from '../BaseBrowserSourceClient.js';
import { BrowserFactory } from '../../infrastructure/browser/BrowserFactory.js';
import { ILogger } from '../../infrastructure/logger/ILogger.js';
import { FetchResult } from '../../domain/source/FetchResult.js';
import { CollectionAccumulator } from '../CollectionAccumulator.js';
import { MediumPageParser } from './MediumPageParser.js';
import { MediumArticleMapper } from './MediumArticleMapper.js';
import { PageResponse } from '../BaseSourceClient.js';

export class MediumClient extends BaseBrowserSourceClient {
  private tag = '';
  private year = 0;
  private month = 12;
  private startYear = 0;
  private readonly now = new Date();
  private currentPage = 0;

  private readonly parser: MediumPageParser;
  private readonly mapper: MediumArticleMapper;

  constructor(
    browserFactory: BrowserFactory,
    cookiesPath: string,
    logger: ILogger,
    parser = new MediumPageParser(),
    mapper = new MediumArticleMapper(),
  ) {
    super(browserFactory, cookiesPath, logger);
    this.parser = parser;
    this.mapper = mapper;
  }

  async fetchTag(tag: string, startYear: number, endYear: number): Promise<FetchResult> {
    this.tag = tag;
    this.year = endYear;
    this.month = 12;
    this.startYear = startYear;
    this.currentPage = 0;

    const acc = new CollectionAccumulator();
    let errors = 0;

    await this.withSession(async (page) => {
      while (this.hasMore()) {
        const url = `https://medium.com/tag/${this.tag}/archive/${this.year}/${this.month}`;
        this.logger.info(`Fetching ${this.year}/${String(this.month).padStart(2, '0')}...`);

        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
          const rawArticles = await this.parser.scrollAndParse(page);
          const publications: Record<string, any> = {};
          const ids: string[] = [];

          for (const raw of rawArticles) {
            const pub = this.mapper.toPublication(raw);
            publications[pub.id] = pub;
            ids.push(pub.id);
          }

          acc.add(ids, publications);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error(`${this.year}/${this.month} failed: ${msg}`);
          errors++;
        }

        this.advancePeriod();
        this.currentPage++;
        await page.waitForTimeout(500);
      }
    });

    const totalMonths = (endYear - startYear + 1) * 12;
    return acc.toFetchResult(totalMonths, errors);
  }

  protected hasMore(): boolean {
    if (this.year > new Date().getFullYear()) return false;
    if (this.year < this.startYear) return false;
    return true;
  }

  // fetchNext не используется — MediumClient управляет итерацией через withSession
  protected async fetchNext(): Promise<PageResponse> {
    throw new Error('Use fetchTag() for MediumClient');
  }

  private advancePeriod(): void {
    this.month--;
    if (this.month < 1) {
      this.month = 12;
      this.year--;
    }
  }
}
```

**Step 2: Compile check**
```bash
npx tsc --noEmit
```
Expected: no errors

**Step 3: Run all tests**
```bash
npx vitest run
```
Expected: all PASS

**Step 4: Commit**
```bash
git add src/sources/medium/MediumClient.ts
git commit -m "refactor: MediumClient — delegates to MediumPageParser and MediumArticleMapper"
```

---

## Task 10: MediumMarkdownFormatter

**Files:**
- Create: `src/formatters/MediumMarkdownFormatter.ts`
- Create: `src/formatters/__tests__/MediumMarkdownFormatter.test.ts`

**Step 1: Write failing test**

`src/formatters/__tests__/MediumMarkdownFormatter.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { MediumMarkdownFormatter } from '../MediumMarkdownFormatter.js';
import { Article } from '../../domain/article/Article.js';

const makeArticle = (overrides: Partial<Article> = {}): Article => ({
  date: '2024-01-15T10:00:00Z',
  title: 'Test Article',
  url: 'https://medium.com/test',
  readingTime: 0,
  hubs: [],
  tags: [],
  votes: 1500,
  votesPlus: 1500,
  votesMinus: 0,
  bookmarks: 0,
  comments: 0,
  views: 0,
  ...overrides,
});

describe('MediumMarkdownFormatter', () => {
  const formatter = new MediumMarkdownFormatter();

  it('returns "No articles found." for empty array', () => {
    expect(formatter.format([])).toBe('No articles found.');
  });

  it('includes Claps column header', () => {
    const result = formatter.format([makeArticle()]);
    expect(result).toContain('Claps');
  });

  it('shows member-only marker for member articles', () => {
    const result = formatter.format([makeArticle({ tags: ['member-only'] })]);
    expect(result).toContain('💎');
  });

  it('formats votes as claps', () => {
    const result = formatter.format([makeArticle({ votes: 1500 })]);
    expect(result).toContain('1500');
  });
});
```

**Step 2: Run — must FAIL**
```bash
npx vitest run src/formatters/__tests__/MediumMarkdownFormatter.test.ts
```

**Step 3: Implement**

`src/formatters/MediumMarkdownFormatter.ts`:
```typescript
import { Article } from '../domain/article/Article.js';
import { BaseFormatter } from '../shared/formatter/BaseFormatter.js';

export class MediumMarkdownFormatter extends BaseFormatter {
  format(articles: Article[]): string {
    if (articles.length === 0) return 'No articles found.';

    const header = '| # | Claps | Date | 💎 | Title | Author |';
    const sep = '|---|------:|------|-----|-------|--------|';

    const rows = articles.map((a, i) => {
      const title = this.escapeCell(this.truncate(a.title, 70));
      const isMember = a.tags.includes('member-only') ? '💎' : '';
      // author stored in hubs[0] — fallback to empty
      const author = this.escapeCell(a.hubs[0] ?? '');
      return `| ${i + 1} | ${a.votes} | ${this.formatDate(a.date)} | ${isMember} | [${title}](${a.url}) | ${author} |`;
    });

    return [header, sep, ...rows].join('\n');
  }
}
```

**Step 4: Run — must PASS**
```bash
npx vitest run src/formatters/__tests__/MediumMarkdownFormatter.test.ts
```

**Step 5: Commit**
```bash
git add src/formatters/MediumMarkdownFormatter.ts src/formatters/__tests__/MediumMarkdownFormatter.test.ts
git commit -m "feat: add MediumMarkdownFormatter with claps and member-only columns"
```

---

## Task 11: MediumLoginCommand и MediumCommand

**Files:**
- Create: `src/presentation/cli/commands/MediumLoginCommand.ts`
- Create: `src/presentation/cli/commands/MediumCommand.ts`
- Modify: `src/presentation/cli/index.ts`

**Step 1: Создать MediumLoginCommand**

`src/presentation/cli/commands/MediumLoginCommand.ts`:
```typescript
import { Command } from 'commander';
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { MEDIUM_SESSION_FILE } from '../../../infrastructure/config.js';

export function createMediumLoginCommand(): Command {
  return new Command('login')
    .description('Login to Medium and save session cookies')
    .action(async () => {
      const browser = await chromium.launch({ headless: false });
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto('https://medium.com/m/signin', { waitUntil: 'domcontentloaded', timeout: 30000 });

      console.log('Login in the browser window. Press Enter here when done...');
      process.stdin.resume();
      await new Promise((resolve) => process.stdin.once('data', resolve));

      const cookies = await context.cookies();
      mkdirSync(dirname(MEDIUM_SESSION_FILE), { recursive: true });
      writeFileSync(MEDIUM_SESSION_FILE, JSON.stringify(cookies, null, 2));
      console.log(`Session saved to ${MEDIUM_SESSION_FILE}`);

      await browser.close();
      process.exit(0);
    });
}
```

**Step 2: Добавить MEDIUM_SESSION_FILE в config**

Modify `src/infrastructure/config.ts` — добавить строку:
```typescript
export const MEDIUM_SESSION_FILE = `${process.env.HOME}/.cache/medium-scraper/session.json`;
```

**Step 3: Создать MediumCommand**

`src/presentation/cli/commands/MediumCommand.ts`:
```typescript
import { Command } from 'commander';
import { chromium } from 'playwright';
import { ILogger } from '../../../infrastructure/logger/ILogger.js';
import { BrowserFactory } from '../../../infrastructure/browser/BrowserFactory.js';
import { MediumClient } from '../../../sources/medium/MediumClient.js';
import { MediumMarkdownFormatter } from '../../../formatters/MediumMarkdownFormatter.js';
import { ArticleTransformer } from '../../../shared/transformer/ArticleTransformer.js';
import { BaseSorter } from '../../../shared/sorter/BaseSorter.js';
import { MEDIUM_SESSION_FILE } from '../../../infrastructure/config.js';
import { createMediumLoginCommand } from './MediumLoginCommand.js';

export function createMediumCommand(logger: ILogger): Command {
  const medium = new Command('medium').description('Fetch articles from Medium');

  medium.addCommand(createMediumLoginCommand());

  medium
    .command('fetch')
    .description('Fetch Medium articles by tag')
    .argument('<tag>', 'Medium tag (e.g. "accessibility-testing")')
    .option('--from <year>', 'Start year', '2013')
    .option('--to <year>', 'End year', String(new Date().getFullYear()))
    .option('-n, --limit <number>', 'Max articles to display', '100')
    .action(async (tag: string, opts: Record<string, string>) => {
      try {
        const browserFactory = new BrowserFactory(chromium);
        const client = new MediumClient(browserFactory, MEDIUM_SESSION_FILE, logger);
        const transformer = new ArticleTransformer();
        const sorter = new BaseSorter();
        const formatter = new MediumMarkdownFormatter();

        const result = await client.fetchTag(tag, parseInt(opts.from, 10), parseInt(opts.to, 10));
        let articles = transformer.transform(result.publications, result.ids);
        articles = sorter.sort(articles, 'votes', false);
        if (opts.limit) articles = articles.slice(0, parseInt(opts.limit, 10));

        logger.info(`Found ${result.ids.length} articles`);
        const output = formatter.format(articles);
        if (output) console.log(output);
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  return medium;
}
```

**Step 4: Зарегистрировать в index.ts**

Modify `src/presentation/cli/index.ts` — добавить импорт и команду:
```typescript
import { createMediumCommand } from './commands/MediumCommand.js';
// ...
program.addCommand(createMediumCommand(logger));
```

**Step 5: Compile check**
```bash
npx tsc --noEmit
```

**Step 6: Smoke test**
```bash
npx tsx src/presentation/cli/index.ts medium --help
npx tsx src/presentation/cli/index.ts medium fetch --help
```
Expected: показывает help с описанием команд

**Step 7: Commit**
```bash
git add src/presentation/cli/commands/MediumCommand.ts src/presentation/cli/commands/MediumLoginCommand.ts src/presentation/cli/index.ts src/infrastructure/config.ts
git commit -m "feat: add medium CLI commands — fetch and login"
```

---

## Task 12: Удалить старые JS-скрипты и старый MediumClient

**Files:**
- Delete: `src/medium-scraper.js`
- Delete: `src/medium-login.js`
- Delete: `src/medium-to-md.js`

**Step 1: Убедиться что всё работает**
```bash
npx tsc --noEmit
npx vitest run
```
Expected: all PASS

**Step 2: Удалить старые файлы**
```bash
rm src/medium-scraper.js src/medium-login.js src/medium-to-md.js
```

**Step 3: Run tests после удаления**
```bash
npx vitest run
```
Expected: all PASS (старые файлы не импортировались нигде)

**Step 4: Commit и push**
```bash
git add -A
git commit -m "chore: remove legacy medium JS scripts — logic ported to TypeScript"
git push origin main
```

---

## Final Checklist

- [ ] `npx tsc --noEmit` — no errors
- [ ] `npx vitest run` — all tests pass
- [ ] `npx tsx src/presentation/cli/index.ts --help` — показывает search, hub, medium
- [ ] `npx tsx src/presentation/cli/index.ts medium --help` — показывает fetch, login
- [ ] `src/medium-scraper.js`, `src/medium-login.js`, `src/medium-to-md.js` — удалены
