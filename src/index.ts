#!/usr/bin/env node
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
import { HubClient } from './hub-client.js';
import { App } from './app.js';
import { CliOptions, Order, SortField, OutputFormat, TopPeriod } from './types.js';

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
const hubClient = new HubClient(httpClient, logger);
const app = new App(searchClient, transformer, sorter, formatters, logger);

// --- CLI ---

const program = new Command();

function parseOptions(opts: Record<string, string | boolean>): CliOptions {
  return {
    order: opts.order as Order,
    sort: opts.sort as SortField,
    asc: opts.asc as boolean,
    pages: parseInt(opts.pages as string, 10),
    format: opts.format as OutputFormat,
    limit: opts.limit ? parseInt(opts.limit as string, 10) : undefined,
  };
}

async function runAndPrint(output: Promise<string>) {
  try {
    const result = await output;
    if (result) console.log(result);
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

program
  .name('harvest')
  .description('CLI tool for searching Habr.com articles')
  .version('1.0.0');

// Default command: search
program
  .command('search', { isDefault: true })
  .description('Search articles by query')
  .argument('<query>', 'Search query. Use brackets for tag search: "[ansible]"')
  .option('-o, --order <order>', 'Server-side order: date, relevance, rating', 'relevance')
  .option('-s, --sort <field>', 'Client-side sort: votes, bookmarks, comments, date, views', 'votes')
  .option('--asc', 'Sort ascending (default: descending)', false)
  .option('-p, --pages <number>', 'Pages to fetch (0 = all)', '1')
  .option('-f, --format <format>', 'Output format: md, json, csv', 'md')
  .option('-n, --limit <number>', 'Max articles to display')
  .action(async (query: string, opts: Record<string, string | boolean>) => {
    const options = parseOptions(opts);
    await runAndPrint(app.run(query, options));
  });

// Hub command
program
  .command('hub')
  .description('Fetch articles from hub(s)')
  .argument('<aliases...>', 'Hub aliases or URLs (e.g. "web_testing" or full Habr hub URL)')
  .option('-s, --sort <field>', 'Client-side sort: votes, bookmarks, comments, date, views', 'votes')
  .option('--asc', 'Sort ascending (default: descending)', false)
  .option('-p, --pages <number>', 'Pages to fetch (0 = all)', '5')
  .option('-f, --format <format>', 'Output format: md, json, csv', 'md')
  .option('-n, --limit <number>', 'Max articles to display', '100')
  .option('--period <period>', 'Top period: daily, weekly, monthly, yearly, alltime', 'alltime')
  .action(async (aliases: string[], opts: Record<string, string | boolean>) => {
    const period = opts.period as TopPeriod;
    const pages = parseInt(opts.pages as string, 10);
    const sortField = opts.sort as SortField;
    const asc = opts.asc as boolean;
    const format = opts.format as OutputFormat;
    const limit = parseInt(opts.limit as string, 10);

    try {
      const { publications, ids, totalPages, errors } = await hubClient.fetch(aliases, pages, period);

      if (ids.length === 0) {
        logger.info('No articles found in the specified hub(s)');
        return;
      }

      let articles = transformer.transform(publications, ids);
      articles = sorter.sort(articles, sortField, asc);
      if (limit) articles = articles.slice(0, limit);

      let summary = `Found ${ids.length} articles (${totalPages} pages total)`;
      if (errors > 0) summary += ` [${errors} page(s) failed]`;
      logger.info(summary);

      const output = formatters.get(format).format(articles);
      if (output) console.log(output);
    } catch (err) {
      logger.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

program.parse();
