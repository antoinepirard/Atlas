use crate::commands::items::MymindItem;
use crate::commands::vault::VaultState;
use crate::crypto;
use serde::Serialize;
use tauri::State;

/// Result of semantic search
#[derive(Debug, Clone, Serialize)]
pub struct SearchResult {
    pub item: MymindItem,
    pub similarity: f32,
}

/// Response for search
#[derive(Debug, Serialize)]
pub struct SearchResponse {
    pub results: Vec<SearchResult>,
    pub total_searched: usize,
}

/// Compute cosine similarity between two vectors
fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }

    let mut dot = 0.0f32;
    let mut mag_a = 0.0f32;
    let mut mag_b = 0.0f32;

    for i in 0..a.len() {
        dot += a[i] * b[i];
        mag_a += a[i] * a[i];
        mag_b += b[i] * b[i];
    }

    let magnitude = (mag_a.sqrt()) * (mag_b.sqrt());
    if magnitude == 0.0 {
        0.0
    } else {
        dot / magnitude
    }
}

/// Perform semantic search using embeddings
/// Returns the top `limit` results sorted by similarity
#[tauri::command]
pub fn semantic_search(
    query_embedding: Vec<f32>,
    limit: Option<usize>,
    state: State<VaultState>,
) -> Result<SearchResponse, String> {
    let key = state.get_key().ok_or("Vault is locked")?;
    let limit = limit.unwrap_or(50);

    // Get all embeddings from database
    let embeddings = state
        .db
        .get_all_embeddings()
        .map_err(|e| format!("Failed to get embeddings: {}", e))?;

    let total_searched = embeddings.len();

    // Calculate similarity for each embedding
    let mut scored: Vec<(String, f32)> = embeddings
        .iter()
        .map(|(item_id, embedding)| {
            let similarity = cosine_similarity(&query_embedding, embedding);
            (item_id.clone(), similarity)
        })
        .collect();

    // Sort by similarity (descending)
    scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    // Take top results
    let top_results: Vec<(String, f32)> = scored.into_iter().take(limit).collect();

    // Load the actual items for top results
    let mut results = Vec::new();
    for (item_id, similarity) in top_results {
        if let Ok(Some(encrypted)) = state.db.get_item(&item_id) {
            if let Ok(json) = crypto::decrypt(&encrypted.encrypted_data, &key) {
                if let Ok(mut item) = serde_json::from_str::<MymindItem>(&json) {
                    // Don't send embedding back to frontend
                    item.embedding = None;
                    results.push(SearchResult { item, similarity });
                }
            }
        }
    }

    Ok(SearchResponse {
        results,
        total_searched,
    })
}

/// Normalize text for search comparison
/// Treats hyphens, underscores as spaces for flexible matching
fn normalize_for_search(text: &str) -> String {
    text.to_lowercase()
        .replace('-', " ")
        .replace('_', " ")
}

/// Check if all words from query appear in the text (in any order)
fn words_match(query: &str, text: &str) -> bool {
    let query_normalized = normalize_for_search(query);
    let text_normalized = normalize_for_search(text);
    
    let query_words: Vec<&str> = query_normalized.split_whitespace().collect();
    
    // All query words must appear in the text
    query_words.iter().all(|word| text_normalized.contains(word))
}

/// Perform text search using FTS5 index (fast)
#[tauri::command]
pub fn text_search(
    query: String,
    limit: Option<usize>,
    state: State<VaultState>,
) -> Result<Vec<MymindItem>, String> {
    let key = state.get_key().ok_or("Vault is locked")?;
    let limit = limit.unwrap_or(50) as u32;

    // Build FTS5 query: split into words, each with wildcard, combined with AND
    // This allows "all in" to match "all-in" since FTS5 tokenizes on hyphens
    let words: Vec<String> = query
        .split(|c: char| c.is_whitespace() || c == '-' || c == '_')
        .filter(|w| !w.is_empty())
        .map(|w| format!("{}*", w.replace("\"", "\"\"")))
        .collect();
    
    let fts_query = if words.is_empty() {
        query.clone()
    } else {
        words.join(" AND ")
    };

    // Try FTS5 search first
    let fts_results = state.db.search_fts(&fts_query, limit);
    
    match fts_results {
        Ok(results) if !results.is_empty() => {
            // Load items by ID
            let mut items = Vec::new();
            for (item_id, _rank) in results {
                if let Ok(Some(encrypted)) = state.db.get_item(&item_id) {
                    if let Ok(json) = crypto::decrypt(&encrypted.encrypted_data, &key) {
                        if let Ok(mut item) = serde_json::from_str::<MymindItem>(&json) {
                            item.embedding = None;
                            items.push(item);
                        }
                    }
                }
            }
            Ok(items)
        }
        _ => {
            // Fall back to brute-force search if FTS fails or returns nothing
            let encrypted_items = state.db.get_all_items().map_err(|e| e.to_string())?;

            let mut matches = Vec::new();
            for encrypted in encrypted_items {
                if let Ok(json) = crypto::decrypt(&encrypted.encrypted_data, &key) {
                    if let Ok(mut item) = serde_json::from_str::<MymindItem>(&json) {
                        let searchable = [
                            item.title.as_deref().unwrap_or(""),
                            item.description.as_deref().unwrap_or(""),
                            item.summary.as_deref().unwrap_or(""),
                            &item.content,
                        ]
                        .join(" ");

                        // Check if query words match in searchable text or tags
                        let text_match = words_match(&query, &searchable);
                        let tags_match = item.tags.iter().any(|t| words_match(&query, t));

                        if text_match || tags_match {
                            item.embedding = None;
                            matches.push(item);

                            if matches.len() >= limit as usize {
                                break;
                            }
                        }
                    }
                }
            }
            Ok(matches)
        }
    }
}

/// Index an item's embedding for search
/// Called after adding/updating an item with an embedding
pub fn index_embedding(item_id: &str, embedding: &[f32], state: &State<VaultState>) -> Result<(), String> {
    state
        .db
        .save_embedding(item_id, embedding)
        .map_err(|e| format!("Failed to index embedding: {}", e))
}

/// Remove an item's embedding from the index
pub fn remove_embedding(item_id: &str, state: &State<VaultState>) -> Result<(), String> {
    state
        .db
        .delete_embedding(item_id)
        .map_err(|e| format!("Failed to remove embedding: {}", e))
}

/// Reindex all items that have embeddings stored in their encrypted data
/// This migrates embeddings to the separate table for faster search
#[tauri::command]
pub fn reindex_all_embeddings(state: State<VaultState>) -> Result<ReindexResult, String> {
    let key = state.get_key().ok_or("Vault is locked")?;

    let encrypted_items = state.db.get_all_items().map_err(|e| e.to_string())?;

    let mut indexed = 0;
    let mut skipped = 0;
    let mut failed = 0;

    for encrypted in encrypted_items {
        match crypto::decrypt(&encrypted.encrypted_data, &key) {
            Ok(json) => {
                if let Ok(item) = serde_json::from_str::<MymindItem>(&json) {
                    if let Some(ref embedding) = item.embedding {
                        if !embedding.is_empty() {
                            match state.db.save_embedding(&item.id, embedding) {
                                Ok(_) => indexed += 1,
                                Err(_) => failed += 1,
                            }
                        } else {
                            skipped += 1;
                        }
                    } else {
                        skipped += 1;
                    }
                } else {
                    failed += 1;
                }
            }
            Err(_) => failed += 1,
        }
    }

    Ok(ReindexResult {
        indexed,
        skipped,
        failed,
    })
}

#[derive(Debug, Serialize)]
pub struct ReindexResult {
    pub indexed: u32,
    pub skipped: u32,
    pub failed: u32,
}

/// Rebuild the FTS index for all items
#[tauri::command]
pub fn rebuild_fts_index(state: State<VaultState>) -> Result<ReindexResult, String> {
    use crate::db::FtsEntry;
    
    let key = state.get_key().ok_or("Vault is locked")?;
    let encrypted_items = state.db.get_all_items().map_err(|e| e.to_string())?;

    let mut indexed = 0;
    let mut skipped = 0;
    let mut failed = 0;

    for encrypted in encrypted_items {
        match crypto::decrypt(&encrypted.encrypted_data, &key) {
            Ok(json) => {
                if let Ok(item) = serde_json::from_str::<MymindItem>(&json) {
                    let entry = FtsEntry {
                        item_id: item.id.clone(),
                        title: item.title.unwrap_or_default(),
                        description: item.description.unwrap_or_default(),
                        summary: item.summary.unwrap_or_default(),
                        tags: item.tags.join(" "),
                    };
                    
                    match state.db.index_fts(&entry) {
                        Ok(_) => indexed += 1,
                        Err(_) => failed += 1,
                    }
                } else {
                    skipped += 1;
                }
            }
            Err(_) => failed += 1,
        }
    }

    Ok(ReindexResult {
        indexed,
        skipped,
        failed,
    })
}

/// Index a single item in FTS (called after add/update)
pub fn index_item_fts(item: &MymindItem, state: &State<VaultState>) -> Result<(), String> {
    use crate::db::FtsEntry;
    
    let entry = FtsEntry {
        item_id: item.id.clone(),
        title: item.title.clone().unwrap_or_default(),
        description: item.description.clone().unwrap_or_default(),
        summary: item.summary.clone().unwrap_or_default(),
        tags: item.tags.join(" "),
    };
    
    state.db.index_fts(&entry)
        .map_err(|e| format!("Failed to index in FTS: {}", e))
}

/// Remove an item from FTS index
pub fn remove_item_fts(item_id: &str, state: &State<VaultState>) -> Result<(), String> {
    state.db.delete_fts(item_id)
        .map_err(|e| format!("Failed to remove from FTS: {}", e))
}

