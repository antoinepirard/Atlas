use std::fs;
use std::path::PathBuf;

use crate::db::get_app_dir_name;

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

/// Get OpenAI API key from file or environment
pub(super) fn get_api_key() -> Result<String, String> {
    // Try file first
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

