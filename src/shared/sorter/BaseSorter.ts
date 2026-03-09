import { Article } from '../../domain/article/Article.js';
import { ISorter } from '../../domain/article/ISorter.js';
import { SortField } from '../../domain/shared/SortField.js';

export class BaseSorter implements ISorter {
  sort(articles: Article[], field: SortField, ascending: boolean): Article[] {
    const sorted = [...articles].sort(this.comparatorFor(field));
    return ascending ? sorted : sorted.reverse();
  }

  protected byVotes(a: Article, b: Article): number {
    return a.votes - b.votes;
  }

  protected byBookmarks(a: Article, b: Article): number {
    return a.bookmarks - b.bookmarks;
  }

  protected byComments(a: Article, b: Article): number {
    return a.comments - b.comments;
  }

  protected byViews(a: Article, b: Article): number {
    return a.views - b.views;
  }

  protected byDate(a: Article, b: Article): number {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  }

  private comparatorFor(field: SortField): (a: Article, b: Article) => number {
    const map: Record<SortField, (a: Article, b: Article) => number> = {
      votes: this.byVotes.bind(this),
      bookmarks: this.byBookmarks.bind(this),
      comments: this.byComments.bind(this),
      views: this.byViews.bind(this),
      date: this.byDate.bind(this),
    };
    return map[field];
  }
}
