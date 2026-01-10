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

fn is_github_repo_url(url: &Url) -> bool {
    if !matches!(url.host_str(), Some(host) if host.contains("github.com")) {
        return false;
    }
    let segments: Vec<&str> = url.path().split('/').filter(|s| !s.is_empty()).collect();
    if segments.len() < 2 {
        return false;
    }
    if segments.len() == 2 {
        return true;
    }
    matches!(segments.get(2), Some(&"tree") | Some(&"blob"))
}

fn extract_github_readme(html: &str) -> Option<String> {
    let html_lower = html.to_ascii_lowercase();
    let mut search_start = 0;

    while let Some(start) = html_lower[search_start..].find("<article") {
        let abs_start = search_start + start;
        if let Some(end) = html_lower[abs_start..].find('>') {
            let tag = &html[abs_start..abs_start + end + 1];
            if tag.to_ascii_lowercase().contains("markdown-body") {
                let content_start = abs_start + end + 1;
                if let Some(close) = html_lower[content_start..].find("</article>") {
                    let content_end = content_start + close;
                    let content = html[content_start..content_end].trim();
                    if !content.is_empty() {
                        return Some(content.to_string());
                    }
                }
            }
            search_start = abs_start + end + 1;
        } else {
            break;
        }
    }

    None
}

async fn fetch_html(client: &Client, start_url: Url) -> Result<Option<String>, String> {
    let mut current = start_url;

    for _ in 0..=MAX_REDIRECTS {
        let response = client
            .get(current.clone())
            .header(
                "User-Agent",
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
            )
            .header(
                "Accept",
                "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            )
            .header("Accept-Language", "en-US,en;q=0.9")
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
        .or_else(|| extract_meta(&html, "twitter:title"))
        .or_else(|| extract_meta(&html, "title"))
        .or_else(|| extract_tag(&html, "title"));
    let description = extract_meta(&html, "og:description")
        .or_else(|| extract_meta(&html, "twitter:description"))
        .or_else(|| extract_meta(&html, "description"));
    let image = extract_meta(&html, "og:image")
        .or_else(|| extract_meta(&html, "og:image:secure_url"))
        .or_else(|| extract_meta(&html, "twitter:image"))
        .or_else(|| extract_meta(&html, "twitter:image:src"));
    let json_ld_product = extract_product_from_json_ld(&html);
    let description = description
        .or_else(|| json_ld_product.as_ref().and_then(|p| p.description.clone()));

    // For author, prefer oEmbed data (more reliable for YouTube), then fall back to HTML parsing
    let author = oembed_data.as_ref().and_then(|o| o.author.clone())
        .or_else(|| extract_meta(&html, "author"))
        .or_else(|| extract_author_from_json_ld(&html))
        .or_else(|| extract_meta(&html, "og:site_name"));

    let github_readme = if is_github_repo_url(&url) {
        extract_github_readme(&html)
    } else {
        None
    };

    // Extract article content for reader mode (skip for YouTube/video content)
    let article_content = if github_readme.is_some() {
        github_readme
    } else if !is_youtube {
        extract_article(&html, url.as_str())
    } else {
        None
    };

    Ok(UrlMetadata {
        // Prefer oEmbed title for YouTube (cleaner), fall back to page title
        title: oembed_data
            .as_ref()
            .and_then(|o| o.title.clone())
            .or(title)
            .or_else(|| json_ld_product.as_ref().and_then(|p| p.title.clone())),
        description,
        // Prefer page image (usually higher res), fall back to oEmbed
        image: image
            .or_else(|| json_ld_product.as_ref().and_then(|p| p.image.clone()))
            .or_else(|| {
                if url
                    .host_str()
                    .map(|host| host.contains("amazon."))
                    .unwrap_or(false)
                {
                    extract_amazon_image(&html)
                } else {
                    None
                }
            })
            .or_else(|| oembed_data.as_ref().and_then(|o| o.image.clone())),
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
    let property = property.to_ascii_lowercase();
    let html_lower = html.to_ascii_lowercase();
    let mut search_start = 0;

    while let Some(start) = html_lower[search_start..].find("<meta") {
        let abs_start = search_start + start;
        if let Some(end) = html_lower[abs_start..].find('>') {
            let tag = &html[abs_start..abs_start + end + 1];
            let name = extract_attr_value(tag, "property")
                .or_else(|| extract_attr_value(tag, "name"));
            if let Some(name) = name {
                if name.trim().eq_ignore_ascii_case(&property) {
                    if let Some(content) = extract_attr_value(tag, "content") {
                        if !content.trim().is_empty() {
                            return Some(content);
                        }
                    }
                }
            }
            search_start = abs_start + end + 1;
        } else {
            break;
        }
    }

    None
}

fn extract_attr_value(tag: &str, attr: &str) -> Option<String> {
    let tag_lower = tag.to_ascii_lowercase();
    let attr_lower = attr.to_ascii_lowercase();
    let mut search = 0;

    while let Some(pos) = tag_lower[search..].find(&attr_lower) {
        let abs = search + pos;
        if abs > 0 {
            let prev = tag_lower.as_bytes()[abs - 1] as char;
            if !prev.is_ascii_whitespace() && prev != '<' {
                search = abs + attr_lower.len();
                continue;
            }
        }

        let mut idx = abs + attr_lower.len();
        while idx < tag_lower.len() && tag_lower.as_bytes()[idx].is_ascii_whitespace() {
            idx += 1;
        }
        if idx >= tag_lower.len() || tag_lower.as_bytes()[idx] != b'=' {
            search = abs + attr_lower.len();
            continue;
        }
        idx += 1;
        while idx < tag_lower.len() && tag_lower.as_bytes()[idx].is_ascii_whitespace() {
            idx += 1;
        }
        if idx >= tag_lower.len() {
            break;
        }

        let quote = tag_lower.as_bytes()[idx];
        if quote != b'"' && quote != b'\'' {
            search = abs + attr_lower.len();
            continue;
        }
        idx += 1;
        let start = idx;
        if let Some(end_rel) = tag[start..].find(quote as char) {
            return Some(tag[start..start + end_rel].to_string());
        }
        break;
    }

    None
}

fn extract_amazon_image(html: &str) -> Option<String> {
    let html_lower = html.to_ascii_lowercase();
    let mut search_start = 0;

    while let Some(start) = html_lower[search_start..].find("<img") {
        let abs_start = search_start + start;
        if let Some(end) = html_lower[abs_start..].find('>') {
            let tag = &html[abs_start..abs_start + end + 1];
            if is_amazon_landing_image(tag) {
                if let Some(url) = extract_image_from_tag(tag) {
                    return Some(url);
                }
            }
            search_start = abs_start + end + 1;
        } else {
            break;
        }
    }

    extract_dynamic_image_from_html(html)
}

fn is_amazon_landing_image(tag: &str) -> bool {
    let id = extract_attr_value(tag, "id")
        .unwrap_or_default()
        .to_ascii_lowercase();
    let name = extract_attr_value(tag, "data-a-image-name")
        .unwrap_or_default()
        .to_ascii_lowercase();
    id == "landingimage" || id == "imgblkfront" || name == "landingimage"
}

fn extract_image_from_tag(tag: &str) -> Option<String> {
    let candidates = [
        "data-old-hires",
        "data-a-hires",
        "data-zoom-image",
        "src",
    ];

    for attr in candidates {
        if let Some(value) = extract_attr_value(tag, attr) {
            let value = value.trim();
            if !value.is_empty() {
                return Some(value.to_string());
            }
        }
    }

    if let Some(value) = extract_attr_value(tag, "data-a-dynamic-image") {
        return extract_first_url_from_dynamic_image(&value);
    }

    None
}

fn extract_dynamic_image_from_html(html: &str) -> Option<String> {
    let html_lower = html.to_ascii_lowercase();
    let mut search_start = 0;

    while let Some(start) = html_lower[search_start..].find("data-a-dynamic-image") {
        let abs_start = search_start + start;
        if let Some(tag_start) = html_lower[..abs_start].rfind('<') {
            if let Some(tag_end) = html_lower[abs_start..].find('>') {
                let abs_end = abs_start + tag_end + 1;
                let tag = &html[tag_start..abs_end];
                if let Some(value) = extract_attr_value(tag, "data-a-dynamic-image") {
                    if let Some(url) = extract_first_url_from_dynamic_image(&value) {
                        return Some(url);
                    }
                }
                search_start = abs_end;
                continue;
            }
        }
        search_start = abs_start + 1;
    }

    None
}

fn extract_first_url_from_dynamic_image(value: &str) -> Option<String> {
    let unescaped = html_unescape_basic(value);
    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&unescaped) {
        if let Some(obj) = json.as_object() {
            if let Some((url, _)) = obj.iter().next() {
                return Some(url.to_string());
            }
        }
    }

    extract_first_url(&unescaped)
}

fn extract_first_url(value: &str) -> Option<String> {
    let start = value.find("https://")?;
    let rest = &value[start..];
    let end = rest
        .find(|c: char| c == '"' || c == '\'' || c == ',' || c == '}' || c == ']' || c == ' ')
        .unwrap_or(rest.len());
    let candidate = &rest[..end];
    if candidate.is_empty() {
        None
    } else {
        Some(candidate.to_string())
    }
}

fn html_unescape_basic(value: &str) -> String {
    value
        .replace("&quot;", "\"")
        .replace("&#34;", "\"")
        .replace("&amp;", "&")
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

#[derive(Default)]
struct JsonLdProduct {
    title: Option<String>,
    description: Option<String>,
    image: Option<String>,
}

fn extract_product_from_json_ld(html: &str) -> Option<JsonLdProduct> {
    let mut search_start = 0;
    while let Some(start) = html[search_start..].find(r#"type="application/ld+json""#) {
        let abs_start = search_start + start;
        if let Some(content_start) = html[abs_start..].find('>') {
            let content_abs_start = abs_start + content_start + 1;
            if let Some(end) = html[content_abs_start..].find("</script>") {
                let json_str = &html[content_abs_start..content_abs_start + end];
                if let Ok(value) = serde_json::from_str::<serde_json::Value>(json_str) {
                    if let Some(product) = find_product_fields(&value) {
                        return Some(product);
                    }
                }
            }
        }
        search_start = abs_start + 1;
    }
    None
}

fn find_product_fields(value: &serde_json::Value) -> Option<JsonLdProduct> {
    match value {
        serde_json::Value::Object(map) => {
            if is_product_type(map.get("@type")) {
                let title = extract_json_ld_text(map.get("name"))
                    .or_else(|| extract_json_ld_text(map.get("title")));
                let description = extract_json_ld_text(map.get("description"));
                let image = extract_json_ld_image(map.get("image"));
                if title.is_some() || description.is_some() || image.is_some() {
                    return Some(JsonLdProduct {
                        title,
                        description,
                        image,
                    });
                }
            }

            for value in map.values() {
                if let Some(product) = find_product_fields(value) {
                    return Some(product);
                }
            }
            None
        }
        serde_json::Value::Array(items) => {
            for item in items {
                if let Some(product) = find_product_fields(item) {
                    return Some(product);
                }
            }
            None
        }
        _ => None,
    }
}

fn is_product_type(value: Option<&serde_json::Value>) -> bool {
    match value {
        Some(serde_json::Value::String(name)) => name.eq_ignore_ascii_case("product"),
        Some(serde_json::Value::Array(types)) => types.iter().any(|t| is_product_type(Some(t))),
        _ => false,
    }
}

fn extract_json_ld_text(value: Option<&serde_json::Value>) -> Option<String> {
    match value {
        Some(serde_json::Value::String(text)) => Some(text.trim().to_string()),
        Some(serde_json::Value::Array(items)) => items
            .iter()
            .find_map(|item| extract_json_ld_text(Some(item))),
        Some(serde_json::Value::Object(map)) => map
            .get("name")
            .and_then(|name| extract_json_ld_text(Some(name))),
        _ => None,
    }
}

fn extract_json_ld_image(value: Option<&serde_json::Value>) -> Option<String> {
    match value {
        Some(serde_json::Value::String(url)) => Some(url.to_string()),
        Some(serde_json::Value::Array(items)) => items
            .iter()
            .find_map(|item| extract_json_ld_image(Some(item))),
        Some(serde_json::Value::Object(map)) => map
            .get("url")
            .or_else(|| map.get("contentUrl"))
            .and_then(|url| extract_json_ld_image(Some(url))),
        _ => None,
    }
}
