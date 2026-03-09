import { Article } from './Article.js';
import { Publication } from '../source/Publication.js';

export interface ITransformer {
  transform(publications: Record<string, Publication>, ids: string[]): Article[];
}
