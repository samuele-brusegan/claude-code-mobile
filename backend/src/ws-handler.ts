import { WebSocketServer, WebSocket } from 'ws';
import { SessionManager } from './sessions';
import { ClientMessage } from './types';

/**
 * Collega il WebSocket server al SessionManager.
 * Ogni connessione WS viene associata a una sessione Claude.
 */
export function setupWsHandler(
  wss: WebSocketServer,
  sessionManager: SessionManager,
  authToken: string
): void {
  wss.on('connection', (ws, req) => {
    console.log('[ws] New connection', req.url);

    // Auth via query parameter
    const url = req.url || '';
    const urlToken = new URLSearchParams(url.split('?')[1] || '').get('token');

    if (!urlToken || urlToken !== authToken) {
      ws.send(JSON.stringify({ event: 'error', data: { message: 'Unauthorized' } }));
      ws.close(4001, 'Unauthorized');
      return;
    }

    let currentSessionId: string | null = null;

    // Quando il client richiede una sessione via WS
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          type: string;
          payload?: Record<string, unknown> | string;
        };

        switch (msg.type) {
          case 'join': {
            // Il client si connette a una sessione esistente
            const sessionId = msg.payload as string;
            if (typeof sessionId === 'string') {
              currentSessionId = sessionId;
              subscribeSession(ws, sessionId, sessionManager);
            }
            break;
          }

          case 'create': {
            // Crea nuova sessione
            const config = msg.payload as Record<string, any>;
            if (config) {
              const session = sessionManager.createSession({
                ssh: {
                  host: config.host,
                  port: config.port || 22,
                  username: config.username,
                  password: config.password,
                  privateKey: config.privateKey,
                },
                workingDirectory: config.workingDirectory || '.',
                model: config.model || undefined,
              });

              if (session) {
                currentSessionId = session.id;
                subscribeSession(ws, session.id, sessionManager);
                ws.send(JSON.stringify({ event: 'session_created', data: { sessionId: session.id } }));
              }
            }
            break;
          }

          case 'prompt':
          case 'answer':
          case 'cancel': {
            if (!currentSessionId) {
              ws.send(JSON.stringify({ event: 'error', data: { message: 'No active session' } }));
              return;
            }
            const session = sessionManager.getSession(currentSessionId);
            if (session) {
              session.handleClientMessage(msg as ClientMessage);
            }
            break;
          }
        }
      } catch (err: any) {
        console.error('[ws] Parse error:', err.message);
        ws.send(JSON.stringify({ event: 'error', data: { message: 'Invalid message' } }));
      }
    });

    ws.on('close', () => {
      console.log('[ws] Connection closed');
    });
  });
}

/**
 * Iscrive un WebSocket agli eventi di una sessione.
 */
function subscribeSession(
  ws: WebSocket,
  sessionId: string,
  sessionManager: SessionManager
): void {
  const session = sessionManager.getSession(sessionId);
  if (!session) return;

  const handler = (data: { sessionId: string; event: string; data: Record<string, unknown> }) => {
    if (data.sessionId === sessionId) {
      ws.send(JSON.stringify({ event: data.event, data: data.data }));
    }
  };

  // Iscrive il listener
  session.on('event', handler);

  // Alla chiusura del WS, rimuove il listener
  ws.on('close', () => {
    session.off('event', handler);
  });
}
