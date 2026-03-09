import { describe, it, expect } from 'vitest';
import { ArticleTransformer } from '../ArticleTransformer.js';
import { Publication } from '../../../domain/source/Publication.js';

const makePublication = (overrides: Partial<Publication> = {}): Publication => ({
  id: '123',
  timePublished: '2024-01-15T10:00:00Z',
  titleHtml: '<b>Hello &amp; World</b>',
  readingTime: 5,
  complexity: null,
  author: { alias: 'user', fullname: null },
  statistics: {
    commentsCount: 3,
    favoritesCount: 10,
    score: 42,
    votesCount: 50,
    votesCountPlus: 46,
    votesCountMinus: 4,
    readingCount: 1000,
  },
  hubs: [{ alias: 'web', title: 'Web', type: 'hub' }],
  tags: [{ titleHtml: '<i>tag1</i>' }],
  ...overrides,
});

describe('ArticleTransformer', () => {
  const transformer = new ArticleTransformer();

  it('strips HTML from title', () => {
    const [article] = transformer.transform({ '123': makePublication() }, ['123']);
    expect(article.title).toBe('Hello & World');
  });

  it('maps statistics correctly', () => {
    const [article] = transformer.transform({ '123': makePublication() }, ['123']);
    expect(article.votes).toBe(42);
    expect(article.bookmarks).toBe(10);
    expect(article.comments).toBe(3);
    expect(article.views).toBe(1000);
  });

  it('builds correct URL', () => {
    const [article] = transformer.transform({ '123': makePublication() }, ['123']);
    expect(article.url).toContain('/ru/articles/123/');
  });

  it('skips missing ids', () => {
    const result = transformer.transform({}, ['999']);
    expect(result).toHaveLength(0);
  });
});
