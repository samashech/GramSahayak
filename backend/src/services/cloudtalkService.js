const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { config } = require('../config');

// CloudTalk REST + webhook helpers (R3: only Node talks to CloudTalk).
// Field names marked TBC are confirmed by LD-01 (CCR-03); until then the contract section 7
// keys are used and common aliases are accepted.

const SMS_PATH = '/api/sms/send.json';
const MAX_RECORDING_BYTES = 10 * 1024 * 1024;

const isConfigured = () => Boolean(config.cloudtalk.apiKeyId && config.cloudtalk.apiSecret);
const basicAuth = () => `Basic ${Buffer.from(`${config.cloudtalk.apiKeyId}:${config.cloudtalk.apiSecret}`).toString('base64')}`;

// First non-empty value among the accepted aliases of a webhook field.
function pick(body, keys) {
  for (const k of keys) {
    const v = body?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return null;
}

const FIELDS = {
  caller: ['caller_number', 'callerPhone', 'from', 'fromPhone', 'contact_phone', 'phone', 'caller'],
  digit: ['dtmf_digit', 'dtmfDigit', 'dtmf', 'digits', 'digit', 'input'],
  recording: ['recording_url', 'recordingUrl', 'audio_url', 'recording'],
  smsBody: ['body', 'text', 'message'],
};

// -> 'sent' | 'failed' | 'simulated'. Without credentials nothing is sent (DR-02: simulators
// are the primary path; outbound SMS to +91 may also need DLT registration).
async function sendSms(to, text) {
  if (!isConfigured()) return 'simulated';
  try {
    const res = await fetch(`${config.cloudtalk.baseUrl}${SMS_PATH}`, {
      method: 'POST',
      headers: { Authorization: basicAuth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: to, message: text }), // TBC (CCR-03)
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return 'sent';
  } catch (err) {
    console.warn(`[cloudtalk] SMS to ${to} failed: ${err.message}`);
    return 'failed';
  }
}

// Optional shared secret: when CLOUDTALK_WEBHOOK_SECRET is set, the webhook URL configured in
// CloudTalk must carry ?secret=<value> (or an x-webhook-secret header).
function webhookAuthorized(req) {
  const secret = config.cloudtalk.webhookSecret;
  if (!secret) return true;
  const given = String(req.query?.secret || req.get('x-webhook-secret') || '');
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Only public https recording URLs are fetched (no localhost / private ranges).
function isFetchableUrl(raw) {
  let url;
  try { url = new URL(raw); } catch { return false; }
  if (url.protocol !== 'https:') return false;
  const host = url.hostname;
  return !(/^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || host === '[::1]' || host.endsWith('.local'));
}

// Download a CloudTalk recording to uploads/ -> local path, or null on any problem.
async function downloadRecording(recordingUrl) {
  if (!recordingUrl || !isFetchableUrl(recordingUrl)) return null;
  try {
    const res = await fetch(recordingUrl, {
      headers: isConfigured() ? { Authorization: basicAuth() } : {}, // auth behaviour TBC (CCR-03)
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_RECORDING_BYTES) throw new Error(`bad size ${buf.length}`);
    const file = path.join(config.paths.uploadsDir, `rec-${Date.now()}-${crypto.randomUUID()}${path.extname(new URL(recordingUrl).pathname) || '.wav'}`);
    fs.writeFileSync(file, buf);
    return file;
  } catch (err) {
    console.warn(`[cloudtalk] recording download failed: ${err.message}`);
    return null;
  }
}

module.exports = { isConfigured, sendSms, webhookAuthorized, downloadRecording, isFetchableUrl, pick, FIELDS };
