import { Article } from './Article.js';
import { SortField } from '../shared/SortField.js';

export interface ISorter {
  sort(articles: Article[], field: SortField, ascending: boolean): Article[];
}
