import { describe, it, expect } from 'vitest';
import { CollectionAccumulator } from '../CollectionAccumulator.js';
import { Publication } from '../../domain/source/Publication.js';

const makePub = (id: string): Publication => ({ id } as Publication);

describe('CollectionAccumulator', () => {
  it('accumulates ids and publications', () => {
    const acc = new CollectionAccumulator();
    acc.add(['a', 'b'], { a: makePub('a'), b: makePub('b') });
    const result = acc.toFetchResult(2, 0);
    expect(result.ids).toEqual(['a', 'b']);
    expect(result.publications['a'].id).toBe('a');
  });

  it('deduplicates ids', () => {
    const acc = new CollectionAccumulator();
    acc.add(['a'], { a: makePub('a') });
    acc.add(['a', 'b'], { a: makePub('a'), b: makePub('b') });
    const result = acc.toFetchResult(2, 0);
    expect(result.ids).toEqual(['a', 'b']);
  });

  it('reports totalPages and errors', () => {
    const acc = new CollectionAccumulator();
    const result = acc.toFetchResult(5, 2);
    expect(result.totalPages).toBe(5);
    expect(result.errors).toBe(2);
  });
});
