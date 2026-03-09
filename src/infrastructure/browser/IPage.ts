export interface IPage {
  goto(url: string, options?: { waitUntil?: string; timeout?: number }): Promise<void>;
  evaluate<T>(fn: () => T): Promise<T>;
  waitForTimeout(ms: number): Promise<void>;
  close(): Promise<void>;
}
