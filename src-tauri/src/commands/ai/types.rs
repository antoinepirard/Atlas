use serde::{Deserialize, Serialize};

/// OpenAI API response structures
#[derive(Debug, Deserialize)]
pub(super) struct ChatCompletionResponse {
    pub choices: Vec<ChatChoice>,
    #[serde(default)]
    pub usage: Option<Usage>,
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
    #[serde(default)]
    pub usage: Option<Usage>,
}

#[derive(Debug, Deserialize)]
pub(super) struct EmbeddingData {
    pub embedding: Vec<f32>,
}

#[derive(Debug, Deserialize)]
pub(super) struct Usage {
    pub prompt_tokens: Option<u32>,
    pub completion_tokens: Option<u32>,
    pub total_tokens: Option<u32>,
}

/// AI processing result
#[derive(Debug, Serialize, Deserialize)]
pub struct AIProcessResult {
    pub tags: Vec<String>,
    pub summary: String,
    pub embedding: Vec<f32>,
    pub title: Option<String>,
    /// Whether the content is classified as a readable article
    #[serde(default)]
    pub is_article: bool,
}

/// URL metadata result
#[derive(Debug, Serialize, Deserialize)]
pub struct UrlMetadata {
    pub title: Option<String>,
    pub description: Option<String>,
    pub image: Option<String>,
    pub author: Option<String>,
    /// Extracted article content for reader mode
    pub article_content: Option<String>,
}

/// Token classification result from AI
#[derive(Debug, Serialize, Deserialize)]
pub struct TokenClassification {
    pub token: String,
    pub filter_kind: Option<String>, // "date", "type", "color", "tag", or null
    pub confidence: f32,             // 0.0 to 1.0
    pub resolved_value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiSettings {
    pub monthly_budget_usd: Option<f64>,
    pub warning_threshold_percent: f64,
}

impl Default for AiSettings {
    fn default() -> Self {
        AiSettings {
            monthly_budget_usd: None,
            warning_threshold_percent: 0.8,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiUsageDay {
    pub date: String,
    pub total_tokens: u32,
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub request_count: u32,
    pub total_cost_usd: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiBudgetStatus {
    pub month: String,
    pub spent_usd: f64,
    pub budget_usd: Option<f64>,
    pub warning_threshold_percent: f64,
    pub should_warn: bool,
    pub is_over_budget: bool,
}
