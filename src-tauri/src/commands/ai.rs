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
    pub title: Option<String>,
}

/// URL metadata result
#[derive(Debug, Serialize, Deserialize)]
pub struct UrlMetadata {
    pub title: Option<String>,
    pub description: Option<String>,
    pub image: Option<String>,
    pub author: Option<String>,
}

/// Get the path for storing the API key
fn get_api_key_path() -> Result<PathBuf, String> {
    let app_dir = dirs::data_local_dir()
        .ok_or_else(|| "Could not find app data directory".to_string())?
        .join("mymind");
    
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
    // Check if we have actual content (not just a URL)
    let has_rich_content = description.as_ref().map(|d| d.len() > 20).unwrap_or(false);
    
    let prompt = match item_type {
        ItemType::Url if has_rich_content => format!(
            r#"Analyze this content and return a JSON object with:
1. "tags": An array of 6-10 descriptive, lowercase tags based on the actual content. Extract key topics, themes, people mentioned, products, concepts, and relevant keywords.
2. "summary": A concise 2-3 sentence summary of the content.
3. "title": A concise, descriptive title (4-8 words) that captures the essence of the content.

Source: {}
Title: {}
Content: {}

Focus on the actual content when generating tags. Return ONLY valid JSON, no markdown."#,
            content,
            title.as_deref().unwrap_or("Unknown"),
            description.as_deref().unwrap_or("None")
        ),
        ItemType::Url => format!(
            r#"Analyze this URL and return a JSON object with:
1. "tags": An array of 6-10 descriptive, lowercase tags
2. "summary": A concise 2-3 sentence summary
3. "title": A concise, descriptive title (4-8 words) that captures the essence of the content.

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
3. "title": A concise, descriptive title (4-8 words) summarizing the note's main topic.

Note: {}

Return ONLY valid JSON, no markdown."#,
            content
        ),
        ItemType::Image => format!(
            r#"This is an image with filename: {}
Generate a JSON object with:
1. "tags": An array of 5-8 descriptive tags for an image
2. "summary": A brief description
3. "title": A concise, descriptive title (4-8 words) for this image. Be creative based on the filename context.

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
    let (tags, summary, ai_title) = parse_ai_response(&response_text);

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
        title: ai_title,
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
    
    // Check if this is a YouTube URL - use oEmbed API for channel name
    let is_youtube = url.contains("youtube.com") || url.contains("youtu.be");
    let oembed_data = if is_youtube {
        fetch_youtube_oembed(&client, &url).await
    } else {
        None
    };
    
    // Fetch the page for description and other metadata
    let response = client
        .get(&url)
        .header("User-Agent", "Mozilla/5.0 (compatible; MymindBot/1.0)")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch URL: {}", e))?;
    
    if !response.status().is_success() {
        // If page fetch failed but we have oEmbed data, use that
        if let Some(oembed) = oembed_data {
            return Ok(oembed);
        }
        return Ok(UrlMetadata {
            title: None,
            description: None,
            image: None,
            author: None,
        });
    }
    
    let html = response.text().await.unwrap_or_default();
    
    // Simple HTML parsing for meta tags
    let title = extract_meta(&html, "og:title")
        .or_else(|| extract_tag(&html, "title"));
    let description = extract_meta(&html, "og:description")
        .or_else(|| extract_meta(&html, "description"));
    let image = extract_meta(&html, "og:image");
    
    // For author, prefer oEmbed data (more reliable for YouTube), then fall back to HTML parsing
    let author = oembed_data.as_ref().and_then(|o| o.author.clone())
        .or_else(|| extract_meta(&html, "author"))
        .or_else(|| extract_author_from_json_ld(&html))
        .or_else(|| extract_meta(&html, "og:site_name"));
    
    Ok(UrlMetadata {
        // Prefer oEmbed title for YouTube (cleaner), fall back to page title
        title: oembed_data.as_ref().and_then(|o| o.title.clone()).or(title),
        description,
        // Prefer page image (usually higher res), fall back to oEmbed
        image: image.or_else(|| oembed_data.as_ref().and_then(|o| o.image.clone())),
        author,
    })
}

/// Fetch YouTube metadata using oEmbed API
/// This provides reliable channel name without needing to parse JavaScript-rendered HTML
async fn fetch_youtube_oembed(client: &reqwest::Client, url: &str) -> Option<UrlMetadata> {
    let oembed_url = format!(
        "https://www.youtube.com/oembed?url={}&format=json",
        urlencoding::encode(url)
    );
    
    let response = client
        .get(&oembed_url)
        .send()
        .await
        .ok()?;
    
    if !response.status().is_success() {
        return None;
    }
    
    let json: serde_json::Value = response.json().await.ok()?;
    
    let title = json.get("title").and_then(|v| v.as_str()).map(|s| s.to_string());
    let author = json.get("author_name").and_then(|v| v.as_str()).map(|s| s.to_string());
    let image = json.get("thumbnail_url").and_then(|v| v.as_str()).map(|s| s.to_string());
    
    Some(UrlMetadata {
        title,
        description: None, // oEmbed doesn't provide description
        image,
        author,
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
fn parse_ai_response(text: &str) -> (Vec<String>, String, Option<String>) {
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
        title: Option<String>,
    }

    if let Ok(parsed) = serde_json::from_str::<AIResponse>(json_str) {
        let tags = parsed
            .tags
            .unwrap_or_default()
            .into_iter()
            .map(|t| t.to_lowercase())
            .collect();
        let summary = parsed.summary.unwrap_or_default();
        let title = parsed.title.filter(|t| !t.trim().is_empty());
        (tags, summary, title)
    } else {
        (vec![], String::new(), None)
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

/// Extract YouTube channel name from the page
/// YouTube has specific patterns for channel names
fn extract_youtube_channel(html: &str) -> Option<String> {
    // Try to find channel name in link itemprop="name"
    // YouTube uses: <link itemprop="name" content="Channel Name">
    if let Some(start) = html.find(r#"itemprop="name" content=""#) {
        let content_start = start + r#"itemprop="name" content=""#.len();
        if let Some(end) = html[content_start..].find('"') {
            let name = html[content_start..content_start + end].trim();
            if !name.is_empty() && !name.eq_ignore_ascii_case("youtube") {
                return Some(name.to_string());
            }
        }
    }
    
    // Also try: <link content="Channel Name" itemprop="name">
    if let Some(start) = html.find(r#"<link content=""#) {
        let content_start = start + r#"<link content=""#.len();
        if let Some(end) = html[content_start..].find('"') {
            // Check if this is the itemprop="name" one
            let remaining = &html[content_start + end..];
            if remaining.starts_with(r#"" itemprop="name""#) {
                let name = html[content_start..content_start + end].trim();
                if !name.is_empty() && !name.eq_ignore_ascii_case("youtube") {
                    return Some(name.to_string());
                }
            }
        }
    }
    
    // Try to extract from ytInitialPlayerResponse which contains channel info
    if let Some(start) = html.find(r#""author":""#) {
        let content_start = start + r#""author":""#.len();
        if let Some(end) = html[content_start..].find('"') {
            let name = html[content_start..content_start + end].trim();
            if !name.is_empty() && !name.eq_ignore_ascii_case("youtube") {
                return Some(name.to_string());
            }
        }
    }
    
    // Try "ownerChannelName" pattern
    if let Some(start) = html.find(r#""ownerChannelName":""#) {
        let content_start = start + r#""ownerChannelName":""#.len();
        if let Some(end) = html[content_start..].find('"') {
            let name = html[content_start..content_start + end].trim();
            if !name.is_empty() {
                return Some(name.to_string());
            }
        }
    }
    
    None
}

/// Extract author from JSON-LD structured data
/// YouTube and many sites embed author info in JSON-LD scripts
fn extract_author_from_json_ld(html: &str) -> Option<String> {
    // Find all JSON-LD script blocks
    let mut search_start = 0;
    while let Some(start) = html[search_start..].find(r#"type="application/ld+json""#) {
        let abs_start = search_start + start;
        
        // Find the script content
        if let Some(content_start) = html[abs_start..].find('>') {
            let content_abs_start = abs_start + content_start + 1;
            if let Some(end) = html[content_abs_start..].find("</script>") {
                let json_str = &html[content_abs_start..content_abs_start + end];
                
                // Try to parse and extract author
                if let Some(author) = extract_author_from_json(json_str) {
                    return Some(author);
                }
            }
        }
        
        search_start = abs_start + 1;
    }
    
    None
}

/// Extract author name from JSON-LD JSON content
fn extract_author_from_json(json_str: &str) -> Option<String> {
    // Try to parse as JSON value
    if let Ok(value) = serde_json::from_str::<serde_json::Value>(json_str) {
        // Check for "author" field (could be object or string)
        if let Some(author) = value.get("author") {
            // Author can be an object with "name" field
            if let Some(name) = author.get("name").and_then(|n| n.as_str()) {
                return Some(name.to_string());
            }
            // Or a direct string
            if let Some(name) = author.as_str() {
                return Some(name.to_string());
            }
        }
        
        // Check for "creator" field (some sites use this)
        if let Some(creator) = value.get("creator") {
            if let Some(name) = creator.get("name").and_then(|n| n.as_str()) {
                return Some(name.to_string());
            }
            if let Some(name) = creator.as_str() {
                return Some(name.to_string());
            }
        }
        
        // YouTube often has nested itemListElement with author info
        if let Some(items) = value.get("itemListElement").and_then(|v| v.as_array()) {
            for item in items {
                if let Some(name) = item.get("name").and_then(|n| n.as_str()) {
                    // Skip generic names like "YouTube"
                    if !name.eq_ignore_ascii_case("youtube") && !name.is_empty() {
                        return Some(name.to_string());
                    }
                }
            }
        }
    }
    
    None
}

