/**
 * BoredRoom Booking — Encryption Service (AES-256-CBC)
 * For HIPAA-mode businesses — encrypts sensitive data at rest.
 */

const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-cbc';

function getKey() {
  return Buffer.from(ENCRYPTION_KEY, 'hex').slice(0, 32);
}

function encrypt(text) {
  if (!text) return text;
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return iv.toString('base64') + ':' + encrypted;
  } catch (e) {
    console.error('Encryption error:', e.message);
    return text; // Fail open — better than losing data
  }
}

function decrypt(encrypted) {
  if (!encrypted || !encrypted.includes(':')) return encrypted;
  try {
    const [ivBase64, data] = encrypted.split(':');
    const iv = Buffer.from(ivBase64, 'base64');
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    let decrypted = decipher.update(data, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    console.error('Decryption error:', e.message);
    return encrypted; // Return as-is if decryption fails
  }
}

module.exports = { encrypt, decrypt };
