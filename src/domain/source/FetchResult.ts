import { Publication } from './Publication.js';

export interface FetchResult {
  publications: Record<string, Publication>;
  ids: string[];
  totalPages: number;
  errors: number;
}
