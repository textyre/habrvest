#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { THROTTLE_MS } from './infrastructure/config.js';
import { Logger } from './infrastructure/logger/Logger.js';
import { Throttler } from './infrastructure/http/Throttler.js';
import { HttpClient } from './infrastructure/http/HttpClient.js';
import { HabrSearchClient } from './sources/habr/HabrSearchClient.js';
import { HabrHubClient } from './sources/habr/HabrHubClient.js';
import { ArticleTransformer } from './shared/transformer/ArticleTransformer.js';
import { BaseSorter } from './shared/sorter/BaseSorter.js';
import { MarkdownFormatter } from './formatters/MarkdownFormatter.js';
import { JsonFormatter } from './formatters/JsonFormatter.js';
import { CsvFormatter } from './formatters/CsvFormatter.js';
import { FormatterRegistry } from './formatters/FormatterRegistry.js';
import { App } from './application/App.js';
import { Order, SortField, OutputFormat, TopPeriod } from './domain/shared/index.js';

// --- Composition Root ---

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

// --- MCP Server ---

const server = new McpServer({
  name: 'habrvest',
  version: '1.0.0',
});

server.registerTool(
  'search_habr',
  {
    description: 'Search articles on Habr.com by query. Returns a markdown table with title, URL, date, votes, bookmarks, comments, reading time, hubs, and tags. Use this instead of WebFetch/WebSearch for Habr.',
    inputSchema: {
      query: z.string().describe('Search query. Use brackets for tag search, e.g. "[ansible]"'),
      order: z.enum(['date', 'relevance', 'rating']).default('relevance').describe('Server-side ordering'),
      sort: z.enum(['votes', 'bookmarks', 'comments', 'date', 'views']).default('votes').describe('Client-side sort field'),
      pages: z.number().int().min(0).default(1).describe('Number of pages to fetch (0 = all)'),
      limit: z.number().int().positive().optional().describe('Max articles to return'),
    },
  },
  async ({ query, order, sort, pages, limit }) => {
    const result = await app.search(query, {
      order: order as Order,
      sort: sort as SortField,
      asc: false,
      pages,
      format: 'md' as OutputFormat,
      limit,
    });
    return {
      content: [{ type: 'text', text: result || 'No articles found.' }],
    };
  },
);

server.registerTool(
  'fetch_habr_hub',
  {
    description: 'Fetch top articles from a Habr.com hub (topic/community). Returns a markdown table with title, URL, date, votes, bookmarks, comments, reading time, hubs, and tags. Use this instead of WebFetch/WebSearch for Habr hub pages.',
    inputSchema: {
      hub: z.string().describe('Hub alias (e.g. "python", "web_testing") or full Habr hub URL'),
      sort: z.enum(['votes', 'bookmarks', 'comments', 'date', 'views']).default('votes').describe('Client-side sort field'),
      pages: z.number().int().min(0).default(5).describe('Number of pages to fetch'),
      limit: z.number().int().positive().default(20).describe('Max articles to return'),
      period: z.enum(['daily', 'weekly', 'monthly', 'yearly', 'alltime']).default('alltime').describe('Top period'),
    },
  },
  async ({ hub, sort, pages, limit, period }) => {
    const result = await app.hub([hub], {
      sort: sort as SortField,
      asc: false,
      pages,
      format: 'md' as OutputFormat,
      limit,
      period: period as TopPeriod,
    });
    return {
      content: [{ type: 'text', text: result || 'No articles found in the specified hub.' }],
    };
  },
);

// --- Start ---

const transport = new StdioServerTransport();
await server.connect(transport);
