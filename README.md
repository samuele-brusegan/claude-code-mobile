# Claude Code Mobile

Webapp/PWA per interagire con **Claude Code** da dispositivo mobile. Interfaccia tipo chat con supporto per tool call, domande interattive e sessione multi-istanza via SSH.

## Architettura

```
┌─────────────────┐     WebSocket/HTTPS     ┌──────────────────┐      SSH       ┌───────────────────┐
│   Mobile/PWA    │ ◄─────────────────────► │  Backend Node.js  │ ◄────────────► │  Claude Code CLI  │
│   (Next.js)     │                         │  (Express + WS)   │                │  (server remoto)  │
└─────────────────┘                         └──────────────────┘                └───────────────────┘
```

- **Frontend**: Next.js PWA con TailwindCSS — UI pulita tipo chat
- **Backend**: Node.js + Express + WebSocket — gestisce sessioni SSH multiple
- **Comunicazione**: Ogni sessione spawn `claude` via SSH su un server remoto
- **Auth**: Token semplice per proteggere l'accesso

## Requisiti

- **Server remoto**: Macchina con Claude Code installato e SSH abilitato
- **Locale**: Node.js >= 20, npm >= 10
- **Docker** (opzionale, per deploy production)

## Setup Locale (Dev)

### 1. Clonare il repo

```bash
git clone https://github.com/samuele-brusegan/claude-code-mobile.git
cd claude-code-mobile
```

### 2. Installare dipendenze

```bash
npm install
```

### 3. Configurare il backend

```bash
cp backend/.env.example backend/.env
```

Ora modifica `backend/.env` e imposta l'`AUTH_TOKEN`:

```bash
AUTH_TOKEN=una-stringa-a-scelta
PORT=4000
```

**Cos'e l'`AUTH_TOKEN`?** — E una password che scegli tu. Puo essere qualsiasi stringa (es. `mia-password-segreta`). Serve a proteggere l'accesso alla webapp: solo chi conosce il token puo inviare prompt a Claude Code. In ambiente production usa una stringa lunga e casuale (es. `openssl rand -hex 32`).

### 4. Avviare in modalità dev

```bash
# Backend (porta 4000)
cd backend && npm run dev &

# Frontend (porta 3000)
cd frontend && npm run dev &
```

Oppure usa il comando root:

```bash
npm run dev
```

### 5. Aprire il browser

Vai su `http://localhost:3000`, inserisci il token auth e configura la connessione SSH al tuo server Claude Code.

## Deploy Production

### Docker

```bash
# Modifica docker-compose.yml e sostituisci AUTH_TOKEN con la tua password
# environment:
#   - AUTH_TOKEN=la-tua-password-qui

# Build e avvio
docker compose up -d --build
```

### Docker Compose

Il file `docker-compose.yml` include:
- Backend con configurazione tramite `.env`

### Configurazione SSH

Ogni sessione viene avviata configurando:
- **Host**: indirizzo del server remoto
- **Port**: porta SSH (default 22)
- **Utente**: username SSH
- **Autenticazione**: chiave privata o password
- **Working directory**: directory dove Claude Code lavorerà

## Struttura Progetto

```
claude-code-mobile/
├── frontend/           # Next.js PWA
│   ├── src/
│   │   ├── app/        # App Router (route page)
│   │   ├── components/ # Componenti React
│   │   └── lib/        # Utility e types
│   └── public/         # Manifest e icone PWA
├── backend/            # Express server
│   ├── src/
│   │   ├── index.ts         # Entry point
│   │   ├── auth.ts          # Auth middleware
│   │   ├── ssh-client.ts    # Connessione SSH
│   │   ├── session.ts       # Single session handler
│   │   ├── sessions.ts      # Session manager
│   │   ├── parser.ts        # ANSI output parser
│   │   └── ws-handler.ts    # WebSocket handler
│   └── Dockerfile
└── docker-compose.yml
```

## Troubleshooting

### Claude non si connette via SSH
- Verifica che il server remoto abbia SSH abilitato e accessibile
- Assicurati che l'utente SSH abbia permessi per eseguire `claude`
- Se usi chiave privata, verifica i permessi (600)

### Sessione non parte
- Il server remoto deve avere `claude` installato e nel PATH
- La working directory deve esistere ed essere scrivibile
- Controlla i log del backend per errori SSH

### Output non viene parsato correttamente
- L'output di Claude Code varia nel tempo — il parser è best-effort
- Se noti pattern non riconosciuti, apri una issue

## License

MIT
