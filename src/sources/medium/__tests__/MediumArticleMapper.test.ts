import { describe, it, expect } from 'vitest';
import { MediumArticleMapper } from '../MediumArticleMapper.js';
import { MediumArticleRaw } from '../MediumPageParser.js';

const makeRaw = (overrides: Partial<MediumArticleRaw> = {}): MediumArticleRaw => ({
  title: 'Test Article',
  url: 'https://medium.com/@user/test-abc123',
  author: 'Alice',
  date: '2024-01-15T10:00:00Z',
  claps: '1.5K',
  description: 'A description',
  isMember: false,
  ...overrides,
});

describe('MediumArticleMapper', () => {
  const mapper = new MediumArticleMapper();

  it('maps claps string to score', () => {
    const pub = mapper.toPublication(makeRaw({ claps: '1.5K' }));
    expect(pub.statistics.score).toBe(1500);
  });

  it('maps M suffix', () => {
    const pub = mapper.toPublication(makeRaw({ claps: '2M' }));
    expect(pub.statistics.score).toBe(2_000_000);
  });

  it('maps empty claps to 0', () => {
    const pub = mapper.toPublication(makeRaw({ claps: '' }));
    expect(pub.statistics.score).toBe(0);
  });

  it('sets isMember as tag', () => {
    const pub = mapper.toPublication(makeRaw({ isMember: true }));
    expect(pub.tags[0].titleHtml).toBe('member-only');
  });

  it('sets author alias', () => {
    const pub = mapper.toPublication(makeRaw({ author: 'Bob' }));
    expect(pub.author.alias).toBe('Bob');
  });

  it('uses encoded url as id', () => {
    const raw = makeRaw({ url: 'https://medium.com/test' });
    const pub = mapper.toPublication(raw);
    expect(pub.id).toBe(encodeURIComponent(raw.url));
  });
});
