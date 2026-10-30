const fs = require('node:fs');
const path = require('node:path');

// B-10: golden demo cache. backend/cache/golden-cache.json is generated from the live RAG service
// by scripts/build-golden-cache.js (G1-G5, G7, S1-S3 x hi/mr/ta/en, chat + voice answers).
// Used when RAG is down or USE_MOCK_AI=true. It never holds SMS receipts: those always come from
// the seed card (R5).

const CACHE_FILE = path.join(__dirname, '..', '..', 'cache', 'golden-cache.json');
let cache;

// Same normalisation for building and lookup: NFC, lower case, no punctuation, single spaces.
function normalizeQuery(text) {
  return String(text || '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[?？!.,।॥:;'"“”‘’()\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function load() {
  try {
    cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch (err) {
    console.warn(`[cache] golden cache unavailable (${err.code || err.message}); cache rung skipped`);
    cache = { entries: {} };
  }
  return cache;
}

// -> {answerText, matchedSchemeId, sources, category, id} or null
function lookup(queryText, languageCode, { forVoice = false } = {}) {
  const entry = (cache || load()).entries[`${languageCode}|${normalizeQuery(queryText)}`];
  if (!entry) return null;
  return {
    id: entry.id,
    category: entry.category,
    matchedSchemeId: entry.matchedSchemeId,
    sources: entry.sources || [],
    answerText: forVoice ? entry.answerText.voice : entry.answerText.chat,
  };
}

const size = () => Object.keys((cache || load()).entries).length;

module.exports = { lookup, normalizeQuery, load, size, CACHE_FILE };
