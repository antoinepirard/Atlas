use super::article::extract_article;
use super::types::UrlMetadata;
use futures::StreamExt;
use reqwest::header::{CONTENT_TYPE, LOCATION};
use reqwest::{redirect::Policy, Client, Url};
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, ToSocketAddrs};

const MAX_HTML_BYTES: usize = 2 * 1024 * 1024;
const MAX_REDIRECTS: usize = 3;

fn is_blocked_hostname(host: &str) -> bool {
    let host = host.trim_end_matches('.').to_ascii_lowercase();
    host == "localhost"
        || host.ends_with(".localhost")
        || host.ends_with(".local")
        || host.ends_with(".localdomain")
}

fn is_private_ipv4(ip: Ipv4Addr) -> bool {
    ip.is_private()
        || ip.is_loopback()
        || ip.is_link_local()
        || ip.is_unspecified()
        || ip.is_broadcast()
        || ip.is_documentation()
        || {
            let octets = ip.octets();
            octets[0] == 100 && (octets[1] & 0b1100_0000) == 0b0100_0000
        }
}

fn is_private_ipv6(ip: Ipv6Addr) -> bool {
    if let Some(v4) = ip.to_ipv4() {
        return is_private_ipv4(v4);
    }
    ip.is_loopback()
        || ip.is_unique_local()
        || ip.is_unicast_link_local()
        || ip.is_unspecified()
        || ip.is_multicast()
}

fn is_private_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => is_private_ipv4(v4),
        IpAddr::V6(v6) => is_private_ipv6(v6),
    }
}

fn validate_url(url: &Url) -> Result<(), String> {
    match url.scheme() {
        "http" | "https" => {}
        _ => return Err("Only http/https URLs are allowed".to_string()),
    }

    let host = url.host_str().ok_or_else(|| "URL is missing host".to_string())?;
    if is_blocked_hostname(host) {
        return Err("Blocked URL host".to_string());
    }

    if let Ok(ip) = host.parse::<IpAddr>() {
        if is_private_ip(ip) {
            return Err("Blocked URL host".to_string());
        }
    }

    let port = url.port_or_known_default().unwrap_or(80);
    let addrs = (host, port)
        .to_socket_addrs()
        .map_err(|_| "Failed to resolve host".to_string())?;

    for addr in addrs {
        if is_private_ip(addr.ip()) {
            return Err("Blocked URL host".to_string());
        }
    }

    Ok(())
}

fn validate_fetch_url(raw_url: &str) -> Result<Url, String> {
    let url = Url::parse(raw_url).map_err(|_| "Invalid URL".to_string())?;
    validate_url(&url)?;
    Ok(url)
}

fn is_youtube_url(url: &Url) -> bool {
    matches!(url.host_str(), Some(host) if host.contains("youtube.com") || host.contains("youtu.be"))
}

async fn fetch_html(client: &Client, start_url: Url) -> Result<Option<String>, String> {
    let mut current = start_url;

    for _ in 0..=MAX_REDIRECTS {
        let response = client
            .get(current.clone())
            .header("User-Agent", "Mozilla/5.0 (compatible; AtlasBot/1.0)")
            .send()
            .await
            .map_err(|e| format!("Failed to fetch URL: {}", e))?;

        if response.status().is_redirection() {
            let location = response
                .headers()
                .get(LOCATION)
                .ok_or_else(|| "Redirect without location header".to_string())?;
            let location = location
                .to_str()
                .map_err(|_| "Invalid redirect location".to_string())?;
            let next = current
                .join(location)
                .map_err(|_| "Invalid redirect URL".to_string())?;
            validate_url(&next)?;
            current = next;
            continue;
        }

        if !response.status().is_success() {
            return Ok(None);
        }

        if let Some(len) = response.content_length() {
            if len > MAX_HTML_BYTES as u64 {
                return Err("Response too large".to_string());
            }
        }

        if let Some(content_type) = response
            .headers()
            .get(CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
        {
            if !content_type.contains("text/html")
                && !content_type.contains("application/xhtml+xml")
            {
                return Ok(None);
            }
        }

        let mut body = Vec::new();
        let mut stream = response.bytes_stream();
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| format!("Failed to read response: {}", e))?;
            if body.len() + chunk.len() > MAX_HTML_BYTES {
                return Err("Response too large".to_string());
            }
            body.extend_from_slice(&chunk);
        }

        let html = String::from_utf8_lossy(&body).to_string();
        return Ok(Some(html));
    }

    Err("Too many redirects".to_string())
}

/// Fetch URL metadata
#[tauri::command]
pub async fn fetch_url_metadata(url: String) -> Result<UrlMetadata, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .redirect(Policy::none())
        .build()
        .map_err(|e| e.to_string())?;
    let url = validate_fetch_url(&url)?;

    // Check if this is a YouTube URL - use oEmbed API for channel name
    let is_youtube = is_youtube_url(&url);
    let oembed_data = if is_youtube {
        fetch_youtube_oembed(&client, url.as_str()).await
    } else {
        None
    };

    let html = match fetch_html(&client, url.clone()).await? {
        Some(content) => content,
        None => {
            if let Some(oembed) = oembed_data {
                return Ok(oembed);
            }
            return Ok(UrlMetadata {
                title: None,
                description: None,
                image: None,
                author: None,
                article_content: None,
            });
        }
    };

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

    // Extract article content for reader mode (skip for YouTube/video content)
    let article_content = if !is_youtube {
        extract_article(&html, url.as_str())
    } else {
        None
    };

    Ok(UrlMetadata {
        // Prefer oEmbed title for YouTube (cleaner), fall back to page title
        title: oembed_data.as_ref().and_then(|o| o.title.clone()).or(title),
        description,
        // Prefer page image (usually higher res), fall back to oEmbed
        image: image.or_else(|| oembed_data.as_ref().and_then(|o| o.image.clone())),
        author,
        article_content,
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
        article_content: None, // oEmbed doesn't provide article content
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
