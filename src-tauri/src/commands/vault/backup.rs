use super::VaultState;
use crate::db::{
    get_backup_settings as get_backup_settings_pref, save_backup_settings, BackupSettings,
};
use crate::images;
use chrono::Utc;
use std::path::{Path, PathBuf};
use tauri::State;

const BACKUP_FOLDER_NAME: &str = "Atlas Backups";

fn copy_dir_recursive(from: &Path, to: &Path) -> Result<(), String> {
    if !from.exists() {
        return Ok(());
    }

    std::fs::create_dir_all(to)
        .map_err(|e| format!("Failed to create backup directory: {}", e))?;

    for entry in
        std::fs::read_dir(from).map_err(|e| format!("Failed to read directory: {}", e))?
    {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let file_type = entry
            .file_type()
            .map_err(|e| format!("Failed to read file type: {}", e))?;
        let source = entry.path();
        let destination = to.join(entry.file_name());

        if file_type.is_dir() {
            copy_dir_recursive(&source, &destination)?;
        } else {
            std::fs::copy(&source, &destination)
                .map_err(|e| format!("Failed to copy file: {}", e))?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn get_backup_settings() -> Result<BackupSettings, String> {
    Ok(get_backup_settings_pref())
}

#[tauri::command]
pub fn set_backup_enabled(enabled: bool) -> Result<BackupSettings, String> {
    let mut settings = get_backup_settings_pref();
    settings.enabled = enabled;
    save_backup_settings(&settings)?;
    Ok(settings)
}

#[tauri::command]
pub fn set_backup_path(path: Option<String>) -> Result<BackupSettings, String> {
    let mut settings = get_backup_settings_pref();
    settings.path = path.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    });
    save_backup_settings(&settings)?;
    Ok(settings)
}

#[tauri::command]
pub fn run_backup(state: State<VaultState>) -> Result<BackupSettings, String> {
    let mut settings = get_backup_settings_pref();
    let backup_root = settings
        .path
        .as_ref()
        .ok_or("Backup location not set")?
        .trim();

    if backup_root.is_empty() {
        return Err("Backup location not set".to_string());
    }

    let exists = state
        .db
        .vault_exists()
        .map_err(|e| format!("Failed to read vault: {}", e))?;
    if !exists {
        return Err("No vault found to back up".to_string());
    }

    let timestamp = Utc::now().format("%Y-%m-%d_%H-%M-%S").to_string();
    let backup_dir = PathBuf::from(backup_root)
        .join(BACKUP_FOLDER_NAME)
        .join(&timestamp);
    std::fs::create_dir_all(&backup_dir)
        .map_err(|e| format!("Failed to create backup directory: {}", e))?;

    let backup_db_path = backup_dir.join("vault.db");
    state.db.backup_to(&backup_db_path)?;

    let images_dir = images::get_images_dir();
    if images_dir.exists() {
        copy_dir_recursive(&images_dir, &backup_dir.join("images"))?;
    }

    settings.last_backup_at = Some(Utc::now().to_rfc3339());
    save_backup_settings(&settings)?;
    Ok(settings)
}
