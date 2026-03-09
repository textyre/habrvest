import { Command } from 'commander';
import { App } from '../../../application/App.js';
import { ILogger } from '../../../infrastructure/logger/ILogger.js';
import { Order } from '../../../domain/shared/Order.js';
import { SortField } from '../../../domain/shared/SortField.js';
import { OutputFormat } from '../../../domain/shared/OutputFormat.js';

export function createSearchCommand(app: App, logger: ILogger): Command {
  return new Command('search')
    .description('Search articles by query')
    .argument('<query>', 'Search query. Use brackets for tag search: "[ansible]"')
    .option('-o, --order <order>', 'Server-side order: date, relevance, rating', 'relevance')
    .option('-s, --sort <field>', 'Client-side sort: votes, bookmarks, comments, date, views', 'votes')
    .option('--asc', 'Sort ascending (default: descending)', false)
    .option('-p, --pages <number>', 'Pages to fetch (0 = all)', '1')
    .option('-f, --format <format>', 'Output format: md, json, csv', 'md')
    .option('-n, --limit <number>', 'Max articles to display')
    .action(async (query: string, opts: Record<string, string | boolean>) => {
      try {
        const result = await app.search(query, {
          order: opts.order as Order,
          sort: opts.sort as SortField,
          asc: opts.asc as boolean,
          pages: parseInt(opts.pages as string, 10),
          format: opts.format as OutputFormat,
          limit: opts.limit ? parseInt(opts.limit as string, 10) : undefined,
        });
        if (result) console.log(result);
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}
