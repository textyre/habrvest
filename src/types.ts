// --- Habr API response types ---

export interface HabrSearchResponse {
  pagesCount: number;
  publicationIds: string[];
  publicationRefs: Record<string, HabrPublication>;
}

export interface HabrPublication {
  id: string;
  timePublished: string;
  titleHtml: string;
  readingTime: number;
  complexity: string | null;
  author: {
    alias: string;
    fullname: string | null;
  };
  statistics: {
    commentsCount: number;
    favoritesCount: number;
    score: number;
    votesCount: number;
    votesCountPlus: number;
    votesCountMinus: number;
    readingCount: number;
  };
  hubs: Array<{
    alias: string;
    title: string;
    type: string;
  }>;
  tags: Array<{
    titleHtml: string;
  }>;
}

// --- Normalized article type ---

export interface Article {
  date: string;
  title: string;
  url: string;
  readingTime: number;
  hubs: string[];
  tags: string[];
  votes: number;
  votesPlus: number;
  votesMinus: number;
  bookmarks: number;
  comments: number;
  views: number;
}

// --- CLI types ---

export type Order = 'date' | 'relevance' | 'rating';
export type SortField = 'votes' | 'bookmarks' | 'comments' | 'date' | 'views';
export type OutputFormat = 'md' | 'json' | 'csv';

export interface CliOptions {
  order: Order;
  sort: SortField;
  asc: boolean;
  pages: number;
  format: OutputFormat;
  limit?: number;
}

// --- Search result ---

export interface FetchResult {
  publications: HabrSearchResponse['publicationRefs'];
  ids: string[];
  totalPages: number;
  errors: number;
}

// --- Abstractions ---

export interface ILogger {
  info(msg: string): void;
  error(msg: string): void;
  progress(current: number, total: number): void;
}

export interface IThrottler {
  acquire(): Promise<void>;
}

export interface IHttpClient {
  fetchJson<T>(url: string): Promise<T>;
}

export interface ISearchClient {
  search(query: string, order: Order, maxPages: number): Promise<FetchResult>;
}

export type TopPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'alltime';

export interface IHubClient {
  fetch(hubs: string[], maxPages: number, top?: TopPeriod): Promise<FetchResult>;
}

export interface ITransformer {
  transform(publications: Record<string, HabrPublication>, ids: string[]): Article[];
}

export interface ISorter {
  sort(articles: Article[], field: SortField, ascending: boolean): Article[];
}

export interface IFormatter {
  format(articles: Article[]): string;
}
