import { Command } from 'commander';
import { chromium } from 'playwright';
import { ILogger } from '../../../infrastructure/logger/ILogger.js';
import { BrowserFactory } from '../../../infrastructure/browser/BrowserFactory.js';
import { MediumClient } from '../../../sources/medium/MediumClient.js';
import { MediumMarkdownFormatter } from '../../../formatters/MediumMarkdownFormatter.js';
import { ArticleTransformer } from '../../../shared/transformer/ArticleTransformer.js';
import { BaseSorter } from '../../../shared/sorter/BaseSorter.js';
import { MEDIUM_SESSION_FILE } from '../../../infrastructure/config.js';
import { createMediumLoginCommand } from './MediumLoginCommand.js';

export function createMediumCommand(logger: ILogger): Command {
  const medium = new Command('medium').description('Fetch articles from Medium');

  medium.addCommand(createMediumLoginCommand());

  medium
    .command('fetch')
    .description('Fetch Medium articles by tag')
    .argument('<tag>', 'Medium tag (e.g. "accessibility-testing")')
    .option('--from <year>', 'Start year', '2013')
    .option('--to <year>', 'End year', String(new Date().getFullYear()))
    .option('-n, --limit <number>', 'Max articles to display', '100')
    .action(async (tag: string, opts: Record<string, string>) => {
      try {
        const browserFactory = new BrowserFactory(chromium);
        const client = new MediumClient(browserFactory, MEDIUM_SESSION_FILE, logger);
        const transformer = new ArticleTransformer();
        const sorter = new BaseSorter();
        const formatter = new MediumMarkdownFormatter();

        const result = await client.fetchTag(tag, parseInt(opts.from, 10), parseInt(opts.to, 10));
        let articles = transformer.transform(result.publications, result.ids);
        articles = sorter.sort(articles, 'votes', false);
        if (opts.limit) articles = articles.slice(0, parseInt(opts.limit, 10));

        logger.info(`Found ${result.ids.length} articles`);
        const output = formatter.format(articles);
        if (output) console.log(output);
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  return medium;
}
