mod types;
mod api_key;
mod processing;
mod url_metadata;
mod classification;
mod article;
mod settings;
mod usage;
pub mod subtype_detection;

// Re-export public types
pub use types::{AIProcessResult, UrlMetadata, TokenClassification, AiSettings, AiUsageDay, AiBudgetStatus};

// Re-export everything from submodules (including Tauri-generated __cmd__ handlers)
pub use api_key::*;
pub use processing::*;
pub use url_metadata::*;
pub use classification::*;
pub use article::sanitize_article_html;
pub use settings::*;
pub use usage::*;
pub use subtype_detection::{detect_url_subtype_by_domain, detect_note_subtype, get_default_image_subtype, SubtypeDetection};
