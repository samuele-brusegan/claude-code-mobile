#!/usr/bin/env node
/**
 * CLI debug tool per testare il backend di Claude Code Mobile.
 *
 * Simula una sessione completa WS: invia un prompt, legge la risposta,
 * verifica il parsing. Non richiede SSH — testa solo il parser locale.
 *
 * Usage:
 *   node scripts/test-parser.js          - Test parser con output simulato
 *   node scripts/test-parser.js --live   - Test live (richiede backend running)
 */

// Run with: npx tsx scripts/test-parser.js
import { cleanOutput, detectQuestion, detectToolCall } from '../backend/src/parser.js';

// ANSI wrapper per test: simula output di Claude Code
const testCases = [
  {
    name: 'Tool call: Read file',
    input: '\u001b[32m📖 Reading src/index.ts\u001b[0m',
    expectTool: 'Read',
    expectQuestion: false,
  },
  {
    name: 'Tool call: Edit file',
    input: '\u001b[34m✏️ Editing src/index.ts\u001b[0m',
    expectTool: 'Edit',
  },
  {
    name: 'Tool call: Bash command',
    input: '⚙️ Running npm run build',
    expectTool: 'Bash',
  },
  {
    name: 'Text: normale risposta',
    input: 'Ho letto il file src/index.ts e applicato le modifiche.',
    expectTool: false,
  },
  {
    name: 'Question: confirm y/n',
    input: 'Vuoi continuare? [y/n]',
    expectQuestion: true,
    expectQuestionType: 'confirm',
  },
  {
    name: 'Question: multi-choice',
    input: 'Seleziona opzione:\n[1] Prima\n[2] Seconda\n[3] Terza\n',
    expectQuestion: true,
    expectQuestionType: 'radio',
  },
  {
    name: 'Question: Chat About This',
    input: 'Chat About This',
    expectQuestion: true,
    expectQuestionType: 'chat_about_this',
  },
];

let passed = 0;
let failed = 0;

console.log('=== Parser Test Suite ===\n');

for (const tc of testCases) {
  const cleaned = cleanOutput(tc.input);
  const toolCall = detectToolCall(cleaned);
  const question = detectQuestion(cleaned);

  // Check tool call
  if (tc.expectTool) {
    if (toolCall && toolCall.tool === tc.expectTool) {
      passed++;
    } else {
      console.error(`FAIL: ${tc.name}`);
      console.error(`  Expected tool: ${tc.expectTool}`);
      console.error(`  Got: ${toolCall ? toolCall.tool : 'none'}`);
      failed++;
      continue;
    }
  } else if (tc.expectTool === false && toolCall) {
    console.error(`FAIL: ${tc.name}`);
    console.error(`  Unexpected tool call: ${toolCall.tool}`);
    failed++;
    continue;
  }

  // Check question
  if (tc.expectQuestion) {
    if (question) {
      if (tc.expectQuestionType && question.type !== tc.expectQuestionType) {
        console.error(`FAIL: ${tc.name}`);
        console.error(`  Expected question type: ${tc.expectQuestionType}`);
        console.error(`  Got: ${question.type}`);
        failed++;
        continue;
      }
      passed++;
    } else {
      console.error(`FAIL: ${tc.name}`);
      console.error(`  Expected question but got none`);
      failed++;
    }
  } else {
    passed++;
  }
}

console.log(`\nResults: ${passed} passed, ${failed} failed, ${passed + failed} total`);
process.exit(failed > 0 ? 1 : 0);
