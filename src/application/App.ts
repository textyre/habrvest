import { FormatterRegistry } from '../formatters/FormatterRegistry.js';
import { ILogger } from '../infrastructure/logger/ILogger.js';
import { ISorter } from '../domain/article/ISorter.js';
import { ITransformer } from '../domain/article/ITransformer.js';
import { HabrSearchClient } from '../sources/habr/HabrSearchClient.js';
import { HabrHubClient } from '../sources/habr/HabrHubClient.js';
import { Order } from '../domain/shared/Order.js';
import { SortField } from '../domain/shared/SortField.js';
import { OutputFormat } from '../domain/shared/OutputFormat.js';
import { TopPeriod } from '../domain/shared/TopPeriod.js';
import { FetchResult } from '../domain/source/FetchResult.js';

export interface SearchOptions {
  order: Order;
  sort: SortField;
  asc: boolean;
  pages: number;
  format: OutputFormat;
  limit?: number;
}

export interface HubOptions {
  sort: SortField;
  asc: boolean;
  pages: number;
  format: OutputFormat;
  limit?: number;
  period: TopPeriod;
}

export class App {
  constructor(
    private readonly searchClient: HabrSearchClient,
    private readonly hubClient: HabrHubClient,
    private readonly transformer: ITransformer,
    private readonly sorter: ISorter,
    private readonly formatters: FormatterRegistry,
    private readonly logger: ILogger,
  ) {}

  async search(query: string, options: SearchOptions): Promise<string> {
    const result = await this.searchClient.search(query, options.order, options.pages);

    if (result.ids.length === 0) {
      this.logger.info(`No articles found for "${query}"`);
      return '';
    }

    return this.processAndFormat(result, options);
  }

  async hub(aliases: string[], options: HubOptions): Promise<string> {
    const result = await this.hubClient.fetchHubs(aliases, options.pages, options.period);

    if (result.ids.length === 0) {
      this.logger.info('No articles found in the specified hub(s)');
      return '';
    }

    return this.processAndFormat(result, options);
  }

  private processAndFormat(
    result: FetchResult,
    options: { sort: SortField; asc: boolean; format: OutputFormat; limit?: number },
  ): string {
    let articles = this.transformer.transform(result.publications, result.ids);
    articles = this.sorter.sort(articles, options.sort, options.asc);
    if (options.limit) articles = articles.slice(0, options.limit);

    let summary = `Found ${result.ids.length} articles (${result.totalPages} pages total)`;
    if (result.errors > 0) summary += ` [${result.errors} page(s) failed]`;
    this.logger.info(summary);

    return this.formatters.get(options.format).format(articles);
  }
}
