import { describe, it, expect, vi } from 'vitest';
import { Logger } from '../Logger.js';

describe('Logger', () => {
  it('writes info to stderr', () => {
    const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const logger = new Logger();
    logger.info('hello');
    expect(write).toHaveBeenCalledWith('hello\n');
    write.mockRestore();
  });

  it('writes error with prefix', () => {
    const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const logger = new Logger();
    logger.error('oops');
    expect(write).toHaveBeenCalledWith('Error: oops\n');
    write.mockRestore();
  });
});
