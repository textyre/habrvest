import { Article } from './Article.js';

export interface IFormatter {
  format(articles: Article[]): string;
}
