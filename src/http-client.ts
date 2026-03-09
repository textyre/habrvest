import { MAX_RETRIES, REQUEST_TIMEOUT_MS } from './config.js';
import { FileCache } from './cache.js';
import { IHttpClient, ILogger, IThrottler } from './types.js';

export class HttpClient implements IHttpClient {
  private readonly cache = new FileCache();

  constructor(
    private readonly throttler: IThrottler,
    private readonly logger: ILogger,
  ) {}

  async fetchJson<T>(url: string): Promise<T> {
    const cached = await this.cache.get<T>(url);
    if (cached) {
      this.logger.info(`[cache hit]`);
      return cached;
    }

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      await this.throttler.acquire();

      const res = await this.tryFetch(url, attempt);
      if (!res) continue;

      this.validateContentType(res);

      const data = await this.parseJson<T>(res, url);
      await this.cache.set(url, data);
      return data;
    }

    throw new Error('Max retries exceeded');
  }

  private async tryFetch(url: string, attempt: number): Promise<Response | null> {
    let res: Response;

    try {
      res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; harvest/1.0)',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      return this.handleNetworkError(err, attempt);
    }

    if (res.status === 429) {
      await this.handleRateLimit(res);
      return null;
    }

    // Habr anti-DDoS: 503 = IP temporarily blocked, need longer backoff
    if (res.status === 503) {
      await this.handleAntiDdos(attempt);
      return null;
    }

    if (!res.ok) {
      return this.handleHttpError(res, attempt);
    }

    return res;
  }

  private async handleNetworkError(err: unknown, attempt: number): Promise<null> {
    if (attempt < MAX_RETRIES) {
      const delay = 1000 * (attempt + 1);
      this.logger.info(`  Network error (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${delay / 1000}s...`);
      await this.sleep(delay);
      return null;
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Network error after ${MAX_RETRIES + 1} attempts: ${msg}`);
  }

  private async handleRateLimit(res: Response): Promise<void> {
    const wait = parseInt(res.headers.get('Retry-After') ?? '10', 10) * 1000;
    this.logger.info(`  Rate limited, waiting ${wait / 1000}s...`);
    await this.sleep(wait);
  }

  private async handleAntiDdos(attempt: number): Promise<null> {
    const delay = 5000 * (attempt + 1); // 5s, 10s, 15s — longer backoff for IP block
    this.logger.info(`  Anti-DDoS 503 (attempt ${attempt + 1}/${MAX_RETRIES + 1}), waiting ${delay / 1000}s...`);
    await this.sleep(delay);
    return null;
  }

  private async handleHttpError(res: Response, attempt: number): Promise<null> {
    if (attempt < MAX_RETRIES) {
      const delay = 1000 * (attempt + 1);
      this.logger.info(`  HTTP ${res.status} (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${delay / 1000}s...`);
      await this.sleep(delay);
      return null;
    }
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  private validateContentType(res: Response): void {
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('json')) {
      throw new Error(
        'Server returned a non-JSON response (possible captcha). Try again later or reduce request rate.',
      );
    }
  }

  private async parseJson<T>(res: Response, url: string): Promise<T> {
    try {
      return await res.json() as T;
    } catch {
      throw new Error(`Failed to parse JSON from ${url}`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
