export interface IThrottler {
  acquire(): Promise<void>;
}
