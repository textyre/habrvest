import { BaseBrowserSourceClient } from '../BaseBrowserSourceClient.js';
import { BrowserFactory } from '../../infrastructure/browser/BrowserFactory.js';
import { ILogger } from '../../infrastructure/logger/ILogger.js';
import { FetchResult } from '../../domain/source/FetchResult.js';
import { CollectionAccumulator } from '../CollectionAccumulator.js';
import { MediumPageParser } from './MediumPageParser.js';
import { MediumArticleMapper } from './MediumArticleMapper.js';
import { PageResponse } from '../BaseSourceClient.js';

export class MediumClient extends BaseBrowserSourceClient {
  private tag = '';
  private year = 0;
  private month = 12;
  private startYear = 0;
  private readonly now = new Date();
  private mediumPage = 0;

  private readonly parser: MediumPageParser;
  private readonly mapper: MediumArticleMapper;

  constructor(
    browserFactory: BrowserFactory,
    cookiesPath: string,
    logger: ILogger,
    parser = new MediumPageParser(),
    mapper = new MediumArticleMapper(),
  ) {
    super(browserFactory, cookiesPath, logger);
    this.parser = parser;
    this.mapper = mapper;
  }

  async fetchTag(tag: string, startYear: number, endYear: number): Promise<FetchResult> {
    this.tag = tag;
    this.year = endYear;
    this.month = 12;
    this.startYear = startYear;
    this.mediumPage = 0;

    const acc = new CollectionAccumulator();
    let errors = 0;

    await this.withSession(async (page) => {
      while (this.hasMore()) {
        const url = `https://medium.com/tag/${this.tag}/archive/${this.year}/${this.month}`;
        this.logger.info(`Fetching ${this.year}/${String(this.month).padStart(2, '0')}...`);

        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
          const rawArticles = await this.parser.scrollAndParse(page);
          const publications: Record<string, any> = {};
          const ids: string[] = [];

          for (const raw of rawArticles) {
            const pub = this.mapper.toPublication(raw);
            publications[pub.id] = pub;
            ids.push(pub.id);
          }

          acc.add(ids, publications);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error(`${this.year}/${this.month} failed: ${msg}`);
          errors++;
        }

        this.advancePeriod();
        this.mediumPage++;
        await page.waitForTimeout(500);
      }
    });

    const totalMonths = (endYear - startYear + 1) * 12;
    return acc.toFetchResult(totalMonths, errors);
  }

  protected hasMore(): boolean {
    if (this.year > new Date().getFullYear()) return false;
    if (this.year < this.startYear) return false;
    return true;
  }

  // fetchNext не используется — MediumClient управляет итерацией через withSession
  protected async fetchNext(): Promise<PageResponse> {
    throw new Error('Use fetchTag() for MediumClient');
  }

  private advancePeriod(): void {
    this.month--;
    if (this.month < 1) {
      this.month = 12;
      this.year--;
    }
  }
}
