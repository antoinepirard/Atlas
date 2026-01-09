use super::{VaultState, VERIFICATION_TOKEN};
use crate::biometrics;
use crate::crypto;
use tauri::State;

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
