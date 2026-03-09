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
