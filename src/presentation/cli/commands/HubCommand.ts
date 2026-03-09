import { Command } from 'commander';
import { App } from '../../../application/App.js';
import { ILogger } from '../../../infrastructure/logger/ILogger.js';
import { SortField } from '../../../domain/shared/SortField.js';
import { OutputFormat } from '../../../domain/shared/OutputFormat.js';
import { TopPeriod } from '../../../domain/shared/TopPeriod.js';

export function createHubCommand(app: App, logger: ILogger): Command {
  return new Command('hub')
    .description('Fetch articles from hub(s)')
    .argument('<aliases...>', 'Hub aliases or URLs')
    .option('-s, --sort <field>', 'Client-side sort: votes, bookmarks, comments, date, views', 'votes')
    .option('--asc', 'Sort ascending (default: descending)', false)
    .option('-p, --pages <number>', 'Pages to fetch (0 = all)', '5')
    .option('-f, --format <format>', 'Output format: md, json, csv', 'md')
    .option('-n, --limit <number>', 'Max articles to display', '100')
    .option('--period <period>', 'Top period: daily, weekly, monthly, yearly, alltime', 'alltime')
    .action(async (aliases: string[], opts: Record<string, string | boolean>) => {
      try {
        const result = await app.hub(aliases, {
          sort: opts.sort as SortField,
          asc: opts.asc as boolean,
          pages: parseInt(opts.pages as string, 10),
          format: opts.format as OutputFormat,
          limit: parseInt(opts.limit as string, 10),
          period: opts.period as TopPeriod,
        });
        if (result) console.log(result);
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}
