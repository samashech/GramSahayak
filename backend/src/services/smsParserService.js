const { config, LANGUAGES, SCHEME_CODES } = require('../config');
const { AppError } = require('../utils/response');
const msg = require('../config/messages');
const seedSchemes = require('../adapters/seedSchemes');
const dbAdapter = require('../adapters/dbAdapter');
const sessionService = require('./sessionService');
const { smsSummaryFor } = require('./schemeView');
const { matchCard } = require('./cardMatcher');

// B-05: offline SMS bot, shared by the CloudTalk SMS webhook and /api/sms-simulate (B-07).
// Keyword -> card sms_summary verbatim (R5, no LLM, target <300 ms).
// Free text -> answerFreeText (agent brain with maxChars 160, plugged in by B-06), else a
// deterministic card match, else the HELP list.

const KEYWORD_ALIASES = {
  PMUY: 'UJJWALA', NREGA: 'MGNREGA', MNREGA: 'MGNREGA', AYUSHMAN: 'PMJAY',
  SCHOLARSHIPS: 'SCHOLARSHIP', YASASVI: 'PMYASASVI', HELPME: 'HELP', MENU: 'HELP',
};
const CATEGORY_KEYWORDS = ['AGRI', 'HEALTH', 'SCHOLARSHIP'];

const codePoints = (s) => Array.from(s).length;
const clip = (s, max = config.smsMaxChars) => (codePoints(s) <= max ? s : `${Array.from(s).slice(0, max - 1).join('')}…`);

function parseKeyword(body) {
  const compact = body.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const firstToken = (body.trim().split(/\s+/)[0] || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  for (const candidate of [compact, firstToken]) {
    const k = KEYWORD_ALIASES[candidate] || candidate;
    if (SCHEME_CODES.includes(k) || CATEGORY_KEYWORDS.includes(k) || k === 'HELP') return k;
  }
  return null;
}

// Reply language: explicit hint > script of the message > caller's profile > en-IN.
function pickLanguage(body, languageHint, profileLanguage) {
  if (LANGUAGES.includes(languageHint)) return languageHint;
  if (/[஀-௿]/.test(body)) return 'ta-IN';
  if (/[ऀ-ॿ]/.test(body)) return ['hi-IN', 'mr-IN'].includes(profileLanguage) ? profileLanguage : 'hi-IN';
  if (LANGUAGES.includes(profileLanguage)) return profileLanguage;
  return 'en-IN';
}

function keywordReply(keyword, languageCode) {
  const lang = msg.langOf(languageCode);
  if (keyword === 'HELP') return { replyText: msg.SMS_HELP[lang], matchedSchemeId: null, mode: 'help' };
  if (CATEGORY_KEYWORDS.includes(keyword)) {
    return { replyText: msg.SMS_CATEGORY_REPLIES[keyword][lang], matchedSchemeId: null, mode: 'keyword' };
  }
  const card = seedSchemes.getByCode(keyword);
  return { replyText: smsSummaryFor(card, languageCode), matchedSchemeId: card.code, mode: 'keyword' };
}

async function freeTextReply(body, languageCode, sessionKey, answerFreeText) {
  if (answerFreeText) {
    try {
      const out = await answerFreeText({ queryText: body, languageCode, sessionKey, maxChars: config.smsMaxChars });
      if (out?.replyText) return { replyText: out.replyText, matchedSchemeId: out.matchedSchemeId ?? null, mode: 'rag' };
    } catch (err) {
      console.warn('[sms] free-text agent failed, using local card match:', err.message);
    }
  }
  const card = matchCard(body);
  if (card) return { replyText: smsSummaryFor(card, languageCode), matchedSchemeId: card.code, mode: 'keyword' };
  return { replyText: msg.SMS_HELP[msg.langOf(languageCode)], matchedSchemeId: null, mode: 'help' };
}

// -> {replyText, charCount, matchedSchemeId, mode, languageCode, sessionKey, latencyMs}
async function handleSmsQuery(fromPhone, smsBody, languageHint, { answerFreeText } = {}) {
  const started = performance.now();
  const sessionKey = sessionService.normalizePhone(fromPhone);
  if (!sessionKey) throw new AppError('ERR_VALIDATION', `Invalid fromPhone: ${fromPhone}`);
  const body = String(smsBody ?? '').trim().slice(0, 1000);

  const profile = await sessionService.getProfile(sessionKey);
  const languageCode = pickLanguage(body, languageHint, profile?.language);
  const keyword = body ? parseKeyword(body) : 'HELP';

  const reply = keyword
    ? keywordReply(keyword, languageCode)
    : await freeTextReply(body, languageCode, sessionKey, answerFreeText);
  const replyText = clip(reply.replyText);
  const latencyMs = Math.round(performance.now() - started);

  const category = reply.matchedSchemeId ? seedSchemes.getByCode(reply.matchedSchemeId)?.category : null;
  // Turns (one read + one write) and the two logs are independent: run them together.
  await Promise.all([
    sessionService.appendTurns(sessionKey, [
      { channel: 'sms', speaker: 'user', text: body, category, language: languageCode },
      { channel: 'sms', speaker: 'assistant', text: replyText, category, language: languageCode },
    ]),
    dbAdapter.logCallOrSms({ sessionKey, phone: sessionKey, channel: 'sms', eventType: 'sms_in', detail: { body, languageCode } }),
    dbAdapter.logCallOrSms({
      sessionKey, phone: sessionKey, channel: 'sms', eventType: 'sms_out',
      detail: { replyText, mode: reply.mode, matchedSchemeId: reply.matchedSchemeId }, latencyMs,
    }),
  ]);

  return {
    replyText,
    charCount: codePoints(replyText),
    matchedSchemeId: reply.matchedSchemeId,
    mode: reply.mode,
    languageCode,
    sessionKey,
    latencyMs,
  };
}

module.exports = { handleSmsQuery, parseKeyword, pickLanguage };
