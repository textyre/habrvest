import { FetchResult } from '../domain/source/FetchResult.js';
import { Publication } from '../domain/source/Publication.js';

export class CollectionAccumulator {
  private readonly seen = new Set<string>();
  private readonly ids: string[] = [];
  private readonly publications: Record<string, Publication> = {};

  add(newIds: string[], newPubs: Record<string, Publication>): void {
    for (const id of newIds) {
      if (!this.seen.has(id)) {
        this.seen.add(id);
        this.ids.push(id);
      }
    }
    Object.assign(this.publications, newPubs);
  }

  toFetchResult(totalPages: number, errors: number): FetchResult {
    return {
      ids: [...this.ids],
      publications: { ...this.publications },
      totalPages,
      errors,
    };
  }
}
