# Radiance Hub — Estrutura Atual (Template)

Este arquivo descreve como o projeto está organizado hoje.

## Raiz

```txt
radiance-hub/
├─ src/                        # Frontend React + TypeScript
├─ src-tauri/                  # Backend Tauri + Rust
├─ public/                     # Arquivos estáticos públicos
├─ assets/                     # Assets de documentação/template
├─ dist/                       # Build frontend (gerado)
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
├─ components.json
└─ README.md
```

## Frontend (`src/`)

```txt
src/
├─ main.tsx                    # Entry point React
├─ app/
│  ├─ index.tsx                # Composição principal da app
│  ├─ provider.tsx             # Providers globais
│  ├─ router.tsx               # Rotas
│  ├─ global.css               # Estilos globais
│  └─ routes/
│     ├─ home.tsx
│     ├─ available-updates.tsx
│     ├─ installed-apps.tsx
│     ├─ update-history.tsx
│     ├─ logs.tsx
│     ├─ settings.tsx
│     ├─ system-status.tsx
│     ├─ not-found.tsx
│     └─ _placeholder-page.tsx
├─ components/
│  └─ ui/
│     ├─ button.tsx
│     └─ tooltip.tsx
├─ config/
│  └─ env.ts
├─ lib/
│  ├─ create-env.ts
│  └─ utils.ts
└─ features/
   ├─ updates/
   │  ├─ index.tsx
   │  ├─ types.ts
   │  ├─ api/winget.ts
   │  ├─ hooks/use-updates.tsx
   │  ├─ lib/package-manager.ts
   │  └─ components/updates-library.tsx
   ├─ dashboard/
   │  ├─ index.tsx
   │  └─ components/dashboard-card.tsx
   ├─ errors/
   │  ├─ app-error.tsx
   │  └─ error-base.tsx
   ├─ built-with/
   │  ├─ index.tsx
   │  └─ assets/
   └─ github-star-button/
      └─ index.tsx
```

## Backend Tauri (`src-tauri/`)

```txt
src-tauri/
├─ src/
│  ├─ main.rs                  # Bootstrap Tauri, tray e eventos
│  └─ winget.rs                # Comandos Rust para updates
├─ tauri.conf.json             # Configuração de janela/app
├─ Cargo.toml                  # Dependências Rust
├─ build.rs
├─ icons/
├─ capabilities/
└─ gen/schemas/
```

## Fluxo de alto nível

1. Frontend chama comandos Tauri via `invoke` (`features/updates/api/winget.ts`).
2. Backend Rust executa `winget`, faz parsing e retorna JSON estruturado.
3. Store/hook de updates (`use-updates.tsx`) concentra estado e ações.
4. UI de updates renderiza painel de tray (`updates-library.tsx`).

## Observações

- `dist/`, `node_modules/` e `src-tauri/target/` são diretórios gerados.
- A arquitetura está orientada por features para facilitar evolução modular.
