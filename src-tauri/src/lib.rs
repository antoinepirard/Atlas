pub mod biometrics;
pub mod commands;
pub mod crypto;
pub mod db;

use commands::vault::VaultState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let vault_state = VaultState::new().expect("Failed to initialize vault state");
    
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(vault_state)
        .invoke_handler(tauri::generate_handler![
            // Vault commands
            commands::get_vault_status,
            commands::create_vault,
            commands::unlock_vault,
            commands::unlock_with_phrase,
            commands::lock_vault,
            commands::set_auto_lock_minutes,
            commands::reset_vault,
            commands::get_storage_path,
            commands::set_storage_path,
            // Biometrics commands
            commands::is_biometrics_available,
            commands::is_biometrics_enabled,
            commands::enable_biometrics,
            commands::disable_biometrics,
            commands::unlock_with_biometrics,
            // Item commands
            commands::get_all_items,
            commands::add_item,
            commands::update_item,
            commands::delete_item,
            commands::get_item_count,
            // AI commands
            commands::save_api_key,
            commands::has_api_key,
            commands::get_api_key_masked,
            commands::process_with_ai,
            commands::get_search_embedding,
            commands::fetch_url_metadata,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

