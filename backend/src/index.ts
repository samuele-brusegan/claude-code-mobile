import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import { authMiddleware } from './auth';
import { setupWsHandler } from './ws-handler';
import { SessionManager } from './sessions';

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = parseInt(process.env.PORT || '4000', 10);
const AUTH_TOKEN = process.env.AUTH_TOKEN;

if (!AUTH_TOKEN) {
  console.error('ERROR: AUTH_TOKEN not set in environment');
  process.exit(1);
}

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const sessionManager = new SessionManager();

// HTTP auth endpoint — valida il token e restituisce le sessioni attive
app.get('/api/auth', authMiddleware(AUTH_TOKEN), (_req, res) => {
  res.json({ sessions: sessionManager.getSessionList() });
});

// Inizializza sessione: lancia Claude su server remoto via SSH
app.post('/api/sessions', authMiddleware(AUTH_TOKEN), (req, res) => {
  const { host, port, username, password, privateKey, workingDirectory } = req.body;

  if (!host || !username) {
    res.status(400).json({ error: 'host and username are required' });
    return;
  }

  const session = sessionManager.createSession({
    ssh: { host, port: port || 22, username, password, privateKey },
    workingDirectory: workingDirectory || '.',
  });

  if (!session) {
    res.status(500).json({ error: 'Failed to create session' });
    return;
  }

  res.json({ sessionId: session.id, status: 'connecting' });
});

// Lista sessioni
app.get('/api/sessions', authMiddleware(AUTH_TOKEN), (_req, res) => {
  res.json({ sessions: sessionManager.getSessionList() });
});

// Chiudi sessione
app.delete('/api/sessions/:sessionId', authMiddleware(AUTH_TOKEN), (req, res) => {
  const sessionId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
  sessionManager.closeSession(sessionId);
  res.json({ status: 'closed', sessionId });
});

// WebSocket setup
const wss = new WebSocketServer({ server, path: '/ws' });
setupWsHandler(wss, sessionManager, AUTH_TOKEN);

server.listen(PORT, () => {
  console.log(`[backend] listening on :${PORT}`);
});
