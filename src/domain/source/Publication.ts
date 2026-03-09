export interface Publication {
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
  hubs: Array<{ alias: string; title: string; type: string }>;
  tags: Array<{ titleHtml: string }>;
}
