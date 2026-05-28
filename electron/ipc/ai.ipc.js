/**
 * electron/ipc/ai.ipc.js
 * Claude API handler. Uses safeStorage for key encryption.
 * Falls back to mock if no key is configured.
 *
 * safeStorage encrypts using the OS keychain — zero extra deps.
 * Key is stored encrypted in the settings table as a base64 string.
 * It is DECRYPTED here in the main process only — never sent to renderer.
 */

'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const { getSupabaseClient } = require('./supabase.ipc');
const { encrypt, decrypt } = require('./encrypt');

// ─── Key Management ────────────────────────────────────────────────────────

/** Thin wrappers for callers that depend on the old ai.ipc.js export surface */
const encryptApiKey = encrypt;
const decryptApiKey = decrypt;

async function getClaudeApiKey() {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('settings')
      .select('value')
      .eq('key', 'claude_api_key')
      .single();

    if (error || !data?.value) return null;
    return decryptApiKey(data.value);
  } catch (err) {
    console.error('[ai.ipc] Failed to load Claude API key:', err.message);
    return null;
  }
}

// ─── Mock Fallback ─────────────────────────────────────────────────────────

function generateMockReport(type) {
  const mocks = {
    rca: '**Root Cause Analysis (Mock)**\n\nNo Claude API key configured. Connect your API key in Settings to generate real analysis.',
    sprint_summary: '**Sprint Summary (Mock)**\n\nNo Claude API key configured. Connect your API key in Settings.',
    deployment_note: '**Deployment Note (Mock)**\n\nNo Claude API key configured. Connect your API key in Settings.',
    test_summary: '**Test Summary (Mock)**\n\nNo Claude API key configured. Connect your API key in Settings.',
  };
  return mocks[type] ?? '**Mock Report**\n\nConfigure your Claude API key in Settings to enable AI reports.';
}

// ─── Main Handler ──────────────────────────────────────────────────────────

async function handleAiGenerate(prompt, type) {
  try {
    const apiKey = await getClaudeApiKey();

    if (!apiKey || apiKey.trim() === '') {
      return { content: generateMockReport(type), mock: true };
    }

    const anthropic = new Anthropic({
      apiKey,
      maxRetries: 3, // automatic backoff on transient failures
    });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n');

    return { content, mock: false };
  } catch (err) {
    // Strip the key from error messages before logging
    const safeMessage = err.message?.replace(/sk-ant-[\w-]+/g, '[REDACTED]') ?? 'Unknown error';
    console.error('[ai.ipc] Error:', safeMessage);
    return { content: null, error: safeMessage };
  }
}

module.exports = {
  handleAiGenerate,
  encryptApiKey,
  decryptApiKey
};
