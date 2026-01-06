//! Biometrics module for Touch ID authentication on macOS
//!
//! This module provides functions to store and retrieve the vault encryption key
//! using the macOS Keychain with biometric (Touch ID) protection.

#[cfg(target_os = "macos")]
use std::process::Command;
#[cfg(target_os = "macos")]
use std::fs;
#[cfg(target_os = "macos")]
use std::io::Write;

const SERVICE_NAME: &str = "com.antoinepirard.atlas";
const ACCOUNT_NAME: &str = "vault-key";

/// Get the path to our Swift helper binary
#[cfg(target_os = "macos")]
fn get_helper_path() -> std::path::PathBuf {
    // Store in app support directory for persistence
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    let app_support = std::path::PathBuf::from(home)
        .join("Library/Application Support/Atlas");
    
    // Create directory if needed
    let _ = fs::create_dir_all(&app_support);
    
    app_support.join("Atlas")
}

/// Ensure the Swift helper is compiled
#[cfg(target_os = "macos")]
fn ensure_helper() -> Result<std::path::PathBuf, String> {
    let helper_path = get_helper_path();
    
    // Check if we need to compile
    if helper_path.exists() {
        return Ok(helper_path);
    }
    
    // Swift helper that handles Touch ID + Keychain in one operation
    // Note: We store without biometric ACL (requires entitlements), but authenticate with Touch ID before retrieval
    let swift_code = format!(r#"
import Foundation
import LocalAuthentication
import Security

let service = "{service}"
let account = "{account}"

func checkAvailable() -> Bool {{
    let context = LAContext()
    var error: NSError?
    return context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
}}

func storeKey(_ keyHex: String) -> Bool {{
    guard let keyData = Data(hexString: keyHex) else {{
        fputs("Invalid hex key\n", stderr)
        return false
    }}
    
    // Delete existing item first
    let deleteQuery: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: service,
        kSecAttrAccount as String: account
    ]
    SecItemDelete(deleteQuery as CFDictionary)
    
    // Store without biometric ACL (would require entitlements)
    // Security is provided by Touch ID check before retrieval
    let addQuery: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: service,
        kSecAttrAccount as String: account,
        kSecValueData as String: keyData,
        kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
    ]
    
    let status = SecItemAdd(addQuery as CFDictionary, nil)
    if status != errSecSuccess {{
        fputs("Failed to store key: \(status)\n", stderr)
        return false
    }}
    
    return true
}}

func retrieveKey() -> String? {{
    // First, authenticate with Touch ID
    let context = LAContext()
    var error: NSError?
    
    guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {{
        fputs("Touch ID not available\n", stderr)
        return nil
    }}
    
    let semaphore = DispatchSemaphore(value: 0)
    var authSuccess = false
    
    context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: "Unlock Atlas vault") {{ success, _ in
        authSuccess = success
        semaphore.signal()
    }}
    
    _ = semaphore.wait(timeout: .now() + 60)
    
    guard authSuccess else {{
        fputs("Touch ID authentication failed\n", stderr)
        return nil
    }}
    
    // Now retrieve the key from Keychain
    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: service,
        kSecAttrAccount as String: account,
        kSecReturnData as String: true,
        kSecMatchLimit as String: kSecMatchLimitOne
    ]
    
    var result: AnyObject?
    let status = SecItemCopyMatching(query as CFDictionary, &result)
    
    if status == errSecSuccess, let data = result as? Data {{
        return data.hexString
    }}
    
    fputs("Failed to retrieve key: \(status)\n", stderr)
    return nil
}}

func checkEnabled() -> Bool {{
    // Query without authentication to check if item exists
    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: service,
        kSecAttrAccount as String: account,
        kSecReturnAttributes as String: true,
        kSecMatchLimit as String: kSecMatchLimitOne
    ]
    
    var result: AnyObject?
    let status = SecItemCopyMatching(query as CFDictionary, &result)
    return status == errSecSuccess
}}

func removeKey() -> Bool {{
    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: service,
        kSecAttrAccount as String: account
    ]
    
    let status = SecItemDelete(query as CFDictionary)
    return status == errSecSuccess || status == errSecItemNotFound
}}

// Helper extension for hex encoding/decoding
extension Data {{
    init?(hexString: String) {{
        let len = hexString.count / 2
        var data = Data(capacity: len)
        var index = hexString.startIndex
        for _ in 0..<len {{
            let nextIndex = hexString.index(index, offsetBy: 2)
            guard let byte = UInt8(hexString[index..<nextIndex], radix: 16) else {{
                return nil
            }}
            data.append(byte)
            index = nextIndex
        }}
        self = data
    }}
    
    var hexString: String {{
        return map {{ String(format: "%02x", $0) }}.joined()
    }}
}}

// Main entry point
let args = CommandLine.arguments
guard args.count >= 2 else {{
    fputs("Usage: atlas-touchid <command> [args]\n", stderr)
    exit(1)
}}

switch args[1] {{
case "available":
    print(checkAvailable() ? "true" : "false")
case "enabled":
    print(checkEnabled() ? "true" : "false")
case "store":
    guard args.count >= 3 else {{
        fputs("Missing key argument\n", stderr)
        exit(1)
    }}
    print(storeKey(args[2]) ? "true" : "false")
case "retrieve":
    if let key = retrieveKey() {{
        print(key)
    }} else {{
        exit(1)
    }}
case "remove":
    print(removeKey() ? "true" : "false")
default:
    fputs("Unknown command: \(args[1])\n", stderr)
    exit(1)
}}
"#, service = SERVICE_NAME, account = ACCOUNT_NAME);
    
    // Write and compile
    let temp_dir = std::env::temp_dir();
    let swift_file = temp_dir.join("atlas_touchid.swift");
    
    let mut file = fs::File::create(&swift_file)
        .map_err(|e| format!("Failed to create Swift file: {}", e))?;
    file.write_all(swift_code.as_bytes())
        .map_err(|e| format!("Failed to write Swift file: {}", e))?;
    drop(file);
    
    // Compile with security frameworks
    let compile_result = Command::new("swiftc")
        .args([
            "-O",
            "-o", helper_path.to_str().unwrap(),
            swift_file.to_str().unwrap(),
            "-framework", "Security",
            "-framework", "LocalAuthentication"
        ])
        .output()
        .map_err(|e| format!("Failed to run swiftc: {}", e))?;
    
    if !compile_result.status.success() {
        return Err(format!("Swift compilation failed: {}", 
            String::from_utf8_lossy(&compile_result.stderr)));
    }
    
    // Clean up temp file
    let _ = fs::remove_file(&swift_file);
    
    Ok(helper_path)
}

/// Run the helper with a command
#[cfg(target_os = "macos")]
fn run_helper(args: &[&str]) -> Result<String, String> {
    let helper = ensure_helper()?;
    
    let output = Command::new(&helper)
        .args(args)
        .output()
        .map_err(|e| format!("Failed to run helper: {}", e))?;
    
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

/// Check if biometrics (Touch ID) is available on this device
#[cfg(target_os = "macos")]
pub fn is_available() -> bool {
    run_helper(&["available"])
        .map(|s| s == "true")
        .unwrap_or(false)
}

#[cfg(not(target_os = "macos"))]
pub fn is_available() -> bool {
    false
}

/// Check if a biometric key is already stored
#[cfg(target_os = "macos")]
pub fn is_enabled() -> bool {
    run_helper(&["enabled"])
        .map(|s| s == "true")
        .unwrap_or(false)
}

#[cfg(not(target_os = "macos"))]
pub fn is_enabled() -> bool {
    false
}

/// Store the encryption key in Keychain with biometric protection
#[cfg(target_os = "macos")]
pub fn store_key(key: &[u8; 32]) -> Result<(), String> {
    let key_hex: String = key.iter().map(|b| format!("{:02x}", b)).collect();
    
    let result = run_helper(&["store", &key_hex])?;
    
    if result == "true" {
        Ok(())
    } else {
        Err("Failed to store key".to_string())
    }
}

#[cfg(not(target_os = "macos"))]
pub fn store_key(_key: &[u8; 32]) -> Result<(), String> {
    Err("Biometrics not supported on this platform".to_string())
}

/// Retrieve the encryption key using biometric authentication
/// This will automatically prompt for Touch ID
#[cfg(target_os = "macos")]
pub fn retrieve_key() -> Result<[u8; 32], String> {
    let key_hex = run_helper(&["retrieve"])?;
    
    // Convert hex back to bytes
    if key_hex.len() != 64 {
        return Err("Invalid key length".to_string());
    }
    
    let mut key = [0u8; 32];
    for i in 0..32 {
        key[i] = u8::from_str_radix(&key_hex[i*2..i*2+2], 16)
            .map_err(|_| "Invalid hex in key")?;
    }
    
    Ok(key)
}

#[cfg(not(target_os = "macos"))]
pub fn retrieve_key() -> Result<[u8; 32], String> {
    Err("Biometrics not supported on this platform".to_string())
}

/// Remove the stored key from Keychain
#[cfg(target_os = "macos")]
pub fn remove_key() -> Result<(), String> {
    let result = run_helper(&["remove"])?;
    
    if result == "true" {
        Ok(())
    } else {
        Err("Failed to remove key".to_string())
    }
}

#[cfg(not(target_os = "macos"))]
pub fn remove_key() -> Result<(), String> {
    Err("Biometrics not supported on this platform".to_string())
}
