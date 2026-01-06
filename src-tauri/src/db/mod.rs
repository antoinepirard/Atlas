use rusqlite::{Connection, Result as SqliteResult};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

/// Encrypted item stored in the database
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedItem {
    pub id: String,
    pub encrypted_data: String,
    pub created_at: String,
    pub updated_at: String,
}

/// Vault configuration stored in the database
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultConfig {
    pub salt: String,             // Base64 encoded salt
    pub verification: String,     // Encrypted verification token
    pub recovery_encrypted: String, // Recovery phrase encrypted with password
    pub auto_lock_minutes: i32,
}

/// Database manager for the vault
pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    /// Open or create the database at the specified path
    pub fn open(path: &PathBuf) -> SqliteResult<Self> {
        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).ok();
        }
        
        let conn = Connection::open(path)?;
        let db = Database {
            conn: Mutex::new(conn),
        };
        db.initialize()?;
        Ok(db)
    }
    
    /// Initialize the database schema
    fn initialize(&self) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS vault_config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            
            CREATE TABLE IF NOT EXISTS items (
                id TEXT PRIMARY KEY,
                encrypted_data TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            
            CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at);
            "
        )?;
        
        Ok(())
    }
    
    /// Check if vault is initialized
    pub fn vault_exists(&self) -> SqliteResult<bool> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT 1 FROM vault_config WHERE key = 'salt' LIMIT 1")?;
        let exists = stmt.exists([])?;
        Ok(exists)
    }
    
    /// Save vault configuration
    pub fn save_vault_config(&self, config: &VaultConfig) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        
        let configs = [
            ("salt", &config.salt),
            ("verification", &config.verification),
            ("recovery_encrypted", &config.recovery_encrypted),
            ("auto_lock_minutes", &config.auto_lock_minutes.to_string()),
        ];
        
        for (key, value) in configs {
            conn.execute(
                "INSERT OR REPLACE INTO vault_config (key, value) VALUES (?1, ?2)",
                [key, value],
            )?;
        }
        
        Ok(())
    }
    
    /// Get vault configuration
    pub fn get_vault_config(&self) -> SqliteResult<Option<VaultConfig>> {
        let conn = self.conn.lock().unwrap();
        
        let get_value = |key: &str| -> SqliteResult<Option<String>> {
            let mut stmt = conn.prepare("SELECT value FROM vault_config WHERE key = ?1")?;
            let result: Option<String> = stmt.query_row([key], |row| row.get(0)).ok();
            Ok(result)
        };
        
        let salt = match get_value("salt")? {
            Some(v) => v,
            None => return Ok(None),
        };
        
        let verification = get_value("verification")?.unwrap_or_default();
        let recovery_encrypted = get_value("recovery_encrypted")?.unwrap_or_default();
        let auto_lock_minutes: i32 = get_value("auto_lock_minutes")?
            .and_then(|v| v.parse().ok())
            .unwrap_or(15);
        
        Ok(Some(VaultConfig {
            salt,
            verification,
            recovery_encrypted,
            auto_lock_minutes,
        }))
    }
    
    /// Update auto-lock minutes
    pub fn set_auto_lock_minutes(&self, minutes: i32) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO vault_config (key, value) VALUES ('auto_lock_minutes', ?1)",
            [minutes.to_string()],
        )?;
        Ok(())
    }
    
    /// Save an encrypted item
    pub fn save_item(&self, item: &EncryptedItem) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO items (id, encrypted_data, created_at, updated_at) 
             VALUES (?1, ?2, ?3, ?4)",
            [&item.id, &item.encrypted_data, &item.created_at, &item.updated_at],
        )?;
        Ok(())
    }
    
    /// Get all encrypted items
    pub fn get_all_items(&self) -> SqliteResult<Vec<EncryptedItem>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, encrypted_data, created_at, updated_at FROM items ORDER BY created_at DESC"
        )?;
        
        let items = stmt.query_map([], |row| {
            Ok(EncryptedItem {
                id: row.get(0)?,
                encrypted_data: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })?;
        
        items.collect()
    }
    
    /// Get a single item by ID
    pub fn get_item(&self, id: &str) -> SqliteResult<Option<EncryptedItem>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, encrypted_data, created_at, updated_at FROM items WHERE id = ?1"
        )?;
        
        let item = stmt.query_row([id], |row| {
            Ok(EncryptedItem {
                id: row.get(0)?,
                encrypted_data: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
            })
        }).ok();
        
        Ok(item)
    }
    
    /// Delete an item
    pub fn delete_item(&self, id: &str) -> SqliteResult<bool> {
        let conn = self.conn.lock().unwrap();
        let affected = conn.execute("DELETE FROM items WHERE id = ?1", [id])?;
        Ok(affected > 0)
    }
    
    /// Get item count
    pub fn get_item_count(&self) -> SqliteResult<i64> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT COUNT(*) FROM items")?;
        stmt.query_row([], |row| row.get(0))
    }
    
    /// Clear all items (destructive!)
    pub fn clear_items(&self) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM items", [])?;
        Ok(())
    }
    
    /// Reset vault completely (destructive!)
    pub fn reset_vault(&self) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            "DELETE FROM items; DELETE FROM vault_config;"
        )?;
        Ok(())
    }
}

/// Get storage path preference from keychain
pub fn get_storage_path_preference() -> Option<String> {
    if let Ok(entry) = keyring::Entry::new("mymind", "storage_path") {
        if let Ok(path) = entry.get_password() {
            return Some(path);
        }
    }
    None
}

/// Set storage path preference in keychain
pub fn set_storage_path_preference(path: &str) -> Result<(), String> {
    let entry = keyring::Entry::new("mymind", "storage_path")
        .map_err(|e| format!("Failed to access keychain: {}", e))?;
    
    entry.set_password(path)
        .map_err(|e| format!("Failed to save storage path: {}", e))?;
    
    Ok(())
}

/// Get the database path (checks preference first, falls back to default)
pub fn get_db_path() -> PathBuf {
    // Check for custom storage path preference
    if let Some(custom_path) = get_storage_path_preference() {
        let path = PathBuf::from(&custom_path).join("vault.db");
        // Only use custom path if the parent directory exists
        if path.parent().map(|p| p.exists()).unwrap_or(false) {
            return path;
        }
    }
    
    // Default path
    let mut path = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("mymind");
    path.push("vault.db");
    path
}

