import { Article, ISorter, SortField } from './types.js';

type Comparator = (a: Article, b: Article) => number;

const comparators: Record<SortField, Comparator> = {
  votes: (a, b) => a.votes - b.votes,
  bookmarks: (a, b) => a.bookmarks - b.bookmarks,
  comments: (a, b) => a.comments - b.comments,
  views: (a, b) => a.views - b.views,
  date: (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
};

export class ArticleSorter implements ISorter {
  sort(articles: Article[], field: SortField, ascending: boolean): Article[] {
    const compare = comparators[field];
    const sorted = [...articles].sort(compare);
    return ascending ? sorted : sorted.reverse();
  }
}
