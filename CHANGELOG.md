# Changelog

## [Unreleased]

### Added
- Backend Node.js con Express, WebSocket, SSH multi-istanza
- Parser output Claude Code (tool call, domande)
- Frontend Next.js PWA con UI tipo chat
- Login con token auth
- Sessione SSH configurabile da UI (host, porta, utente, password/key, working directory)
- Componenti: ToolCallView, QuestionPrompt
- Dockerfile backend + docker-compose.yml
- README, DECISION_LOG, documentazione

### Fixed
- ssh-client.ts: usa shell() invece di exec() per PTY interattivo corretto
- parser.ts: cleanOutput mantiene emoji per tool call detection
- session.ts: semplificato, rimosso stream management manuale
- Componenti: aggiunti export mancanti su ToolCallView e QuestionPrompt
- Chat: form submit corretto con preventDefault
