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
