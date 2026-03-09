import { FetchResult } from '../domain/source/FetchResult.js';
import { Publication } from '../domain/source/Publication.js';
import { ILogger } from '../infrastructure/logger/ILogger.js';
import { MAX_PAGE } from '../infrastructure/config.js';

interface PageResponse {
  pagesCount: number;
  publicationIds: string[];
  publicationRefs: Record<string, Publication>;
}

export abstract class BaseSourceClient {
  constructor(protected readonly logger: ILogger) {}

  protected abstract fetchPage(page: number): Promise<PageResponse>;

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
