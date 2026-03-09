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
