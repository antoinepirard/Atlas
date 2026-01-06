use serde::{Deserialize, Serialize};
use crate::commands::items::ItemType;
use std::fs;
use std::path::PathBuf;

/// OpenAI API response structures
#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
    message: ChatMessage,
}

#[derive(Debug, Deserialize)]
struct ChatMessage {
    content: String,
}

#[derive(Debug, Deserialize)]
struct EmbeddingResponse {
    data: Vec<EmbeddingData>,
}

#[derive(Debug, Deserialize)]
struct EmbeddingData {
    embedding: Vec<f32>,
}

/// AI processing result
#[derive(Debug, Serialize, Deserialize)]
pub struct AIProcessResult {
    pub tags: Vec<String>,
    pub summary: String,
    pub embedding: Vec<f32>,
}

/// URL metadata result
#[derive(Debug, Serialize, Deserialize)]
pub struct UrlMetadata {
    pub title: Option<String>,
    pub description: Option<String>,
    pub image: Option<String>,
}

/// Get the path for storing the API key
fn get_api_key_path() -> Result<PathBuf, String> {
    let app_dir = dirs::data_dir()
        .ok_or_else(|| "Could not find app data directory".to_string())?
        .join("atlas");
    
    // Ensure directory exists
    fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create app directory: {}", e))?;
    
    Ok(app_dir.join(".openai_key"))
}

/// Get OpenAI API key from file or environment
fn get_api_key() -> Result<String, String> {
    // Try file first
    if let Ok(path) = get_api_key_path() {
        if path.exists() {
            if let Ok(key) = fs::read_to_string(&path) {
                let key = key.trim().to_string();
                if !key.is_empty() {
                    return Ok(key);
                }
            }
        }
    }
    
    // Fall back to environment variable
    std::env::var("OPENAI_API_KEY")
        .map_err(|_| "OpenAI API key not found. Please set it in settings.".to_string())
}

/// Save OpenAI API key to file
#[tauri::command]
pub fn save_api_key(api_key: String) -> Result<(), String> {
    let path = get_api_key_path()?;
    
    fs::write(&path, api_key.trim())
        .map_err(|e| format!("Failed to save API key: {}", e))?;
    
    // Set restrictive permissions on Unix systems
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = fs::Permissions::from_mode(0o600);
        fs::set_permissions(&path, perms)
            .map_err(|e| format!("Failed to set file permissions: {}", e))?;
    }
    
    Ok(())
}

/// Check if API key is configured
#[tauri::command]
pub fn has_api_key() -> bool {
    get_api_key().is_ok()
}

/// Get masked API key for display (shows last 8 chars)
#[tauri::command]
pub fn get_api_key_masked() -> Option<String> {
    match get_api_key() {
        Ok(key) if key.len() > 8 => {
            let visible = &key[key.len() - 8..];
            Some(format!("sk-...{}", visible))
        }
        Ok(key) => Some(format!("...{}", key)),
        Err(_) => None,
    }
}

/// Process content with AI to get tags, summary, and embedding
#[tauri::command]
pub async fn process_with_ai(
    content: String,
    item_type: ItemType,
    title: Option<String>,
    description: Option<String>,
) -> Result<AIProcessResult, String> {
    let api_key = get_api_key()?;
    let client = reqwest::Client::new();
    
    // Build the prompt based on item type
    let prompt = match item_type {
        ItemType::Url => format!(
            r#"Analyze this URL and return a JSON object with:
1. "tags": An array of 6-10 descriptive, lowercase tags
2. "summary": A concise 2-3 sentence summary

URL: {}
Title: {}
Description: {}

Return ONLY valid JSON, no markdown."#,
            content,
            title.as_deref().unwrap_or("Unknown"),
            description.as_deref().unwrap_or("None")
        ),
        ItemType::Note => format!(
            r#"Analyze this note and return a JSON object with:
1. "tags": An array of 5-8 descriptive, lowercase tags
2. "summary": A brief 1 sentence summary

Note: {}

Return ONLY valid JSON, no markdown."#,
            content
        ),
        ItemType::Image => format!(
            r#"This is an image with filename: {}
Generate a JSON object with:
1. "tags": An array of 5-8 descriptive tags for an image
2. "summary": A brief description

Return ONLY valid JSON, no markdown."#,
            title.as_deref().unwrap_or("image")
        ),
    };
    
    // Call OpenAI Chat API
    let chat_response = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&serde_json::json!({
            "model": "gpt-4o-mini",
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.3,
            "max_tokens": 400
        }))
        .send()
        .await
        .map_err(|e| format!("Failed to call OpenAI: {}", e))?;
    
    if !chat_response.status().is_success() {
        let error_text = chat_response.text().await.unwrap_or_default();
        return Err(format!("OpenAI API error: {}", error_text));
    }
    
    let chat_result: ChatCompletionResponse = chat_response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    
    let response_text = chat_result
        .choices
        .first()
        .map(|c| c.message.content.clone())
        .unwrap_or_default();
    
    // Parse the JSON response
    let (tags, summary) = parse_ai_response(&response_text);
    
    // Get embedding
    let embedding_input = if !summary.is_empty() {
        format!("{} {}", summary, tags.join(" "))
    } else {
        content.chars().take(1000).collect()
    };
    
    let embedding = get_embedding(&client, &api_key, &embedding_input).await?;
    
    Ok(AIProcessResult {
        tags,
        summary,
        embedding,
    })
}

/// Get embedding for search query
#[tauri::command]
pub async fn get_search_embedding(query: String) -> Result<Vec<f32>, String> {
    let api_key = get_api_key()?;
    let client = reqwest::Client::new();
    get_embedding(&client, &api_key, &query).await
}

/// Fetch URL metadata
#[tauri::command]
pub async fn fetch_url_metadata(url: String) -> Result<UrlMetadata, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;
    
    let response = client
        .get(&url)
        .header("User-Agent", "Mozilla/5.0 (compatible; MymindBot/1.0)")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch URL: {}", e))?;
    
    if !response.status().is_success() {
        return Ok(UrlMetadata {
            title: None,
            description: None,
            image: None,
        });
    }
    
    let html = response.text().await.unwrap_or_default();
    
    // Simple HTML parsing for meta tags
    let title = extract_meta(&html, "og:title")
        .or_else(|| extract_tag(&html, "title"));
    let description = extract_meta(&html, "og:description")
        .or_else(|| extract_meta(&html, "description"));
    let image = extract_meta(&html, "og:image");
    
    Ok(UrlMetadata {
        title,
        description,
        image,
    })
}

/// Helper to get embedding from OpenAI
async fn get_embedding(
    client: &reqwest::Client,
    api_key: &str,
    input: &str,
) -> Result<Vec<f32>, String> {
    let response = client
        .post("https://api.openai.com/v1/embeddings")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&serde_json::json!({
            "model": "text-embedding-3-small",
            "input": input
        }))
        .send()
        .await
        .map_err(|e| format!("Failed to get embedding: {}", e))?;
    
    if !response.status().is_success() {
        let error = response.text().await.unwrap_or_default();
        return Err(format!("Embedding API error: {}", error));
    }
    
    let result: EmbeddingResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse embedding: {}", e))?;
    
    result
        .data
        .first()
        .map(|d| d.embedding.clone())
        .ok_or_else(|| "No embedding returned".to_string())
}

/// Parse AI response JSON
fn parse_ai_response(text: &str) -> (Vec<String>, String) {
    // Try to extract JSON from the response
    let json_str = if let Some(start) = text.find('{') {
        if let Some(end) = text.rfind('}') {
            &text[start..=end]
        } else {
            text
        }
    } else {
        text
    };
    
    #[derive(Deserialize)]
    struct AIResponse {
        tags: Option<Vec<String>>,
        summary: Option<String>,
    }
    
    if let Ok(parsed) = serde_json::from_str::<AIResponse>(json_str) {
        let tags = parsed
            .tags
            .unwrap_or_default()
            .into_iter()
            .map(|t| t.to_lowercase())
            .collect();
        let summary = parsed.summary.unwrap_or_default();
        (tags, summary)
    } else {
        (vec![], String::new())
    }
}

/// Simple meta tag extraction
fn extract_meta(html: &str, property: &str) -> Option<String> {
    let patterns = [
        format!(r#"property="{}" content=""#, property),
        format!(r#"name="{}" content=""#, property),
        format!(r#"content="" property="{}""#, property),
        format!(r#"content="" name="{}""#, property),
    ];
    
    for pattern in patterns {
        if let Some(start) = html.find(&pattern) {
            let content_start = start + pattern.len();
            if let Some(end) = html[content_start..].find('"') {
                return Some(html[content_start..content_start + end].to_string());
            }
        }
    }
    
    None
}

/// Simple title tag extraction
fn extract_tag(html: &str, tag: &str) -> Option<String> {
    let start_tag = format!("<{}>", tag);
    let end_tag = format!("</{}>", tag);
    
    if let Some(start) = html.find(&start_tag) {
        let content_start = start + start_tag.len();
        if let Some(end) = html[content_start..].find(&end_tag) {
            return Some(html[content_start..content_start + end].trim().to_string());
        }
    }
    
    None
}

