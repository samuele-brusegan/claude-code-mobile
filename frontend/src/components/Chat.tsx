'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ClaudeWebSocket } from '@/lib/websocket';
import { Message, ServerEvent, ToolCall, QuestionPrompt, SessionStatus } from '@/lib/types';
import { ToolCallView } from './ToolCallView';
import { QuestionPrompt as QuestionPromptComponent } from './QuestionPrompt';

export default function Chat() {
  const router = useRouter();
  const [ws, setWs] = useState<ClaudeWebSocket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<SessionStatus>('connecting');
  const [showConfig, setShowConfig] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionPrompt | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Config form state
  const [config, setConfig] = useState({
    host: '',
    port: '22',
    username: '',
    password: '',
    privateKey: '',
    workingDirectory: '.',
    model: '',
  });

  // Auth check on mount
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      router.push('/login');
      return;
    }

    const backendUrl = localStorage.getItem('backend_url') || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
    const wsClient = new ClaudeWebSocket(backendUrl, token);
    setWs(wsClient);

    wsClient.on('session_status', (data) => {
      setStatus(data.status as SessionStatus);
    });

    wsClient.on('session_created', (data) => {
      setSessionId(data.sessionId as string);
      setShowConfig(false);
    });

    wsClient.on('text_chunk', (data) => {
      const text = data.text as string;
      if (!text) return;

      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant' && !last.question) {
          // Append to last assistant message
          return [
            ...prev.slice(0, -1),
            { ...last, content: last.content + text },
          ];
        }
        return [
          ...prev,
          {
            id: Date.now().toString() + Math.random(),
            role: 'assistant',
            content: text,
            timestamp: Date.now(),
          },
        ];
      });
    });

    wsClient.on('tool_call', (data) => {
      const toolCall: ToolCall = {
        tool: (data.tool as string) || 'Unknown',
        description: (data.description as string) || '',
        text: data.text as string,
      };

      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant') {
          const tc = last.toolCalls || [];
          return [...prev.slice(0, -1), { ...last, toolCalls: [...tc, toolCall] }];
        }
        return [
          ...prev,
          {
            id: Date.now().toString() + Math.random(),
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
            toolCalls: [toolCall],
          },
        ];
      });
    });

    wsClient.on('question', (data) => {
      const question: QuestionPrompt = {
        type: (data.type as any) || 'text',
        question: (data.question as string) || '',
        options: data.options as string[] | undefined,
        placeholder: data.placeholder as string | undefined,
      };

      setCurrentQuestion(question);

      // Append question to messages
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant') {
          return [...prev.slice(0, -1), { ...last, question, content: last.content || question.question }];
        }
        return [
          ...prev,
          {
            id: Date.now().toString() + Math.random(),
            role: 'assistant',
            content: question.question,
            timestamp: Date.now(),
            question,
          },
        ];
      });
    });

    wsClient.on('error', (data) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + Math.random(),
          role: 'system',
          content: `Errore: ${data.message}`,
          timestamp: Date.now(),
        },
      ]);
    });

    wsClient.connect(
      () => {
        console.log('WS connected');
      },
      () => {
        console.log('WS disconnected');
      }
    );

    return () => {
      wsClient.close();
    };
  }, [router]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSendPrompt = useCallback(() => {
    if (!input.trim() || !ws) return;
    const userMsg = input.trim();
    setInput('');

    // Add user message
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString() + Math.random(),
        role: 'user',
        content: userMsg,
        timestamp: Date.now(),
      },
    ]);

    ws.sendPrompt(userMsg);
  }, [input, ws]);

  const handleAnswer = useCallback(
    (answer: string) => {
      if (!ws) return;
      setCurrentQuestion(null);
      setInput('');

      ws.sendAnswer(answer);

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + Math.random(),
          role: 'user',
          content: answer,
          timestamp: Date.now(),
        },
      ]);
    },
    [ws]
  );

  const handleConfigSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!ws) return;
      setShowConfig(false);
      ws.createSession({
        host: config.host,
        port: parseInt(config.port) || 22,
        username: config.username,
        password: config.password || undefined,
        privateKey: config.privateKey || undefined,
        workingDirectory: config.workingDirectory || '.',
        model: config.model || undefined,
      });
    },
    [ws, config]
  );

  const handleCancel = useCallback(() => {
    ws?.sendCancel();
  }, [ws]);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (currentQuestion) return; // Question has its own handler
        handleSendPrompt();
      }
    },
    [currentQuestion, handleSendPrompt]
  );

  const isReady = status === 'running' && ws?.isConnected();

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            Claude Code
          </h1>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={
              isReady
                ? { background: 'rgba(52,211,153,0.15)', color: 'var(--success)' }
                : status === 'error'
                ? { background: 'rgba(248,113,113,0.15)', color: 'var(--error)' }
                : { background: 'var(--bg-elevated)', color: 'var(--text-muted)' }
            }
          >
            {isReady ? 'Online' : status === 'error' ? 'Error' : 'Connecting...'}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCancel}
            className="text-xs px-3 py-1 rounded-lg transition"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
            title="Cancel current operation (Ctrl+C)"
          >
            Stop
          </button>
          <button
            onClick={() => {
              ws?.close();
              localStorage.removeItem('auth_token');
              router.push('/login');
            }}
            className="text-xs px-3 py-1 rounded-lg transition"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {showConfig ? (
          <form
            onSubmit={handleConfigSubmit}
            className="rounded-xl p-6 space-y-4"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            <h2 className="text-lg font-medium" style={{ color: 'var(--text)' }}>
              Configura connessione SSH
            </h2>

            <input
              placeholder="Host (es. 192.168.1.100)"
              value={config.host}
              onChange={(e) => setConfig({ ...config, host: e.target.value })}
              className="w-full rounded-xl px-4 py-3 outline-none"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
            <div className="flex gap-2">
              <input
                placeholder="Porta (22)"
                value={config.port}
                onChange={(e) => setConfig({ ...config, port: e.target.value })}
                className="flex-1 rounded-xl px-4 py-3 outline-none"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text)' }}
              />
              <input
                placeholder="Utente"
                value={config.username}
                onChange={(e) => setConfig({ ...config, username: e.target.value })}
                className="flex-1 rounded-xl px-4 py-3 outline-none"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text)' }}
              />
            </div>
            <textarea
              placeholder="Password (opzionale, se non usi chiave)"
              value={config.password}
              onChange={(e) => setConfig({ ...config, password: e.target.value })}
              className="w-full rounded-xl px-4 py-3 outline-none resize-none"
              rows={2}
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
            <details>
              <summary
                className="text-sm cursor-pointer"
                style={{ color: 'var(--text-muted)' }}
              >
                SSH Private Key (opzionale)
              </summary>
              <textarea
                placeholder="Incolla qui la chiave privata..."
                value={config.privateKey}
                onChange={(e) => setConfig({ ...config, privateKey: e.target.value })}
                className="w-full rounded-xl px-4 py-3 mt-2 outline-none resize-none font-mono text-sm"
                rows={4}
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text)' }}
              />
            </details>
            <input
              placeholder="Working directory (es. /home/user/project)"
              value={config.workingDirectory}
              onChange={(e) => setConfig({ ...config, workingDirectory: e.target.value })}
              className="w-full rounded-xl px-4 py-3 outline-none"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
            <input
              placeholder="Modello (es. qwen/qwen3.6-plus:free, vuoto = default)"
              value={config.model}
              onChange={(e) => setConfig({ ...config, model: e.target.value })}
              className="w-full rounded-xl px-4 py-3 outline-none font-mono text-sm"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />

            <button
              onClick={handleConfigSubmit}
              disabled={!config.host || !config.username}
              className="w-full rounded-xl py-3 font-medium transition disabled:opacity-50"
              style={{
                background: config.host && config.username ? 'var(--accent)' : 'var(--bg-elevated)',
                color: config.host && config.username ? '#fff' : 'var(--text-muted)',
              }}
            >
              Avvia sessione Claude Code
            </button>
          </form>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : msg.role === 'system' ? 'justify-center' : 'justify-start'}`}
            >
              {msg.role === 'user' ? (
                <div
                  className="max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
                  style={{ background: 'var(--user-bubble)', color: 'var(--text)' }}
                >
                  {msg.content}
                </div>
              ) : msg.role === 'system' ? (
                <div
                  className="text-xs px-3 py-2 rounded-lg"
                  style={{ background: 'rgba(248,113,113,0.1)', color: 'var(--error)' }}
                >
                  {msg.content}
                </div>
              ) : (
                <div className="max-w-[95%] w-full space-y-2">
                  {/* Text content */}
                  {msg.content && (
                    <div
                      className="rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap"
                      style={{ background: 'var(--claude-bubble)', color: 'var(--text)' }}
                    >
                      {msg.content}
                    </div>
                  )}

                  {/* Tool calls */}
                  {msg.toolCalls?.length ? (
                    <div className="space-y-1">
                      {msg.toolCalls.map((tc, i) => (
                        <ToolCallView key={i} toolCall={tc} />
                      ))}
                    </div>
                  ) : null}

                  {/* Question prompt */}
                  {msg.question && (
                    <QuestionPromptComponent
                      question={msg.question}
                      onAnswer={handleAnswer}
                    />
                  )}
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      {(!showConfig) && (
        <div
          className="px-4 py-3 border-t"
          style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
        >
          {currentQuestion ? (
            <div
              className="text-xs text-center mb-2"
              style={{ color: 'var(--text-muted)' }}
            >
              Claude sta aspettando una risposta...
            </div>
          ) : null}

          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={currentQuestion ? 'Rispondi qui...' : 'Scrivi un messaggio...'}
              rows={1}
              className="flex-1 rounded-xl px-4 py-3 outline-none resize-none text-sm"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
              }}
            />
            <button
              onClick={currentQuestion ? undefined : handleSendPrompt}
              disabled={!input.trim() || !isReady}
              className="rounded-xl px-4 py-3 text-sm font-medium transition disabled:opacity-50"
              style={{
                background: input.trim() && isReady ? 'var(--accent)' : 'var(--bg-elevated)',
                color: input.trim() && isReady ? '#fff' : 'var(--text-muted)',
              }}
            >
              Invia
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
