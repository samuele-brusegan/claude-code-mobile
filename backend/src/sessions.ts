import { ClaudeSession } from './session';
import { SessionConfig, SessionInfo } from './types';

/**
 * Gestisce multiple sessioni Claude Code simultanee.
 * Mappa sessionId → ClaudeSession.
 */
export class SessionManager {
  private sessions = new Map<string, ClaudeSession>();

  createSession(config: SessionConfig): ClaudeSession | null {
    const session = new ClaudeSession(config, {
      onEvent: (sessionId, event, data) => {
        // Events sono gestiti dal WS handler
        session.emit('event', { sessionId, event, data });
      },
    });

    this.sessions.set(session.id, session);

    // Avvia la sessione in background
    session.start().catch((err) => {
      console.error(`[session:${session.id}] Start error:`, err);
    });

    return session;
  }

  getSession(id: string): ClaudeSession | undefined {
    return this.sessions.get(id);
  }

  getSessionList(): SessionInfo[] {
    return Array.from(this.sessions.values()).map((s) => ({
      id: s.id,
      status: s.status,
      workingDirectory: (s as any).config.workingDirectory,
      createdAt: s.createdAt,
    }));
  }

  closeSession(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;

    session.close();
    this.sessions.delete(id);
    return true;
  }

  cleanup(): void {
    for (const session of this.sessions.values()) {
      session.close();
    }
    this.sessions.clear();
  }
}
