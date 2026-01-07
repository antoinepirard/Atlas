use super::types::UrlMetadata;

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
#[allow(dead_code)]
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

