use serde::{Deserialize, Serialize};

/// OpenAI API response structures
#[derive(Debug, Deserialize)]
pub(super) struct ChatCompletionResponse {
    pub choices: Vec<ChatChoice>,
}

#[derive(Debug, Deserialize)]
pub(super) struct ChatChoice {
    pub message: ChatMessage,
}

#[derive(Debug, Deserialize)]
pub(super) struct ChatMessage {
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub(super) struct EmbeddingResponse {
    pub data: Vec<EmbeddingData>,
}

#[derive(Debug, Deserialize)]
pub(super) struct EmbeddingData {
    pub embedding: Vec<f32>,
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

/// Token classification result from AI
#[derive(Debug, Serialize, Deserialize)]
pub struct TokenClassification {
    pub token: String,
    pub filter_kind: Option<String>, // "date", "type", "color", "tag", or null
    pub confidence: f32,             // 0.0 to 1.0
    pub resolved_value: Option<String>,
}

