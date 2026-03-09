import { describe, it, expect } from 'vitest';
import { Throttler } from '../Throttler.js';

describe('Throttler', () => {
  it('allows immediate first request', async () => {
    const throttler = new Throttler(100);
    const start = Date.now();
    await throttler.acquire();
    expect(Date.now() - start).toBeLessThan(50);
  });

  it('delays second request within interval', async () => {
    const throttler = new Throttler(200);
    await throttler.acquire();
    const start = Date.now();
    await throttler.acquire();
    expect(Date.now() - start).toBeGreaterThanOrEqual(150);
  });
});
