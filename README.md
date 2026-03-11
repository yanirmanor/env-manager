# Env Manager

A native desktop tool to manage `.env` files across projects — scan, edit, diff, snapshot, and toggle between local and remote URLs.

[![Download app for macOS](docs/download-macos.svg)](https://github.com/yanirmanor/env-manager/releases/latest)

![screenshot](docs/screenshot.png)

## Features

**Project Discovery**
- Scan folders recursively for projects with `.env` files (`.env`, `.env.development`, `.env.staging`, etc.)
- Smart filtering — skips `node_modules`, `.git`, `build`, and other non-project directories

**Variable Editor**
- Inline editing of key-value pairs with real-time updates
- Auto-categorization: URL, Port, Host, Credential, Flag, Config
- Sensitive values (secrets, tokens, passwords) are masked by default with a reveal toggle

**URL & Service Intelligence**
- Classifies URLs as Local, Staging, Production, Database, K8s Internal, etc.
- Scans localhost ports to detect running services
- One-click toggle between local and remote URLs per variable
- Star services and map them to remote endpoints

**Change Management**
- Stage changes before saving, with a pending changes counter
- Visual diff viewer — compare current state against saved defaults
- Save or discard changes in bulk

**Snapshots & Backups**
- Save and restore complete `.env` file states with timestamps
- Automatic backups before modifications

**UI**
- Dark and light themes
- Search projects by name or path
- Status badges per project: All Local, All Remote, Mixed, No URLs

## Install

### Homebrew (macOS)

```sh
brew install --cask yanirmanor/tap/env-manager
```

### GitHub Releases

Download the latest release from the [GitHub Releases](https://github.com/yanirmanor/env-manager/releases) page:

| Platform | Format |
|----------|--------|
| macOS | `.dmg` |
| Windows | `.msi` |
| Linux | `.AppImage` |

> **macOS note:** On first launch, macOS may block the app ("Apple could not verify"). Go to **System Settings > Privacy & Security**, scroll down, and click **Open Anyway**.

## Build from Source

Prerequisites: [Rust](https://rustup.rs/), [Bun](https://bun.sh/), [Tauri CLI](https://v2.tauri.app/start/prerequisites/)

```sh
bun install
bun run tauri build
```

The built application will be in `src-tauri/target/release/bundle/`.

## Development

```sh
bun install
bun run tauri dev
```

## License

[MIT](LICENSE)
