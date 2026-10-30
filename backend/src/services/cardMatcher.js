const seedSchemes = require('../adapters/seedSchemes');
const ALIASES = require('../config/schemeAliases');

// Deterministic "which scheme card is this text about?" (no LLM).
// Picks the longest matching term so "किसान क्रेडिट" (KCC) beats a bare "किसान".

const isLatin = (s) => /^[\x00-\x7F]+$/.test(s);
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function termsFor(card) {
  return [card.code, card.name_en, card.name_hi, card.name_mr, card.name_ta, ...(ALIASES[card.code] || [])]
    .filter(Boolean)
    .map((t) => t.toLowerCase());
}

function contains(text, term) {
  if (isLatin(term)) return new RegExp(`(^|[^a-z0-9])${escape(term)}([^a-z0-9]|$)`).test(text);
  return text.includes(term);
}

function matchCard(text, { category } = {}) {
  if (!text) return null;
  const haystack = String(text).toLowerCase().normalize('NFC');
  let best = null;
  for (const card of seedSchemes.getAll(category)) {
    for (const term of termsFor(card)) {
      if (term.length >= 3 && contains(haystack, term.normalize('NFC')) && (!best || term.length > best.term.length)) {
        best = { card, term };
      }
    }
  }
  return best ? best.card : null;
}

module.exports = { matchCard };
