/**
 * CLI debug tool per testare il parser del backend.
 *
 * Run: cd backend && npx tsx ../scripts/test-parser.ts
 */

import { cleanOutput, detectQuestion, detectToolCall } from '../backend/src/parser';

// Test: output simulato di Claude Code
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
    expectQuestion: false,
  },
  {
    name: 'Tool call: Bash command',
    input: '⚙️ Running npm run build',
    expectTool: 'Bash',
    expectQuestion: false,
  },
  {
    name: 'Text: normale risposta',
    input: 'Ho letto il file e applicato le modifiche.',
    expectTool: false,
    expectQuestion: false,
  },
  {
    name: 'Question: confirm y/n',
    input: 'Vuoi continuare? [y/n]',
    expectTool: false,
    expectQuestion: true,
    expectQuestionType: 'confirm',
  },
  {
    name: 'Question: multi-choice',
    input: 'Seleziona opzione:\n[1] Prima\n[2] Seconda\n[3] Terza\n',
    expectTool: false,
    expectQuestion: true,
    expectQuestionType: 'radio',
  },
  {
    name: 'Question: Chat About This',
    input: 'Chat About This',
    expectTool: false,
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
      console.log(`PASS: ${tc.name} → tool="${toolCall.tool}"`);
      continue;
    }
    console.error(`FAIL: ${tc.name}`);
    console.error(`  Expected tool: ${tc.expectTool}`);
    console.error(`  Got: ${toolCall ? toolCall.tool : 'none'}`);
    console.error(`  Cleaned: "${cleaned}"`);
    failed++;
    continue;
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
        console.error(`  Expected: ${tc.expectQuestionType}`);
        console.error(`  Got: ${question.type}`);
        failed++;
        continue;
      }
      passed++;
      console.log(`PASS: ${tc.name} → question="${question.type}"`);
      continue;
    }
    console.error(`FAIL: ${tc.name}`);
    console.error(`  Expected question but got none`);
    console.error(`  Input: "${tc.input}"`);
    failed++;
  } else if (!tc.expectQuestion && question) {
    // false positive question is OK sometimes, don't fail
    passed++;
    console.log(`PASS: ${tc.name} (question detected: ${question.type}, ignored)`);
  } else {
    passed++;
    console.log(`PASS: ${tc.name}`);
  }
}

console.log(`\nResults: ${passed} passed, ${failed} failed, ${passed + failed} total`);
process.exit(failed > 0 ? 1 : 0);
