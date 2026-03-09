import { describe, it, expect, beforeEach } from 'vitest';
import { BaseSorter } from '../BaseSorter.js';
import { Article } from '../../../domain/article/Article.js';

const makeArticle = (overrides: Partial<Article>): Article => ({
  date: '2024-01-01T00:00:00Z',
  title: 'Test',
  url: 'https://example.com',
  readingTime: 5,
  hubs: [],
  tags: [],
  votes: 0,
  votesPlus: 0,
  votesMinus: 0,
  bookmarks: 0,
  comments: 0,
  views: 0,
  ...overrides,
});

describe('BaseSorter', () => {
  let sorter: BaseSorter;
  beforeEach(() => { sorter = new BaseSorter(); });

  it('sorts by votes descending by default', () => {
    const articles = [makeArticle({ votes: 1 }), makeArticle({ votes: 10 }), makeArticle({ votes: 5 })];
    const result = sorter.sort(articles, 'votes', false);
    expect(result.map(a => a.votes)).toEqual([10, 5, 1]);
  });

  it('sorts by votes ascending', () => {
    const articles = [makeArticle({ votes: 10 }), makeArticle({ votes: 1 })];
    const result = sorter.sort(articles, 'votes', true);
    expect(result.map(a => a.votes)).toEqual([1, 10]);
  });

  it('sorts by bookmarks', () => {
    const articles = [makeArticle({ bookmarks: 3 }), makeArticle({ bookmarks: 10 })];
    const result = sorter.sort(articles, 'bookmarks', false);
    expect(result.map(a => a.bookmarks)).toEqual([10, 3]);
  });

  it('sorts by date', () => {
    const articles = [
      makeArticle({ date: '2024-01-01T00:00:00Z' }),
      makeArticle({ date: '2024-06-01T00:00:00Z' }),
    ];
    const result = sorter.sort(articles, 'date', false);
    expect(result[0].date).toBe('2024-06-01T00:00:00Z');
  });

  it('does not mutate original array', () => {
    const articles = [makeArticle({ votes: 5 }), makeArticle({ votes: 1 })];
    const original = [...articles];
    sorter.sort(articles, 'votes', false);
    expect(articles).toEqual(original);
  });
});
