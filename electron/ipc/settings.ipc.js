'use strict';

const { getSupabaseClient } = require('./supabase.ipc');
const { decrypt } = require('./encrypt');

const SECRET_KEYS = new Set(['zen_api_key', 'smtp_pass', 'jira_api_token']);

/**
 * Fetches all settings from the database and returns them as a map.
 * Automatically decrypts sensitive secret keys.
 * @returns {Promise<Object>} Map of key-value settings
 */
async function getSettingsMap() {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('settings')
      .select('key, value');

    if (error) {
      throw error;
    }

    const settings = {};
    for (const row of data || []) {
      let value = row.value;
      if (value && SECRET_KEYS.has(row.key)) {
        value = decrypt(value);
      }
      settings[row.key] = value;
    }
    return settings;
  } catch (err) {
    console.error('[settings.ipc] Failed to fetch settings map:', err.message);
    return {};
  }
}

module.exports = {
  getSettingsMap,
};
