'use client';

import { useState } from 'react';
import { ToolCall as ToolCallType } from '@/lib/types';

const toolIcons: Record<string, string> = {
  Read: '📖',
  Edit: '✏️',
  Bash: '⚙️',
  Write: '💾',
  Glob: '🔍',
  Grep: '🔎',
  Agent: '🤖',
  Skill: '💡',
  AskUserQuestion: '❓',
  NotebookEdit: '📓',
};

const toolColors: Record<string, string> = {
  Read: '#60a5fa',
  Edit: '#a78bfa',
  Bash: '#f59e0b',
  Write: '#34d399',
};

function ToolCallView({ toolCall: tc }: { toolCall: ToolCallType }) {
  const [expanded, setExpanded] = useState(false);

  const icon = toolIcons[tc.tool] || '⚡';
  const color = toolColors[tc.tool] || 'var(--text-muted)';

  return (
    <div
      className="rounded-lg px-3 py-2 text-xs cursor-pointer transition hover:opacity-80"
      style={{ background: 'var(--bg-elevated)', borderLeft: `3px solid ${color}` }}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2">
        <span>{icon}</span>
        <span className="font-medium" style={{ color }}>
          {tc.tool}
        </span>
        {tc.description && (
          <span className="truncate" style={{ color: 'var(--text-muted)' }}>
            {tc.description}
          </span>
        )}
      </div>
      {expanded && tc.text && (
        <pre
          className="mt-2 text-xs overflow-x-auto font-mono"
          style={{ color: 'var(--text-muted)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
        >
          {tc.text}
        </pre>
      )}
    </div>
  );
}
