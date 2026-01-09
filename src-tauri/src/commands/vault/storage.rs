use super::VaultState;
use crate::db::{get_db_path, set_storage_path_preference, Database};
use serde::Deserialize;
use std::path::PathBuf;
use tauri::State;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StoragePathMode {
    Move,
    Switch,
    Create,
}

fn sync_state_after_db_change(state: &VaultState, lock_ui: bool) {
    if lock_ui {
        state.set_key(None);
        state.lock_ui();
    }

    let auto_lock = state
        .db
        .get_vault_config()
        .ok()
        .flatten()
        .map(|config| config.auto_lock_minutes)
        .unwrap_or(30);
    *state.auto_lock_minutes.lock().unwrap() = auto_lock;
}

/// Get current storage path
#[tauri::command]
pub fn get_storage_path() -> String {
    get_db_path().to_string_lossy().to_string()
}

/// Set storage path and optionally move or switch vaults
#[tauri::command]
pub fn set_storage_path(
    new_path: String,
    mode: Option<StoragePathMode>,
    state: State<VaultState>,
) -> Result<(), String> {
    let current_path = get_db_path();
    let new_db_path = PathBuf::from(&new_path).join("vault.db");

    // Don't do anything if paths are the same
    if current_path == new_db_path {
        return Ok(());
    }

    let mode = mode.unwrap_or(StoragePathMode::Move);

    match mode {
        StoragePathMode::Move => {
            if new_db_path.exists() {
                return Err("Destination already contains a vault database.".to_string());
            }

            if let Some(parent) = new_db_path.parent() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create directory: {}", e))?;
            }

            if current_path.exists() {
                std::fs::copy(&current_path, &new_db_path)
                    .map_err(|e| format!("Failed to copy vault: {}", e))?;
            }

            set_storage_path_preference(&new_path)
                .map_err(|e| format!("Failed to save path preference: {}", e))?;

            state
                .db
                .reopen(&new_db_path)
                .map_err(|e| format!("Failed to open vault: {}", e))?;
            sync_state_after_db_change(&state, false);
        }
        StoragePathMode::Switch => {
            if !new_db_path.exists() {
                return Err("No vault found at the selected location.".to_string());
            }

            let candidate =
                Database::open(&new_db_path).map_err(|e| format!("Failed to open vault: {}", e))?;
            let exists = candidate
                .vault_exists()
                .map_err(|e| format!("Failed to read vault: {}", e))?;
            if !exists {
                return Err("No vault found at the selected location.".to_string());
            }

            set_storage_path_preference(&new_path)
                .map_err(|e| format!("Failed to save path preference: {}", e))?;

            state
                .db
                .reopen(&new_db_path)
                .map_err(|e| format!("Failed to open vault: {}", e))?;
            sync_state_after_db_change(&state, true);
        }
        StoragePathMode::Create => {
            if new_db_path.exists() {
                let candidate = Database::open(&new_db_path)
                    .map_err(|e| format!("Failed to open vault: {}", e))?;
                let exists = candidate
                    .vault_exists()
                    .map_err(|e| format!("Failed to read vault: {}", e))?;
                if exists {
                    return Err("A vault already exists in that folder.".to_string());
                }
            }

            if let Some(parent) = new_db_path.parent() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create directory: {}", e))?;
            }

            set_storage_path_preference(&new_path)
                .map_err(|e| format!("Failed to save path preference: {}", e))?;

            state
                .db
                .reopen(&new_db_path)
                .map_err(|e| format!("Failed to open vault: {}", e))?;
            sync_state_after_db_change(&state, true);
        }
    }

    Ok(())
}
