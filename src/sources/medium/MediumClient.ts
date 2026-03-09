import { BaseSourceClient } from '../BaseSourceClient.js';
import { FetchResult } from '../../domain/source/FetchResult.js';

export class MediumClient extends BaseSourceClient {
  async search(_query: string, _maxPages: number): Promise<FetchResult> {
    throw new Error('MediumClient not yet implemented');
  }

  protected async fetchPage(_page: number): Promise<never> {
    throw new Error('MediumClient not yet implemented');
  }
}
