/**
 * Parser per l'output di Claude Code.
 *
 * Claude Code produce output ANSI-wrapped in un terminale. Questo parser:
 * 1. Strappa gli escape codes ANSI
 * 2. Riconosce pattern di tool call, domande, messaggi di sistema
 * 3. Rileva quando Claude sta chiedendo input all'utente
 *
 * Nota: il parsing e best-effort — l'output di Claude Code non ha un formato
 * machine-readable stabile e puo cambiare tra versioni.
 */

const ANSI_REGEX = /\x1b\[[0-9;]*[a-zA-Z]|\x1b\](?:[0-9]+;)?[^\x07]*\x07|\x1b\^[^\x07]*\x07/g;

/** Strappa tutti gli ANSI escape codes da una stringa */
export function stripAnsi(text: string): string {
  return text.replace(ANSI_REGEX, '');
}

/** Rimuove i caratteri non stampabili (mantienenndo newlines e tab) */
export function cleanOutput(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/[^\x20-\x7E\n\t]/g, '')
    .trim();
}

/**
 * Riconosce il tipo di prompt interattivo che Claude Code sta mostrando.
 * Returns null se non viene riconosciuta una domanda.
 */
export function detectQuestion(text: string): {
  type: 'radio' | 'checkbox' | 'text' | 'confirm' | 'chat_about_this';
  question: string;
  options?: string[];
  placeholder?: string;
} | null {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const lastLines = lines.slice(-8); // Ultime righe — dove appare il prompt

  const fullText = lastLines.join('\n');

  // Pattern: Yes/No domande
  if (/\[y\/n\]|\(y\/n\)/i.test(fullText)) {
    return {
      type: 'confirm',
      question: lastLines.slice(-3, -1).join(' ') || 'Confermi?',
    };
  }

  // Pattern: multi-choice numerico [1], [2], [3]... [a], [b], [c]
  const multiMatch = fullText.match(/(\[[\da-f]\].*\n?)+/i);
  if (multiMatch) {
    const optionLines = lastLines.filter((l) => /^\[[\da-f]\]\s/i.test(l) || /^\[\d+\]\s/.test(l));
    if (optionLines.length > 0) {
      return {
        type: 'radio',
        question: lastLines.find((l) => l && !/^\[/.test(l)) || 'Seleziona un\'opzione',
        options: optionLines.map((l) => l.replace(/^\[[\da-f]+\]\s*/i, '')),
      };
    }
  }

  // Pattern: checkbox (selezione multipla)
  if (/checkbox/i.test(fullText) || /select all that apply/i.test(fullText)) {
    return {
      type: 'checkbox',
      question: lastLines.slice(-4, -1).join(' ') || 'Seleziona opzioni',
    };
  }

  // Pattern: "Chat About This" — Claude Code offre di chattare sul risultato
  if (/chat about this/i.test(fullText)) {
    return {
      type: 'chat_about_this',
      question: 'Vuoi approfondire il risultato?',
    };
  }

  // Pattern: text input — quando Claude chiede un input libero
  // Si riconosce dal cursore vuoto senza opzioni: riga con solo prompt
  if (/\n\s*▏$/.test(text) || /\n\s*>\s*$/.test(text)) {
    return {
      type: 'text',
      question: 'Input',
      placeholder: 'Scrivi la tua risposta...',
    };
  }

  return null;
}

/**
 * Tenta di rilevare tool calls dall'output di Claude Code.
 * Claude mostra i tool call come blocchi formattati tipo:
 *   📖 Read file.ts
 *   ✍️ Edit file.ts
 *   ⚙️ Bash command
 */
export function detectToolCall(text: string): {
  tool: string;
  description: string;
  details?: string;
} | null {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // Pattern: tool call con emoji (formato UI di Claude Code)
  const toolEmojis: [RegExp, string][] = [
    [/^[📖📄]\s*(Read|Reading)\s+/i, 'Read'],
    [/^[✍️📝✏️]\s*(Edit|Editing|Save)\s+/i, 'Edit'],
    [/^[⚙️🔧]\s*(Bash|Running)\s+/i, 'Bash'],
    [/^[📄💾]\s*(Write|Writing|Creating)\s+/i, 'Write'],
    [/^[🔍]\s*(Glob|Searching)\s+/i, 'Glob'],
    [/^[🔎]\s*(Grep|Searching)\s+/i, 'Grep'],
    [/^[🤖]\s*(Agent)\s+/i, 'Agent'],
    [/^[💡]\s*(Skill)\s+/i, 'Skill'],
    [/^[❓]\s*(Ask)\s+/i, 'AskUserQuestion'],
    [/^[📓]\s*(Notebook)/i, 'NotebookEdit'],
  ];

  for (const line of lines) {
    for (const [regex, toolName] of toolEmojis) {
      const match = line.match(regex);
      if (match) {
        const description = line.replace(regex, '').trim();
        return { tool: toolName, description };
      }
    }
  }

  // Fallback: pattern senza emoji (es. output raw)
  for (const line of lines) {
    const toolMatch = line.match(/^(?:tool|call|running):\s*(\w+)\s*[:\s]\s*(.*)?/i);
    if (toolMatch) {
      return {
        tool: toolMatch[1],
        description: toolMatch[2] || '',
      };
    }
  }

  return null;
}

/**
 * Processa un blocco di output: pulisce, rileva eventi e li ritorna.
 */
export function processOutput(rawText: string): {
  cleaned: string;
  events: Array<{
    type: 'text' | 'tool_call' | 'question';
    data: Record<string, unknown>;
  }>;
} {
  const cleaned = cleanOutput(rawText);
  const events: Array<{
    type: 'text' | 'tool_call' | 'question';
    data: Record<string, unknown>;
  }> = [];

  if (!cleaned) return { cleaned: '', events };

  // Check per tool call
  const toolCall = detectToolCall(cleaned);
  if (toolCall) {
    events.push({
      type: 'tool_call',
      data: {
        tool: toolCall.tool,
        description: toolCall.description,
        text: cleaned,
      },
    });
  }

  // Check per domanda
  const question = detectQuestion(cleaned);
  if (question) {
    events.push({
      type: 'question',
      data: question,
    });
  }

  // Emit testo pulito in ogni caso
  if (cleaned.length > 0) {
    events.push({
      type: 'text',
      data: { text: cleaned },
    });
  }

  return { cleaned, events };
}
