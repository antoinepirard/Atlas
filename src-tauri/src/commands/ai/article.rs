use reqwest::Url;
use std::io::Cursor;

/// Extract article HTML content using Mozilla's Readability algorithm
/// Returns the HTML content with formatting preserved (headings, paragraphs, links, etc.)
pub fn extract_article(html: &str, url: &str) -> Option<String> {
    // Parse the URL to create a proper base URL
    let base_url = match Url::parse(url) {
        Ok(u) => u,
        Err(_) => return None,
    };

    // Use readability to extract article content
    let mut cursor = Cursor::new(html.as_bytes());
    match readability::extractor::extract(&mut cursor, &base_url) {
        Ok(product) => {
            // Return the HTML content with formatting preserved
            let html_content = product.content.trim().to_string();

            // Only return if we got meaningful content (at least 100 chars of text)
            if product.text.len() >= 100 {
                Some(html_content)
            } else {
                None
            }
        }
        Err(_) => None,
    }
}
