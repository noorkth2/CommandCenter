'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const { getSupabaseClient } = require('./supabase.ipc');

let _anthropicClient = null;

/**
 * Retrieves Claude API key from Supabase settings table.
 * The key is NEVER logged or stored in memory longer than the call.
 */
async function getClaudeApiKey() {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('settings')
    .select('value')
    .eq('key', 'claude_api_key')
    .single();

  if (error || !data?.value) {
    throw new Error('Claude API key not configured. Please set it in Settings → AI Configuration.');
  }

  return data.value;
}

/**
 * Handles AI generation IPC calls from the renderer process.
 * Always reads the API key fresh from the DB — never caches it in memory.
 *
 * @param {string} prompt - The full prompt to send to Claude
 * @param {string} type   - Report type for context: 'rca' | 'sprint_summary' | 'deployment_note' | 'test_summary'
 * @returns {{ content: string, error: string|null }}
 */
async function handleAiGenerate(prompt, type) {
  try {
    const apiKey = await getClaudeApiKey();

    const anthropic = new Anthropic({ apiKey });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system:
        'You are a senior software engineering assistant embedded in a DevOps command center. ' +
        'You write professional, factual, concise technical documentation. ' +
        'Do not add filler phrases, pleasantries, or unnecessary caveats. ' +
        'Output only the requested content.',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = message.content?.[0]?.text ?? '';
    if (!content) throw new Error('Empty response from Claude API');

    return { content, error: null };
  } catch (err) {
    // Sanitize error — do not expose raw API key errors with key values
    const safeMessage = err.message
      .replace(/sk-ant-[A-Za-z0-9\-_]+/g, '[REDACTED]')
      .replace(/Bearer [A-Za-z0-9\-_]+/g, 'Bearer [REDACTED]');

    console.error('[ai.ipc] Error:', safeMessage);
    return { content: null, error: safeMessage };
  }
}

module.exports = { handleAiGenerate };
