import { describe, it, expect } from 'vitest';
import { MarkdownFormatter } from '../MarkdownFormatter.js';
import { Article } from '../../domain/article/Article.js';

const makeArticle = (): Article => ({
  date: '2024-01-15T10:00:00Z',
  title: 'My Article',
  url: 'https://habr.com/ru/articles/123/',
  readingTime: 5,
  hubs: ['Web'],
  tags: ['js'],
  votes: 42,
  votesPlus: 45,
  votesMinus: 3,
  bookmarks: 10,
  comments: 3,
  views: 1000,
});

describe('MarkdownFormatter', () => {
  const formatter = new MarkdownFormatter();

  it('returns "No articles found." for empty array', () => {
    expect(formatter.format([])).toBe('No articles found.');
  });

  it('includes header row', () => {
    const result = formatter.format([makeArticle()]);
    expect(result).toContain('| # | Date |');
  });

  it('formats article as table row', () => {
    const result = formatter.format([makeArticle()]);
    expect(result).toContain('My Article');
    expect(result).toContain('+42');
  });

  it('escapes pipe characters in title', () => {
    const article = makeArticle();
    article.title = 'A | B';
    const result = formatter.format([article]);
    expect(result).toContain('A \\| B');
  });
});
