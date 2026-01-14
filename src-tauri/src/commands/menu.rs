use tauri::{
    menu::{ContextMenu, IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu},
    AppHandle, Manager, State,
};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

use crate::commands::spaces;
use crate::commands::vault::VaultState;

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
    state: State<'_, VaultState>,
) -> Result<(), String> {
    let webview_window = app
        .get_webview_window("main")
        .ok_or("Main window not found")?;

    // Get the underlying Window from WebviewWindow for popup
    let window = webview_window.as_ref().window();

    // Store the item_id for the menu event handler
    set_current_context_item_id(Some(options.item_id.clone()));

    let spaces = spaces::get_all_spaces(state).unwrap_or_default();
    let add_to_space_submenu = if spaces.is_empty() {
        None
    } else {
        let mut space_items = Vec::new();
        for space in spaces {
            space_items.push(
                MenuItem::with_id(
                    &app,
                    format!("ctx_space_{}", space.id),
                    space.name,
                    true,
                    None::<&str>,
                )
                .map_err(|e| e.to_string())?,
            );
        }
        let space_refs: Vec<&dyn IsMenuItem<_>> = space_items
            .iter()
            .map(|item| item as &dyn IsMenuItem<_>)
            .collect();
        Some(
            Submenu::with_items(&app, "Add to Space", true, &space_refs)
                .map_err(|e| e.to_string())?,
        )
    };

    let open_item = if options.show_open_external {
        let open_label = match options.item_type.as_str() {
            "url" => "Open in Browser",
            "image" => "Open Image",
            _ => "Open",
        };
        Some(
            MenuItem::with_id(&app, "ctx_open_external", open_label, true, None::<&str>)
                .map_err(|e| e.to_string())?,
        )
    } else {
        None
    };

    let copy_item =
        MenuItem::with_id(&app, "ctx_copy", "Copy", true, None::<&str>)
            .map_err(|e| e.to_string())?;
    let enrich_item =
        MenuItem::with_id(&app, "ctx_enrich", "Enrich", true, None::<&str>)
            .map_err(|e| e.to_string())?;
    let separator = PredefinedMenuItem::separator(&app).map_err(|e| e.to_string())?;
    let delete_item =
        MenuItem::with_id(&app, "ctx_delete", "Delete", true, None::<&str>)
            .map_err(|e| e.to_string())?;

    let mut menu_items: Vec<&dyn IsMenuItem<_>> = Vec::new();
    if let Some(open_item) = open_item.as_ref() {
        menu_items.push(open_item);
    }
    menu_items.push(&copy_item);
    menu_items.push(&enrich_item);
    if let Some(submenu) = add_to_space_submenu.as_ref() {
        menu_items.push(submenu);
    }
    menu_items.push(&separator);
    menu_items.push(&delete_item);

    let menu = Menu::with_items(&app, &menu_items).map_err(|e| e.to_string())?;

    // Show the popup menu at cursor position
    menu.popup(window).map_err(|e| e.to_string())?;

    Ok(())
}
