import he from 'he';
import { HABR_BASE_URL } from '../../infrastructure/config.js';
import { Article } from '../../domain/article/Article.js';
import { Publication } from '../../domain/source/Publication.js';
import { ITransformer } from '../../domain/article/ITransformer.js';

export class ArticleTransformer implements ITransformer {
  transform(publications: Record<string, Publication>, ids: string[]): Article[] {
    return ids
      .map((id) => publications[id])
      .filter(Boolean)
      .map((pub) => this.transformOne(pub));
  }

  private transformOne(pub: Publication): Article {
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
