use crate::biometrics;
use crate::crypto;
use crate::db::{get_db_path, set_storage_path_preference, Database, VaultConfig};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

/// Verification token to check password correctness
const VERIFICATION_TOKEN: &str = "mymind-vault-ok";

/// Vault state managed by Tauri
pub struct VaultState {
    pub db: Database,
    pub key: Mutex<Option<[u8; 32]>>,
    pub ui_locked: Mutex<bool>,
    pub auto_lock_minutes: Mutex<i32>,
}

impl VaultState {
    pub fn new() -> Result<Self, String> {
        let db_path = get_db_path();
        let db = Database::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

        let auto_lock = db
            .get_vault_config()
            .ok()
            .flatten()
            .map(|c| c.auto_lock_minutes)
            .unwrap_or(30);

        Ok(VaultState {
            db,
            key: Mutex::new(None),
            ui_locked: Mutex::new(true),
            auto_lock_minutes: Mutex::new(auto_lock),
        })
    }

    pub fn get_key(&self) -> Option<[u8; 32]> {
        *self.key.lock().unwrap()
    }

    pub fn set_key(&self, key: Option<[u8; 32]>) {
        *self.key.lock().unwrap() = key;
    }

    /// Check if the UI is unlocked (user can view items)
    pub fn is_unlocked(&self) -> bool {
        !*self.ui_locked.lock().unwrap() && self.key.lock().unwrap().is_some()
    }

    /// Check if the encryption key is available (for quick capture even when UI is locked)
    pub fn has_key(&self) -> bool {
        self.key.lock().unwrap().is_some()
    }

    /// Lock the UI (but keep the encryption key for quick capture)
    pub fn lock_ui(&self) {
        *self.ui_locked.lock().unwrap() = true;
    }

    /// Unlock the UI
    pub fn unlock_ui(&self) {
        *self.ui_locked.lock().unwrap() = false;
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VaultStatus {
    pub exists: bool,
    pub unlocked: bool,
    pub auto_lock_minutes: i32,
    pub biometrics_available: bool,
    pub biometrics_enabled: bool,
}

/// Check vault status
#[tauri::command]
pub fn get_vault_status(state: State<VaultState>) -> Result<VaultStatus, String> {
    let exists = state.db.vault_exists().map_err(|e| e.to_string())?;
    let unlocked = state.is_unlocked();
    let auto_lock_minutes = *state.auto_lock_minutes.lock().unwrap();
    let biometrics_available = biometrics::is_available();
    let biometrics_enabled = biometrics::is_enabled();
    
    Ok(VaultStatus {
        exists,
        unlocked,
        auto_lock_minutes,
        biometrics_available,
        biometrics_enabled,
    })
}

/// Create a new vault with password
/// Returns the recovery phrase
#[tauri::command]
pub fn create_vault(password: String, state: State<VaultState>) -> Result<Vec<String>, String> {
    // Check if vault already exists
    if state.db.vault_exists().map_err(|e| e.to_string())? {
        return Err("Vault already exists".to_string());
    }
    
    // Generate salt and recovery phrase
    let salt = crypto::generate_salt();
    let recovery_phrase = crypto::generate_recovery_phrase();
    
    // Derive key from password
    let key = crypto::derive_key(&password, &salt);
    
    // Create verification token
    let verification = crypto::encrypt(VERIFICATION_TOKEN, &key)
        .map_err(|e| format!("Failed to create verification: {}", e))?;
    
    // Encrypt recovery phrase
    let recovery_json = serde_json::to_string(&recovery_phrase)
        .map_err(|e| format!("Failed to serialize recovery phrase: {}", e))?;
    let recovery_encrypted = crypto::encrypt(&recovery_json, &key)
        .map_err(|e| format!("Failed to encrypt recovery phrase: {}", e))?;
    
    // Save vault config
    let config = VaultConfig {
        salt: crypto::bytes_to_base64(&salt),
        verification,
        recovery_encrypted,
        auto_lock_minutes: 30,
    };
    
    state.db.save_vault_config(&config).map_err(|e| e.to_string())?;

    // Set the key in state and unlock UI
    state.set_key(Some(key));
    state.unlock_ui();

    Ok(recovery_phrase)
}

/// Unlock vault with password
#[tauri::command]
pub fn unlock_vault(password: String, state: State<VaultState>) -> Result<bool, String> {
    let config = state
        .db
        .get_vault_config()
        .map_err(|e| e.to_string())?
        .ok_or("Vault not found")?;
    
    // Decode salt
    let salt = crypto::base64_to_bytes(&config.salt)
        .map_err(|e| format!("Invalid salt: {}", e))?;
    
    // Derive key
    let key = crypto::derive_key(&password, &salt);
    
    // Verify password
    match crypto::decrypt(&config.verification, &key) {
        Ok(decrypted) if decrypted == VERIFICATION_TOKEN => {
            state.set_key(Some(key));
            state.unlock_ui();
            *state.auto_lock_minutes.lock().unwrap() = config.auto_lock_minutes;
            Ok(true)
        }
        _ => Ok(false),
    }
}

/// Unlock vault with recovery phrase
#[tauri::command]
pub fn unlock_with_phrase(phrase: Vec<String>, state: State<VaultState>) -> Result<bool, String> {
    let config = state
        .db
        .get_vault_config()
        .map_err(|e| e.to_string())?
        .ok_or("Vault not found")?;
    
    // Decode salt
    let salt = crypto::base64_to_bytes(&config.salt)
        .map_err(|e| format!("Invalid salt: {}", e))?;
    
    // Derive key from phrase
    let key = crypto::phrase_to_key(&phrase, &salt);
    
    // Verify
    match crypto::decrypt(&config.verification, &key) {
        Ok(decrypted) if decrypted == VERIFICATION_TOKEN => {
            state.set_key(Some(key));
            state.unlock_ui();
            *state.auto_lock_minutes.lock().unwrap() = config.auto_lock_minutes;
            Ok(true)
        }
        _ => Ok(false),
    }
}

/// Lock the vault UI (keeps encryption key for quick capture)
#[tauri::command]
pub fn lock_vault(state: State<VaultState>) -> Result<(), String> {
    state.lock_ui();
    Ok(())
}

/// Set auto-lock timeout
#[tauri::command]
pub fn set_auto_lock_minutes(minutes: i32, state: State<VaultState>) -> Result<(), String> {
    state.db.set_auto_lock_minutes(minutes).map_err(|e| e.to_string())?;
    *state.auto_lock_minutes.lock().unwrap() = minutes;
    Ok(())
}

/// Reset vault (destructive!)
#[tauri::command]
pub fn reset_vault(state: State<VaultState>) -> Result<(), String> {
    state.db.reset_vault().map_err(|e| e.to_string())?;
    state.set_key(None);
    Ok(())
}

/// Get current storage path
#[tauri::command]
pub fn get_storage_path() -> String {
    get_db_path().to_string_lossy().to_string()
}

/// Set storage path and migrate data
#[tauri::command]
pub fn set_storage_path(new_path: String, _state: State<VaultState>) -> Result<(), String> {
    let current_path = get_db_path();
    let new_db_path = PathBuf::from(&new_path).join("vault.db");
    
    // Don't do anything if paths are the same
    if current_path == new_db_path {
        return Ok(());
    }
    
    // Ensure target directory exists
    if let Some(parent) = new_db_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    
    // Copy existing database if it exists
    if current_path.exists() {
        std::fs::copy(&current_path, &new_db_path)
            .map_err(|e| format!("Failed to copy vault: {}", e))?;
    }
    
    // Save the new path preference
    set_storage_path_preference(&new_path)
        .map_err(|e| format!("Failed to save path preference: {}", e))?;
    
    // Remove old database after successful migration
    if current_path.exists() && current_path != new_db_path {
        // We'll leave the old file for safety - user can manually delete it
        // std::fs::remove_file(&current_path).ok();
    }
    
    Ok(())
}

// ============================================================================
// Biometrics Commands
// ============================================================================

/// Check if biometrics (Touch ID) is available
#[tauri::command]
pub fn is_biometrics_available() -> bool {
    biometrics::is_available()
}

/// Check if biometrics is enabled (key is stored)
#[tauri::command]
pub fn is_biometrics_enabled() -> bool {
    biometrics::is_enabled()
}

/// Enable biometrics by storing the current encryption key
#[tauri::command]
pub fn enable_biometrics(state: State<VaultState>) -> Result<(), String> {
    let key = state.get_key().ok_or("Vault is not unlocked")?;
    biometrics::store_key(&key)
}

/// Disable biometrics by removing the stored key
#[tauri::command]
pub fn disable_biometrics() -> Result<(), String> {
    biometrics::remove_key()
}

/// Unlock vault using biometrics (Touch ID)
#[tauri::command]
pub fn unlock_with_biometrics(state: State<VaultState>) -> Result<bool, String> {
    // Retrieve key using biometrics (will prompt for Touch ID)
    let key = biometrics::retrieve_key()?;
    
    // Verify the key is correct by checking the verification token
    let config = state
        .db
        .get_vault_config()
        .map_err(|e| e.to_string())?
        .ok_or("Vault not found")?;
    
    // Try to decrypt the verification token
    match crypto::decrypt(&config.verification, &key) {
        Ok(decrypted) if decrypted == VERIFICATION_TOKEN => {
            state.set_key(Some(key));
            state.unlock_ui();
            *state.auto_lock_minutes.lock().unwrap() = config.auto_lock_minutes;
            Ok(true)
        }
        _ => {
            // Key from Keychain doesn't work - remove it
            let _ = biometrics::remove_key();
            Ok(false)
        }
    }
}

