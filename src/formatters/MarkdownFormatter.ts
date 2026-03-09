import { Article } from '../domain/article/Article.js';
import { BaseFormatter } from '../shared/formatter/BaseFormatter.js';

export class MarkdownFormatter extends BaseFormatter {
  format(articles: Article[]): string {
    if (articles.length === 0) return 'No articles found.';

    const header = '| # | Date | Title | Votes | Bookmarks | Comments | Time | Hubs | Tags |';
    const sep = '|---|------|-------|------:|----------:|---------:|-----:|------|------|';

    const rows = articles.map((a, i) => {
      const title = this.escapeCell(this.truncate(a.title, 60));
      const hubs = this.escapeCell(a.hubs.slice(0, 3).join(', '));
      const tags = this.escapeCell(a.tags.join(', '));
      const sign = a.votes > 0 ? '+' : '';
      return `| ${i + 1} | ${this.formatDate(a.date)} | [${title}](${a.url}) | ${sign}${a.votes} | ${a.bookmarks} | ${a.comments} | ${a.readingTime}m | ${hubs} | ${tags} |`;
    });

    return [header, sep, ...rows].join('\n');
  }
}
