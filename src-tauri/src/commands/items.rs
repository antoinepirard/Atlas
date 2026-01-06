use crate::commands::vault::VaultState;
use crate::crypto;
use crate::db::EncryptedItem;
use serde::{Deserialize, Serialize};
use tauri::State;

/// Item type
#[derive(Debug, Clone, Serialize, Deserialize)]
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
    pub tags: Vec<String>,
    pub embedding: Option<Vec<f32>>,
    pub created_at: String,
    pub updated_at: String,
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
    pub tags: Vec<String>,
    pub embedding: Option<Vec<f32>>,
}

/// Get all items (decrypted)
#[tauri::command]
pub fn get_all_items(state: State<VaultState>) -> Result<Vec<MymindItem>, String> {
    let key = state.get_key().ok_or("Vault is locked")?;
    
    let encrypted_items = state.db.get_all_items().map_err(|e| e.to_string())?;
    
    let mut items = Vec::new();
    for encrypted in encrypted_items {
        match crypto::decrypt(&encrypted.encrypted_data, &key) {
            Ok(json) => {
                if let Ok(item) = serde_json::from_str::<MymindItem>(&json) {
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
#[tauri::command]
pub fn add_item(input: AddItemInput, state: State<VaultState>) -> Result<MymindItem, String> {
    let key = state.get_key().ok_or("Vault is locked")?;
    
    let now = chrono::Utc::now().to_rfc3339();
    let id = format!("item-{}-{}", 
        chrono::Utc::now().timestamp_millis(),
        &uuid::Uuid::new_v4().to_string()[..8]
    );
    
    let item = MymindItem {
        id: id.clone(),
        item_type: input.item_type,
        content: input.content,
        title: input.title,
        description: input.description,
        summary: input.summary,
        image_url: input.image_url,
        tags: input.tags,
        embedding: input.embedding,
        created_at: now.clone(),
        updated_at: now.clone(),
    };
    
    // Encrypt and save
    let json = serde_json::to_string(&item).map_err(|e| e.to_string())?;
    let encrypted_data = crypto::encrypt(&json, &key).map_err(|e| e.to_string())?;
    
    let encrypted_item = EncryptedItem {
        id,
        encrypted_data,
        created_at: now.clone(),
        updated_at: now,
    };
    
    state.db.save_item(&encrypted_item).map_err(|e| e.to_string())?;
    
    Ok(item)
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
    
    state.db.save_item(&encrypted_item).map_err(|e| e.to_string())?;
    
    Ok(updated_item)
}

/// Delete an item
#[tauri::command]
pub fn delete_item(id: String, state: State<VaultState>) -> Result<bool, String> {
    // Don't need the key to delete, just check we're unlocked
    if !state.is_unlocked() {
        return Err("Vault is locked".to_string());
    }
    
    state.db.delete_item(&id).map_err(|e| e.to_string())
}

/// Get item count
#[tauri::command]
pub fn get_item_count(state: State<VaultState>) -> Result<i64, String> {
    state.db.get_item_count().map_err(|e| e.to_string())
}

