import { Command } from 'commander';
import { THROTTLE_MS } from './config.js';
import { Logger } from './logger.js';
import { Throttler } from './throttler.js';
import { HttpClient } from './http-client.js';
import { HabrClient } from './habr-client.js';
import { ArticleTransformer } from './transformer.js';
import { ArticleSorter } from './sorter.js';
import { MarkdownFormatter } from './formatters/markdown.js';
import { JsonFormatter } from './formatters/json.js';
import { CsvFormatter } from './formatters/csv.js';
import { FormatterRegistry } from './formatters/registry.js';
import { App } from './app.js';
import { CliOptions, Order, SortField, OutputFormat } from './types.js';

// --- Composition Root: wire up all dependencies ---

const logger = new Logger();
const throttler = new Throttler(THROTTLE_MS);
const httpClient = new HttpClient(throttler, logger);
const searchClient = new HabrClient(httpClient, logger);
const transformer = new ArticleTransformer();
const sorter = new ArticleSorter();
const formatters = new FormatterRegistry({
  md: new MarkdownFormatter(),
  json: new JsonFormatter(),
  csv: new CsvFormatter(),
});
const app = new App(searchClient, transformer, sorter, formatters, logger);

// --- CLI ---

const program = new Command();

program
  .name('harvest')
  .description('CLI tool for searching Habr.com articles')
  .version('1.0.0')
  .argument('<query>', 'Search query. Use brackets for tag search: "[ansible]"')
  .option('-o, --order <order>', 'Server-side order: date, relevance, rating', 'relevance')
  .option('-s, --sort <field>', 'Client-side sort: votes, bookmarks, comments, date, views', 'votes')
  .option('--asc', 'Sort ascending (default: descending)', false)
  .option('-p, --pages <number>', 'Pages to fetch (0 = all)', '1')
  .option('-f, --format <format>', 'Output format: md, json, csv', 'md')
  .option('-n, --limit <number>', 'Max articles to display')
  .action(async (query: string, opts: Record<string, string | boolean>) => {
    const options: CliOptions = {
      order: opts.order as Order,
      sort: opts.sort as SortField,
      asc: opts.asc as boolean,
      pages: parseInt(opts.pages as string, 10),
      format: opts.format as OutputFormat,
      limit: opts.limit ? parseInt(opts.limit as string, 10) : undefined,
    };

    try {
      const output = await app.run(query, options);
      if (output) console.log(output);
    } catch (err) {
      logger.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

program.parse();
