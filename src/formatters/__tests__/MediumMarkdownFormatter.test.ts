import { describe, it, expect } from 'vitest';
import { MediumMarkdownFormatter } from '../MediumMarkdownFormatter.js';
import { Article } from '../../domain/article/Article.js';

const makeArticle = (overrides: Partial<Article> = {}): Article => ({
  date: '2024-01-15T10:00:00Z',
  title: 'Test Article',
  url: 'https://medium.com/test',
  readingTime: 0,
  hubs: [],
  tags: [],
  votes: 1500,
  votesPlus: 1500,
  votesMinus: 0,
  bookmarks: 0,
  comments: 0,
  views: 0,
  ...overrides,
});

describe('MediumMarkdownFormatter', () => {
  const formatter = new MediumMarkdownFormatter();

  it('returns "No articles found." for empty array', () => {
    expect(formatter.format([])).toBe('No articles found.');
  });

  it('includes Claps column header', () => {
    const result = formatter.format([makeArticle()]);
    expect(result).toContain('Claps');
  });

  it('shows member-only marker for member articles', () => {
    const result = formatter.format([makeArticle({ tags: ['member-only'] })]);
    expect(result).toContain('💎');
  });

  it('formats votes as claps', () => {
    const result = formatter.format([makeArticle({ votes: 1500 })]);
    expect(result).toContain('1500');
  });
});
