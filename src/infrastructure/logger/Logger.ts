import { ILogger } from './ILogger.js';

export class Logger implements ILogger {
  info(msg: string): void {
    process.stderr.write(msg + '\n');
  }

  error(msg: string): void {
    process.stderr.write(`Error: ${msg}\n`);
  }

  progress(current: number, total: number): void {
    process.stderr.write(`  ${current}/${total}\n`);
  }
}
