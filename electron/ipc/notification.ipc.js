'use strict';

const { Notification } = require('electron');

/**
 * Sends a native OS desktop notification.
 * Silently no-ops if notifications are not supported.
 *
 * @param {{ title: string, body: string, urgency?: 'critical'|'normal' }} opts
 */
function showNotification({ title, body, urgency = 'normal' }) {
  if (!Notification.isSupported()) return;

  try {
    const n = new Notification({
      title: title || 'CommandCenter',
      body: body || '',
      urgency,
    });
    n.show();
  } catch (err) {
    console.error('[notification.ipc] Failed to show notification:', err.message);
  }
}

module.exports = { showNotification };
