use tauri::{
    menu::{ContextMenu, Menu, MenuItem, PredefinedMenuItem},
    AppHandle, Manager,
};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextMenuOptions {
    pub item_id: String,
    pub show_open_external: bool,
    pub item_type: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ContextMenuAction {
    pub action: String,
    pub item_id: String,
}

// Store the current item_id for context menu actions
static CURRENT_ITEM_ID: once_cell::sync::Lazy<Arc<Mutex<Option<String>>>> =
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(None)));

/// Get the current item ID for context menu actions
pub fn get_current_context_item_id() -> Option<String> {
    CURRENT_ITEM_ID.lock().ok()?.clone()
}

/// Set the current item ID for context menu actions
fn set_current_context_item_id(item_id: Option<String>) {
    if let Ok(mut id) = CURRENT_ITEM_ID.lock() {
        *id = item_id;
    }
}

/// Show a native context menu for an item
#[tauri::command]
pub async fn show_item_context_menu(
    app: AppHandle,
    options: ContextMenuOptions,
) -> Result<(), String> {
    let webview_window = app
        .get_webview_window("main")
        .ok_or("Main window not found")?;

    // Get the underlying Window from WebviewWindow for popup
    let window = webview_window.as_ref().window();

    // Store the item_id for the menu event handler
    set_current_context_item_id(Some(options.item_id.clone()));

    // Build the menu with unique IDs that include "ctx_" prefix
    let menu = if options.show_open_external {
        let open_label = match options.item_type.as_str() {
            "url" => "Open in Browser",
            "image" => "Open Image",
            _ => "Open",
        };

        Menu::with_items(
            &app,
            &[
                &MenuItem::with_id(&app, "ctx_open_external", open_label, true, None::<&str>)
                    .map_err(|e| e.to_string())?,
                &MenuItem::with_id(&app, "ctx_copy", "Copy", true, None::<&str>)
                    .map_err(|e| e.to_string())?,
                &PredefinedMenuItem::separator(&app).map_err(|e| e.to_string())?,
                &MenuItem::with_id(&app, "ctx_delete", "Delete", true, None::<&str>)
                    .map_err(|e| e.to_string())?,
            ],
        )
        .map_err(|e| e.to_string())?
    } else {
        Menu::with_items(
            &app,
            &[
                &MenuItem::with_id(&app, "ctx_copy", "Copy", true, None::<&str>)
                    .map_err(|e| e.to_string())?,
                &PredefinedMenuItem::separator(&app).map_err(|e| e.to_string())?,
                &MenuItem::with_id(&app, "ctx_delete", "Delete", true, None::<&str>)
                    .map_err(|e| e.to_string())?,
            ],
        )
        .map_err(|e| e.to_string())?
    };

    // Show the popup menu at cursor position
    menu.popup(window).map_err(|e| e.to_string())?;

    Ok(())
}
