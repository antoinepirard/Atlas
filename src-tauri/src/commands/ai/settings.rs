use std::fs;
use std::path::PathBuf;

use crate::db::get_app_dir_name;

use super::types::AiSettings;

const AI_SETTINGS_FILE: &str = ".ai_settings.json";

fn get_ai_settings_file_path() -> Result<PathBuf, String> {
    let app_dir = dirs::data_local_dir()
        .ok_or_else(|| "Could not find app data directory".to_string())?
        .join(get_app_dir_name());

    fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create app directory: {}", e))?;

    Ok(app_dir.join(AI_SETTINGS_FILE))
}

pub(super) fn load_ai_settings() -> AiSettings {
    let path = match get_ai_settings_file_path() {
        Ok(path) => path,
        Err(_) => return AiSettings::default(),
    };
    if !path.exists() {
        return AiSettings::default();
    }

    let contents = match fs::read_to_string(path) {
        Ok(contents) => contents,
        Err(_) => return AiSettings::default(),
    };

    let parsed = serde_json::from_str::<AiSettings>(&contents).unwrap_or_default();
    sanitize_ai_settings(parsed)
}

fn save_ai_settings(settings: &AiSettings) -> Result<(), String> {
    let path = get_ai_settings_file_path()?;
    let payload = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("Failed to serialize AI settings: {}", e))?;
    fs::write(path, payload).map_err(|e| format!("Failed to save AI settings: {}", e))?;
    Ok(())
}

fn sanitize_ai_settings(settings: AiSettings) -> AiSettings {
    // Ensure warning threshold is between 0 and 1
    let warning_threshold = settings.warning_threshold_percent.clamp(0.0, 1.0);
    // Ensure budget is non-negative if set
    let budget = settings.monthly_budget_usd.map(|b| b.max(0.0));
    
    AiSettings {
        monthly_budget_usd: budget,
        warning_threshold_percent: warning_threshold,
    }
}

#[tauri::command]
pub fn get_ai_settings() -> AiSettings {
    load_ai_settings()
}

#[tauri::command]
pub fn set_ai_settings(settings: AiSettings) -> Result<AiSettings, String> {
    let sanitized = sanitize_ai_settings(settings);
    save_ai_settings(&sanitized)?;
    Ok(sanitized)
}
