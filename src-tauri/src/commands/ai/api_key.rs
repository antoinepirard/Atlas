use std::fs;
use std::path::PathBuf;

use keyring::Entry;

use crate::db::get_app_dir_name;

const KEYRING_SERVICE: &str = "Atlas";
const KEYRING_ACCOUNT: &str = "openai-api-key";

/// Get the path for storing the API key
fn get_api_key_path() -> Result<PathBuf, String> {
    let app_dir = dirs::data_local_dir()
        .ok_or_else(|| "Could not find app data directory".to_string())?
        .join(get_app_dir_name());
    
    // Ensure directory exists
    fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create app directory: {}", e))?;
    
    Ok(app_dir.join(".openai_key"))
}

fn keyring_entry() -> Result<Entry, String> {
    Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT)
        .map_err(|err| format!("Failed to initialize keychain entry: {}", err))
}

fn get_key_from_keyring() -> Option<String> {
    let entry = match keyring_entry() {
        Ok(entry) => entry,
        Err(err) => {
            eprintln!("{}", err);
            return None;
        }
    };
    match entry.get_password() {
        Ok(value) => {
            let key = value.trim().to_string();
            if key.is_empty() {
                None
            } else {
                Some(key)
            }
        }
        Err(err) => {
            eprintln!("Failed to read API key from keychain: {}", err);
            None
        }
    }
}

fn save_key_to_file(api_key: &str) -> Result<(), String> {
    let path = get_api_key_path()?;

    fs::write(&path, api_key.trim())
        .map_err(|e| format!("Failed to save API key: {}", e))?;

    // Set restrictive permissions on Unix systems
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = fs::Permissions::from_mode(0o600);
        fs::set_permissions(&path, perms)
            .map_err(|e| format!("Failed to set file permissions: {}", e))?;
    }

    Ok(())
}

fn remove_key_file() {
    if let Ok(path) = get_api_key_path() {
        let _ = fs::remove_file(path);
    }
}

fn remove_key_from_keyring() {
    let entry = match keyring_entry() {
        Ok(entry) => entry,
        Err(err) => {
            eprintln!("{}", err);
            return;
        }
    };

    if let Err(err) = entry.delete_credential() {
        eprintln!("Failed to remove API key from keychain: {}", err);
    }
}

/// Get OpenAI API key from file or environment
pub(super) fn get_api_key() -> Result<String, String> {
    // Try keychain first
    if let Some(key) = get_key_from_keyring() {
        return Ok(key);
    }

    // Try file fallback
    if let Ok(path) = get_api_key_path() {
        if path.exists() {
            if let Ok(key) = fs::read_to_string(&path) {
                let key = key.trim().to_string();
                if !key.is_empty() {
                    return Ok(key);
                }
            }
        }
    }
    
    // Fall back to environment variable
    std::env::var("OPENAI_API_KEY")
        .map_err(|_| "OpenAI API key not found. Please set it in settings.".to_string())
}

/// Save OpenAI API key to file
#[tauri::command]
pub fn save_api_key(api_key: String) -> Result<(), String> {
    let trimmed = api_key.trim();
    if trimmed.is_empty() {
        return Err("API key is empty".to_string());
    }

    let entry = keyring_entry()?;
    match entry.set_password(trimmed) {
        Ok(_) => {
            remove_key_file();
            Ok(())
        }
        Err(err) => {
            eprintln!("Failed to store API key in keychain: {}", err);
            save_key_to_file(trimmed)
        }
    }
}

/// Check if API key is configured
#[tauri::command]
pub fn has_api_key() -> bool {
    get_api_key().is_ok()
}

/// Get masked API key for display (shows last 8 chars)
#[tauri::command]
pub fn get_api_key_masked() -> Option<String> {
    match get_api_key() {
        Ok(key) if key.len() > 8 => {
            let visible = &key[key.len() - 8..];
            Some(format!("sk-...{}", visible))
        }
        Ok(key) => Some(format!("...{}", key)),
        Err(_) => None,
    }
}

/// Remove stored OpenAI API key from keychain and disk
#[tauri::command]
pub fn remove_api_key() -> Result<(), String> {
    remove_key_from_keyring();
    remove_key_file();
    Ok(())
}
