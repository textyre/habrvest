import { Article, IFormatter } from '../types.js';

const HEADERS = ['date', 'title', 'url', 'votes', 'votesPlus', 'votesMinus', 'bookmarks', 'comments', 'views', 'readingTime', 'hubs', 'tags'];

export class CsvFormatter implements IFormatter {
  format(articles: Article[]): string {
    const header = HEADERS.join(',');

    const rows = articles.map((a) =>
      [
        a.date.slice(0, 10),
        this.escape(a.title),
        a.url,
        a.votes,
        a.votesPlus,
        a.votesMinus,
        a.bookmarks,
        a.comments,
        a.views,
        a.readingTime,
        this.escape(a.hubs.join('; ')),
        this.escape(a.tags.join('; ')),
      ].join(','),
    );

    return [header, ...rows].join('\n');
  }

  private escape(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
