import { Article, IFormatter } from '../types.js';

export class MarkdownFormatter implements IFormatter {
  format(articles: Article[]): string {
    if (articles.length === 0) return 'No articles found.';

    const header = '| # | Date | Title | Votes | Bookmarks | Comments | Time | Hubs |';
    const sep = '|---|------|-------|------:|----------:|---------:|-----:|------|';

    const rows = articles.map((a, i) => {
      const title = this.escapeCell(this.truncate(a.title, 60));
      const hubs = this.escapeCell(a.hubs.slice(0, 3).join(', '));
      const sign = a.votes > 0 ? '+' : '';

      return `| ${i + 1} | ${this.formatDate(a.date)} | [${title}](${a.url}) | ${sign}${a.votes} | ${a.bookmarks} | ${a.comments} | ${a.readingTime}m | ${hubs} |`;
    });

    return [header, sep, ...rows].join('\n');
  }

  private formatDate(iso: string): string {
    return iso.slice(0, 10);
  }

  private truncate(str: string, max: number): string {
    return str.length > max ? str.slice(0, max - 1) + '…' : str;
  }

  private escapeCell(str: string): string {
    return str.replace(/\|/g, '\\|').replace(/\n/g, ' ');
  }
}
