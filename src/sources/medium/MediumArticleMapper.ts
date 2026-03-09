import { Publication } from '../../domain/source/Publication.js';
import { MediumArticleRaw } from './MediumPageParser.js';

export class MediumArticleMapper {
  toPublication(raw: MediumArticleRaw): Publication {
    const id = encodeURIComponent(raw.url);
    const claps = this.parseClaps(raw.claps);
    return {
      id,
      timePublished: raw.date,
      titleHtml: raw.title,
      readingTime: 0,
      complexity: null,
      author: { alias: raw.author, fullname: raw.author },
      statistics: {
        commentsCount: 0,
        favoritesCount: 0,
        score: claps,
        votesCount: claps,
        votesCountPlus: claps,
        votesCountMinus: 0,
        readingCount: 0,
      },
      hubs: [],
      tags: raw.isMember ? [{ titleHtml: 'member-only' }] : [],
    };
  }

  private parseClaps(claps: string): number {
    if (!claps) return 0;
    if (claps.endsWith('K')) return Math.round(parseFloat(claps) * 1000);
    if (claps.endsWith('M')) return Math.round(parseFloat(claps) * 1_000_000);
    return parseInt(claps, 10) || 0;
  }
}
