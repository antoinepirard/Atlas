use super::api_key::get_api_key;
use super::types::{ChatCompletionResponse, TokenClassification};
use super::usage::{can_use_ai, record_ai_usage};

// Max tokens for classification responses (kept small for efficiency)
const CLASSIFICATION_MAX_TOKENS: u32 = 300;

/// Classify search tokens using AI
/// Called for tokens that don't match deterministic rules
#[tauri::command]
pub async fn classify_search_tokens(
    tokens: Vec<String>,
    existing_tags: Vec<String>,
) -> Result<Vec<TokenClassification>, String> {
    if tokens.is_empty() {
        return Ok(vec![]);
    }
    
    // Check budget before making AI call
    can_use_ai()?;
    
    let api_key = get_api_key()?;
    let client = reqwest::Client::new();
    
    let tags_context = if existing_tags.is_empty() {
        String::new()
    } else {
        format!("\nExisting tags in the system: {}", existing_tags.join(", "))
    };
    
    let prompt = format!(
        r#"Classify each search token into one of these filter categories:
- "date": Time-related phrases (e.g., "recent", "old", "2024", "summer")
- "type": Content type (e.g., "video", "article", "design", "code")
- "color": Color references (e.g., "bright", "dark", "colorful")
- "tag": Matches or relates to existing tags
- null: Regular search text (not a filter)

Tokens to classify: {}
{}

Return a JSON array with objects containing:
- "token": the original token
- "filter_kind": one of "date", "type", "color", "tag", or null
- "confidence": 0.0 to 1.0 (how confident you are)
- "resolved_value": the normalized value if applicable (e.g., "last 30 days" for "recent")

Only classify as a filter if confidence >= 0.7. Return ONLY valid JSON array."#,
        tokens.join(", "),
        tags_context
    );
    
    let max_tokens = CLASSIFICATION_MAX_TOKENS;

    let response = client
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
            "temperature": 0.1,
            "max_tokens": max_tokens
        }))
        .send()
        .await
        .map_err(|e| format!("Failed to call OpenAI: {}", e))?;
    
    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("OpenAI API error: {}", error_text));
    }
    
    let result: ChatCompletionResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    if let Some(usage) = result.usage {
        let prompt_tokens = usage.prompt_tokens.unwrap_or(0);
        let completion_tokens = usage.completion_tokens.unwrap_or(0);
        let total_tokens = usage
            .total_tokens
            .unwrap_or(prompt_tokens + completion_tokens);
        record_ai_usage(
            "gpt-4o-mini",
            "classification",
            prompt_tokens,
            completion_tokens,
            total_tokens,
        );
    }
    
    let response_text = result
        .choices
        .first()
        .map(|c| c.message.content.clone())
        .unwrap_or_default();
    
    // Parse the JSON array response
    parse_classification_response(&response_text, &tokens)
}

/// Parse AI classification response
fn parse_classification_response(text: &str, original_tokens: &[String]) -> Result<Vec<TokenClassification>, String> {
    // Try to extract JSON array from the response
    let json_str = if let Some(start) = text.find('[') {
        if let Some(end) = text.rfind(']') {
            &text[start..=end]
        } else {
            text
        }
    } else {
        text
    };
    
    match serde_json::from_str::<Vec<TokenClassification>>(json_str) {
        Ok(classifications) => Ok(classifications),
        Err(_) => {
            // If parsing fails, return unclassified tokens
            Ok(original_tokens.iter().map(|t| TokenClassification {
                token: t.clone(),
                filter_kind: None,
                confidence: 0.0,
                resolved_value: None,
            }).collect())
        }
    }
}
