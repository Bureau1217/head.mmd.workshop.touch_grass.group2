export interface WikipediaArticle {
  title: string;
  displayTitle: string;
  extract: string;
  thumbnailUrl: string | null;
  pageUrl: string;
  description?: string;
}

export interface WikipediaSearchResult {
  title: string;
  snippet?: string;
}
