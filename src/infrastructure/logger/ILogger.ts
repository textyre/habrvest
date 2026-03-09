export interface ILogger {
  info(msg: string): void;
  error(msg: string): void;
  progress(current: number, total: number): void;
}
