import { Article } from '../domain/article/Article.js';
import { BaseFormatter } from '../shared/formatter/BaseFormatter.js';

const HEADERS = ['date', 'title', 'url', 'votes', 'votesPlus', 'votesMinus', 'bookmarks', 'comments', 'views', 'readingTime', 'hubs', 'tags'];

export class CsvFormatter extends BaseFormatter {
  format(articles: Article[]): string {
    const header = HEADERS.join(',');
    const rows = articles.map((a) =>
      [
        a.date.slice(0, 10),
        this.escapeCsv(a.title),
        a.url,
        a.votes,
        a.votesPlus,
        a.votesMinus,
        a.bookmarks,
        a.comments,
        a.views,
        a.readingTime,
        this.escapeCsv(a.hubs.join('; ')),
        this.escapeCsv(a.tags.join('; ')),
      ].join(','),
    );
    return [header, ...rows].join('\n');
  }
}
