use crate::biometrics;
use crate::crypto;
use crate::db::{
    get_backup_settings as get_backup_settings_pref,
    get_db_path,
    save_backup_settings,
    set_storage_path_preference,
    BackupSettings,
    Database,
    VaultConfig,
};
use crate::images;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;
use std::time::Instant;
use tauri::State;

// Rate limiting for vault unlock attempts
static FAILED_ATTEMPTS: AtomicU32 = AtomicU32::new(0);
static LAST_FAILURE: Mutex<Option<Instant>> = Mutex::new(None);

/// Check rate limit before allowing unlock attempt
fn check_rate_limit() -> Result<(), String> {
    let attempts = FAILED_ATTEMPTS.load(Ordering::Relaxed);
    if attempts >= 3 {
        if let Some(last) = *LAST_FAILURE.lock().unwrap() {
            // Exponential backoff: 2s, 4s, 8s, 16s, 32s, 64s (max)
            let delay_secs = 2u64.pow((attempts - 2).min(5));
            let elapsed = last.elapsed().as_secs();
            if elapsed < delay_secs {
                let remaining = delay_secs - elapsed;
                return Err(format!(
                    "Too many failed attempts. Please wait {} second{}.",
                    remaining,
                    if remaining == 1 { "" } else { "s" }
                ));
            }
        }
    }
    Ok(())
}

/// Record a failed unlock attempt
fn record_failure() {
    FAILED_ATTEMPTS.fetch_add(1, Ordering::Relaxed);
    *LAST_FAILURE.lock().unwrap() = Some(Instant::now());
}

/// Reset the failure counter on successful unlock
fn reset_failures() {
    FAILED_ATTEMPTS.store(0, Ordering::Relaxed);
    *LAST_FAILURE.lock().unwrap() = None;
}

/// Verification token to check password correctness
const VERIFICATION_TOKEN: &str = "mymind-vault-ok";

/// Vault state managed by Tauri
pub struct VaultState {
    pub db: Database,
    pub key: Mutex<Option<[u8; 32]>>,
    pub ui_locked: Mutex<bool>,
    pub auto_lock_minutes: Mutex<i32>,
}

fn copy_dir_recursive(from: &Path, to: &Path) -> Result<(), String> {
    if !from.exists() {
        return Ok(());
    }

    std::fs::create_dir_all(to)
        .map_err(|e| format!("Failed to create backup directory: {}", e))?;

    for entry in std::fs::read_dir(from)
        .map_err(|e| format!("Failed to read directory: {}", e))?
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
    pub name: Option<String>,
    pub auto_lock_minutes: i32,
    pub biometrics_available: bool,
    pub biometrics_enabled: bool,
}

// ============================================================================
// Backup Commands
// ============================================================================

const BACKUP_FOLDER_NAME: &str = "Atlas Backups";

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

/// Check vault status
#[tauri::command]
pub fn get_vault_status(state: State<VaultState>) -> Result<VaultStatus, String> {
    let exists = state.db.vault_exists().map_err(|e| e.to_string())?;
    let unlocked = state.is_unlocked();
    let auto_lock_minutes = *state.auto_lock_minutes.lock().unwrap();
    let name = if exists {
        state
            .db
            .get_vault_config()
            .ok()
            .flatten()
            .and_then(|config| config.name)
    } else {
        None
    };
    let biometrics_available = biometrics::is_available();
    let biometrics_enabled = biometrics::is_enabled();
    
    Ok(VaultStatus {
        exists,
        unlocked,
        name,
        auto_lock_minutes,
        biometrics_available,
        biometrics_enabled,
    })
}

/// Create a new vault with password
/// Returns the recovery phrase
#[tauri::command]
pub fn create_vault(
    password: String,
    name: Option<String>,
    state: State<VaultState>,
) -> Result<Vec<String>, String> {
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
    let name = name.and_then(|value| {
        let trimmed = value.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    });

    let config = VaultConfig {
        name,
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
    // Check rate limit before attempting unlock
    check_rate_limit()?;

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
            reset_failures();
            state.set_key(Some(key));
            state.unlock_ui();
            *state.auto_lock_minutes.lock().unwrap() = config.auto_lock_minutes;
            Ok(true)
        }
        _ => {
            record_failure();
            Ok(false)
        }
    }
}

/// Unlock vault with recovery phrase
#[tauri::command]
pub fn unlock_with_phrase(phrase: Vec<String>, state: State<VaultState>) -> Result<bool, String> {
    // Check rate limit before attempting unlock
    check_rate_limit()?;

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
            reset_failures();
            state.set_key(Some(key));
            state.unlock_ui();
            *state.auto_lock_minutes.lock().unwrap() = config.auto_lock_minutes;
            Ok(true)
        }
        _ => {
            record_failure();
            Ok(false)
        }
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

/// Set vault name
#[tauri::command]
pub fn set_vault_name(name: Option<String>, state: State<VaultState>) -> Result<(), String> {
    let name = name.and_then(|value| {
        let trimmed = value.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    });
    state.db.set_vault_name(name).map_err(|e| e.to_string())?;
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

            let candidate = Database::open(&new_db_path)
                .map_err(|e| format!("Failed to open vault: {}", e))?;
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
