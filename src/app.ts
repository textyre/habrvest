import { FormatterRegistry } from './formatters/registry.js';
import { CliOptions, ILogger, ISearchClient, ISorter, ITransformer } from './types.js';

export class App {
  constructor(
    private readonly searchClient: ISearchClient,
    private readonly transformer: ITransformer,
    private readonly sorter: ISorter,
    private readonly formatters: FormatterRegistry,
    private readonly logger: ILogger,
  ) {}

  async run(query: string, options: CliOptions): Promise<string> {
    const { publications, ids, totalPages, errors } = await this.searchClient.search(
      query,
      options.order,
      options.pages,
    );

    if (ids.length === 0) {
      this.logger.info(`No articles found for "${query}"`);
      return '';
    }

    let articles = this.transformer.transform(publications, ids);
    articles = this.sorter.sort(articles, options.sort, options.asc);

    if (options.limit) {
      articles = articles.slice(0, options.limit);
    }

    let summary = `Found ${ids.length} articles (${totalPages} pages total)`;
    if (errors > 0) {
      summary += ` [${errors} page(s) failed]`;
    }
    this.logger.info(summary);

    const formatter = this.formatters.get(options.format);
    return formatter.format(articles);
  }
}
