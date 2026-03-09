#!/usr/bin/env node
import { Command } from 'commander';
import { THROTTLE_MS } from '../../infrastructure/config.js';
import { Logger } from '../../infrastructure/logger/Logger.js';
import { Throttler } from '../../infrastructure/http/Throttler.js';
import { HttpClient } from '../../infrastructure/http/HttpClient.js';
import { HabrSearchClient } from '../../sources/habr/HabrSearchClient.js';
import { HabrHubClient } from '../../sources/habr/HabrHubClient.js';
import { ArticleTransformer } from '../../shared/transformer/ArticleTransformer.js';
import { BaseSorter } from '../../shared/sorter/BaseSorter.js';
import { MarkdownFormatter } from '../../formatters/MarkdownFormatter.js';
import { JsonFormatter } from '../../formatters/JsonFormatter.js';
import { CsvFormatter } from '../../formatters/CsvFormatter.js';
import { FormatterRegistry } from '../../formatters/FormatterRegistry.js';
import { App } from '../../application/App.js';
import { createSearchCommand } from './commands/SearchCommand.js';
import { createHubCommand } from './commands/HubCommand.js';

const logger = new Logger();
const throttler = new Throttler(THROTTLE_MS);
const httpClient = new HttpClient(throttler, logger);
const searchClient = new HabrSearchClient(httpClient, logger);
const hubClient = new HabrHubClient(httpClient, logger);
const transformer = new ArticleTransformer();
const sorter = new BaseSorter();
const formatters = new FormatterRegistry({
  md: new MarkdownFormatter(),
  json: new JsonFormatter(),
  csv: new CsvFormatter(),
});
const app = new App(searchClient, hubClient, transformer, sorter, formatters, logger);

const program = new Command();
program.name('habrvest').description('CLI tool for searching Habr.com articles').version('1.0.0');
program.addCommand(createSearchCommand(app, logger), { isDefault: true });
program.addCommand(createHubCommand(app, logger));
program.parse();
