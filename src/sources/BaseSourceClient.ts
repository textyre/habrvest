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
