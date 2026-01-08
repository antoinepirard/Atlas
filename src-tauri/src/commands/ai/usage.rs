use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;

use chrono::{DateTime, Datelike, Duration, NaiveDate, Utc};
use serde::{Deserialize, Serialize};

use crate::db::get_app_dir_name;

use super::settings::load_ai_settings;
use super::types::{AiBudgetStatus, AiUsageDay};

const AI_USAGE_FILE: &str = ".ai_usage.json";
const USAGE_RETENTION_DAYS: i64 = 120;

// OpenAI pricing per 1M tokens (as of 2024)
// These should be updated periodically to reflect current pricing
const GPT4O_MINI_INPUT_PRICE_PER_M: f64 = 0.15;   // $0.15 per 1M input tokens
const GPT4O_MINI_OUTPUT_PRICE_PER_M: f64 = 0.60;  // $0.60 per 1M output tokens
const EMBEDDING_3_SMALL_PRICE_PER_M: f64 = 0.02;  // $0.02 per 1M tokens

/// Calculate cost in USD for a given model and token usage
fn calculate_cost(model: &str, prompt_tokens: u32, completion_tokens: u32) -> f64 {
    let prompt = prompt_tokens as f64 / 1_000_000.0;
    let completion = completion_tokens as f64 / 1_000_000.0;
    
    match model {
        "gpt-4o-mini" => {
            prompt * GPT4O_MINI_INPUT_PRICE_PER_M + completion * GPT4O_MINI_OUTPUT_PRICE_PER_M
        }
        "text-embedding-3-small" => {
            // Embeddings only have input tokens (prompt_tokens contains total)
            prompt * EMBEDDING_3_SMALL_PRICE_PER_M
        }
        // Fallback for unknown models - use gpt-4o-mini pricing as estimate
        _ => {
            prompt * GPT4O_MINI_INPUT_PRICE_PER_M + completion * GPT4O_MINI_OUTPUT_PRICE_PER_M
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct UsageEntry {
    timestamp: String,
    model: String,
    operation: String,
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
    #[serde(default)]
    cost_usd: f64,
}

fn get_ai_usage_file_path() -> Result<PathBuf, String> {
    let app_dir = dirs::data_local_dir()
        .ok_or_else(|| "Could not find app data directory".to_string())?
        .join(get_app_dir_name());

    fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create app directory: {}", e))?;

    Ok(app_dir.join(AI_USAGE_FILE))
}

fn load_usage_entries() -> Vec<UsageEntry> {
    let path = match get_ai_usage_file_path() {
        Ok(path) => path,
        Err(_) => return vec![],
    };
    if !path.exists() {
        return vec![];
    }

    let contents = match fs::read_to_string(path) {
        Ok(contents) => contents,
        Err(_) => return vec![],
    };

    serde_json::from_str(&contents).unwrap_or_default()
}

fn save_usage_entries(entries: &[UsageEntry]) -> Result<(), String> {
    let path = get_ai_usage_file_path()?;
    let payload = serde_json::to_string_pretty(entries)
        .map_err(|e| format!("Failed to serialize AI usage: {}", e))?;
    fs::write(path, payload).map_err(|e| format!("Failed to save AI usage: {}", e))?;
    Ok(())
}

pub(super) fn record_ai_usage(
    model: &str,
    operation: &str,
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
) {
    let mut entries = load_usage_entries();
    let now = Utc::now();
    let cutoff = now - Duration::days(USAGE_RETENTION_DAYS);

    entries.retain(|entry| {
        entry
            .timestamp
            .parse::<DateTime<Utc>>()
            .map(|ts| ts >= cutoff)
            .unwrap_or(false)
    });

    let cost_usd = calculate_cost(model, prompt_tokens, completion_tokens);
    
    entries.push(UsageEntry {
        timestamp: now.to_rfc3339(),
        model: model.to_string(),
        operation: operation.to_string(),
        prompt_tokens,
        completion_tokens,
        total_tokens,
        cost_usd,
    });

    if let Err(err) = save_usage_entries(&entries) {
        eprintln!("Failed to save AI usage: {}", err);
    }
}

#[tauri::command]
pub fn get_ai_usage_history(days: u32) -> Vec<AiUsageDay> {
    let day_count = days.max(1) as i64;
    let today = Utc::now().date_naive();
    let start = today - Duration::days(day_count - 1);

    let mut buckets: BTreeMap<NaiveDate, AiUsageDay> = BTreeMap::new();
    for offset in 0..day_count {
        let day = start + Duration::days(offset);
        buckets.insert(
            day,
            AiUsageDay {
                date: day.to_string(),
                total_tokens: 0,
                prompt_tokens: 0,
                completion_tokens: 0,
                request_count: 0,
                total_cost_usd: 0.0,
            },
        );
    }

    for entry in load_usage_entries() {
        let parsed = match entry.timestamp.parse::<DateTime<Utc>>() {
            Ok(parsed) => parsed,
            Err(_) => continue,
        };
        let date = parsed.date_naive();
        if date < start || date > today {
            continue;
        }
        if let Some(day) = buckets.get_mut(&date) {
            day.total_tokens = day.total_tokens.saturating_add(entry.total_tokens);
            day.prompt_tokens = day.prompt_tokens.saturating_add(entry.prompt_tokens);
            day.completion_tokens = day
                .completion_tokens
                .saturating_add(entry.completion_tokens);
            day.request_count = day.request_count.saturating_add(1);
            // Add cost - use stored cost or calculate from tokens for old entries
            day.total_cost_usd += if entry.cost_usd > 0.0 {
                entry.cost_usd
            } else {
                calculate_cost(&entry.model, entry.prompt_tokens, entry.completion_tokens)
            };
        }
    }

    buckets.into_values().collect()
}

/// Get the current month's budget status
#[tauri::command]
pub fn get_ai_budget_status() -> AiBudgetStatus {
    let settings = load_ai_settings();
    let now = Utc::now();
    let month_start = NaiveDate::from_ymd_opt(now.year(), now.month(), 1).unwrap();
    let month_label = now.format("%Y-%m").to_string();
    
    // Calculate this month's spending
    let entries = load_usage_entries();
    let spent_usd: f64 = entries
        .iter()
        .filter_map(|entry| {
            let ts = entry.timestamp.parse::<DateTime<Utc>>().ok()?;
            let entry_date = ts.date_naive();
            if entry_date >= month_start {
                Some(if entry.cost_usd > 0.0 {
                    entry.cost_usd
                } else {
                    calculate_cost(&entry.model, entry.prompt_tokens, entry.completion_tokens)
                })
            } else {
                None
            }
        })
        .sum();
    
    let budget_usd = settings.monthly_budget_usd;
    let warning_threshold = settings.warning_threshold_percent;
    
    let (should_warn, is_over_budget) = match budget_usd {
        Some(budget) if budget > 0.0 => {
            let usage_percent = spent_usd / budget;
            (usage_percent >= warning_threshold, spent_usd >= budget)
        }
        _ => (false, false),
    };
    
    AiBudgetStatus {
        month: month_label,
        spent_usd,
        budget_usd,
        warning_threshold_percent: warning_threshold,
        should_warn,
        is_over_budget,
    }
}

/// Check if we can make an AI request (not over budget)
pub(super) fn can_use_ai() -> Result<(), String> {
    let status = get_ai_budget_status();
    if status.is_over_budget {
        Err(format!(
            "Monthly AI budget exceeded (${:.4} / ${:.2}). AI features paused until next month.",
            status.spent_usd,
            status.budget_usd.unwrap_or(0.0)
        ))
    } else {
        Ok(())
    }
}
