import { BaseSourceClient } from '../BaseSourceClient.js';
import { ILogger } from '../../infrastructure/logger/ILogger.js';
import { IHttpClient } from '../../infrastructure/http/IHttpClient.js';
import { HABR_API_URL } from '../../infrastructure/config.js';
import { FetchResult } from '../../domain/source/FetchResult.js';
import { TopPeriod } from '../../domain/shared/TopPeriod.js';

const HUB_URL_PATTERN = /habr\.com\/ru\/hubs\/([^/]+)/;

interface HabrPageResponse {
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

  protected async fetchPage(page: number): Promise<HabrPageResponse> {
    const params = new URLSearchParams({
      hub: this.currentAlias,
      sort: 'all',
      fl: 'ru',
      hl: 'ru',
      page: String(page),
    });
    if (this.currentTop) params.set('period', this.currentTop);
    return this.http.fetchJson<HabrPageResponse>(`${HABR_API_URL}?${params}`);
  }

  static parseAlias(input: string): string {
    const match = input.match(HUB_URL_PATTERN);
    return match ? match[1] : input;
  }
}
