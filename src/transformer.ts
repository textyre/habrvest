import he from 'he';
import { HABR_BASE_URL } from './config.js';
import { Article, HabrPublication, ITransformer } from './types.js';

export class ArticleTransformer implements ITransformer {
  transform(publications: Record<string, HabrPublication>, ids: string[]): Article[] {
    return ids
      .map((id) => publications[id])
      .filter(Boolean)
      .map((pub) => this.transformOne(pub));
  }

  private transformOne(pub: HabrPublication): Article {
    return {
      date: pub.timePublished,
      title: this.stripHtml(pub.titleHtml),
      url: `${HABR_BASE_URL}/ru/articles/${pub.id}/`,
      readingTime: pub.readingTime,
      hubs: pub.hubs.map((h) => h.title),
      tags: pub.tags.map((t) => this.stripHtml(t.titleHtml)),
      votes: pub.statistics.score,
      votesPlus: pub.statistics.votesCountPlus,
      votesMinus: pub.statistics.votesCountMinus,
      bookmarks: pub.statistics.favoritesCount,
      comments: pub.statistics.commentsCount,
      views: pub.statistics.readingCount,
    };
  }

  private stripHtml(html: string): string {
    return he.decode(html.replace(/<[^>]*>/g, ''));
  }
}
