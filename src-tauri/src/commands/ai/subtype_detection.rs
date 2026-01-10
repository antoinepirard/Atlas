//! Subtype detection for items
//!
//! Provides domain-based and pattern-based detection for content subtypes,
//! enabling specialized UI rendering for different content types.

use url::Url;

/// Result of subtype detection
#[derive(Debug, Clone)]
pub struct SubtypeDetection {
    pub subtype: String,
    pub confidence: f32,
    pub method: String,
}

/// Detect URL subtype based on domain patterns
///
/// Returns Some(detection) if a known domain pattern is matched,
/// None if the URL should fall through to AI classification.
pub fn detect_url_subtype_by_domain(url_str: &str) -> Option<SubtypeDetection> {
    let url = Url::parse(url_str).ok()?;
    let host = url.host_str()?.to_lowercase();
    let host = host.strip_prefix("www.").unwrap_or(&host);
    let path = url.path().to_lowercase();

    // Video platforms
    if host.contains("youtube.com")
        || host.contains("youtu.be")
        || host.contains("vimeo.com")
        || host.contains("dailymotion.com")
        || host.contains("twitch.tv")
        || host.contains("tiktok.com")
    {
        return Some(SubtypeDetection {
            subtype: "video".to_string(),
            confidence: 1.0,
            method: "domain".to_string(),
        });
    }

    // Social platforms
    if host == "x.com"
        || host == "twitter.com"
        || host.contains("threads.net")
        || host.contains("bsky.app")
        || host.contains("mastodon.")
        || host.ends_with(".social")  // Mastodon instances
        || host.contains("facebook.com")
        || host.contains("instagram.com")
        || host.contains("linkedin.com")
        || host.contains("reddit.com")
    {
        return Some(SubtypeDetection {
            subtype: "social".to_string(),
            confidence: 1.0,
            method: "domain".to_string(),
        });
    }

    // Code repositories
    if host.contains("github.com")
        || host.contains("gitlab.com")
        || host.contains("bitbucket.org")
        || host.contains("codepen.io")
        || host.contains("codesandbox.io")
        || host.contains("replit.com")
        || host.contains("stackblitz.com")
        || host.contains("jsfiddle.net")
    {
        return Some(SubtypeDetection {
            subtype: "code".to_string(),
            confidence: 1.0,
            method: "domain".to_string(),
        });
    }

    // E-commerce / Products
    // Check domains first
    if host.contains("amazon.")
        || host.contains("ebay.com")
        || host.contains("etsy.com")
        || host.contains("aliexpress.com")
        || host.contains("walmart.com")
        || host.contains("target.com")
        || host.contains("bestbuy.com")
        || host.contains("newegg.com")
        || host.contains("wayfair.com")
        || host.contains("shopify.com")
    {
        return Some(SubtypeDetection {
            subtype: "product".to_string(),
            confidence: 1.0,
            method: "domain".to_string(),
        });
    }
    // Check product URL patterns (for generic sites)
    if path.contains("/product")
        || path.contains("/item/")
        || path.contains("/dp/")
        || path.contains("/gp/product")
        || path.contains("/shop/")
        || path.contains("/buy/")
    {
        return Some(SubtypeDetection {
            subtype: "product".to_string(),
            confidence: 0.85,
            method: "domain".to_string(),
        });
    }

    // Audio/Podcast platforms
    if host.contains("spotify.com")
        || host.contains("soundcloud.com")
        || host.contains("podcasts.apple.com")
        || host.contains("overcast.fm")
        || host.contains("pocketcasts.com")
        || host.contains("anchor.fm")
        || host.contains("transistor.fm")
        || host.contains("simplecast.com")
        || host.contains("podbean.com")
        || host.contains("buzzsprout.com")
        || host.contains("castbox.fm")
        || host.contains("deezer.com")
        || host.contains("audible.com")
    {
        return Some(SubtypeDetection {
            subtype: "audio".to_string(),
            confidence: 1.0,
            method: "domain".to_string(),
        });
    }

    // News/Article domains (high confidence known article sites)
    if host.contains("medium.com")
        || host.contains("substack.com")
        || host.contains("nytimes.com")
        || host.contains("washingtonpost.com")
        || host.contains("theguardian.com")
        || host.contains("bbc.com")
        || host.contains("bbc.co.uk")
        || host.contains("reuters.com")
        || host.contains("arstechnica.com")
        || host.contains("techcrunch.com")
        || host.contains("theverge.com")
        || host.contains("wired.com")
        || host.contains("forbes.com")
        || host.contains("bloomberg.com")
        || host.contains("cnn.com")
        || host.contains("npr.org")
        || host.contains("theatlantic.com")
        || host.contains("newyorker.com")
        || host.contains("economist.com")
        || host.contains("ft.com")
        || host.contains("wsj.com")
        || host.contains("dev.to")
        || host.contains("hackernoon.com")
        || host.contains("freecodecamp.org")
    {
        return Some(SubtypeDetection {
            subtype: "article".to_string(),
            confidence: 0.95,
            method: "domain".to_string(),
        });
    }

    // Check article URL patterns
    if path.contains("/article/")
        || path.contains("/blog/")
        || path.contains("/post/")
        || path.contains("/news/")
        || path.contains("/story/")
    {
        return Some(SubtypeDetection {
            subtype: "article".to_string(),
            confidence: 0.7,
            method: "domain".to_string(),
        });
    }

    None // Fall through to AI classification
}

/// Detect note subtype based on content patterns
pub fn detect_note_subtype(content: &str) -> SubtypeDetection {
    let trimmed = content.trim();
    let lines: Vec<&str> = trimmed.lines().collect();

    // Checklist detection: multiple lines matching checklist patterns
    let checklist_lines = lines
        .iter()
        .filter(|line| is_checklist_line(line))
        .count();

    if lines.len() >= 2 && checklist_lines as f32 / lines.len() as f32 >= 0.5 {
        return SubtypeDetection {
            subtype: "checklist".to_string(),
            confidence: 0.9,
            method: "domain".to_string(),
        };
    }

    // Quote detection: starts with quotation marks or blockquote indicators
    // Check for curly quotes (" ' " ') and standard quotes
    if trimmed.starts_with('\u{201C}')  // "
        || trimmed.starts_with('\u{2018}')  // '
        || trimmed.starts_with('\u{201D}')  // "
        || trimmed.starts_with('\u{2019}')  // '
        || trimmed.starts_with('>')
        || trimmed.starts_with('"')
        || trimmed.starts_with('\'')
    {
        return SubtypeDetection {
            subtype: "quote".to_string(),
            confidence: 0.8,
            method: "domain".to_string(),
        };
    }

    // Code detection using heuristics
    if detect_code_heuristics(trimmed) {
        return SubtypeDetection {
            subtype: "code".to_string(),
            confidence: 0.85,
            method: "domain".to_string(),
        };
    }

    // Default to plain note
    SubtypeDetection {
        subtype: "plain".to_string(),
        confidence: 1.0,
        method: "domain".to_string(),
    }
}

/// Check if a line looks like a checklist item
fn is_checklist_line(line: &str) -> bool {
    let trimmed = line.trim();

    // - [ ] Task or - [x] Task (GitHub style)
    if trimmed.starts_with("- [ ]")
        || trimmed.starts_with("- [x]")
        || trimmed.starts_with("- [X]")
    {
        return true;
    }

    // [ ] Task or [x] Task
    if trimmed.starts_with("[ ]") || trimmed.starts_with("[x]") || trimmed.starts_with("[X]") {
        return true;
    }

    // - Item or * Item (unordered list)
    if (trimmed.starts_with("- ") || trimmed.starts_with("* ")) && trimmed.len() > 2 {
        return true;
    }

    // 1. Item (numbered list)
    if let Some(first_char) = trimmed.chars().next() {
        if first_char.is_ascii_digit() {
            let rest = &trimmed[1..];
            if rest.starts_with(". ") || rest.starts_with(") ") {
                return true;
            }
            // Also check for two-digit numbers like "10. "
            if rest.chars().next().map(|c| c.is_ascii_digit()).unwrap_or(false) {
                let after_digits = rest.trim_start_matches(|c: char| c.is_ascii_digit());
                if after_digits.starts_with(". ") || after_digits.starts_with(") ") {
                    return true;
                }
            }
        }
    }

    false
}

/// Detect if content looks like code using heuristics
fn detect_code_heuristics(content: &str) -> bool {
    let mut score = 0;

    // Common code keywords and patterns
    let code_indicators = [
        "function ",
        "const ",
        "let ",
        "var ",
        "return ",
        "import ",
        "export ",
        "class ",
        "def ",
        "fn ",
        "pub ",
        "async ",
        "await ",
        "if (",
        "for (",
        "while (",
        "switch (",
        "match ",
        "struct ",
        "impl ",
        "interface ",
        "type ",
        "enum ",
        "package ",
        "use ",
        "require(",
        "module.exports",
        "=>",
        "->",
        "::=",
    ];

    for indicator in &code_indicators {
        if content.contains(indicator) {
            score += 1;
        }
    }

    // Check for balanced braces
    let open_braces = content.matches('{').count();
    let close_braces = content.matches('}').count();
    if open_braces > 0 && open_braces == close_braces {
        score += 2;
    }

    // Check for balanced brackets
    let open_brackets = content.matches('[').count();
    let close_brackets = content.matches(']').count();
    if open_brackets > 1 && open_brackets == close_brackets {
        score += 1;
    }

    // Check for semicolons at line ends (common in many languages)
    let semicolon_lines = content
        .lines()
        .filter(|l| l.trim().ends_with(';'))
        .count();
    if semicolon_lines >= 2 {
        score += 2;
    }

    // Check for common syntax patterns
    if content.contains("()") || content.contains("() {") {
        score += 1;
    }

    // Check for indentation patterns (4 spaces or tabs at start of lines)
    let indented_lines = content
        .lines()
        .filter(|l| l.starts_with("    ") || l.starts_with('\t'))
        .count();
    if indented_lines >= 3 {
        score += 1;
    }

    // Threshold for code detection
    score >= 3
}

/// Get default subtype for image items
/// Images require AI-based classification in most cases
pub fn get_default_image_subtype() -> SubtypeDetection {
    SubtypeDetection {
        subtype: "photo".to_string(),
        confidence: 0.5,
        method: "domain".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_youtube_detection() {
        let result = detect_url_subtype_by_domain("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
        assert!(result.is_some());
        let r = result.unwrap();
        assert_eq!(r.subtype, "video");
        assert_eq!(r.confidence, 1.0);
    }

    #[test]
    fn test_youtube_short_url() {
        let result = detect_url_subtype_by_domain("https://youtu.be/dQw4w9WgXcQ");
        assert!(result.is_some());
        assert_eq!(result.unwrap().subtype, "video");
    }

    #[test]
    fn test_twitter_detection() {
        let result = detect_url_subtype_by_domain("https://twitter.com/user/status/123");
        assert!(result.is_some());
        assert_eq!(result.unwrap().subtype, "social");
    }

    #[test]
    fn test_x_detection() {
        let result = detect_url_subtype_by_domain("https://x.com/user/status/123");
        assert!(result.is_some());
        assert_eq!(result.unwrap().subtype, "social");
    }

    #[test]
    fn test_github_detection() {
        let result = detect_url_subtype_by_domain("https://github.com/user/repo");
        assert!(result.is_some());
        assert_eq!(result.unwrap().subtype, "code");
    }

    #[test]
    fn test_amazon_detection() {
        let result = detect_url_subtype_by_domain("https://www.amazon.com/dp/B08N5WRWNW");
        assert!(result.is_some());
        assert_eq!(result.unwrap().subtype, "product");
    }

    #[test]
    fn test_medium_detection() {
        let result = detect_url_subtype_by_domain("https://medium.com/@user/article-title-123");
        assert!(result.is_some());
        assert_eq!(result.unwrap().subtype, "article");
    }

    #[test]
    fn test_spotify_detection() {
        let result =
            detect_url_subtype_by_domain("https://open.spotify.com/episode/1234567890");
        assert!(result.is_some());
        assert_eq!(result.unwrap().subtype, "audio");
    }

    #[test]
    fn test_unknown_domain() {
        let result = detect_url_subtype_by_domain("https://unknown-site.com/page");
        assert!(result.is_none());
    }

    #[test]
    fn test_checklist_detection() {
        let content = "- [ ] Task 1\n- [x] Task 2\n- [ ] Task 3";
        let result = detect_note_subtype(content);
        assert_eq!(result.subtype, "checklist");
    }

    #[test]
    fn test_numbered_list_detection() {
        let content = "1. First item\n2. Second item\n3. Third item";
        let result = detect_note_subtype(content);
        assert_eq!(result.subtype, "checklist");
    }

    #[test]
    fn test_code_detection() {
        let content = "function hello() {\n  return 'world';\n}";
        let result = detect_note_subtype(content);
        assert_eq!(result.subtype, "code");
    }

    #[test]
    fn test_quote_detection() {
        let content = "\"To be or not to be, that is the question.\"";
        let result = detect_note_subtype(content);
        assert_eq!(result.subtype, "quote");
    }

    #[test]
    fn test_blockquote_detection() {
        let content = "> This is a quoted text\n> From someone important";
        let result = detect_note_subtype(content);
        assert_eq!(result.subtype, "quote");
    }

    #[test]
    fn test_plain_note() {
        let content = "Just a regular note about something I want to remember.";
        let result = detect_note_subtype(content);
        assert_eq!(result.subtype, "plain");
    }
}
