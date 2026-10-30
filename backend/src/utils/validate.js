const { LANGUAGES, CATEGORIES } = require('../config');
const { AppError } = require('./response');

// Empty -> fallback; anything outside the contract vocabulary -> ERR_VALIDATION.
function languageCodeOr(value, fallback) {
  if (value == null || value === '') return fallback;
  if (!LANGUAGES.includes(value)) throw new AppError('ERR_VALIDATION', `Invalid languageCode: ${value}. Allowed: ${LANGUAGES.join(', ')}`);
  return value;
}

function categoryOr(value, fallback = null) {
  if (value == null || value === '') return fallback;
  if (!CATEGORIES.includes(value)) throw new AppError('ERR_VALIDATION', `Invalid category: ${value}. Allowed: ${CATEGORIES.join(', ')}`);
  return value;
}

module.exports = { languageCodeOr, categoryOr };
