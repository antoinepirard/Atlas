export type ItemType = "url" | "image" | "note";

export interface Item {
  id: string;
  type: ItemType;
  content: string;
  title: string | null;
  description: string | null;
  summary: string | null;
  image_url: string | null;
  source_url: string | null;
  tags: string[];
  embedding: number[] | null;
  created_at: string;
  updated_at: string;
  /** Flag indicating image is stored externally (not in DB) */
  image_external?: boolean;
  /** Dominant colors extracted from image (hex strings like "#ff5500") */
  colors?: string[];
  /** Extracted article content for reader mode */
  article_content?: string | null;
  /** Whether this URL is classified as a readable article */
  is_article?: boolean;
}

export interface MigrationResult {
  migrated: number;
  failed: number;
  skipped: number;
}

export interface ItemsPage {
  items: Item[];
  total: number;
  has_more: boolean;
}

export interface SearchResultItem {
  item: Item;
  similarity: number;
}

export interface SearchResponse {
  results: SearchResultItem[];
  total_searched: number;
}

export interface ReindexResult {
  indexed: number;
  skipped: number;
  failed: number;
}

export interface AddItemInput {
  content: string;
  type: ItemType;
  title?: string;
  description?: string;
  summary?: string;
  image_url?: string;
  source_url?: string;
  tags: string[];
  embedding?: number[];
  /** Extracted article content for reader mode */
  article_content?: string;
  /** Whether this URL is classified as a readable article */
  is_article?: boolean;
}

export interface SearchResult extends Item {
  similarity?: number;
}

export interface VaultStatus {
  exists: boolean;
  unlocked: boolean;
  name?: string | null;
  auto_lock_minutes: number;
  biometrics_available: boolean;
  biometrics_enabled: boolean;
}

export interface BackupSettings {
  enabled: boolean;
  path: string | null;
  last_backup_at: string | null;
}

export interface AiSettings {
  /** Monthly budget limit in USD (null = no limit) */
  monthly_budget_usd: number | null;
  /** Warning threshold as decimal (0.8 = warn at 80% of budget) */
  warning_threshold_percent: number;
}

export interface AiUsageDay {
  date: string;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  request_count: number;
  /** Estimated cost in USD for this day */
  total_cost_usd: number;
}

export interface AiBudgetStatus {
  month: string;
  spent_usd: number;
  budget_usd: number | null;
  warning_threshold_percent: number;
  should_warn: boolean;
  is_over_budget: boolean;
}

export interface AIProcessResult {
  tags: string[];
  summary: string;
  embedding: number[];
  title?: string;
  /** Whether the content is classified as a readable article */
  is_article?: boolean;
}

export interface UrlMetadata {
  title: string | null;
  description: string | null;
  image: string | null;
  author: string | null;
  /** Extracted article content for reader mode */
  article_content?: string | null;
}

/** Data from quick capture (global shortcut) */
export interface QuickCaptureData {
  app_name: string;
  is_browser: boolean;
  url: string | null;
  page_title: string | null;
  selected_text: string | null;
  /** HTML content from clipboard (for better formatting preservation) */
  html_content: string | null;
}

// Smart Search Types

/** Filter kind for parsed tokens */
export type FilterKind = "date" | "type" | "color" | "tag";

/** A single parsed token from the search query */
export interface ParsedToken {
  /** Original text of the token */
  text: string;
  /** Whether this token is a filter or plain text */
  type: "filter" | "text";
  /** The kind of filter if type is 'filter' */
  filterKind?: FilterKind;
  /** Confidence score (0-1), 1.0 for deterministic matches */
  confidence: number;
  /** The resolved/normalized value (e.g., hex color, date ISO string) */
  resolvedValue?: string;
}

/** Date range filter */
export interface DateRangeFilter {
  start: Date;
  end: Date;
  /** Human-readable label like "yesterday" or "last week" */
  label: string;
}

/** Parsed query with structured filters */
export interface ParsedQuery {
  /** All tokens with their classifications */
  tokens: ParsedToken[];
  /** Extracted filters */
  filters: {
    dateRange?: DateRangeFilter;
    types?: ItemType[];
    colors?: string[];
    tags?: string[];
  };
  /** Remaining text for semantic/text search */
  remainingText: string;
  /** Original raw query */
  rawQuery: string;
}
