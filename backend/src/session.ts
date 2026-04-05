import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { SshClient } from './ssh-client';
import { SessionConfig, SessionStatus, ClientMessage } from './types';
import { stripAnsi, cleanOutput, detectQuestion, detectToolCall } from './parser';

interface WsCallbacks {
  onEvent: (sessionId: string, event: string, data: Record<string, unknown>) => void;
}

/**
 * Gestisce una singola sessione Claude Code remota.
 * Gestisce il lifecycle SSH → spawn claude → read output → send input.
 */
export class ClaudeSession extends EventEmitter {
  public readonly id: string;
  public status: SessionStatus = 'connecting';

  private ssh: SshClient;
  private config: SessionConfig;
  private wsCallbacks: WsCallbacks;
  private stream: any = null; // SSH stream (non typed dalla lib ssh2)
  private outputBuffer = '';
  private lastChunkTime = 0;

  /**
   * Flag per capire se siamo in fase di attesa input da parte dell'utente.
   * Claude Code mette il processo in pausa quando attende.
   */
  private awaitingInput = false;

  constructor(config: SessionConfig, callbacks: WsCallbacks) {
    super();
    this.id = uuidv4();
    this.config = config;
    this.wsCallbacks = callbacks;
    this.ssh = new SshClient();
  }

  async start(): Promise<void> {
    try {
      await this.ssh.connect(this.config.ssh);
      this.emitStatus('connecting');

      // Verifica che claude esista sul server remoto
      try {
        await this.ssh.exec('which claude', this.config.workingDirectory);
      } catch {
        // Claude potrebbe non essere nel PATH — proviamo comunque
        console.warn(`[session:${this.id}] 'which claude' non trovato, provo lo spawn lo stesso`);
      }

      this.emitStatus('running');
      this.spawnClaude();
    } catch (err: any) {
      this.status = 'error';
      this.wsCallbacks.onEvent(this.id, 'error', { message: err.message });
      this.emitStatus('error');
    }
  }

  /** Spawn claude in un PTY remoto */
  private spawnClaude(): void {
    const cwd = this.config.workingDirectory || '.';
    let pendingInput: string | null = null;

    this.stream = this.ssh.spawnPty(
      'claude',
      cwd,
      (data: Buffer | string, isStderr?: boolean) => {
        const text = typeof data === 'string' ? data : data.toString();

        this.outputBuffer += text;
        this.lastChunkTime = Date.now();

        // Controlla subito se c'e una domanda
        const events = processRecentOutput(this.outputBuffer);
        this.outputBuffer = events.cleaned;

        for (const event of events.list) {
          this.wsCallbacks.onEvent(this.id, event.type, event.data);
        }
      },
      (code: number) => {
        this.status = 'closed';
        this.wsCallbacks.onEvent(this.id, 'session_status', { status: 'closed' });
      }
    );

    // Se c'e pending input (es. comando iniziale), lo scriviamo
    if (pendingInput) {
      this.writeInput(pendingInput);
    }
  }

  /** Invia input al processo claude remoto */
  writeInput(text: string): void {
    if (this.stream && typeof this.stream.write === 'function') {
      this.stream.write(text + '\n');
    }
  }

  /** Gestisce un messaggio dal client (WS) */
  handleClientMessage(message: ClientMessage): void {
    switch (message.type) {
      case 'prompt':
        if (message.payload) {
          this.writeInput(message.payload);
        }
        break;

      case 'answer':
        // Rispondi a una domanda — stesso di prompt ma semanticamente diverso
        if (message.payload) {
          this.writeInput(message.payload);
        }
        break;

      case 'cancel':
        // Ctrl+C equivalente — interrompe l'operazione corrente
        if (this.stream && typeof this.stream.write === 'function') {
          this.stream.write('\x03'); // Ctrl+C
        }
        break;
    }
  }

  close(): void {
    this.status = 'closing';
    this.writeInput('EXIT');

    // Grace: poi force
    setTimeout(() => {
      this.ssh.close();
      this.status = 'closed';
    }, 2000);
  }

  private emitStatus(status: SessionStatus): void {
    this.status = status;
    this.wsCallbacks.onEvent(this.id, 'session_status', { status });
  }
}

// --- Helper di parsing inline per evitare circular deps ---

function processRecentOutput(buffer: string): { cleaned: string; list: Array<{ type: string; data: Record<string, unknown> }> } {
  // Tieniamo le ultime ~2000 righe del buffer per evitare memory leak
  const maxBuffer = 50000;
  if (buffer.length > maxBuffer) {
    buffer = buffer.slice(-maxBuffer);
  }

  const cleaned = cleanOutput(buffer);
  const list: Array<{ type: string; data: Record<string, unknown> }> = [];

  if (!cleaned) return { cleaned: '', list };

  // Tool call
  const toolCall = detectToolCall(cleaned);
  if (toolCall) {
    list.push({
      type: 'tool_call',
      data: {
        tool: toolCall.tool,
        description: toolCall.description,
        text: cleaned,
      },
    });
  }

  // Domande — check solo le ultime righe
  const lines = cleaned.split('\n');
  const tail = lines.slice(-6).join('\n');
  const question = detectQuestion(tail);
  if (question) {
    list.push({
      type: 'question',
      data: question,
    });
  }

  // Emit testo — inviamo chunk al client
  if (cleaned.length > 0 && (toolCall || question) === null) {
    // Solo se non abbiamo gia emesso un tool_call o question
    if (list.length === 0) {
      list.push({
        type: 'text_chunk',
        data: { text: cleaned },
      });
    }
  }

  // Se abbiamo emesso qualcosa, il buffer viene mantenuto (accumulativo)
  // Se no, il buffer va mantenuto per il prossimo check
  return { cleaned: buffer, list };
}
