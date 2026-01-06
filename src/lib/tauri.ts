import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type {
  MymindItem,
  AddItemInput,
  VaultStatus,
  AIProcessResult,
  UrlMetadata,
  ItemType,
} from '../types';

// Vault commands
export async function getVaultStatus(): Promise<VaultStatus> {
  return invoke('get_vault_status');
}

export async function createVault(password: string): Promise<string[]> {
  return invoke('create_vault', { password });
}

export async function unlockVault(password: string): Promise<boolean> {
  return invoke('unlock_vault', { password });
}

export async function unlockWithPhrase(phrase: string[]): Promise<boolean> {
  return invoke('unlock_with_phrase', { phrase });
}

export async function lockVault(): Promise<void> {
  return invoke('lock_vault');
}

export async function setAutoLockMinutes(minutes: number): Promise<void> {
  return invoke('set_auto_lock_minutes', { minutes });
}

export async function resetVault(): Promise<void> {
  return invoke('reset_vault');
}

// Item commands
export async function getAllItems(): Promise<MymindItem[]> {
  return invoke('get_all_items');
}

export async function addItem(input: AddItemInput): Promise<MymindItem> {
  return invoke('add_item', { input });
}

export async function updateItem(item: MymindItem): Promise<MymindItem> {
  return invoke('update_item', { item });
}

export async function deleteItem(id: string): Promise<boolean> {
  return invoke('delete_item', { id });
}

export async function getItemCount(): Promise<number> {
  return invoke('get_item_count');
}

// AI commands
export async function saveApiKey(apiKey: string): Promise<void> {
  return invoke('save_api_key', { apiKey });
}

export async function hasApiKey(): Promise<boolean> {
  return invoke('has_api_key');
}

export async function processWithAI(
  content: string,
  itemType: ItemType,
  title?: string,
  description?: string
): Promise<AIProcessResult> {
  return invoke('process_with_ai', {
    content,
    itemType,
    title,
    description,
  });
}

export async function getSearchEmbedding(query: string): Promise<number[]> {
  return invoke('get_search_embedding', { query });
}

export async function fetchUrlMetadata(url: string): Promise<UrlMetadata> {
  return invoke('fetch_url_metadata', { url });
}

// Settings commands
export async function getApiKeyMasked(): Promise<string | null> {
  return invoke('get_api_key_masked');
}

export async function getStoragePath(): Promise<string> {
  return invoke('get_storage_path');
}

export async function setStoragePath(newPath: string): Promise<void> {
  return invoke('set_storage_path', { newPath });
}

export async function pickStorageFolder(): Promise<string | null> {
  const result = await open({
    directory: true,
    multiple: false,
    title: 'Choose storage location',
  });
  return result as string | null;
}

// Window controls
export async function startWindowDrag(): Promise<void> {
  await getCurrentWindow().startDragging();
}

