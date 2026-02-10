import { HABR_API_URL, MAX_PAGE } from './config.js';
import { FetchResult, HabrSearchResponse, IHttpClient, IHubClient, ILogger, TopPeriod } from './types.js';

const HUB_URL_PATTERN = /habr\.com\/ru\/hubs\/([^/]+)/;

export class HubClient implements IHubClient {
  constructor(
    private readonly http: IHttpClient,
    private readonly logger: ILogger,
  ) {}

  async fetch(hubs: string[], maxPages: number, top?: TopPeriod): Promise<FetchResult> {
    const aliases = hubs.map(HubClient.parseAlias);

    const allIds: string[] = [];
    const allPubs: FetchResult['publications'] = {};
    let totalPages = 0;
    let errors = 0;
    const seen = new Set<string>();

    for (const alias of aliases) {
      const label = top ? `Fetching hub: ${alias} (top/${top})` : `Fetching hub: ${alias}`;
      this.logger.info(label);
      const result = await this.fetchHub(alias, maxPages, top);
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

  private async fetchHub(alias: string, maxPages: number, top?: TopPeriod): Promise<FetchResult> {
    const first = await this.fetchPage(alias, 1, top);
    const totalPages = first.pagesCount;

    if (totalPages === 0) {
      return { publications: {}, ids: [], totalPages: 0, errors: 0 };
    }

    const allIds = [...first.publicationIds];
    const allPubs = { ...first.publicationRefs };

    let pagesToFetch = maxPages === 0 ? totalPages : Math.min(maxPages, totalPages);

    if (pagesToFetch > MAX_PAGE) {
      this.logger.info(`  Note: Habr limits to ${MAX_PAGE} pages, capping from ${pagesToFetch}`);
      pagesToFetch = MAX_PAGE;
    }

    if (pagesToFetch <= 1) {
      return { publications: allPubs, ids: allIds, totalPages, errors: 0 };
    }

    this.logger.info(`  ${pagesToFetch} pages to fetch...`);

    let errors = 0;

    // Strictly sequential — parallel requests trigger Habr anti-DDoS (503 + IP ban)
    for (let page = 2; page <= pagesToFetch; page++) {
      const result = await this.fetchPageSafe(alias, page, top);

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

  private async fetchPage(alias: string, page: number, top?: TopPeriod): Promise<HabrSearchResponse> {
    const params = new URLSearchParams({
      hub: alias,
      sort: 'all',
      fl: 'ru',
      hl: 'ru',
      page: String(page),
    });

    if (top) {
      params.set('period', top);
    }

    return this.http.fetchJson<HabrSearchResponse>(`${HABR_API_URL}?${params}`);
  }

  private async fetchPageSafe(alias: string, page: number, top?: TopPeriod): Promise<HabrSearchResponse | null> {
    try {
      return await this.fetchPage(alias, page, top);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Page ${page} failed: ${msg}`);
      return null;
    }
  }

  static parseAlias(input: string): string {
    const match = input.match(HUB_URL_PATTERN);
    return match ? match[1] : input;
  }
}
