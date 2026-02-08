import { Article, IFormatter } from '../types.js';

export class JsonFormatter implements IFormatter {
  format(articles: Article[]): string {
    return JSON.stringify(articles, null, 2);
  }
}
