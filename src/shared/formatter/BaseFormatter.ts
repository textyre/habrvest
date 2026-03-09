import { Article } from '../../domain/article/Article.js';
import { IFormatter } from '../../domain/article/IFormatter.js';

export abstract class BaseFormatter implements IFormatter {
  abstract format(articles: Article[]): string;

  protected escapeCell(str: string): string {
    return str.replace(/\|/g, '\\|').replace(/\n/g, ' ');
  }

  protected escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  protected truncate(str: string, max: number): string {
    return str.length > max ? str.slice(0, max - 1) + '…' : str;
  }

  protected formatDate(iso: string): string {
    return iso.slice(0, 10);
  }
}
