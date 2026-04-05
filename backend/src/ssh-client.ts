import { Client, ConnectConfig, ShellOptions } from 'ssh2';
import { SshConfig } from './types';

/**
 * Gestisce una singola connessione SSH.
 * Espone il client raw per permettere lo spawn di PTY.
 */
export class SshClient {
  private client: Client;
  private connected = false;

  constructor() {
    this.client = new Client();
  }

  async connect(config: SshConfig): Promise<void> {
    const connectConfig: ConnectConfig = {
      host: config.host,
      port: config.port,
      username: config.username,
      readyTimeout: 30000,
    };

    if (config.password) {
      connectConfig.password = config.password;
    }

    if (config.privateKey) {
      connectConfig.privateKey = config.privateKey;
      // Se c'e passphrase, andrebbe gestita — per ora non supportata
    }

    return new Promise((resolve, reject) => {
      this.client.on('ready', () => {
        this.connected = true;
        resolve();
      });
      this.client.on('error', (err) => {
        reject(err);
      });
      this.client.on('close', () => {
        this.connected = false;
      });
      this.client.connect(connectConfig);
    });
  }

  /**
   * Spawn un processo in un PTY remoto.
   * Claude Code richiede un terminale interattivo.
   */
  spawnPty(
    command: string,
    cwd: string,
    onData: (data: Buffer | string, isStderr?: boolean) => void,
    onExit: (code: number) => void
  ): { write: (data: string) => void; resize: (rows: number, cols: number) => void } {
    const options: ShellOptions = {
      pty: {
        term: 'xterm-256color',
        cols: 160,
        rows: 40,
      },
      env: {
        // Env essenziali per Claude Code
        TERM: 'xterm-256color',
        CLAUDE_CODE_SHELL: 'echo', // Evita che Claude apra la vera shell
      },
    };

    return this.client.exec(`${command}`, { pty: true, cwd }, (err, stream) => {
      if (err) {
        onData(Buffer.from(`SSH exec error: ${err.message}\n`), true);
        return;
      }

      stream.on('data', (data) => onData(data, false));
      stream.on('stderr', (data) => onData(data, true));
      stream.on('close', (code) => onExit(code || 0));
    });
  }

  /**
   * Esegue un comando senza PTY (per check preliminari).
   */
  exec(command: string, cwd?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const options: { cwd?: string } = {};
      if (cwd) options.cwd = cwd;

      this.client.exec(command, options, (err, stream) => {
        if (err) return reject(err);

        let output = '';
        stream.on('data', (data) => (output += data.toString()));
        stream.on('stderr', (data) => (output += data.toString()));
        stream.on('close', (code) => {
          if (code === 0) resolve(output);
          else reject(new Error(`Command exited with code ${code}: ${output}`));
        });
      });
    });
  }

  isConnected(): boolean {
    return this.connected;
  }

  close(): void {
    this.client.end();
    this.connected = false;
  }
}
