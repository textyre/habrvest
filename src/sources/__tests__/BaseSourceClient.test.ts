import { describe, it, expect } from 'vitest';
import { BaseSourceClient } from '../BaseSourceClient.js';
import { Publication } from '../../domain/source/Publication.js';

interface PageResponse {
  pagesCount: number;
  publicationIds: string[];
  publicationRefs: Record<string, Publication>;
}

class TestClient extends BaseSourceClient {
  public calls: number[] = [];
  public failPages: Set<number> = new Set();

  protected async fetchPage(page: number): Promise<PageResponse> {
    this.calls.push(page);
    if (this.failPages.has(page)) throw new Error(`Page ${page} failed`);
    return {
      pagesCount: 3,
      publicationIds: [`id-${page}`],
      publicationRefs: { [`id-${page}`]: { id: `id-${page}` } as Publication },
    };
  }
}

const mockLogger = { info: () => {}, error: () => {}, progress: () => {} };

describe('BaseSourceClient', () => {
  it('fetches first page and returns early if maxPages=1', async () => {
    const client = new TestClient(mockLogger);
    const result = await client.fetchPages(1);
    expect(result.ids).toEqual(['id-1']);
    expect(client.calls).toEqual([1]);
  });

  it('fetches multiple pages sequentially', async () => {
    const client = new TestClient(mockLogger);
    const result = await client.fetchPages(3);
    expect(client.calls).toEqual([1, 2, 3]);
    expect(result.ids).toHaveLength(3);
  });

  it('deduplicates ids across pages', async () => {
    class DupClient extends BaseSourceClient {
      protected async fetchPage(_page: number): Promise<PageResponse> {
        return { pagesCount: 2, publicationIds: ['same-id'], publicationRefs: { 'same-id': { id: 'same-id' } as Publication } };
      }
    }
    const client = new DupClient(mockLogger);
    const result = await client.fetchPages(2);
    expect(result.ids).toHaveLength(1);
  });

  it('counts errors for failed pages', async () => {
    const client = new TestClient(mockLogger);
    client.failPages.add(2);
    const result = await client.fetchPages(3);
    expect(result.errors).toBe(1);
  });
});
