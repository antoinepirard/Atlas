use rusqlite::{Connection, Result as SqliteResult};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

/// Get the app data directory name (with -dev suffix for debug builds)
pub fn get_app_dir_name() -> &'static str {
    #[cfg(debug_assertions)]
    {
        "com.antoinepirard.atlas-dev"
    }
    #[cfg(not(debug_assertions))]
    {
        "com.antoinepirard.atlas"
    }
}

/// Migrate old mymind directory to new location if needed
fn migrate_old_data_dir() {
    let old_dir = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("mymind");

    let new_dir = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(get_app_dir_name());

    // Only migrate if old dir exists and new dir doesn't
    if old_dir.exists() && !new_dir.exists() {
        if let Err(e) = fs::rename(&old_dir, &new_dir) {
            eprintln!("Failed to migrate data directory: {}", e);
        }
    }
}

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
    pub name: Option<String>,
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
            
            -- Separate table for embeddings (unencrypted for search)
            -- Embeddings are stored as binary BLOBs for efficiency
            CREATE TABLE IF NOT EXISTS embeddings (
                item_id TEXT PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
                embedding BLOB NOT NULL
            );
            
            -- Full-text search index for fast text searches
            -- Stores unencrypted searchable text
            CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
                item_id,
                title,
                description,
                summary,
                tags,
                content='',
                contentless_delete=1
            );
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
        
        let mut configs: Vec<(String, String)> = vec![
            ("salt".to_string(), config.salt.clone()),
            ("verification".to_string(), config.verification.clone()),
            ("recovery_encrypted".to_string(), config.recovery_encrypted.clone()),
            (
                "auto_lock_minutes".to_string(),
                config.auto_lock_minutes.to_string(),
            ),
        ];

        if let Some(name) = config.name.as_ref().filter(|value| !value.trim().is_empty()) {
            configs.push(("name".to_string(), name.trim().to_string()));
        }

        for (key, value) in configs {
            conn.execute(
                "INSERT OR REPLACE INTO vault_config (key, value) VALUES (?1, ?2)",
                [&key, &value],
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
        let name = get_value("name")?;
        let auto_lock_minutes: i32 = get_value("auto_lock_minutes")?
            .and_then(|v| v.parse().ok())
            .unwrap_or(15);
        
        Ok(Some(VaultConfig {
            name,
            salt,
            verification,
            recovery_encrypted,
            auto_lock_minutes,
        }))
    }

    /// Reopen the database at a new path and reinitialize schema
    pub fn reopen(&self, path: &PathBuf) -> SqliteResult<()> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).ok();
        }

        let conn = Connection::open(path)?;
        {
            let mut guard = self.conn.lock().unwrap();
            *guard = conn;
        }

        self.initialize()
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
    
    /// Get paginated encrypted items
    pub fn get_items_page(&self, offset: u32, limit: u32) -> SqliteResult<Vec<EncryptedItem>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, encrypted_data, created_at, updated_at FROM items 
             ORDER BY created_at DESC 
             LIMIT ?1 OFFSET ?2"
        )?;
        
        let items = stmt.query_map([limit, offset], |row| {
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
            "DELETE FROM items; DELETE FROM vault_config; DELETE FROM embeddings;"
        )?;
        Ok(())
    }
    
    /// Save embedding for an item
    pub fn save_embedding(&self, item_id: &str, embedding: &[f32]) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        
        // Convert f32 array to bytes
        let bytes: Vec<u8> = embedding
            .iter()
            .flat_map(|f| f.to_le_bytes())
            .collect();
        
        conn.execute(
            "INSERT OR REPLACE INTO embeddings (item_id, embedding) VALUES (?1, ?2)",
            rusqlite::params![item_id, bytes],
        )?;
        
        Ok(())
    }
    
    /// Get embedding for an item
    pub fn get_embedding(&self, item_id: &str) -> SqliteResult<Option<Vec<f32>>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT embedding FROM embeddings WHERE item_id = ?1")?;
        
        let result: Option<Vec<u8>> = stmt.query_row([item_id], |row| row.get(0)).ok();
        
        match result {
            Some(bytes) => {
                let embedding = bytes_to_f32_vec(&bytes);
                Ok(Some(embedding))
            }
            None => Ok(None),
        }
    }
    
    /// Get all embeddings with their item IDs
    pub fn get_all_embeddings(&self) -> SqliteResult<Vec<(String, Vec<f32>)>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT item_id, embedding FROM embeddings")?;
        
        let results = stmt.query_map([], |row| {
            let item_id: String = row.get(0)?;
            let bytes: Vec<u8> = row.get(1)?;
            Ok((item_id, bytes_to_f32_vec(&bytes)))
        })?;
        
        results.collect()
    }
    
    /// Delete embedding for an item
    pub fn delete_embedding(&self, item_id: &str) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM embeddings WHERE item_id = ?1", [item_id])?;
        Ok(())
    }
}

/// Convert bytes to f32 vector
fn bytes_to_f32_vec(bytes: &[u8]) -> Vec<f32> {
    bytes
        .chunks_exact(4)
        .map(|chunk| f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
        .collect()
}

/// Item metadata for FTS indexing (unencrypted)
pub struct FtsEntry {
    pub item_id: String,
    pub title: String,
    pub description: String,
    pub summary: String,
    pub tags: String, // Space-separated tags
}

impl Database {
    /// Index an item in the FTS table
    pub fn index_fts(&self, entry: &FtsEntry) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        
        // First remove any existing entry
        conn.execute(
            "DELETE FROM items_fts WHERE item_id = ?1",
            [&entry.item_id],
        )?;
        
        // Insert the new entry
        conn.execute(
            "INSERT INTO items_fts (item_id, title, description, summary, tags) 
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![
                entry.item_id,
                entry.title,
                entry.description,
                entry.summary,
                entry.tags
            ],
        )?;
        
        Ok(())
    }
    
    /// Search FTS index and return matching item IDs with rank
    pub fn search_fts(&self, query: &str, limit: u32) -> SqliteResult<Vec<(String, f64)>> {
        let conn = self.conn.lock().unwrap();
        
        // Use FTS5's built-in ranking
        let mut stmt = conn.prepare(
            "SELECT item_id, rank FROM items_fts 
             WHERE items_fts MATCH ?1
             ORDER BY rank
             LIMIT ?2"
        )?;
        
        let results = stmt.query_map(rusqlite::params![query, limit], |row| {
            Ok((row.get(0)?, row.get(1)?))
        })?;
        
        results.collect()
    }
    
    /// Remove an item from the FTS index
    pub fn delete_fts(&self, item_id: &str) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM items_fts WHERE item_id = ?1", [item_id])?;
        Ok(())
    }
}

/// Get storage path preference from keychain
pub fn get_storage_path_preference() -> Option<String> {
    if let Ok(entry) = keyring::Entry::new(get_app_dir_name(), "storage_path") {
        if let Ok(path) = entry.get_password() {
            return Some(path);
        }
    }
    None
}

/// Set storage path preference in keychain
pub fn set_storage_path_preference(path: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(get_app_dir_name(), "storage_path")
        .map_err(|e| format!("Failed to access keychain: {}", e))?;

    entry.set_password(path)
        .map_err(|e| format!("Failed to save storage path: {}", e))?;

    Ok(())
}

/// Get the database path (checks preference first, falls back to default)
pub fn get_db_path() -> PathBuf {
    // Migrate old data directory if needed
    migrate_old_data_dir();

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
    path.push(get_app_dir_name());
    path.push("vault.db");
    path
}
