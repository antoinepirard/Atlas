pub mod biometrics;
pub mod capture;
pub mod commands;
pub mod crypto;
pub mod db;

use capture::QuickCaptureData;
use commands::vault::VaultState;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    Emitter, Manager,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

fn create_app_menu(app: &tauri::AppHandle) -> Result<Menu<tauri::Wry>, tauri::Error> {
    let app_menu = Submenu::with_items(
        app,
        "Atlas",
        true,
        &[
            &MenuItem::with_id(app, "about", "About Atlas", true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "check_updates", "Check for Updates...", true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "settings", "Settings...", true, Some("CmdOrCtrl+,"))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::services(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::hide(app, Some("Hide Atlas"))?,
            &PredefinedMenuItem::hide_others(app, None)?,
            &PredefinedMenuItem::show_all(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::quit(app, Some("Quit Atlas"))?,
        ],
    )?;

    let edit_menu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(app, None)?,
            &PredefinedMenuItem::redo(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::select_all(app, None)?,
        ],
    )?;

    let view_menu = Submenu::with_items(
        app,
        "View",
        true,
        &[
            &PredefinedMenuItem::fullscreen(app, None)?,
        ],
    )?;

    let window_menu = Submenu::with_items(
        app,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(app, None)?,
            &PredefinedMenuItem::maximize(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::close_window(app, Some("Close"))?,
        ],
    )?;

    Menu::with_items(app, &[&app_menu, &edit_menu, &view_menu, &window_menu])
}

/// Trigger quick capture from any application
#[tauri::command]
fn trigger_quick_capture() -> Result<QuickCaptureData, String> {
    capture::capture()
}

/// Check if Accessibility permissions are granted
#[tauri::command]
fn check_accessibility_permission() -> bool {
    capture::check_accessibility_permission()
}

/// Request accessibility permission (shows system prompt)
#[tauri::command]
fn request_accessibility_permission() -> bool {
    capture::request_accessibility_permission()
}

/// Open System Preferences to Accessibility settings
#[tauri::command]
fn open_accessibility_settings() -> Result<(), String> {
    capture::open_accessibility_settings()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let vault_state = VaultState::new().expect("Failed to initialize vault state");
    
    // Define the quick capture shortcut: Cmd+Shift+S
    let quick_capture_shortcut = Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyS);
    
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut, event| {
                    if shortcut == &quick_capture_shortcut {
                        if event.state == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                            // Perform the capture
                            match capture::capture() {
                                Ok(data) => {
                                    // Show the main window
                                    if let Some(window) = app.get_webview_window("main") {
                                        let _ = window.show();
                                        let _ = window.set_focus();
                                        // Emit the capture data to the frontend
                                        let _ = window.emit("quick-capture", data);
                                    }
                                }
                                Err(e) => {
                                    eprintln!("Quick capture failed: {}", e);
                                }
                            }
                        }
                    }
                })
                .build(),
        )
        .manage(vault_state)
        .setup(move |app| {
            let menu = create_app_menu(app.handle())?;
            app.set_menu(menu)?;
            
            // Register the global shortcut
            app.global_shortcut().register(quick_capture_shortcut)?;
            
            Ok(())
        })
        .on_menu_event(|app, event| {
            match event.id().as_ref() {
                "check_updates" => {
                    // Emit event to frontend to trigger update check
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.emit("check-for-updates", ());
                    }
                }
                "settings" => {
                    // Emit event to frontend to open settings
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.emit("open-settings", ());
                    }
                }
                "about" => {
                    // Emit event to frontend to show about
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.emit("show-about", ());
                    }
                }
                _ => {}
            }
        })
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
            // Quick capture commands
            trigger_quick_capture,
            check_accessibility_permission,
            request_accessibility_permission,
            open_accessibility_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

