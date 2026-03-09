import { describe, it, expect, vi } from 'vitest';
import { MediumPageParser } from '../MediumPageParser.js';
import { IPage } from '../../../infrastructure/browser/IPage.js';

const makePage = (articles: any[]): IPage => ({
  goto: vi.fn(),
  evaluate: vi.fn().mockResolvedValue(articles),
  waitForTimeout: vi.fn().mockResolvedValue(undefined),
  close: vi.fn(),
});

describe('MediumPageParser', () => {
  const parser = new MediumPageParser();

  it('returns parsed articles from page', async () => {
    const page = makePage([
      { title: 'Test', url: 'https://medium.com/test', author: 'Alice', date: '2024-01-01', claps: '100', description: 'desc', isMember: false },
    ]);
    const result = await parser.parse(page);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Test');
    expect(result[0].claps).toBe('100');
  });

  it('returns empty array if no articles', async () => {
    const page = makePage([]);
    const result = await parser.parse(page);
    expect(result).toHaveLength(0);
  });
});
