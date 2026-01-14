use crate::commands::vault::VaultState;
use crate::crypto;
use crate::db::EncryptedSpace;
use serde::{Deserialize, Serialize};
use tauri::State;

/// Decrypted space structure (matches frontend types)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Space {
    pub id: String,
    pub name: String,
    pub color: String,
    pub icon: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Input for creating a new space
#[derive(Debug, Deserialize)]
pub struct CreateSpaceInput {
    pub name: String,
    pub color: String,
    pub icon: Option<String>,
}

/// Input for updating a space
#[derive(Debug, Deserialize)]
pub struct UpdateSpaceInput {
    pub id: String,
    pub name: String,
    pub color: String,
    pub icon: Option<String>,
}

/// Get all spaces (decrypted)
#[tauri::command]
pub fn get_all_spaces(state: State<VaultState>) -> Result<Vec<Space>, String> {
    let key = state.get_key().ok_or("Vault is locked")?;

    let encrypted_spaces = state.db.get_all_spaces().map_err(|e| e.to_string())?;

    let mut spaces = Vec::new();
    for encrypted in encrypted_spaces {
        match crypto::decrypt(&encrypted.encrypted_data, &key) {
            Ok(json) => {
                if let Ok(space) = serde_json::from_str::<Space>(&json) {
                    spaces.push(space);
                }
            }
            Err(e) => {
                eprintln!("Failed to decrypt space {}: {}", encrypted.id, e);
            }
        }
    }

    Ok(spaces)
}

/// Create a new space
#[tauri::command]
pub fn create_space(input: CreateSpaceInput, state: State<VaultState>) -> Result<Space, String> {
    let key = state.get_key().ok_or("Vault is locked")?;

    let now = chrono::Utc::now().to_rfc3339();
    let id = format!(
        "space-{}-{}",
        chrono::Utc::now().timestamp_millis(),
        &uuid::Uuid::new_v4().to_string()[..8]
    );

    let space = Space {
        id: id.clone(),
        name: input.name,
        color: input.color,
        icon: input.icon,
        created_at: now.clone(),
        updated_at: now.clone(),
    };

    let json = serde_json::to_string(&space).map_err(|e| e.to_string())?;
    let encrypted_data = crypto::encrypt(&json, &key).map_err(|e| e.to_string())?;

    let encrypted_space = EncryptedSpace {
        id,
        encrypted_data,
        created_at: now.clone(),
        updated_at: now,
    };

    state
        .db
        .save_space(&encrypted_space)
        .map_err(|e| e.to_string())?;

    Ok(space)
}

/// Update an existing space
#[tauri::command]
pub fn update_space(input: UpdateSpaceInput, state: State<VaultState>) -> Result<Space, String> {
    let key = state.get_key().ok_or("Vault is locked")?;

    // Load existing space to get created_at
    let existing = state
        .db
        .get_space(&input.id)
        .map_err(|e| e.to_string())?
        .ok_or("Space not found")?;

    let existing_space: Space = {
        let json = crypto::decrypt(&existing.encrypted_data, &key)
            .map_err(|e| format!("Failed to decrypt: {}", e))?;
        serde_json::from_str(&json).map_err(|e| format!("Failed to parse: {}", e))?
    };

    let now = chrono::Utc::now().to_rfc3339();
    let space = Space {
        id: input.id.clone(),
        name: input.name,
        color: input.color,
        icon: input.icon,
        created_at: existing_space.created_at,
        updated_at: now.clone(),
    };

    let json = serde_json::to_string(&space).map_err(|e| e.to_string())?;
    let encrypted_data = crypto::encrypt(&json, &key).map_err(|e| e.to_string())?;

    let encrypted_space = EncryptedSpace {
        id: input.id,
        encrypted_data,
        created_at: existing.created_at,
        updated_at: now,
    };

    state
        .db
        .save_space(&encrypted_space)
        .map_err(|e| e.to_string())?;

    Ok(space)
}

/// Delete a space
#[tauri::command]
pub fn delete_space(id: String, state: State<VaultState>) -> Result<bool, String> {
    if !state.is_unlocked() {
        return Err("Vault is locked".to_string());
    }
    state.db.delete_space(&id).map_err(|e| e.to_string())
}

/// Add item to space
#[tauri::command]
pub fn add_item_to_space(
    space_id: String,
    item_id: String,
    state: State<VaultState>,
) -> Result<(), String> {
    if !state.is_unlocked() {
        return Err("Vault is locked".to_string());
    }
    let now = chrono::Utc::now().to_rfc3339();
    state
        .db
        .add_item_to_space(&space_id, &item_id, &now)
        .map_err(|e| e.to_string())
}

/// Remove item from space
#[tauri::command]
pub fn remove_item_from_space(
    space_id: String,
    item_id: String,
    state: State<VaultState>,
) -> Result<bool, String> {
    if !state.is_unlocked() {
        return Err("Vault is locked".to_string());
    }
    state
        .db
        .remove_item_from_space(&space_id, &item_id)
        .map_err(|e| e.to_string())
}

/// Get space IDs for an item
#[tauri::command]
pub fn get_item_spaces(item_id: String, state: State<VaultState>) -> Result<Vec<String>, String> {
    if !state.is_unlocked() {
        return Err("Vault is locked".to_string());
    }
    state
        .db
        .get_item_space_ids(&item_id)
        .map_err(|e| e.to_string())
}

/// Batch set item spaces (add to new ones, remove from old ones)
#[tauri::command]
pub fn set_item_spaces(
    item_id: String,
    space_ids: Vec<String>,
    state: State<VaultState>,
) -> Result<(), String> {
    if !state.is_unlocked() {
        return Err("Vault is locked".to_string());
    }

    // Get current space memberships
    let current = state
        .db
        .get_item_space_ids(&item_id)
        .map_err(|e| e.to_string())?;

    // Remove from spaces no longer in the list
    for space_id in &current {
        if !space_ids.contains(space_id) {
            state.db.remove_item_from_space(space_id, &item_id).ok();
        }
    }

    // Add to new spaces
    let now = chrono::Utc::now().to_rfc3339();
    for space_id in &space_ids {
        if !current.contains(space_id) {
            state
                .db
                .add_item_to_space(space_id, &item_id, &now)
                .map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}
