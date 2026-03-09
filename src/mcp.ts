#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
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
import { Order, SortField, OutputFormat, TopPeriod } from './types.js';

// --- Composition Root ---

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
    const result = await app.run(query, {
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
    const { publications, ids, totalPages, errors } = await hubClient.fetch([hub], pages, period as TopPeriod);

    if (ids.length === 0) {
      return { content: [{ type: 'text', text: 'No articles found in the specified hub.' }] };
    }

    let articles = transformer.transform(publications, ids);
    articles = sorter.sort(articles, sort as SortField, false);
    articles = articles.slice(0, limit);

    let summary = `Found ${ids.length} articles (${totalPages} pages total)`;
    if (errors > 0) summary += ` [${errors} page(s) failed]`;

    const output = formatters.get('md').format(articles);
    return {
      content: [{ type: 'text', text: `${summary}\n\n${output}` }],
    };
  },
);

// --- Start ---

const transport = new StdioServerTransport();
await server.connect(transport);
