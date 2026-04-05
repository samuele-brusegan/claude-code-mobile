import { ServerEvent } from './types';

type EventHandler = (data: Record<string, unknown>) => void;

/**
 * Client WebSocket per comunicare con il backend.
 * Gestisce reconnect, auth e invio/ricezione messaggi.
 */
export class ClaudeWebSocket {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<EventHandler>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private sessionId: string | null = null;

  constructor(
    private url: string,
    private token: string
  ) {}

  connect(onOpen?: () => void, onClose?: (reason?: string) => void): void {
    const wsUrl = this.url.replace(/^http/, 'ws') + '/ws?token=' + encodeURIComponent(this.token);
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      if (onOpen) onOpen();
    };

    this.ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as ServerEvent;
        this.emit(event.event, event.data || {});
      } catch {
        // Ignora messaggi non parsabili
      }
    };

    this.ws.onclose = (e) => {
      if (onClose) onClose(e.reason);
      this.scheduleReconnect(onOpen, onClose);
    };

    this.ws.onerror = () => {
      // Gestito da onclose
    };
  }

  private scheduleReconnect(onOpen?: () => void, onClose?: (reason?: string) => void): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect(onOpen, onClose);
    }, 3000);
  }

  /**
   * Crea una nuova sessione Claude su server remoto.
   */
  createSession(config: {
    host: string;
    port?: number;
    username: string;
    password?: string;
    privateKey?: string;
    workingDirectory?: string;
  }): void {
    this.send('create', config);
  }

  /**
   * Si connette a una sessione esistente.
   */
  joinSession(sessionId: string): void {
    this.sessionId = sessionId;
    this.send('join', sessionId);
  }

  /**
   * Invia un prompt a Claude.
   */
  sendPrompt(text: string): void {
    this.send('prompt', text);
  }

  /**
   * Risponde a una domanda.
   */
  sendAnswer(text: string): void {
    this.send('answer', text);
  }

  /**
   * Interrompe l'operazione corrente (Ctrl+C).
   */
  sendCancel(): void {
    this.send('cancel', '');
  }

  /**
   * Registra un handler per un evento.
   */
  on(event: string, handler: EventHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  off(event: string, handler: EventHandler): void {
    this.handlers.get(event)?.delete(handler);
  }

  private emit(event: string, data: Record<string, unknown>): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        handler(data);
      }
    }
  }

  private send(type: string, payload: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }

  close(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
