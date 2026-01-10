use serde::Deserialize;
use crate::commands::items::ItemType;

use super::api_key::get_api_key;
use super::types::{AIProcessResult, ChatCompletionResponse, EmbeddingResponse};
use super::usage::{can_use_ai, record_ai_usage};

// Max tokens for AI processing responses
const PROCESSING_MAX_TOKENS: u32 = 512;

/// Process content with AI to get tags, summary, and embedding
#[tauri::command]
pub async fn process_with_ai(
    content: String,
    item_type: ItemType,
    title: Option<String>,
    description: Option<String>,
) -> Result<AIProcessResult, String> {
    // Check budget before making AI call
    can_use_ai()?;
    
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
4. "is_article": Boolean - true if this is a readable article, blog post, or news story. False if it's a video, social media post, product page, homepage, or interactive app.
5. "subtype": Classify as one of: "product" (e-commerce, retail), "article" (news, blog, documentation), "video" (video content), "social" (social media posts), "code" (repositories, code snippets), "audio" (podcasts, music), "event" (event pages, tickets), "place" (maps, locations).
6. "subtype_confidence": A number 0.0-1.0 indicating confidence in the subtype classification.

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
4. "is_article": Boolean - true if this is a readable article, blog post, or news story. False if it's a video, social media post, product page, homepage, or interactive app.
5. "subtype": Classify as one of: "product" (e-commerce, retail), "article" (news, blog, documentation), "video" (video content), "social" (social media posts), "code" (repositories, code snippets), "audio" (podcasts, music), "event" (event pages, tickets), "place" (maps, locations).
6. "subtype_confidence": A number 0.0-1.0 indicating confidence in the subtype classification.

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
4. "subtype": Classify as one of: "screenshot" (UI screenshots, app interfaces), "photo" (photographs), "diagram" (charts, flowcharts, diagrams), "document" (scanned docs, PDFs), "illustration" (artwork, memes, graphics).
5. "subtype_confidence": A number 0.0-1.0 indicating confidence in the subtype classification.

Return ONLY valid JSON, no markdown."#,
            title.as_deref().unwrap_or("image")
        ),
    };
    
    let max_tokens = PROCESSING_MAX_TOKENS;

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
            "max_tokens": max_tokens
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

    if let Some(usage) = chat_result.usage {
        let prompt_tokens = usage.prompt_tokens.unwrap_or(0);
        let completion_tokens = usage.completion_tokens.unwrap_or(0);
        let total_tokens = usage
            .total_tokens
            .unwrap_or(prompt_tokens + completion_tokens);
        record_ai_usage(
            "gpt-4o-mini",
            "completion",
            prompt_tokens,
            completion_tokens,
            total_tokens,
        );
    }

    let response_text = chat_result
        .choices
        .first()
        .map(|c| c.message.content.clone())
        .unwrap_or_default();
    
    // Parse the JSON response
    let parsed = parse_ai_response(&response_text);

    // Get embedding
    let embedding_input = if !parsed.summary.is_empty() {
        format!("{} {}", parsed.summary, parsed.tags.join(" "))
    } else {
        content.chars().take(1000).collect()
    };

    let embedding = get_embedding(&client, &api_key, &embedding_input, "embedding").await?;

    Ok(AIProcessResult {
        tags: parsed.tags,
        summary: parsed.summary,
        embedding,
        title: parsed.title,
        is_article: parsed.is_article,
        subtype: parsed.subtype,
        subtype_confidence: parsed.subtype_confidence,
    })
}

/// Get embedding for search query
#[tauri::command]
pub async fn get_search_embedding(query: String) -> Result<Vec<f32>, String> {
    let api_key = get_api_key()?;
    let client = reqwest::Client::new();
    get_embedding(&client, &api_key, &query, "search").await
}

/// Helper to get embedding from OpenAI
async fn get_embedding(
    client: &reqwest::Client,
    api_key: &str,
    input: &str,
    operation: &str,
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

    if let Some(usage) = result.usage {
        let prompt_tokens = usage.prompt_tokens.unwrap_or(0);
        let total_tokens = usage.total_tokens.unwrap_or(prompt_tokens);
        record_ai_usage(
            "text-embedding-3-small",
            operation,
            prompt_tokens,
            0,
            total_tokens,
        );
    }

    result
        .data
        .first()
        .map(|d| d.embedding.clone())
        .ok_or_else(|| "No embedding returned".to_string())
}

/// Parsed AI response
struct ParsedAIResponse {
    tags: Vec<String>,
    summary: String,
    title: Option<String>,
    is_article: bool,
    subtype: Option<String>,
    subtype_confidence: Option<f32>,
}

/// Parse AI response JSON
fn parse_ai_response(text: &str) -> ParsedAIResponse {
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
        is_article: Option<bool>,
        subtype: Option<String>,
        subtype_confidence: Option<f32>,
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
        let is_article = parsed.is_article.unwrap_or(false);
        let subtype = parsed.subtype.filter(|s| !s.trim().is_empty());
        let subtype_confidence = parsed.subtype_confidence;

        ParsedAIResponse {
            tags,
            summary,
            title,
            is_article,
            subtype,
            subtype_confidence,
        }
    } else {
        ParsedAIResponse {
            tags: vec![],
            summary: String::new(),
            title: None,
            is_article: false,
            subtype: None,
            subtype_confidence: None,
        }
    }
}
