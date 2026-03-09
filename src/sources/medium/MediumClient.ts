import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BaseSourceClient } from '../BaseSourceClient.js';
import { FetchResult } from '../../domain/source/FetchResult.js';
import { Publication } from '../../domain/source/Publication.js';
import { ILogger } from '../../infrastructure/logger/ILogger.js';

const SESSION_FILE = join(process.env.HOME!, '.cache', 'medium-scraper', 'session.json');

interface MediumArticleRaw {
  title: string;
  url: string;
  author: string;
  date: string;
  claps: string;
  description: string;
  isMember: boolean;
}

export class MediumClient extends BaseSourceClient {
  constructor(logger: ILogger) {
    super(logger);
  }

  // Medium пагинируется по year/month — переопределяем fetchPages напрямую
  async fetchTag(tag: string, startYear: number, endYear: number): Promise<FetchResult> {
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    const context = browser.contexts()[0] ?? await browser.newContext();

    const cookies = JSON.parse(readFileSync(SESSION_FILE, 'utf-8'));
    await context.addCookies(cookies);
    this.logger.info(`Loaded ${cookies.length} session cookies`);

    const page = await context.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });

    const seen = new Set<string>();
    const rawArticles: MediumArticleRaw[] = [];
    const now = new Date();
    let totalPages = 0;
    let errors = 0;

    for (let year = endYear; year >= startYear; year--) {
      for (let month = 12; month >= 1; month--) {
        if (year === now.getFullYear() && month > now.getMonth() + 1) continue;

        const url = `https://medium.com/tag/${tag}/archive/${year}/${month}`;
        this.logger.info(`Fetching ${year}/${month}...`);
        totalPages++;

        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
          await page.waitForTimeout(2000);

          // Scroll to load all articles
          let prevHeight = 0;
          for (let i = 0; i < 10; i++) {
            const height = await page.evaluate(() => document.body.scrollHeight);
            if (height === prevHeight) break;
            prevHeight = height;
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(1500);
          }

          const articles = await page.evaluate((): MediumArticleRaw[] => {
            const cards = document.querySelectorAll('[data-testid="post-preview"]');
            return Array.from(cards).map((card) => {
              const linkEl = card.querySelector('[data-href]');
              const url = (linkEl?.getAttribute('data-href') ?? '').split('?')[0];
              const title = card.querySelector('h2')?.textContent?.trim() ?? '';
              const authorLinks = card.querySelectorAll('a[rel="noopener follow"] p');
              const author = authorLinks[authorLinks.length - 1]?.textContent?.trim() ?? '';
              const timeEl = card.querySelector('time');
              const date = timeEl?.getAttribute('datetime') ?? timeEl?.textContent?.trim() ?? '';
              const description = card.querySelector('h3, h4')?.textContent?.trim() ?? '';
              const allSpans = Array.from(card.querySelectorAll('p, span'));
              const clapsEl = allSpans.find((s) => /^\d[\d,.]*[KM]?$/.test(s.textContent?.trim() ?? ''));
              const claps = clapsEl?.textContent?.trim() ?? '';
              const isMember = card.innerHTML.includes('Member-only') || card.innerHTML.includes('member-only');
              return { title, url, author, date, claps, description, isMember };
            }).filter((a) => Boolean(a.title && a.url));
          });

          for (const a of articles) {
            if (a.url && !seen.has(a.url)) {
              seen.add(a.url);
              rawArticles.push(a);
            }
          }

          await page.waitForTimeout(500);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error(`${year}/${month} failed: ${msg}`);
          errors++;
        }
      }
    }

    await page.close();
    await browser.close();

    return this.toFetchResult(rawArticles, totalPages, errors);
  }

  private toFetchResult(articles: MediumArticleRaw[], totalPages: number, errors: number): FetchResult {
    const publications: Record<string, Publication> = {};
    const ids: string[] = [];

    for (const a of articles) {
      const id = encodeURIComponent(a.url);
      ids.push(id);
      publications[id] = this.toPublication(id, a);
    }

    return { publications, ids, totalPages, errors };
  }

  private toPublication(id: string, a: MediumArticleRaw): Publication {
    return {
      id,
      timePublished: a.date,
      titleHtml: a.title,
      readingTime: 0,
      complexity: null,
      author: { alias: a.author, fullname: a.author },
      statistics: {
        commentsCount: 0,
        favoritesCount: 0,
        score: this.parseClaps(a.claps),
        votesCount: this.parseClaps(a.claps),
        votesCountPlus: this.parseClaps(a.claps),
        votesCountMinus: 0,
        readingCount: 0,
      },
      hubs: [],
      tags: a.isMember ? [{ titleHtml: 'member-only' }] : [],
    };
  }

  private parseClaps(claps: string): number {
    if (!claps) return 0;
    if (claps.endsWith('K')) return Math.round(parseFloat(claps) * 1000);
    if (claps.endsWith('M')) return Math.round(parseFloat(claps) * 1_000_000);
    return parseInt(claps, 10) || 0;
  }

  // BaseSourceClient требует реализации fetchPage — не используется в MediumClient
  protected async fetchPage(_page: number): Promise<never> {
    throw new Error('Use fetchTag() instead of fetchPage() for MediumClient');
  }
}
