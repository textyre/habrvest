import { Article } from '../domain/article/Article.js';
import { BaseFormatter } from '../shared/formatter/BaseFormatter.js';

export class MediumMarkdownFormatter extends BaseFormatter {
  format(articles: Article[]): string {
    if (articles.length === 0) return 'No articles found.';

    const header = '| # | Claps | Date | 💎 | Title | Author |';
    const sep = '|---|------:|------|-----|-------|--------|';

    const rows = articles.map((a, i) => {
      const title = this.escapeCell(this.truncate(a.title, 70));
      const isMember = a.tags.includes('member-only') ? '💎' : '';
      // author stored in hubs[0] — fallback to empty
      const author = this.escapeCell(a.hubs[0] ?? '');
      return `| ${i + 1} | ${a.votes} | ${this.formatDate(a.date)} | ${isMember} | [${title}](${a.url}) | ${author} |`;
    });

    return [header, sep, ...rows].join('\n');
  }
}
