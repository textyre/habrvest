import { IPage } from '../../infrastructure/browser/IPage.js';

export interface MediumArticleRaw {
  title: string;
  url: string;
  author: string;
  date: string;
  claps: string;
  description: string;
  isMember: boolean;
}

export class MediumPageParser {
  async parse(page: IPage): Promise<MediumArticleRaw[]> {
    return page.evaluate((): MediumArticleRaw[] => {
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
  }

  async scrollAndParse(page: IPage): Promise<MediumArticleRaw[]> {
    await page.waitForTimeout(2000);

    // Scroll to load all articles
    for (let i = 0; i < 10; i++) {
      const before = await page.evaluate(() => document.body.scrollHeight);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1500);
      const after = await page.evaluate(() => document.body.scrollHeight);
      if (after === before) break;
    }

    return this.parse(page);
  }
}
