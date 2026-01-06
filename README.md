# mymind - Desktop App

A private, encrypted mind vault for macOS built with Tauri + React.

## Features

- 🔒 **End-to-end encryption** - AES-256-GCM with PBKDF2 key derivation
- 🗄️ **Local SQLite storage** - Your data stays on your Mac
- 🔑 **Recovery phrase** - 12-word backup in case you forget your password
- ⏰ **Auto-lock** - Configurable inactivity timeout
- 🤖 **AI-powered tagging** - Uses OpenAI for smart categorization
- 🔍 **Semantic search** - Find content by meaning, not just keywords

## Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- [Node.js](https://nodejs.org/) (18+)
- [pnpm](https://pnpm.io/) (`npm install -g pnpm`)
- Xcode Command Line Tools (`xcode-select --install`)

## Development

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm tauri dev
```

## Build

```bash
# Build for production (creates .dmg and .app)
pnpm tauri build
```

The built app will be in `src-tauri/target/release/bundle/`.

## Auto-Updates

Atlas supports automatic updates. When a new version is released, users will see an in-app toast notification prompting them to update. Users can also manually check for updates via **Atlas → Check for Updates...** in the menu bar.

### Setting Up Auto-Updates for Development

1. **Generate a signing key pair:**

   ```bash
   pnpm tauri signer generate -w ~/.tauri/atlas.key
   ```

   This creates:

   - `~/.tauri/atlas.key` (private key - keep this secret!)
   - `~/.tauri/atlas.key.pub` (public key)

2. **Update the public key in `src-tauri/tauri.conf.json`:**
   Replace `UPDATER_PUBKEY_PLACEHOLDER` with your public key content.

3. **Set up GitHub Secrets** (for CI/CD releases):
   - `TAURI_SIGNING_PRIVATE_KEY`: Content of your private key file
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: Password you used when generating the key

### How It Works

- The app checks for updates 5 seconds after launch
- Update metadata is fetched from GitHub Releases (`latest.json`)
- Updates are signed with EdDSA to ensure authenticity
- Users can postpone updates or install immediately
- After download, a restart is required to apply the update

## Configuration

### OpenAI API Key

The app uses OpenAI for:

- Generating tags and summaries
- Creating embeddings for semantic search

Set your API key through the app settings, or set the `OPENAI_API_KEY` environment variable.

## Data Location

Your encrypted vault is stored at:

```
~/Library/Application Support/mymind/vault.db
```

## Security Notes

- Your password is never stored - only used to derive the encryption key
- The encryption key only exists in memory while the app is unlocked
- Auto-lock clears the key from memory after inactivity
- All item data is encrypted before being written to SQLite

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Motion
- **Backend**: Rust, Tauri 2.0
- **Database**: SQLite (via rusqlite)
- **Encryption**: aes-gcm, pbkdf2 (Rust crates)
- **AI**: OpenAI API (gpt-4o-mini, text-embedding-3-small)
