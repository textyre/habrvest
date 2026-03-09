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
