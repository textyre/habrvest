export const HABR_API_URL = 'https://habr.com/kek/v2/articles/';
export const HABR_BASE_URL = 'https://habr.com';

// Rate limiting: min 500ms between requests, strictly sequential (parallel = IP ban)
export const THROTTLE_MS = 500;

// Retry
export const MAX_RETRIES = 2;
export const REQUEST_TIMEOUT_MS = 15_000;

// Habr API returns 500 on page >= 51
export const MAX_PAGE = 50;

// Cache
export const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
export const CACHE_DIR = `${process.env.HOME}/.cache/habrvest`;
