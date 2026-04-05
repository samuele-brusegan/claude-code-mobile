import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { SshClient } from './ssh-client';
import { SessionConfig, SessionStatus, ClientMessage } from './types';
import { cleanOutput, detectQuestion, detectToolCall } from './parser';

interface WsCallbacks {
  onEvent: (sessionId: string, event: string, data: Record<string, unknown>) => void;
}

/**
 * Gestisce una singola sessione Claude Code remota.
 * Lifecycle: SSH connect → spawn claude shell → stream output → forward input.
 */
export class ClaudeSession extends EventEmitter {
  public readonly id: string;
  public status: SessionStatus = 'connecting';
  public readonly createdAt = Date.now();

  private ssh: SshClient;
  private config: SessionConfig;
  private wsCallbacks: WsCallbacks;
  private outputBuffer = '';
  private pendingText = '';

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
        await this.ssh.exec('which claude');
      } catch {
        console.warn(`[session:${this.id}] 'which claude' non trovato nel PATH remoto`);
      }

      this.emitStatus('running');
      this.spawnClaude();
    } catch (err: any) {
      this.status = 'error';
      this.wsCallbacks.onEvent(this.id, 'error', { message: err.message });
      this.emitStatus('error');
    }
  }

  private spawnClaude(): void {
    const cwd = this.config.workingDirectory || '.';

    this.ssh.spawnPty(
      'claude',
      cwd,
      (data: Buffer | string) => {
        const text = typeof data === 'string' ? data : data.toString();
        this.outputBuffer += text;
        this.flushOutput();
      },
      (code: number) => {
        this.status = 'closed';
        this.wsCallbacks.onEvent(this.id, 'session_status', { status: 'closed' });
      }
    );
  }

  /**
   * Processa l'output accumulato ed emette eventi strutturati.
   * Invia il testo "pulito" al client e cerca tool call/domande.
   */
  private flushOutput(): void {
    const trimmed = this.outputBuffer.trim();
    if (!trimmed || trimmed === this.pendingText) return;

    this.pendingText = trimmed;
    const cleaned = cleanOutput(trimmed);

    // Tool call
    const toolCall = detectToolCall(cleaned);
    if (toolCall) {
      this.wsCallbacks.onEvent(this.id, 'tool_call', {
        tool: toolCall.tool,
        description: toolCall.description,
        text: cleaned,
      });
      return;
    }

    // Domanda
    const lines = cleaned.split('\n');
    const tail = lines.slice(-8).join('\n');
    const question = detectQuestion(tail);
    if (question) {
      this.wsCallbacks.onEvent(this.id, 'question', question);
      return;
    }

    // Testo normale — inviamo solo il delta dall'ultimo flush
    this.wsCallbacks.onEvent(this.id, 'text_chunk', { text: cleaned });
  }

  /** Invia input al processo claude remoto */
  writeInput(text: string): void {
    this.ssh.write(text + '\n');
  }

  handleClientMessage(message: ClientMessage): void {
    switch (message.type) {
      case 'prompt':
        if (message.payload) this.writeInput(message.payload);
        break;
      case 'answer':
        if (message.payload) this.writeInput(message.payload);
        break;
      case 'cancel':
        this.ssh.write('\x03'); // Ctrl+C
        break;
    }
  }

  close(): void {
    this.status = 'closed';
    this.writeInput('/quit');
    setTimeout(() => this.ssh.close(), 2000);
  }

  private emitStatus(status: SessionStatus): void {
    this.status = status;
    this.wsCallbacks.onEvent(this.id, 'session_status', { status });
  }
}
