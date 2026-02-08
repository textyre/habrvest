import { HABR_API_URL, MAX_PAGE } from './config.js';
import {
  FetchResult,
  HabrSearchResponse,
  IHttpClient,
  ILogger,
  ISearchClient,
  Order,
} from './types.js';

export class HabrClient implements ISearchClient {
  constructor(
    private readonly http: IHttpClient,
    private readonly logger: ILogger,
  ) {}

  async search(query: string, order: Order, maxPages: number): Promise<FetchResult> {
    const first = await this.fetchPage(query, order, 1);
    const totalPages = first.pagesCount;

    if (totalPages === 0) {
      return { publications: {}, ids: [], totalPages: 0, errors: 0 };
    }

    const allIds = [...first.publicationIds];
    const allPubs = { ...first.publicationRefs };

    let pagesToFetch = maxPages === 0 ? totalPages : Math.min(maxPages, totalPages);

    if (pagesToFetch > MAX_PAGE) {
      this.logger.info(`  Note: Habr limits search to ${MAX_PAGE} pages, capping from ${pagesToFetch}`);
      pagesToFetch = MAX_PAGE;
    }

    if (pagesToFetch <= 1) {
      return { publications: allPubs, ids: allIds, totalPages, errors: 0 };
    }

    this.logger.info(`Fetching ${pagesToFetch} pages...`);

    let errors = 0;

    // Strictly sequential — parallel requests trigger Habr anti-DDoS (503 + IP ban)
    for (let page = 2; page <= pagesToFetch; page++) {
      const result = await this.fetchPageSafe(query, order, page);

      if (result) {
        allIds.push(...result.publicationIds);
        Object.assign(allPubs, result.publicationRefs);
      } else {
        errors++;
      }

      this.logger.progress(page, pagesToFetch);
    }

    return { publications: allPubs, ids: allIds, totalPages, errors };
  }

  private async fetchPage(query: string, order: Order, page: number): Promise<HabrSearchResponse> {
    const params = new URLSearchParams({
      query,
      target_type: 'posts',
      order,
      page: String(page),
      fl: 'ru',
      hl: 'ru',
    });

    return this.http.fetchJson<HabrSearchResponse>(`${HABR_API_URL}?${params}`);
  }

  private async fetchPageSafe(query: string, order: Order, page: number): Promise<HabrSearchResponse | null> {
    try {
      return await this.fetchPage(query, order, page);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Page ${page} failed: ${msg}`);
      return null;
    }
  }
}
