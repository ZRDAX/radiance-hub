# Radiance Hub

Radiance Hub is a Windows-focused tray application for software updates.

It runs with **Tauri + Rust** on the backend and **React + TypeScript** on the frontend, using `winget` as the current package manager source.

## Current Product Scope

- Tray popup experience (compact update panel)
- Check pending updates
- Run single update
- Run batch update (`Update All`)
- Keep app alive in background (close-to-tray behavior)
- Open/focus/toggle from system tray

## Tech Stack

### Frontend
- React 19
- TypeScript 5
- Vite 7
- Tailwind CSS 4
- shadcn/ui (base UI components)

### Desktop / Backend
- Tauri v2
- Rust 2021 edition
- `tauri-plugin-shell`
- `tauri-plugin-process`
- `tauri-plugin-positioner` (tray window positioning)
- `serde` / `serde_json`

## Project Scripts

From project root:

```bash
yarn dev         # frontend dev server
yarn build       # typecheck + production frontend build
yarn lint        # eslint
yarn tauri dev   # run desktop app in development
yarn tauri build # build desktop bundles
```

Rust checks (inside `src-tauri`):

```bash
cargo fmt --check
cargo check
cargo test
```

## Requirements

- Node.js 20+ recommended
- Yarn 1.x
- Rust toolchain (stable)
- Tauri prerequisites for Windows
- `winget` available in PATH

## Architecture Notes

- Backend (`src-tauri/src/winget.rs`) is the source of truth for update parsing/execution.
- Frontend consumes structured JSON via Tauri `invoke`.
- Updates state is centralized in `src/features/updates/hooks/use-updates.tsx`.
- Tray behavior is implemented in `src-tauri/src/main.rs`.

## Useful Docs in This Repo

- `PROJECT_STRUCTURE.md`: current folder/module structure
- `CI_STACK.md`: stack and CI guidance for workflow implementation

## Status

The project is in active evolution toward a polished tray-native update manager workflow.
