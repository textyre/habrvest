import { IThrottler } from './types.js';

export class Throttler implements IThrottler {
  private lastRequestTime = 0;

  constructor(private readonly minIntervalMs: number) {}

  async acquire(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minIntervalMs) {
      await new Promise<void>((r) => setTimeout(r, this.minIntervalMs - elapsed));
    }
    this.lastRequestTime = Date.now();
  }
}
