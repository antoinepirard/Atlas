export type ItemType = 'url' | 'image' | 'note';

export interface MymindItem {
  id: string;
  type: ItemType;
  content: string;
  title: string | null;
  description: string | null;
  summary: string | null;
  image_url: string | null;
  tags: string[];
  embedding: number[] | null;
  created_at: string;
  updated_at: string;
}

export interface AddItemInput {
  content: string;
  type: ItemType;
  title?: string;
  description?: string;
  summary?: string;
  image_url?: string;
  tags: string[];
  embedding?: number[];
}

export interface SearchResult extends MymindItem {
  similarity?: number;
}

export interface VaultStatus {
  exists: boolean;
  unlocked: boolean;
  auto_lock_minutes: number;
  biometrics_available: boolean;
  biometrics_enabled: boolean;
}

export interface AIProcessResult {
  tags: string[];
  summary: string;
  embedding: number[];
}

export interface UrlMetadata {
  title: string | null;
  description: string | null;
  image: string | null;
}

/** Data from quick capture (global shortcut) */
export interface QuickCaptureData {
  app_name: string;
  is_browser: boolean;
  url: string | null;
  page_title: string | null;
  selected_text: string | null;
}

