pub mod biometrics;
pub mod capture;
pub mod commands;
pub mod crypto;
pub mod db;
pub mod images;
pub mod search;

use capture::QuickCaptureData;
use commands::vault::VaultState;
use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::TrayIconBuilder,
    Emitter, Manager,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};
use tokio::sync::Mutex as TokioMutex;

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
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "find", "Find...", true, Some("CmdOrCtrl+F"))?,
        ],
    )?;

    let view_menu = Submenu::with_items(
        app,
        "View",
        true,
        &[
            &MenuItem::with_id(app, "zoom_in", "Zoom In", true, Some("CmdOrCtrl+Plus"))?,
            &MenuItem::with_id(app, "zoom_out", "Zoom Out", true, Some("CmdOrCtrl+-"))?,
            &MenuItem::with_id(app, "zoom_reset", "Actual Size", true, Some("CmdOrCtrl+0"))?,
            &PredefinedMenuItem::separator(app)?,
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

    let help_menu = Submenu::with_items(
        app,
        "Help",
        true,
        &[
            &MenuItem::with_id(app, "documentation", "Atlas Documentation", true, None::<&str>)?,
            &MenuItem::with_id(app, "report_issue", "Report an Issue...", true, None::<&str>)?,
        ],
    )?;

    Menu::with_items(app, &[&app_menu, &edit_menu, &view_menu, &window_menu, &help_menu])
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

#[derive(Clone)]
struct TrayIcons {
    base: Image<'static>,
    saving: Image<'static>,
}

#[derive(Clone, Copy)]
enum TrayStatus {
    Saving,
    Saved,
    Failed,
}

fn overlay_status_dot(rgba: &mut [u8], width: u32, height: u32) {
    if width == 0 || height == 0 {
        return;
    }

    let min_dim = width.min(height);
    let radius = (min_dim / 6).max(2) as i32;
    let padding: u32 = 1;
    let center_x = width.saturating_sub(padding + radius as u32) as i32;
    let center_y = height.saturating_sub(padding + radius as u32) as i32;

    let border = (radius / 3).max(1);
    let inner_radius = (radius - border).max(1);
    let x_start = center_x - radius;
    let x_end = center_x + radius;
    let y_start = center_y - radius;
    let y_end = center_y + radius;

    for y in y_start..=y_end {
        for x in x_start..=x_end {
            let dx = x - center_x;
            let dy = y - center_y;
            let dist2 = dx * dx + dy * dy;
            if dist2 <= radius * radius {
                if x >= 0 && y >= 0 && (x as u32) < width && (y as u32) < height {
                    let idx = ((y as u32 * width + x as u32) * 4) as usize;
                    if dist2 <= inner_radius * inner_radius {
                        rgba[idx] = 0;
                        rgba[idx + 1] = 0;
                        rgba[idx + 2] = 0;
                        rgba[idx + 3] = 255;
                    } else {
                        rgba[idx] = 0;
                        rgba[idx + 1] = 0;
                        rgba[idx + 2] = 0;
                        rgba[idx + 3] = 0;
                    }
                }
            }
        }
    }
}

fn create_saving_icon(base: &Image<'static>) -> Image<'static> {
    let mut rgba = base.rgba().to_vec();
    overlay_status_dot(&mut rgba, base.width(), base.height());
    Image::new_owned(rgba, base.width(), base.height())
}

fn load_tray_icons(app: &tauri::AppHandle) -> TrayIcons {
    let icon_bytes = include_bytes!("../icons/trayIcon.png");
    let base = image::load_from_memory(icon_bytes)
        .map(|img| {
            let rgba = img.to_rgba8();
            let (width, height) = rgba.dimensions();
            Image::new_owned(rgba.into_raw(), width, height)
        })
        .unwrap_or_else(|_| {
            if let Some(icon) = app.default_window_icon() {
                icon.clone().to_owned()
            } else {
                Image::new_owned(vec![0u8; 4 * 32 * 32], 32, 32)
            }
        });
    let saving = create_saving_icon(&base);

    TrayIcons { base, saving }
}

/// Shared state for the tray icon handle
pub struct TrayState {
    pub handle: TokioMutex<Option<tauri::tray::TrayIcon>>,
    pub icons: TokioMutex<Option<TrayIcons>>,
}

impl TrayState {
    pub fn new() -> Self {
        TrayState {
            handle: TokioMutex::new(None),
            icons: TokioMutex::new(None),
        }
    }
}

/// Create the tray menu
fn create_tray_menu(app: &tauri::AppHandle) -> Result<tauri::menu::Menu<tauri::Wry>, tauri::Error> {
    let add_item = MenuItem::with_id(app, "tray_add", "Quick Capture", true, Some("CmdOrCtrl+Shift+S"))?;
    let separator1 = PredefinedMenuItem::separator(app)?;
    let open_item = MenuItem::with_id(app, "tray_open", "Open Atlas", true, None::<&str>)?;
    let updates_item = MenuItem::with_id(app, "tray_updates", "Check for Updates...", true, None::<&str>)?;
    let separator2 = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "tray_quit", "Quit Atlas", true, Some("CmdOrCtrl+Q"))?;
    
    tauri::menu::Menu::with_items(app, &[&add_item, &separator1, &open_item, &updates_item, &separator2, &quit_item])
}

/// Update tray icon/tooltip to show status (icon-only, no title text)
async fn set_tray_status(app: &tauri::AppHandle, status: TrayStatus) {
    if let Some(tray_state) = app.try_state::<TrayState>() {
        let tray = tray_state.handle.lock().await;
        let icons = tray_state.icons.lock().await;

        if let (Some(tray), Some(icons)) = (tray.as_ref(), icons.as_ref()) {
            let (tooltip, icon) = match status {
                TrayStatus::Saving => ("Saving...", &icons.saving),
                TrayStatus::Saved => ("Saved", &icons.base),
                TrayStatus::Failed => ("Save failed", &icons.base),
            };
            let _ = tray.set_title(None::<&str>);
            let _ = tray.set_tooltip(Some(tooltip));
            let _ = tray.set_icon(Some(icon.clone()));
            let _ = tray.set_icon_as_template(true);
        }
    }
}

/// Clear tray status UI and restore the base icon
async fn clear_tray_status(app: &tauri::AppHandle) {
    if let Some(tray_state) = app.try_state::<TrayState>() {
        let tray = tray_state.handle.lock().await;
        let icons = tray_state.icons.lock().await;

        if let (Some(tray), Some(icons)) = (tray.as_ref(), icons.as_ref()) {
            let _ = tray.set_title(None::<&str>);
            let _ = tray.set_tooltip(None::<&str>);
            let _ = tray.set_icon(Some(icons.base.clone()));
            let _ = tray.set_icon_as_template(true);
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let vault_state = VaultState::new().expect("Failed to initialize vault state");
    let tray_state = TrayState::new();
    
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
                            // Perform the capture silently in background
                            let app_handle = app.clone();
                            tauri::async_runtime::spawn(async move {
                                // Update tray to show saving status
                                set_tray_status(&app_handle, TrayStatus::Saving).await;
                                
                                match capture::capture() {
                                    Ok(data) => {
                                        // Save in background without showing window
                                        match commands::items::add_item_from_capture(
                                            data,
                                            app_handle.state::<VaultState>(),
                                        )
                                        .await
                                        {
                                            Ok(_) => {
                                                set_tray_status(&app_handle, TrayStatus::Saved).await;
                                                if let Some(window) = app_handle.get_webview_window("main") {
                                                    let _ = window.emit("items-updated", ());
                                                }
                                            }
                                            Err(e) => {
                                                eprintln!("Background save failed: {}", e);
                                                set_tray_status(&app_handle, TrayStatus::Failed).await;
                                            }
                                        }
                                    }
                                    Err(e) => {
                                        eprintln!("Quick capture failed: {}", e);
                                        set_tray_status(&app_handle, TrayStatus::Failed).await;
                                    }
                                }
                                
                                // Clear status after delay
                                tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                                clear_tray_status(&app_handle).await;
                            });
                        }
                    }
                })
                .build(),
        )
        .manage(vault_state)
        .manage(tray_state)
        .setup(move |app| {
            let menu = create_app_menu(app.handle())?;
            app.set_menu(menu)?;
            
            // Register the global shortcut
            app.global_shortcut().register(quick_capture_shortcut)?;
            
            // Create tray icon
            let tray_menu = create_tray_menu(app.handle())?;
            
            let tray_icons = load_tray_icons(app.handle());
            
            let tray_icon = TrayIconBuilder::new()
                .icon(tray_icons.base.clone())
                .icon_as_template(true) // Important for macOS menu bar
                .menu(&tray_menu)
                .show_menu_on_left_click(true) // Show menu on click
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "tray_add" => {
                            // Trigger quick capture manually
                            let app_handle = app.clone();
                            tauri::async_runtime::spawn(async move {
                                set_tray_status(&app_handle, TrayStatus::Saving).await;
                                
                                match capture::capture() {
                                    Ok(data) => {
                                        match commands::items::add_item_from_capture(
                                            data,
                                            app_handle.state::<VaultState>(),
                                        )
                                        .await
                                        {
                                            Ok(_) => {
                                                set_tray_status(&app_handle, TrayStatus::Saved).await;
                                                if let Some(window) = app_handle.get_webview_window("main") {
                                                    let _ = window.emit("items-updated", ());
                                                }
                                            }
                                            Err(e) => {
                                                eprintln!("Quick capture failed: {}", e);
                                                set_tray_status(&app_handle, TrayStatus::Failed).await;
                                            }
                                        }
                                    }
                                    Err(e) => {
                                        eprintln!("Capture failed: {}", e);
                                        set_tray_status(&app_handle, TrayStatus::Failed).await;
                                    }
                                }
                                
                                tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                                clear_tray_status(&app_handle).await;
                            });
                        }
                        "tray_open" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "tray_updates" => {
                            // Show window and trigger update check
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                                let _ = window.emit("check-for-updates", ());
                            }
                        }
                        "tray_quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .build(app)?;
            
            // Store tray handle for later use
            let tray_state = app.state::<TrayState>();
            tauri::async_runtime::block_on(async {
                *tray_state.handle.lock().await = Some(tray_icon);
                *tray_state.icons.lock().await = Some(tray_icons);
            });
            
            Ok(())
        })
        .on_menu_event(|app, event| {
            // Handle context menu actions (ctx_ prefixed IDs)
            if event.id().as_ref().starts_with("ctx_") {
                if let Some(window) = app.get_webview_window("main") {
                    if let Some(item_id) = commands::menu::get_current_context_item_id() {
                        let action = event.id().as_ref().strip_prefix("ctx_").unwrap_or("");
                        let payload = serde_json::json!({
                            "action": action,
                            "item_id": item_id
                        });
                        let _ = window.emit("context-menu-action", payload);
                    }
                }
                return;
            }

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
                "find" => {
                    // Emit event to frontend to focus search
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.emit("focus-search", ());
                    }
                }
                "zoom_in" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.emit("zoom", "in");
                    }
                }
                "zoom_out" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.emit("zoom", "out");
                    }
                }
                "zoom_reset" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.emit("zoom", "reset");
                    }
                }
                "documentation" => {
                    // Open documentation in browser
                    #[cfg(target_os = "macos")]
                    {
                        let _ = std::process::Command::new("open")
                            .arg("https://github.com/antoinepirard/Atlas#readme")
                            .spawn();
                    }
                }
                "report_issue" => {
                    // Open GitHub issues
                    #[cfg(target_os = "macos")]
                    {
                        let _ = std::process::Command::new("open")
                            .arg("https://github.com/antoinepirard/Atlas/issues/new")
                            .spawn();
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
            commands::set_vault_name,
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
            commands::get_items_page,
            commands::add_item,
            commands::update_item,
            commands::delete_item,
            commands::get_item_count,
            // Image commands (external storage)
            commands::get_full_image,
            commands::migrate_image_to_external,
            commands::migrate_all_images,
            // AI commands
            commands::save_api_key,
            commands::has_api_key,
            commands::get_api_key_masked,
            commands::process_with_ai,
            commands::get_search_embedding,
            commands::fetch_url_metadata,
            commands::classify_search_tokens,
            // Search commands (server-side)
            search::semantic_search,
            search::text_search,
            search::reindex_all_embeddings,
            search::rebuild_fts_index,
            search::get_all_tags,
            // Quick capture commands
            trigger_quick_capture,
            check_accessibility_permission,
            request_accessibility_permission,
            open_accessibility_settings,
            // Context menu
            commands::show_item_context_menu,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
