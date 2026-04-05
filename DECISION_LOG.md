# Decision Log

Traccia decisioni architetturali e modifiche.

## 2026-04-05 — Decisioni Iniziali

| Decisione | Perché | Alternativa |
|-----------|--------|--------------|
| Backend in Docker separato | Indipendente deploy, multi-istanza SSH | Monorepo con frontend |
| Node.js + Express | ssh2 library, WS nativo, stack comune | Python/FastAPI |
| SSH per comunicare con Claude Code | Multi-istanza flessibile, qualsiasi server | API locale, tunnel |
| Nessun terminale visibile (GUI nativa) | UX mobile, leggibilita | xterm.js embedded |
| Parser ANSI lato backend | Ridurre payload, strutturare eventi prima del WS | Parsare lato frontend |
| Token auth semplice | LAN/VPN, setup minimo | OAuth, GitHub login |
| Next.js PWA | Add to home screen, offline-ready base | SPA React, Svelte |
