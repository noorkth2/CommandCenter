/**
 * electron/ipc/encrypt.js
 * Shared safeStorage encryption utilities for the main process.
 * Stores sensitive credentials encrypted via native OS keychain.
 */

'use strict';

const { safeStorage } = require('electron');

/**
 * Encrypts a plaintext string to a base64-encoded safeStorage buffer string.
 *
 * @param {string} plaintext
 * @returns {string} base64-encoded encrypted string
 */
function encrypt(plaintext) {
  if (!plaintext) return '';
  if (!safeStorage || !safeStorage.isEncryptionAvailable()) {
    return plaintext;
  }
  try {
    const buf = safeStorage.encryptString(plaintext);
    return buf.toString('base64');
  } catch (err) {
    console.error('[encrypt] safeStorage encryption failed:', err.message);
    return plaintext;
  }
}

/**
 * Decrypts a base64-encoded safeStorage buffer string.
 * Falls back to returning the string directly if decryption fails (allowing legacy plaintext load).
 *
 * @param {string} ciphertext base64-encoded encrypted string
 * @returns {string} decrypted plaintext string
 */
function decrypt(ciphertext) {
  if (!ciphertext) return '';
  if (!safeStorage || !safeStorage.isEncryptionAvailable()) {
    return ciphertext;
  }
  try {
    const buf = Buffer.from(ciphertext, 'base64');
    return safeStorage.decryptString(buf);
  } catch (err) {
    // If decryption fails, the value is likely legacy plaintext. Return directly.
    return ciphertext;
  }
}

module.exports = {
  encrypt,
  decrypt,
};
