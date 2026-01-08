# Atlas - Project Documentation

## Overview

Atlas is a private, encrypted "mind vault" desktop application for macOS. It allows users to save URLs, notes, and images with AI-powered tagging and semantic search capabilities. All data is encrypted locally using AES-256-GCM.

## Tech Stack

### Frontend

- **React 18** with TypeScript
- **Vite** for bundling and dev server
- **Tailwind CSS** for styling
- **Motion** (Framer Motion) for animations

### Backend

- **Tauri 2.0** - Rust-based desktop framework
- **SQLite** via `rusqlite` for local database
- **AES-256-GCM** encryption with PBKDF2 key derivation

### AI Integration

- **OpenAI API** for:
  - Tag generation (`gpt-4o-mini`)
  - Content summarization
  - Semantic embeddings (`text-embedding-3-small`)

## Project Structure

```
Atlas/
├── src/                      # Frontend (React)
│   ├── App.tsx               # Root component with vault state routing
│   ├── main.tsx              # Entry point
│   ├── index.css             # Global styles (Tailwind)
│   ├── components/
│   │   ├── VaultProvider.tsx # Vault state context
│   │   ├── VaultSetup.tsx    # First-time setup UI
│   │   ├── VaultUnlock.tsx   # Password entry UI
│   │   ├── AtlasApp.tsx      # Main app after unlock
│   │   ├── MasonryGrid.tsx   # Item grid layout
│   │   ├── ItemCard.tsx      # Individual item display
│   │   ├── SearchBar.tsx     # Search with semantic support
│   │   ├── AddContentModal.tsx
│   │   ├── PreviewModal.tsx
│   │   ├── SettingsModal.tsx
│   │   └── TypeFilter.tsx
│   ├── hooks/
│   │   └── useAtlas.ts       # Item management hook
│   ├── lib/
│   │   └── tauri.ts          # Tauri command wrappers
│   └── types/
│       └── index.ts          # TypeScript interfaces
│
├── src-tauri/                # Backend (Rust)
│   ├── tauri.conf.json       # Tauri configuration
│   ├── Cargo.toml            # Rust dependencies
│   ├── src/
│   │   ├── main.rs           # App entry point
│   │   ├── lib.rs            # Tauri setup & command registration
│   │   ├── commands/
│   │   │   ├── mod.rs        # Command exports
│   │   │   ├── vault.rs      # Vault management commands
│   │   │   ├── items.rs      # Item CRUD commands
│   │   │   └── ai.rs         # OpenAI integration
│   │   ├── crypto/
│   │   │   └── mod.rs        # Encryption utilities
│   │   └── db/
│   │       └── mod.rs        # SQLite database operations
│   └── icons/                # App icons for all platforms
│
├── .github/
│   └── workflows/
│       └── release.yml       # Automated release workflow
│
├── package.json              # Node dependencies
├── pnpm-lock.yaml
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
└── tsconfig.node.json
```

## Running the App

### Prerequisites

- Rust (latest stable): `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- Node.js 18+
- pnpm: `npm install -g pnpm`
- Xcode Command Line Tools: `xcode-select --install`

### Development

```bash
# Install dependencies
pnpm install

# Run in development mode (hot reload)
pnpm tauri dev
```

### Building

```bash
# Build for production (creates .dmg and .app)
pnpm tauri build
```

Output location: `src-tauri/target/release/bundle/`

## Releasing

Releases are automated via GitHub Actions. To create a new release:

```bash
# 1. Update version in package.json and src-tauri/tauri.conf.json
# 2. Commit changes
git add .
git commit -m "Bump version to X.Y.Z"

# 3. Tag and push
git tag vX.Y.Z
git push origin main
git push origin vX.Y.Z
```

The workflow builds a macOS DMG and publishes it to GitHub Releases automatically.

## Architecture

### App Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        App.tsx                              │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────────┐   │
│  │ VaultSetup  │ → │ VaultUnlock │ → │    AtlasApp     │   │
│  │ (no vault)  │   │  (locked)   │   │   (unlocked)    │   │
│  └─────────────┘   └─────────────┘   └─────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Frontend (React)
      │
      │ invoke('command_name', { params })
      ▼
Tauri IPC Bridge
      │
      ▼
Rust Backend
      │
      ├──► crypto/   (encrypt/decrypt)
      ├──► db/       (SQLite operations)
      └──► commands/ (business logic)
```

### Security Model

1. **Password** → PBKDF2 → **Encryption Key** (256-bit)
2. Key only exists in memory while unlocked
3. All item data encrypted with AES-256-GCM before SQLite storage
4. Auto-lock clears key after configurable inactivity
5. 12-word recovery phrase generated at vault creation

## Tauri Commands

### Vault Commands

| Command                          | Description                                       |
| -------------------------------- | ------------------------------------------------- |
| `get_vault_status`               | Returns `{ exists, unlocked, auto_lock_minutes }` |
| `create_vault(password)`         | Creates vault, returns 12-word recovery phrase    |
| `unlock_vault(password)`         | Unlocks vault with password                       |
| `unlock_with_phrase(phrase[])`   | Unlocks with recovery phrase                      |
| `lock_vault`                     | Locks vault, clears key from memory               |
| `set_auto_lock_minutes(minutes)` | Sets auto-lock timeout                            |
| `reset_vault`                    | Deletes vault entirely                            |
| `get_storage_path`               | Returns current vault storage path                |
| `set_storage_path(newPath)`      | Changes vault storage location                    |

### Item Commands

| Command             | Description                    |
| ------------------- | ------------------------------ |
| `get_all_items`     | Returns all decrypted items    |
| `add_item(input)`   | Adds new item (url/note/image) |
| `update_item(item)` | Updates existing item          |
| `delete_item(id)`   | Deletes item by ID             |
| `get_item_count`    | Returns total item count       |

### AI Commands

| Command                                         | Description                                |
| ----------------------------------------------- | ------------------------------------------ |
| `save_api_key(apiKey)`                          | Stores OpenAI API key in system keychain   |
| `has_api_key`                                   | Checks if API key exists                   |
| `get_api_key_masked`                            | Returns masked API key (sk-...xxxx)        |
| `process_with_ai(content, type, title?, desc?)` | Returns `{ tags, summary, embedding }`     |
| `get_search_embedding(query)`                   | Returns embedding vector for search        |
| `fetch_url_metadata(url)`                       | Fetches title, description, image from URL |

## TypeScript Types

```typescript
type ItemType = "url" | "image" | "note";

interface Item {
  id: string;
  type: ItemType;
  content: string;
  title: string | null;
  description: string | null;
  summary: string | null;
  image_url: string | null;
  tags: string[];
  embedding: number[] | null;
  created_at: string;
  updated_at: string;
}

interface VaultStatus {
  exists: boolean;
  unlocked: boolean;
  auto_lock_minutes: number;
}
```

## Data Storage

Vault locations (separated for dev/prod isolation):

```
# Production build
~/Library/Application Support/com.antoinepirard.atlas/vault.db

# Development build (pnpm tauri dev)
~/Library/Application Support/com.antoinepirard.atlas-dev/vault.db
```

The SQLite database stores encrypted item data. The encryption key is derived from the user's password and never stored.

Note: On first run, data is automatically migrated from the legacy `mymind/` directory if it exists.

## Configuration Files

### `src-tauri/tauri.conf.json`

- App name, version, identifier
- Window configuration (size, title)
- Bundle settings (icons, macOS minimum version)
- Build commands

### `package.json`

- Frontend dependencies
- Scripts: `dev`, `build`, `preview`, `tauri`

## Important Notes

- Always use **pnpm** (not npm or yarn)
- Always use **Tailwind CSS** for styling
- Do not override existing components unless explicitly asked
- The app is macOS-only (DMG distribution)
- OpenAI API key is stored in the system keychain (not in the vault)
