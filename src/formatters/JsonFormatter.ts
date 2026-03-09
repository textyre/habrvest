import { Article } from '../domain/article/Article.js';
import { BaseFormatter } from '../shared/formatter/BaseFormatter.js';

export class JsonFormatter extends BaseFormatter {
  format(articles: Article[]): string {
    return JSON.stringify(articles, null, 2);
  }
}
