'use client';

import { useState } from 'react';
import { QuestionPrompt as QuestionPromptType } from '@/lib/types';

function QuestionPrompt({ question, onAnswer }: { question: QuestionPromptType; onAnswer: (answer: string) => void }) {
  const [textAnswer, setTextAnswer] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);

  const handleSubmit = () => {
    if (question.type === 'radio' && question.options?.length) {
      // Invia l'indice selezionato
      if (selectedOptions.length > 0) {
        onAnswer(selectedOptions[0]);
      }
    } else if (question.type === 'checkbox' && question.options?.length) {
      onAnswer(selectedOptions.join(', '));
    } else if (question.type === 'text' || question.type === 'confirm') {
      if (textAnswer) onAnswer(textAnswer);
    } else if (question.type === 'chat_about_this') {
      onAnswer('yes');
    }
  };

  const toggleOption = (option: string) => {
    if (question.type === 'radio') {
      setSelectedOptions([option]);
    } else {
      setSelectedOptions((prev) =>
        prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
      );
    }
  };

  const isReady =
    question.type === 'radio' || question.type === 'confirm' || question.type === 'chat_about_this'
      ? true
      : textAnswer.length > 0;

  return (
    <div
      className="rounded-xl px-4 py-3 text-sm"
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
      }}
    >
      <p className="font-medium mb-3" style={{ color: 'var(--text)' }}>
        {question.question}
      </p>

      {/* Radio / Checkbox options */}
      {question.options?.length ? (
        <div className="space-y-2 mb-3">
          {question.options.map((option, i) => {
            const isSelected = selectedOptions.includes(option);
            return (
              <button
                key={i}
                onClick={() => toggleOption(option)}
                className="w-full text-left rounded-lg px-3 py-2 transition"
                style={
                  isSelected
                    ? { background: 'var(--accent)', color: '#fff' }
                    : { background: 'var(--bg-surface)', color: 'var(--text)' }
                }
              >
                {option}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Text input */}
      {(question.type === 'text' || question.type === 'confirm') && (
        <textarea
          placeholder={question.placeholder || 'Scrivi...'}
          value={textAnswer}
          onChange={(e) => setTextAnswer(e.target.value)}
          className="w-full rounded-lg px-3 py-2 outline-none resize-none text-sm mb-3"
          rows={2}
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
        />
      )}

      {/* Submit */}
      {question.options?.length || question.type === 'text' || question.type === 'confirm' ? (
        <button
          onClick={handleSubmit}
          className="rounded-lg px-4 py-2 text-sm font-medium transition"
          style={{
            background: 'var(--accent)',
            color: '#fff',
          }}
        >
          Conferma
        </button>
      ) : null}

      {/* Quick buttons per Confirm / Chat About This */}
      {(question.type === 'confirm' || question.type === 'chat_about_this') && (
        <div className="flex gap-2 mt-2">
          <button onClick={() => onAnswer('y')} className="px-4 py-2 rounded-lg text-sm" style={{ background: 'var(--success)', color: '#fff' }}>
            Si
          </button>
          <button onClick={() => onAnswer('n')} className="px-4 py-2 rounded-lg text-sm" style={{ background: 'var(--error)', color: '#fff' }}>
            No
          </button>
        </div>
      )}
    </div>
  );
}
