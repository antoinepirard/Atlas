use crate::commands::vault::VaultState;
use crate::crypto;
use crate::db::{EncryptedItem, FtsEntry};
use crate::images;
use serde::{Deserialize, Serialize};
use tauri::State;

/// Item type
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ItemType {
    Url,
    Image,
    Note,
}

/// Decrypted item structure (matches frontend types)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MymindItem {
    pub id: String,
    #[serde(rename = "type")]
    pub item_type: ItemType,
    pub content: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub summary: Option<String>,
    pub image_url: Option<String>,
    pub source_url: Option<String>,
    pub tags: Vec<String>,
    pub embedding: Option<Vec<f32>>,
    pub created_at: String,
    pub updated_at: String,
    /// Flag indicating image is stored externally (not in DB)
    #[serde(default)]
    pub image_external: bool,
}

/// Input for adding new content
#[derive(Debug, Deserialize)]
pub struct AddItemInput {
    pub content: String,
    #[serde(rename = "type")]
    pub item_type: ItemType,
    pub title: Option<String>,
    pub description: Option<String>,
    pub summary: Option<String>,
    pub image_url: Option<String>,
    pub source_url: Option<String>,
    pub tags: Vec<String>,
    pub embedding: Option<Vec<f32>>,
}

/// Check if a string is a base64 data URL
fn is_data_url(s: &str) -> bool {
    s.starts_with("data:image/")
}

/// Get all items (decrypted)
/// For images with external storage, returns thumbnails instead of full images
#[tauri::command]
pub fn get_all_items(state: State<VaultState>) -> Result<Vec<MymindItem>, String> {
    let key = state.get_key().ok_or("Vault is locked")?;

    let encrypted_items = state.db.get_all_items().map_err(|e| e.to_string())?;

    let mut items = Vec::new();
    for encrypted in encrypted_items {
        match crypto::decrypt(&encrypted.encrypted_data, &key) {
            Ok(json) => {
                if let Ok(mut item) = serde_json::from_str::<MymindItem>(&json) {
                    // For image items with external storage, load thumbnail
                    if item.item_type == ItemType::Image && item.image_external {
                        // Load thumbnail from external storage
                        match images::load_thumbnail(&item.id, &key) {
                            Ok(thumbnail_url) => {
                                item.image_url = Some(thumbnail_url.clone());
                                // Don't send full content, just a reference
                                item.content = format!("external:{}", item.id);
                            }
                            Err(e) => {
                                eprintln!("Failed to load thumbnail for {}: {}", item.id, e);
                                // Keep original data if thumbnail load fails
                            }
                        }
                    }
                    // Don't send embeddings to frontend (saves bandwidth)
                    // Frontend will request them only for search
                    item.embedding = None;
                    items.push(item);
                }
            }
            Err(e) => {
                eprintln!("Failed to decrypt item {}: {}", encrypted.id, e);
            }
        }
    }

    Ok(items)
}

/// Add a new item
/// For image items, stores the image externally and returns thumbnail
#[tauri::command]
pub fn add_item(input: AddItemInput, state: State<VaultState>) -> Result<MymindItem, String> {
    let key = state.get_key().ok_or("Vault is locked")?;

    let now = chrono::Utc::now().to_rfc3339();
    let id = format!(
        "item-{}-{}",
        chrono::Utc::now().timestamp_millis(),
        &uuid::Uuid::new_v4().to_string()[..8]
    );

    let mut item = MymindItem {
        id: id.clone(),
        item_type: input.item_type.clone(),
        content: input.content.clone(),
        title: input.title,
        description: input.description,
        summary: input.summary,
        image_url: input.image_url.clone(),
        source_url: input.source_url,
        tags: input.tags,
        embedding: input.embedding,
        created_at: now.clone(),
        updated_at: now.clone(),
        image_external: false,
    };

    // For image items with data URL content, store externally
    if input.item_type == ItemType::Image && is_data_url(&input.content) {
        // Store image externally, get thumbnail back
        let thumbnail_url = images::store_image(&id, &input.content, &key)?;

        // Update item to reference external storage
        item.image_external = true;
        item.content = format!("external:{}", id);
        item.image_url = Some(thumbnail_url);
    }

    // Save embedding to separate table for server-side search
    if let Some(ref embedding) = item.embedding {
        if !embedding.is_empty() {
            state.db.save_embedding(&item.id, embedding).ok();
        }
    }

    // Encrypt and save (without embedding in the main encrypted data)
    let mut storage_item = item.clone();
    storage_item.embedding = None; // Don't store embedding in encrypted JSON
    
    let json = serde_json::to_string(&storage_item).map_err(|e| e.to_string())?;
    let encrypted_data = crypto::encrypt(&json, &key).map_err(|e| e.to_string())?;

    let encrypted_item = EncryptedItem {
        id,
        encrypted_data,
        created_at: now.clone(),
        updated_at: now,
    };

    state
        .db
        .save_item(&encrypted_item)
        .map_err(|e| e.to_string())?;

    // Index in FTS for fast text search
    let fts_entry = FtsEntry {
        item_id: storage_item.id.clone(),
        title: storage_item.title.clone().unwrap_or_default(),
        description: storage_item.description.clone().unwrap_or_default(),
        summary: storage_item.summary.clone().unwrap_or_default(),
        tags: storage_item.tags.join(" "),
    };
    state.db.index_fts(&fts_entry).ok();

    // Return item without embedding (frontend doesn't need it)
    Ok(storage_item)
}

/// Update an existing item
#[tauri::command]
pub fn update_item(item: MymindItem, state: State<VaultState>) -> Result<MymindItem, String> {
    let key = state.get_key().ok_or("Vault is locked")?;

    let now = chrono::Utc::now().to_rfc3339();
    let mut updated_item = item;
    updated_item.updated_at = now.clone();

    // Encrypt and save
    let json = serde_json::to_string(&updated_item).map_err(|e| e.to_string())?;
    let encrypted_data = crypto::encrypt(&json, &key).map_err(|e| e.to_string())?;

    let encrypted_item = EncryptedItem {
        id: updated_item.id.clone(),
        encrypted_data,
        created_at: updated_item.created_at.clone(),
        updated_at: now,
    };

    state
        .db
        .save_item(&encrypted_item)
        .map_err(|e| e.to_string())?;

    // Don't return embedding to frontend
    updated_item.embedding = None;
    Ok(updated_item)
}

/// Delete an item
#[tauri::command]
pub fn delete_item(id: String, state: State<VaultState>) -> Result<bool, String> {
    // Don't need the key to delete, just check we're unlocked
    if !state.is_unlocked() {
        return Err("Vault is locked".to_string());
    }

    // Delete external image files if they exist
    let _ = images::delete_image_files(&id);
    
    // Delete embedding from search index
    let _ = state.db.delete_embedding(&id);
    
    // Delete from FTS index
    let _ = state.db.delete_fts(&id);

    state.db.delete_item(&id).map_err(|e| e.to_string())
}

/// Get item count
#[tauri::command]
pub fn get_item_count(state: State<VaultState>) -> Result<i64, String> {
    state.db.get_item_count().map_err(|e| e.to_string())
}

/// Get full image for an item (loads from external storage)
#[tauri::command]
pub fn get_full_image(id: String, state: State<VaultState>) -> Result<String, String> {
    let key = state.get_key().ok_or("Vault is locked")?;

    // First check if external image exists
    if images::has_external_image(&id) {
        return images::load_full_image(&id, &key);
    }

    // Fall back to loading from database (legacy items)
    let encrypted_item = state
        .db
        .get_item(&id)
        .map_err(|e| e.to_string())?
        .ok_or("Item not found")?;

    let json = crypto::decrypt(&encrypted_item.encrypted_data, &key)
        .map_err(|e| format!("Failed to decrypt: {}", e))?;

    let item: MymindItem =
        serde_json::from_str(&json).map_err(|e| format!("Failed to parse: {}", e))?;

    // Return content (which should be the data URL for legacy items)
    if item.item_type == ItemType::Image {
        Ok(item.content)
    } else {
        Err("Item is not an image".to_string())
    }
}

/// Migrate an existing image item to external storage
/// Returns the new thumbnail URL
#[tauri::command]
pub fn migrate_image_to_external(id: String, state: State<VaultState>) -> Result<String, String> {
    let key = state.get_key().ok_or("Vault is locked")?;

    // Load the item
    let encrypted_item = state
        .db
        .get_item(&id)
        .map_err(|e| e.to_string())?
        .ok_or("Item not found")?;

    let json = crypto::decrypt(&encrypted_item.encrypted_data, &key)
        .map_err(|e| format!("Failed to decrypt: {}", e))?;

    let mut item: MymindItem =
        serde_json::from_str(&json).map_err(|e| format!("Failed to parse: {}", e))?;

    if item.item_type != ItemType::Image {
        return Err("Item is not an image".to_string());
    }

    if item.image_external {
        // Already migrated, just load thumbnail
        return images::load_thumbnail(&id, &key);
    }

    // Migrate the image
    let thumbnail_url = images::migrate_image(&id, &item.content, &key)?;

    // Update the item in database
    item.image_external = true;
    item.content = format!("external:{}", id);
    item.image_url = Some(thumbnail_url.clone());

    let updated_json = serde_json::to_string(&item).map_err(|e| e.to_string())?;
    let encrypted_data = crypto::encrypt(&updated_json, &key).map_err(|e| e.to_string())?;

    let updated_encrypted = EncryptedItem {
        id: item.id.clone(),
        encrypted_data,
        created_at: item.created_at.clone(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    };

    state
        .db
        .save_item(&updated_encrypted)
        .map_err(|e| e.to_string())?;

    Ok(thumbnail_url)
}

/// Migrate all legacy images to external storage
/// Returns count of migrated images
#[tauri::command]
pub fn migrate_all_images(state: State<VaultState>) -> Result<MigrationResult, String> {
    let key = state.get_key().ok_or("Vault is locked")?;

    let encrypted_items = state.db.get_all_items().map_err(|e| e.to_string())?;

    let mut migrated = 0;
    let mut failed = 0;
    let mut skipped = 0;

    for encrypted in encrypted_items {
        match crypto::decrypt(&encrypted.encrypted_data, &key) {
            Ok(json) => {
                if let Ok(mut item) = serde_json::from_str::<MymindItem>(&json) {
                    // Only migrate image items that aren't already external
                    if item.item_type == ItemType::Image && !item.image_external {
                        // Check if content is a data URL
                        if is_data_url(&item.content) {
                            match images::store_image(&item.id, &item.content, &key) {
                                Ok(thumbnail_url) => {
                                    // Update the item
                                    item.image_external = true;
                                    item.content = format!("external:{}", item.id);
                                    item.image_url = Some(thumbnail_url);

                                    let updated_json =
                                        serde_json::to_string(&item).map_err(|e| e.to_string())?;
                                    let encrypted_data = crypto::encrypt(&updated_json, &key)
                                        .map_err(|e| e.to_string())?;

                                    let updated_encrypted = EncryptedItem {
                                        id: item.id.clone(),
                                        encrypted_data,
                                        created_at: item.created_at.clone(),
                                        updated_at: chrono::Utc::now().to_rfc3339(),
                                    };

                                    if state.db.save_item(&updated_encrypted).is_ok() {
                                        migrated += 1;
                                    } else {
                                        failed += 1;
                                    }
                                }
                                Err(e) => {
                                    eprintln!("Failed to migrate image {}: {}", item.id, e);
                                    failed += 1;
                                }
                            }
                        } else {
                            skipped += 1;
                        }
                    } else {
                        skipped += 1;
                    }
                }
            }
            Err(e) => {
                eprintln!("Failed to decrypt item {}: {}", encrypted.id, e);
                failed += 1;
            }
        }
    }

    Ok(MigrationResult {
        migrated,
        failed,
        skipped,
    })
}

/// Result of image migration
#[derive(Debug, Serialize)]
pub struct MigrationResult {
    pub migrated: u32,
    pub failed: u32,
    pub skipped: u32,
}

/// Response for paginated items
#[derive(Debug, Serialize)]
pub struct ItemsPage {
    pub items: Vec<MymindItem>,
    pub total: i64,
    pub has_more: bool,
}

/// Default page size
const DEFAULT_PAGE_SIZE: u32 = 50;

/// Get paginated items (decrypted)
/// For images with external storage, returns thumbnails instead of full images
#[tauri::command]
pub fn get_items_page(
    page: u32,
    limit: Option<u32>,
    state: State<VaultState>,
) -> Result<ItemsPage, String> {
    let key = state.get_key().ok_or("Vault is locked")?;
    let page_size = limit.unwrap_or(DEFAULT_PAGE_SIZE);
    let offset = page * page_size;

    let total = state.db.get_item_count().map_err(|e| e.to_string())?;
    let encrypted_items = state
        .db
        .get_items_page(offset, page_size)
        .map_err(|e| e.to_string())?;

    let mut items = Vec::new();
    for encrypted in encrypted_items {
        match crypto::decrypt(&encrypted.encrypted_data, &key) {
            Ok(json) => {
                if let Ok(mut item) = serde_json::from_str::<MymindItem>(&json) {
                    // For image items with external storage, load thumbnail
                    if item.item_type == ItemType::Image && item.image_external {
                        match images::load_thumbnail(&item.id, &key) {
                            Ok(thumbnail_url) => {
                                item.image_url = Some(thumbnail_url.clone());
                                item.content = format!("external:{}", item.id);
                            }
                            Err(e) => {
                                eprintln!("Failed to load thumbnail for {}: {}", item.id, e);
                            }
                        }
                    }
                    // Don't send embeddings to frontend
                    item.embedding = None;
                    items.push(item);
                }
            }
            Err(e) => {
                eprintln!("Failed to decrypt item {}: {}", encrypted.id, e);
            }
        }
    }

    let has_more = (offset as i64 + items.len() as i64) < total;

    Ok(ItemsPage {
        items,
        total,
        has_more,
    })
}
