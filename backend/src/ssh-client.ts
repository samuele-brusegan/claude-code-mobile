import { Client, ConnectConfig, ClientChannel } from 'ssh2';
import { SshConfig } from './types';

/**
 * Gestisce una singola connessione SSH.
 */
export class SshClient {
  private client: Client;
  private connected = false;
  private stream: ClientChannel | null = null;

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
    }

    return new Promise((resolve, reject) => {
      this.client.on('ready', () => {
        this.connected = true;
        resolve();
      });
      this.client.on('error', (err) => reject(err));
      this.client.on('close', () => {
        this.connected = false;
      });
      this.client.connect(connectConfig);
    });
  }

  /**
   * Spawn claude in un PTY interattivo sul server remoto.
   */
  spawnPty(
    command: string,
    cwd: string,
    onData: (data: Buffer | string, isStderr?: boolean) => void,
    onExit?: (code: number) => void
  ): void {
    // Eseguiamo cd nella working directory poi il comando
    const fullCmd = `cd ${cwd} && ${command}`;

    this.client.shell(
      {
        term: 'xterm-256color',
        cols: 160,
        rows: 40,
      },
      (err, stream) => {
        if (err || !stream) {
          onData(Buffer.from(`SSH shell error: ${err?.message}\n`), true);
          return;
        }

        this.stream = stream;

        stream.on('data', (data) => onData(data, false));
        stream.on('stderr', (data) => onData(data, true));
        stream.on('close', (code) => {
          this.stream = null;
          onExit?.(code || 0);
        });

        // Invia il comando claude alla shell remota
        stream.write(`${fullCmd}\n`);
      }
    );
  }

  write(input: string): void {
    if (this.stream) {
      this.stream.write(input);
    }
  }

  /**
   * Esegue un comando one-shot senza PTY.
   */
  exec(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.client.exec(command, (err, stream) => {
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
    this.stream?.end();
    this.stream = null;
    this.client.end();
    this.connected = false;
  }
}
