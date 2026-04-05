export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  question?: QuestionPrompt;
}

export interface ToolCall {
  tool: string;
  description: string;
  text?: string;
}

export interface QuestionPrompt {
  type: 'radio' | 'checkbox' | 'text' | 'confirm' | 'chat_about_this';
  question: string;
  options?: string[];
  placeholder?: string;
}

export interface ServerEvent {
  event: string;
  data?: Record<string, unknown>;
}

export type SessionStatus = 'connecting' | 'running' | 'error' | 'closed';
