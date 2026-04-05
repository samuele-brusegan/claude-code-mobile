import { EventEmitter } from 'events';

/**
 * Emette eventi stdout/stderr del processo claude remoto.
 * Aggrega i chunk del buffer in stringhe leggibili e parsate.
 */
export class ClaudeDataStream extends EventEmitter {
  private buffer = '';
  private lastEmit = Date.now();

  /**
   * Accumula dati in arrivo. Emit chunk parsato ogni X ms
   * o quando viene rilevato qualcosa di utile.
   */
  push(data: string): void {
    this.buffer += data;
    this.emit('data', data);
  }

  getBuffer(): string {
    return this.buffer;
  }

  /**
   * Pulisce il buffer e ritorna il testo pulito.
   * Utile per domande (l'ultima porzione e quella rilevante).
   */
  getCleanedBuffer(): string {
    return this.buffer.trim();
  }

  /**
   * Reset del buffer (usato dopo inviare risposta a domanda, ecc).
   */
  reset(): void {
    this.buffer = '';
  }

  end(): void {
    this.emit('end');
    this.removeAllListeners();
  }
}
