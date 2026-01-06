use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use pbkdf2::pbkdf2_hmac;
use rand::RngCore;
use sha2::Sha256;
use std::error::Error;

const PBKDF2_ITERATIONS: u32 = 100_000;
const SALT_LEN: usize = 16;
const NONCE_LEN: usize = 12;
const KEY_LEN: usize = 32; // 256 bits for AES-256

/// BIP39-inspired word list for recovery phrases
const WORD_LIST: [&str; 256] = [
    "abandon", "ability", "able", "about", "above", "absent", "absorb", "abstract",
    "absurd", "abuse", "access", "accident", "account", "accuse", "achieve", "acid",
    "acoustic", "acquire", "across", "act", "action", "actor", "actress", "actual",
    "adapt", "add", "addict", "address", "adjust", "admit", "adult", "advance",
    "advice", "aerobic", "affair", "afford", "afraid", "again", "age", "agent",
    "agree", "ahead", "aim", "air", "airport", "aisle", "alarm", "album",
    "alcohol", "alert", "alien", "all", "alley", "allow", "almost", "alone",
    "alpha", "already", "also", "alter", "always", "amateur", "amazing", "among",
    "amount", "amused", "analyst", "anchor", "ancient", "anger", "angle", "angry",
    "animal", "ankle", "announce", "annual", "another", "answer", "antenna", "antique",
    "anxiety", "any", "apart", "apology", "appear", "apple", "approve", "april",
    "arch", "arctic", "area", "arena", "argue", "arm", "armed", "armor",
    "army", "around", "arrange", "arrest", "arrive", "arrow", "art", "artefact",
    "artist", "artwork", "ask", "aspect", "assault", "asset", "assist", "assume",
    "asthma", "athlete", "atom", "attack", "attend", "attitude", "attract", "auction",
    "audit", "august", "aunt", "author", "auto", "autumn", "average", "avocado",
    "avoid", "awake", "aware", "away", "awesome", "awful", "awkward", "axis",
    "baby", "bachelor", "bacon", "badge", "bag", "balance", "balcony", "ball",
    "bamboo", "banana", "banner", "bar", "barely", "bargain", "barrel", "base",
    "basic", "basket", "battle", "beach", "bean", "beauty", "because", "become",
    "beef", "before", "begin", "behave", "behind", "believe", "below", "belt",
    "bench", "benefit", "best", "betray", "better", "between", "beyond", "bicycle",
    "bid", "bike", "bind", "biology", "bird", "birth", "bitter", "black",
    "blade", "blame", "blanket", "blast", "bleak", "bless", "blind", "blood",
    "blossom", "blouse", "blue", "blur", "blush", "board", "boat", "body",
    "boil", "bomb", "bone", "bonus", "book", "boost", "border", "boring",
    "borrow", "boss", "bottom", "bounce", "box", "boy", "bracket", "brain",
    "brand", "brass", "brave", "bread", "breeze", "brick", "bridge", "brief",
    "bright", "bring", "brisk", "broccoli", "broken", "bronze", "broom", "brother",
    "brown", "brush", "bubble", "buddy", "budget", "buffalo", "build", "bulb",
    "bulk", "bullet", "bundle", "bunker", "burden", "burger", "burst", "bus",
    "business", "busy", "butter", "buyer", "buzz", "cabbage", "cabin", "cable",
];

/// Generate a random salt
pub fn generate_salt() -> [u8; SALT_LEN] {
    let mut salt = [0u8; SALT_LEN];
    OsRng.fill_bytes(&mut salt);
    salt
}

/// Derive a 256-bit key from password using PBKDF2
pub fn derive_key(password: &str, salt: &[u8]) -> [u8; KEY_LEN] {
    let mut key = [0u8; KEY_LEN];
    pbkdf2_hmac::<Sha256>(password.as_bytes(), salt, PBKDF2_ITERATIONS, &mut key);
    key
}

/// Encrypt data using AES-256-GCM
/// Returns base64 encoded string: nonce + ciphertext
pub fn encrypt(data: &str, key: &[u8; KEY_LEN]) -> Result<String, Box<dyn Error>> {
    let cipher = Aes256Gcm::new_from_slice(key)?;
    
    let mut nonce_bytes = [0u8; NONCE_LEN];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    let ciphertext = cipher
        .encrypt(nonce, data.as_bytes())
        .map_err(|e| format!("Encryption failed: {}", e))?;
    
    // Combine nonce + ciphertext
    let mut combined = Vec::with_capacity(NONCE_LEN + ciphertext.len());
    combined.extend_from_slice(&nonce_bytes);
    combined.extend_from_slice(&ciphertext);
    
    Ok(BASE64.encode(&combined))
}

/// Decrypt data using AES-256-GCM
/// Expects base64 encoded string: nonce + ciphertext
pub fn decrypt(encrypted: &str, key: &[u8; KEY_LEN]) -> Result<String, Box<dyn Error>> {
    let combined = BASE64.decode(encrypted)?;
    
    if combined.len() < NONCE_LEN {
        return Err("Invalid encrypted data: too short".into());
    }
    
    let (nonce_bytes, ciphertext) = combined.split_at(NONCE_LEN);
    let nonce = Nonce::from_slice(nonce_bytes);
    
    let cipher = Aes256Gcm::new_from_slice(key)?;
    
    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| "Decryption failed: invalid key or corrupted data")?;
    
    String::from_utf8(plaintext).map_err(|e| e.into())
}

/// Generate a 12-word recovery phrase
pub fn generate_recovery_phrase() -> Vec<String> {
    let mut bytes = [0u8; 12];
    OsRng.fill_bytes(&mut bytes);
    
    bytes
        .iter()
        .map(|&b| WORD_LIST[b as usize].to_string())
        .collect()
}

/// Convert recovery phrase to a normalized string for key derivation
pub fn normalize_phrase(phrase: &[String]) -> String {
    phrase
        .iter()
        .map(|w| w.to_lowercase().trim().to_string())
        .collect::<Vec<_>>()
        .join(" ")
}

/// Derive key from recovery phrase
pub fn phrase_to_key(phrase: &[String], salt: &[u8]) -> [u8; KEY_LEN] {
    let normalized = normalize_phrase(phrase);
    derive_key(&normalized, salt)
}

/// Encode bytes to base64
pub fn bytes_to_base64(bytes: &[u8]) -> String {
    BASE64.encode(bytes)
}

/// Decode base64 to bytes
pub fn base64_to_bytes(encoded: &str) -> Result<Vec<u8>, Box<dyn Error>> {
    Ok(BASE64.decode(encoded)?)
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_encrypt_decrypt() {
        let salt = generate_salt();
        let key = derive_key("test_password", &salt);
        
        let original = "Hello, World! 🔐";
        let encrypted = encrypt(original, &key).unwrap();
        let decrypted = decrypt(&encrypted, &key).unwrap();
        
        assert_eq!(original, decrypted);
    }
    
    #[test]
    fn test_recovery_phrase() {
        let phrase = generate_recovery_phrase();
        assert_eq!(phrase.len(), 12);
        
        for word in &phrase {
            assert!(WORD_LIST.contains(&word.as_str()));
        }
    }
    
    #[test]
    fn test_wrong_key_fails() {
        let salt = generate_salt();
        let key1 = derive_key("password1", &salt);
        let key2 = derive_key("password2", &salt);
        
        let encrypted = encrypt("secret", &key1).unwrap();
        let result = decrypt(&encrypted, &key2);
        
        assert!(result.is_err());
    }
}

