/**
 * electron/ipc/ai.ipc.js
 * OpenCode Zen API handler (via Anthropic-compatible endpoint).
 * Uses safeStorage for key encryption.
 * Falls back to mock if no key is configured.
 *
 * safeStorage encrypts using the OS keychain — zero extra deps.
 * Key is stored encrypted in the settings table as a base64 string.
 * It is DECRYPTED here in the main process only — never sent to renderer.
 */

'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getSupabaseClient } = require('./supabase.ipc');
const { encrypt, decrypt } = require('./encrypt');

// ─── Configuration ─────────────────────────────────────────────────────────

const ZEN_BASE_URL = 'https://opencode.ai/zen';

// ─── Key & Setting Management ─────────────────────────────────────────────

const encryptApiKey = encrypt;
const decryptApiKey = decrypt;

async function getSetting(key) {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('settings')
      .select('value')
      .eq('key', key)
      .single();

    if (error || !data?.value) return null;
    return data.value;
  } catch {
    return null;
  }
}

async function getEncryptedSetting(key) {
  const val = await getSetting(key);
  return val ? decrypt(val) : null;
}

// ─── Mock Fallback ─────────────────────────────────────────────────────────

function generateMockReport(type) {
  const mocks = {
    rca: '**Root Cause Analysis (Mock)**\n\nNo AI provider key configured. Add your API key in Settings to generate real analysis.',
    sprint_summary: '**Sprint Summary (Mock)**\n\nNo AI provider key configured. Add your API key in Settings.',
    deployment_note: '**Deployment Note (Mock)**\n\nNo AI provider key configured. Add your API key in Settings.',
    test_summary: '**Test Summary (Mock)**\n\nNo AI provider key configured. Add your API key in Settings.',
  };
  return mocks[type] ?? '**Mock Report**\n\nConfigure your AI provider API key in Settings to enable AI reports.';
}

// ─── Providers ─────────────────────────────────────────────────────────────

async function generateWithZen(prompt, apiKey) {
  const model = (await getSetting('zen_model')) || 'opencode/deepseek-v4-flash-free';
  
  const anthropic = new Anthropic({
    apiKey,
    baseURL: ZEN_BASE_URL,
    maxRetries: 3,
  });

  const message = await anthropic.messages.create({
    model,
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  return message.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

async function generateWithGemini(prompt, apiKey) {
  // Use gemini-1.5-flash which is the standard identifier
  const model = (await getSetting('gemini_model')) || 'gemini-1.5-flash';
  
  const genAI = new GoogleGenerativeAI(apiKey);
  // Default to v1 version instead of v1beta if possible, or ensure correct model string
  const geminiModel = genAI.getGenerativeModel({ model });

  const result = await geminiModel.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

// ─── Main Handler ──────────────────────────────────────────────────────────

async function handleAiGenerate(prompt, type) {
  try {
    const provider = (await getSetting('ai_provider')) || 'zen';
    let content = null;

    if (provider === 'gemini') {
      const apiKey = await getEncryptedSetting('gemini_api_key');
      if (!apiKey || apiKey.trim() === '') return { content: generateMockReport(type), mock: true };
      content = await generateWithGemini(prompt, apiKey);
    } else {
      // Default to Zen
      const apiKey = await getEncryptedSetting('zen_api_key');
      if (!apiKey || apiKey.trim() === '') return { content: generateMockReport(type), mock: true };
      content = await generateWithZen(prompt, apiKey);
    }

    return { content, mock: false };
  } catch (err) {
    const safeMessage = err.message?.replace(/(sk-[a-z0-9-]+|oc[a-z0-9_-]+)/gi, '[REDACTED]') ?? 'Unknown error';
    console.error(`[ai.ipc] [${type}] Error:`, safeMessage);
    return { content: null, error: safeMessage };
  }
}

module.exports = {
  handleAiGenerate,
  encryptApiKey,
  decryptApiKey
};
