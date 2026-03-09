import { FetchResult } from './FetchResult.js';

export interface ISourceClient {
  fetch(...args: unknown[]): Promise<FetchResult>;
}
