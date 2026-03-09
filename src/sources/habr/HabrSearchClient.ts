import { BaseSourceClient } from '../BaseSourceClient.js';
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

  constructor(
    private readonly http: IHttpClient,
    logger: ILogger,
  ) {
    super(logger);
  }

  async search(query: string, order: Order, maxPages: number): Promise<FetchResult> {
    this.query = query;
    this.order = order;
    this.logger.info(`Fetching search: "${query}"...`);
    return this.fetchPages(maxPages);
  }

  protected async fetchPage(page: number): Promise<HabrPageResponse> {
    const params = new URLSearchParams({
      query: this.query,
      target_type: 'posts',
      order: this.order,
      page: String(page),
      fl: 'ru',
      hl: 'ru',
    });
    return this.http.fetchJson<HabrPageResponse>(`${HABR_API_URL}?${params}`);
  }
}
