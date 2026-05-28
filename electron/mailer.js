'use strict';

const nodemailer = require('nodemailer');
const { getSupabaseClient } = require('./ipc/supabase.ipc');
const { decrypt } = require('./ipc/encrypt');

/**
 * Reads SMTP settings from Supabase settings table.
 * Returns a nodemailer transport configured with decrypted credentials.
 * Credentials are never logged.
 */
async function createTransport() {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('settings')
    .select('key, value')
    .in('key', ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'notification_email']);

  if (error) throw new Error(`Failed to read SMTP settings: ${error.message}`);

  const settings = {};
  for (const row of data ?? []) {
    settings[row.key] = row.value;
  }

  if (!settings.smtp_host || !settings.smtp_user || !settings.smtp_pass) {
    throw new Error('SMTP not configured. Please set SMTP credentials in Settings → Email / SMTP.');
  }

  const smtpPort = parseInt(settings.smtp_port ?? '587', 10);

  return {
    transport: nodemailer.createTransport({
      host: settings.smtp_host,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: settings.smtp_user,
        pass: decrypt(settings.smtp_pass),
      },
      tls: { rejectUnauthorized: false },
    }),
    defaultFrom: settings.smtp_user,
    defaultTo: settings.notification_email || settings.smtp_user,
  };
}

/**
 * Sends an email via Nodemailer using decrypted SMTP credentials from Supabase settings.
 *
 * @param {{ to?: string, subject: string, html?: string, text?: string }} options
 * @returns {{ success: boolean, messageId?: string, error?: string }}
 */
async function sendEmail(options) {
  try {
    const { transport, defaultFrom, defaultTo } = await createTransport();

    const info = await transport.sendMail({
      from: `"CommandCenter" <${defaultFrom}>`,
      to: options.to || defaultTo,
      subject: options.subject,
      text: options.text || '',
      html: options.html || options.text || '',
    });

    console.log(`[mailer] Email sent: ${info.messageId}`);
    return { success: true, messageId: info.messageId, error: null };
  } catch (err) {
    // Sanitize — never log passwords
    const safeMessage = err.message
      .replace(/password[=:\s]+\S+/gi, 'password=[REDACTED]')
      .replace(/auth[=:\s]+\S+/gi, 'auth=[REDACTED]');
    console.error('[mailer] Send error:', safeMessage);
    return { success: false, messageId: null, error: safeMessage };
  }
}

module.exports = { sendEmail };

