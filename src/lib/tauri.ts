import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type {
  MymindItem,
  AddItemInput,
  VaultStatus,
  AIProcessResult,
  UrlMetadata,
  ItemType,
  MigrationResult,
  ItemsPage,
  SearchResponse,
  ReindexResult,
} from "../types";

// Vault commands
export async function getVaultStatus(): Promise<VaultStatus> {
  return invoke("get_vault_status");
}

export async function createVault(password: string): Promise<string[]> {
  return invoke("create_vault", { password });
}

export async function unlockVault(password: string): Promise<boolean> {
  return invoke("unlock_vault", { password });
}

export async function unlockWithPhrase(phrase: string[]): Promise<boolean> {
  return invoke("unlock_with_phrase", { phrase });
}

export async function lockVault(): Promise<void> {
  return invoke("lock_vault");
}

export async function setAutoLockMinutes(minutes: number): Promise<void> {
  return invoke("set_auto_lock_minutes", { minutes });
}

export async function resetVault(): Promise<void> {
  return invoke("reset_vault");
}

// Biometrics commands
export async function isBiometricsAvailable(): Promise<boolean> {
  return invoke("is_biometrics_available");
}

export async function isBiometricsEnabled(): Promise<boolean> {
  return invoke("is_biometrics_enabled");
}

export async function enableBiometrics(): Promise<void> {
  return invoke("enable_biometrics");
}

export async function disableBiometrics(): Promise<void> {
  return invoke("disable_biometrics");
}

export async function unlockWithBiometrics(): Promise<boolean> {
  return invoke("unlock_with_biometrics");
}

// Item commands
export async function getAllItems(): Promise<MymindItem[]> {
  return invoke("get_all_items");
}

export async function getItemsPage(
  page: number,
  limit?: number
): Promise<ItemsPage> {
  return invoke("get_items_page", { page, limit });
}

export async function addItem(input: AddItemInput): Promise<MymindItem> {
  return invoke("add_item", { input });
}

export async function updateItem(item: MymindItem): Promise<MymindItem> {
  return invoke("update_item", { item });
}

export async function deleteItem(id: string): Promise<boolean> {
  return invoke("delete_item", { id });
}

export async function getItemCount(): Promise<number> {
  return invoke("get_item_count");
}

// Image commands (external storage)
export async function getFullImage(id: string): Promise<string> {
  return invoke("get_full_image", { id });
}

export async function migrateImageToExternal(id: string): Promise<string> {
  return invoke("migrate_image_to_external", { id });
}

export async function migrateAllImages(): Promise<MigrationResult> {
  return invoke("migrate_all_images");
}

// AI commands
export async function saveApiKey(apiKey: string): Promise<void> {
  return invoke("save_api_key", { apiKey });
}

export async function hasApiKey(): Promise<boolean> {
  return invoke("has_api_key");
}

export async function processWithAI(
  content: string,
  itemType: ItemType,
  title?: string,
  description?: string
): Promise<AIProcessResult> {
  return invoke("process_with_ai", {
    content,
    itemType,
    title,
    description,
  });
}

export async function getSearchEmbedding(query: string): Promise<number[]> {
  return invoke("get_search_embedding", { query });
}

export interface TokenClassification {
  token: string;
  filter_kind: "date" | "type" | "color" | "tag" | null;
  confidence: number;
  resolved_value: string | null;
}

export async function classifySearchTokens(
  tokens: string[],
  existingTags: string[] = []
): Promise<TokenClassification[]> {
  return invoke("classify_search_tokens", { tokens, existingTags });
}

// Server-side search commands
export async function semanticSearch(
  queryEmbedding: number[],
  limit?: number
): Promise<SearchResponse> {
  return invoke("semantic_search", { queryEmbedding, limit });
}

export async function textSearch(
  query: string,
  limit?: number
): Promise<MymindItem[]> {
  return invoke("text_search", { query, limit });
}

export async function reindexAllEmbeddings(): Promise<ReindexResult> {
  return invoke("reindex_all_embeddings");
}

export async function rebuildFtsIndex(): Promise<ReindexResult> {
  return invoke("rebuild_fts_index");
}

export async function getAllTags(): Promise<string[]> {
  return invoke("get_all_tags");
}

export async function fetchUrlMetadata(url: string): Promise<UrlMetadata> {
  return invoke("fetch_url_metadata", { url });
}

// Settings commands
export async function getApiKeyMasked(): Promise<string | null> {
  return invoke("get_api_key_masked");
}

export async function getStoragePath(): Promise<string> {
  return invoke("get_storage_path");
}

export async function setStoragePath(newPath: string): Promise<void> {
  return invoke("set_storage_path", { newPath });
}

export async function pickStorageFolder(): Promise<string | null> {
  const result = await open({
    directory: true,
    multiple: false,
    title: "Choose storage location",
  });
  return result as string | null;
}

// Window controls
export async function startWindowDrag(): Promise<void> {
  await getCurrentWindow().startDragging();
}

export async function toggleMaximize(): Promise<void> {
  const window = getCurrentWindow();
  const isMaximized = await window.isMaximized();
  if (isMaximized) {
    await window.unmaximize();
  } else {
    await window.maximize();
  }
}

// Accessibility commands
export async function checkAccessibilityPermission(): Promise<boolean> {
  return invoke("check_accessibility_permission");
}

export async function requestAccessibilityPermission(): Promise<boolean> {
  return invoke("request_accessibility_permission");
}

export async function openAccessibilitySettings(): Promise<void> {
  return invoke("open_accessibility_settings");
}

// Context menu
export interface ContextMenuOptions {
  itemId: string;
  showOpenExternal: boolean;
  itemType: string;
}

export async function showItemContextMenu(
  options: ContextMenuOptions
): Promise<void> {
  return invoke("show_item_context_menu", {
    options: {
      item_id: options.itemId,
      show_open_external: options.showOpenExternal,
      item_type: options.itemType,
    },
  });
}
