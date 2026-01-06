//! macOS capture module for Quick Capture feature
//! Uses AppleScript to interact with the frontmost application
//! and capture selected text, URLs, and page titles.

use std::process::Command;

#[cfg(target_os = "macos")]
#[link(name = "ApplicationServices", kind = "framework")]
extern "C" {
    fn AXIsProcessTrusted() -> bool;
    fn AXIsProcessTrustedWithOptions(options: core_foundation::base::CFTypeRef) -> bool;
}

#[cfg(target_os = "macos")]
use core_foundation::base::TCFType;
#[cfg(target_os = "macos")]
use core_foundation::boolean::CFBoolean;
#[cfg(target_os = "macos")]
use core_foundation::dictionary::CFDictionary;
#[cfg(target_os = "macos")]
use core_foundation::string::CFString;

/// Result of a quick capture operation
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct QuickCaptureData {
    /// The name of the frontmost application
    pub app_name: String,
    /// Whether the frontmost app is a supported browser
    pub is_browser: bool,
    /// The URL of the current page (if browser)
    pub url: Option<String>,
    /// The title of the current page (if browser)
    pub page_title: Option<String>,
    /// The selected text (if any)
    pub selected_text: Option<String>,
}

/// List of supported browser bundle identifiers and their display names
const SUPPORTED_BROWSERS: &[(&str, &str)] = &[
    ("Safari", "Safari"),
    ("Google Chrome", "Google Chrome"),
    ("Arc", "Arc"),
    ("Brave Browser", "Brave Browser"),
    ("Microsoft Edge", "Microsoft Edge"),
    ("Chromium", "Chromium"),
    ("Opera", "Opera"),
    ("Vivaldi", "Vivaldi"),
];

/// Execute an AppleScript and return the output
fn run_applescript(script: &str) -> Result<String, String> {
    let output = Command::new("osascript")
        .arg("-e")
        .arg(script)
        .output()
        .map_err(|e| format!("Failed to execute osascript: {}", e))?;

    if output.status.success() {
        let result = String::from_utf8_lossy(&output.stdout)
            .trim()
            .to_string();
        Ok(result)
    } else {
        let error = String::from_utf8_lossy(&output.stderr).to_string();
        Err(error)
    }
}

/// Get the name of the frontmost application
pub fn get_frontmost_app() -> Result<String, String> {
    let script = r#"
        tell application "System Events"
            set frontApp to first application process whose frontmost is true
            return name of frontApp
        end tell
    "#;
    run_applescript(script)
}

/// Check if the given app name is a supported browser
pub fn is_supported_browser(app_name: &str) -> bool {
    SUPPORTED_BROWSERS
        .iter()
        .any(|(name, _)| app_name.eq_ignore_ascii_case(name))
}

/// Get the URL from the current browser tab
pub fn get_browser_url(browser_name: &str) -> Result<String, String> {
    let script = match browser_name.to_lowercase().as_str() {
        "safari" => r#"
            tell application "Safari"
                if (count of windows) > 0 then
                    return URL of current tab of front window
                else
                    return ""
                end if
            end tell
        "#.to_string(),
        "google chrome" | "chromium" | "brave browser" | "microsoft edge" | "opera" | "vivaldi" => {
            // All Chromium-based browsers use similar AppleScript interface
            let app_name = match browser_name.to_lowercase().as_str() {
                "google chrome" => "Google Chrome",
                "chromium" => "Chromium",
                "brave browser" => "Brave Browser",
                "microsoft edge" => "Microsoft Edge",
                "opera" => "Opera",
                "vivaldi" => "Vivaldi",
                _ => browser_name,
            };
            format!(r#"
                tell application "{}"
                    if (count of windows) > 0 then
                        return URL of active tab of front window
                    else
                        return ""
                    end if
                end tell
            "#, app_name)
        },
        "arc" => r#"
            tell application "Arc"
                if (count of windows) > 0 then
                    return URL of active tab of front window
                else
                    return ""
                end if
            end tell
        "#.to_string(),
        _ => return Err(format!("Unsupported browser: {}", browser_name)),
    };

    run_applescript(&script)
}

/// Get the page title from the current browser tab
pub fn get_browser_title(browser_name: &str) -> Result<String, String> {
    let script = match browser_name.to_lowercase().as_str() {
        "safari" => r#"
            tell application "Safari"
                if (count of windows) > 0 then
                    return name of current tab of front window
                else
                    return ""
                end if
            end tell
        "#.to_string(),
        "google chrome" | "chromium" | "brave browser" | "microsoft edge" | "opera" | "vivaldi" => {
            let app_name = match browser_name.to_lowercase().as_str() {
                "google chrome" => "Google Chrome",
                "chromium" => "Chromium",
                "brave browser" => "Brave Browser",
                "microsoft edge" => "Microsoft Edge",
                "opera" => "Opera",
                "vivaldi" => "Vivaldi",
                _ => browser_name,
            };
            format!(r#"
                tell application "{}"
                    if (count of windows) > 0 then
                        return title of active tab of front window
                    else
                        return ""
                    end if
                end tell
            "#, app_name)
        },
        "arc" => r#"
            tell application "Arc"
                if (count of windows) > 0 then
                    return title of active tab of front window
                else
                    return ""
                end if
            end tell
        "#.to_string(),
        _ => return Err(format!("Unsupported browser: {}", browser_name)),
    };

    run_applescript(&script)
}

/// Get the selected text from the frontmost application using Accessibility API
pub fn get_selected_text() -> Result<Option<String>, String> {
    // First, try using the Accessibility API through AppleScript
    let script = r#"
        use framework "AppKit"
        use scripting additions
        
        set selectedText to ""
        
        try
            tell application "System Events"
                set frontApp to first application process whose frontmost is true
                set axApp to frontApp
                
                -- Try to get focused UI element and its selected text
                try
                    set focusedElement to value of attribute "AXFocusedUIElement" of axApp
                    set selectedText to value of attribute "AXSelectedText" of focusedElement
                on error
                    -- Fallback: try getting selected text from the app itself
                    try
                        set selectedText to value of attribute "AXSelectedText" of axApp
                    end try
                end try
            end tell
        end try
        
        return selectedText
    "#;

    match run_applescript(script) {
        Ok(text) => {
            let trimmed = text.trim();
            if trimmed.is_empty() || trimmed == "missing value" {
                Ok(None)
            } else {
                Ok(Some(trimmed.to_string()))
            }
        }
        Err(_) => {
            // If Accessibility API fails, return None rather than error
            // User might not have granted Accessibility permissions yet
            Ok(None)
        }
    }
}

/// Perform a complete quick capture operation
pub fn capture() -> Result<QuickCaptureData, String> {
    // Get the frontmost application
    let app_name = get_frontmost_app()?;
    
    // Check if it's a browser
    let is_browser = is_supported_browser(&app_name);
    
    // Get URL and title if it's a browser
    let (url, page_title) = if is_browser {
        let url = get_browser_url(&app_name).ok().filter(|s| !s.is_empty());
        let title = get_browser_title(&app_name).ok().filter(|s| !s.is_empty());
        (url, title)
    } else {
        (None, None)
    };
    
    // Get selected text
    let selected_text = get_selected_text()?;
    
    Ok(QuickCaptureData {
        app_name,
        is_browser,
        url,
        page_title,
        selected_text,
    })
}

/// Check if Accessibility permissions are granted using macOS AXIsProcessTrusted API
#[cfg(target_os = "macos")]
pub fn check_accessibility_permission() -> bool {
    unsafe { AXIsProcessTrusted() }
}

#[cfg(not(target_os = "macos"))]
pub fn check_accessibility_permission() -> bool {
    false
}

/// Request accessibility permission with prompt
/// This will show the system dialog asking the user to grant access
#[cfg(target_os = "macos")]
pub fn request_accessibility_permission() -> bool {
    use core_foundation::base::CFType;
    
    unsafe {
        let key = CFString::new("AXTrustedCheckOptionPrompt");
        let value = CFBoolean::true_value();
        
        let keys: Vec<CFType> = vec![key.as_CFType()];
        let values: Vec<CFType> = vec![value.as_CFType()];
        
        let pairs: Vec<(CFType, CFType)> = keys.into_iter().zip(values.into_iter()).collect();
        let options = CFDictionary::from_CFType_pairs(&pairs);
        
        AXIsProcessTrustedWithOptions(options.as_concrete_TypeRef() as _)
    }
}

#[cfg(not(target_os = "macos"))]
pub fn request_accessibility_permission() -> bool {
    false
}

/// Open System Preferences to Accessibility settings
pub fn open_accessibility_settings() -> Result<(), String> {
    // Use the URL scheme that works on all macOS versions
    let output = Command::new("open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
        .output()
        .map_err(|e| format!("Failed to open System Settings: {}", e))?;
    
    if !output.status.success() {
        return Err("Failed to open System Settings".to_string());
    }
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_supported_browser() {
        assert!(is_supported_browser("Safari"));
        assert!(is_supported_browser("Google Chrome"));
        assert!(is_supported_browser("Arc"));
        assert!(!is_supported_browser("Finder"));
        assert!(!is_supported_browser("VSCode"));
    }
}

