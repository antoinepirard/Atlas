use crate::crypto;
use crate::db::get_db_path;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use image::codecs::jpeg::JpegEncoder;
use image::imageops::FilterType;
use image::{GenericImageView, ImageFormat};
use std::fs;
use std::io::Cursor;
use std::path::PathBuf;

/// Default thumbnail size (width and height)
pub const THUMBNAIL_SIZE: u32 = 400;

/// Quality for JPEG thumbnails (0-100)
const THUMBNAIL_QUALITY: u8 = 80;

/// Get the images directory path
pub fn get_images_dir() -> PathBuf {
    let db_path = get_db_path();
    let vault_dir = db_path.parent().unwrap_or(&db_path);
    vault_dir.join("images")
}

/// Ensure the images directory exists
pub fn ensure_images_dir() -> Result<PathBuf, String> {
    let images_dir = get_images_dir();
    fs::create_dir_all(&images_dir)
        .map_err(|e| format!("Failed to create images directory: {}", e))?;
    Ok(images_dir)
}

/// Get the path for a full-size encrypted image
pub fn get_full_image_path(item_id: &str) -> PathBuf {
    get_images_dir().join(format!("{}-full.enc", item_id))
}

/// Get the path for a thumbnail encrypted image
pub fn get_thumbnail_path(item_id: &str) -> PathBuf {
    get_images_dir().join(format!("{}-thumb.enc", item_id))
}

/// Decode a base64 data URL to raw image bytes
fn decode_data_url(data_url: &str) -> Result<(Vec<u8>, ImageFormat), String> {
    // Parse data URL format: data:image/png;base64,XXXX
    let parts: Vec<&str> = data_url.splitn(2, ',').collect();
    if parts.len() != 2 {
        return Err("Invalid data URL format".to_string());
    }

    let header = parts[0];
    let base64_data = parts[1];

    // Determine format from header
    let format = if header.contains("image/png") {
        ImageFormat::Png
    } else if header.contains("image/jpeg") || header.contains("image/jpg") {
        ImageFormat::Jpeg
    } else if header.contains("image/gif") {
        ImageFormat::Gif
    } else if header.contains("image/webp") {
        ImageFormat::WebP
    } else {
        // Default to PNG if unknown
        ImageFormat::Png
    };

    let bytes = BASE64
        .decode(base64_data)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;

    Ok((bytes, format))
}

/// Create a thumbnail from image bytes
fn create_thumbnail(image_bytes: &[u8], format: ImageFormat) -> Result<Vec<u8>, String> {
    let img = image::load_from_memory_with_format(image_bytes, format)
        .or_else(|_| image::load_from_memory(image_bytes))
        .map_err(|e| format!("Failed to load image: {}", e))?;

    let (width, height) = img.dimensions();

    // Only resize if larger than thumbnail size
    let thumbnail = if width > THUMBNAIL_SIZE || height > THUMBNAIL_SIZE {
        img.resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, FilterType::Lanczos3)
    } else {
        img
    };

    // Encode as JPEG for smaller file size
    let mut output = Vec::new();
    let mut cursor = Cursor::new(&mut output);
    let encoder = JpegEncoder::new_with_quality(&mut cursor, THUMBNAIL_QUALITY);
    thumbnail
        .write_with_encoder(encoder)
        .map_err(|e| format!("Failed to encode thumbnail: {}", e))?;

    Ok(output)
}

/// Encode bytes to a data URL
fn encode_to_data_url(bytes: &[u8], mime_type: &str) -> String {
    let base64_data = BASE64.encode(bytes);
    format!("data:{};base64,{}", mime_type, base64_data)
}

/// Store an image from a data URL, returning the thumbnail data URL
/// 
/// This function:
/// 1. Decodes the base64 data URL
/// 2. Creates a thumbnail
/// 3. Encrypts both full image and thumbnail
/// 4. Saves them to disk
/// 5. Returns the thumbnail as a data URL for immediate display
pub fn store_image(
    item_id: &str,
    data_url: &str,
    key: &[u8; 32],
) -> Result<String, String> {
    // Ensure images directory exists
    ensure_images_dir()?;

    // Decode the data URL
    let (image_bytes, format) = decode_data_url(data_url)?;

    // Create thumbnail
    let thumbnail_bytes = create_thumbnail(&image_bytes, format)?;

    // Encrypt full image
    let full_image_base64 = BASE64.encode(&image_bytes);
    let encrypted_full = crypto::encrypt(&full_image_base64, key)
        .map_err(|e| format!("Failed to encrypt full image: {}", e))?;

    // Encrypt thumbnail
    let thumbnail_base64 = BASE64.encode(&thumbnail_bytes);
    let encrypted_thumbnail = crypto::encrypt(&thumbnail_base64, key)
        .map_err(|e| format!("Failed to encrypt thumbnail: {}", e))?;

    // Save encrypted files
    let full_path = get_full_image_path(item_id);
    let thumb_path = get_thumbnail_path(item_id);

    fs::write(&full_path, &encrypted_full)
        .map_err(|e| format!("Failed to write full image: {}", e))?;
    fs::write(&thumb_path, &encrypted_thumbnail)
        .map_err(|e| format!("Failed to write thumbnail: {}", e))?;

    // Return thumbnail as data URL for immediate use
    Ok(encode_to_data_url(&thumbnail_bytes, "image/jpeg"))
}

/// Load and decrypt a thumbnail, returning it as a data URL
pub fn load_thumbnail(item_id: &str, key: &[u8; 32]) -> Result<String, String> {
    let thumb_path = get_thumbnail_path(item_id);

    if !thumb_path.exists() {
        return Err("Thumbnail not found".to_string());
    }

    let encrypted = fs::read_to_string(&thumb_path)
        .map_err(|e| format!("Failed to read thumbnail: {}", e))?;

    let decrypted_base64 = crypto::decrypt(&encrypted, key)
        .map_err(|e| format!("Failed to decrypt thumbnail: {}", e))?;

    let bytes = BASE64
        .decode(&decrypted_base64)
        .map_err(|e| format!("Failed to decode thumbnail: {}", e))?;

    Ok(encode_to_data_url(&bytes, "image/jpeg"))
}

/// Load and decrypt the full image, returning it as a data URL
pub fn load_full_image(item_id: &str, key: &[u8; 32]) -> Result<String, String> {
    let full_path = get_full_image_path(item_id);

    if !full_path.exists() {
        return Err("Full image not found".to_string());
    }

    let encrypted = fs::read_to_string(&full_path)
        .map_err(|e| format!("Failed to read full image: {}", e))?;

    let decrypted_base64 = crypto::decrypt(&encrypted, key)
        .map_err(|e| format!("Failed to decrypt full image: {}", e))?;

    let bytes = BASE64
        .decode(&decrypted_base64)
        .map_err(|e| format!("Failed to decode full image: {}", e))?;

    // Detect format and return appropriate data URL
    let format = image::guess_format(&bytes).unwrap_or(ImageFormat::Jpeg);
    let mime = match format {
        ImageFormat::Png => "image/png",
        ImageFormat::Gif => "image/gif",
        ImageFormat::WebP => "image/webp",
        _ => "image/jpeg",
    };

    Ok(encode_to_data_url(&bytes, mime))
}

/// Delete image files for an item
pub fn delete_image_files(item_id: &str) -> Result<(), String> {
    let full_path = get_full_image_path(item_id);
    let thumb_path = get_thumbnail_path(item_id);

    // Delete files if they exist (ignore errors for non-existent files)
    if full_path.exists() {
        fs::remove_file(&full_path)
            .map_err(|e| format!("Failed to delete full image: {}", e))?;
    }

    if thumb_path.exists() {
        fs::remove_file(&thumb_path)
            .map_err(|e| format!("Failed to delete thumbnail: {}", e))?;
    }

    Ok(())
}

/// Check if an image has been stored externally (not as Base64 in DB)
pub fn has_external_image(item_id: &str) -> bool {
    get_thumbnail_path(item_id).exists()
}

/// Migrate a Base64 image from the database to external storage
/// Returns the new thumbnail data URL
pub fn migrate_image(
    item_id: &str,
    data_url: &str,
    key: &[u8; 32],
) -> Result<String, String> {
    // Check if already migrated
    if has_external_image(item_id) {
        // Load existing thumbnail
        return load_thumbnail(item_id, key);
    }

    // Store the image externally
    store_image(item_id, data_url, key)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_decode_data_url() {
        // Create a simple 1x1 PNG
        let png_data = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
        let result = decode_data_url(png_data);
        assert!(result.is_ok());
        let (bytes, format) = result.unwrap();
        assert!(!bytes.is_empty());
        assert_eq!(format, ImageFormat::Png);
    }
}

