// Config per connessione SSH
export interface SshConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
}

// Config per sessione Claude Code
export interface SessionConfig {
  ssh: SshConfig;
  workingDirectory: string;
}

// Stato di una sessione
export type SessionStatus = 'connecting' | 'running' | 'error' | 'closed';

// Info sessione (pubblica)
export interface SessionInfo {
  id: string;
  status: SessionStatus;
  workingDirectory: string;
  createdAt: number;
}

// Types per gli eventi che il backend manda al frontend via WS

// Un chunk di testo dall'output di Claude
export interface TextChunk {
  type: 'text';
  data: string;
}

// Una tool call rilevata dall'output
export interface ToolCall {
  type: 'tool_call';
  tool: 'Read' | 'Write' | 'Edit' | 'Bash' | 'NotebookEdit' | 'Glob' | 'Grep' | 'Agent' | 'Skill' | 'AskUserQuestion' | 'Edit';
  input?: Record<string, unknown>;
  output?: string;
  status: 'running' | 'completed' | 'error';
  id?: string;
}

// Una domanda interattiva da Claude (multi-choice, y/n, text input)
export interface QuestionPrompt {
  type: 'question';
  questionType: 'radio' | 'checkbox' | 'text' | 'confirm' | 'chat_about_this';
  question: string;
  options?: string[];
  placeholder?: string;
}

// Un messaggio completo (aggregazione di chunk e tool call)
export interface AssistantMessage {
  type: 'assistant_message';
  content: Array<TextChunk | ToolCall>;
  question?: QuestionPrompt;
}

// Messaggio inviato dal frontend al backend
export interface ClientMessage {
  type: 'prompt' | 'answer' | 'cancel';
  payload?: string;
}

// Evento WS (server → client)
export interface ServerEvent {
  event: 'text_chunk' | 'tool_call' | 'question' | 'session_status' | 'error' | 'ready' | 'message_end';
  data?: Record<string, unknown>;
}
