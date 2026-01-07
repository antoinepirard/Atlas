use serde::Deserialize;
use crate::commands::items::ItemType;

use super::api_key::get_api_key;
use super::types::{AIProcessResult, ChatCompletionResponse, EmbeddingResponse};

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

