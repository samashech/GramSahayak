const { config, LANGUAGES, CATEGORIES, ROLES } = require('../config');
const { AppError } = require('../utils/response');
const msg = require('../config/messages');
const seedSchemes = require('../adapters/seedSchemes');
const dbAdapter = require('../adapters/dbAdapter');
const sessionService = require('./sessionService');
const safetyService = require('./safetyService');
const ragClient = require('./ragClient');
const eventBus = require('./eventBus');
const { matchCard } = require('./cardMatcher');
const demoCache = require('./demoCache');
const { localName, smsSummaryFor } = require('./schemeView');

// B-06: one agent brain for web, IVR and SMS (Loopholes #1, #2, #3, #7).
//   1. deterministic safety screen (fixed answers for emergencies and dose requests)
//   2. POST {AI_RAG_URL}/rag/query with the regional text as-is (R6), 4000 ms timeout
//   3. on failure or USE_MOCK_AI: local scheme-card match, else a fixed "no verified info" answer
//   4. call-to-SMS receipt = matched seed card sms_summary, verbatim (R5)
// Returns AnswerData (contract section 6).

const MAX_QUERY_CHARS = 2000;
const REQUIRED_HELPLINE = { emergency: '108', doseAgri: '1800-180-1551', doseMedical: '104' };
// The user is asking about a scheme by name ("... Yojana", "योजना", "திட்டம்").
const SCHEME_WORD_RE = /(yojana|yojna|scheme|योजना|योजने|யோஜனா|திட்ட)/i;
const DOMAIN_RE = /\s*\b(?:https?:\/\/)?[\w.-]+\.(?:gov|nic|org|com)\.in\b\S*/gi;
// RAG's voice cleanup can turn "pmkisan.gov.in" into "pmkisan, gov, in" before stripping URLs.
const SPLIT_DOMAIN_RE = /,?\s*\b[\w-]+,\s*(?:gov|nic),\s*in\b/gi;

const sourceRefFromRag = (s) => ({
  id: s.id, title: s.title, category: s.category, helpline: s.helpline, portalUrl: s.portal,
});

const sourceRefFromCard = (card, languageCode) => ({
  id: card.code, title: localName(card, languageCode), category: card.category,
  helpline: card.helpline, portalUrl: card.portal_url,
});

// Spoken text must not carry URLs (contract section 6); the SMS receipt carries them.
function voiceSafe(text) {
  return text.replace(DOMAIN_RE, '').replace(SPLIT_DOMAIN_RE, '').replace(/\s{2,}/g, ' ').trim();
}

function smsReceiptFor(card, languageCode, delivery = 'simulated') {
  if (!card) return null;
  return {
    smsReceiptText: smsSummaryFor(card, languageCode),
    helpline: card.helpline,
    portalUrl: card.portal_url,
    documents: Array.isArray(card.documents) ? card.documents.slice() : [],
    delivery,
  };
}

// Spoken answer built from the card's own SMS summary (verbatim facts, no URL).
function cardAnswer(card, languageCode) {
  const summary = voiceSafe(smsSummaryFor(card, languageCode) || '');
  const name = localName(card, languageCode);
  // Card summaries start with their own short label ("पीएम-किसान: ..."); add the name only if not.
  const labelled = summary.includes(name) || /^[^:]{2,40}:/.test(summary);
  const lead = labelled ? summary : `${name}: ${summary}`;
  return `${lead} ${msg.SMS_CLOSING[msg.langOf(languageCode)]}`;
}

// True for an answer that is only a short "details are being sent by SMS" line.
function isClosingOnly(text) {
  const t = String(text || '').trim();
  return !t || (Array.from(t).length < 70 && /(SMS|एसएमएस|எஸ்எம்எஸ்)/i.test(t));
}

// Degradation ladder when RAG gives no usable answer (B-10):
//   safety fixed text -> local card match ("fallback") -> golden cache ("cache") -> "no verified info".
// With USE_MOCK_AI the golden cache is tried before the card match.
function degradedAnswer(queryText, { languageCode, category, safety, forVoice, cacheFirst = false }) {
  const lang = msg.langOf(languageCode);
  if (safety.kind && msg.SAFETY_ANSWERS[safety.kind]) {
    return { answerText: msg.SAFETY_ANSWERS[safety.kind][lang], card: null, sources: [], source: 'fallback' };
  }
  const fromCard = () => {
    const card = matchCard(queryText, { category }) || matchCard(queryText);
    return card && { answerText: cardAnswer(card, languageCode), card, sources: [sourceRefFromCard(card, languageCode)], source: 'fallback' };
  };
  const fromCache = () => {
    const hit = demoCache.lookup(queryText, languageCode, { forVoice });
    return hit && { answerText: hit.answerText, card: seedSchemes.getByCode(hit.matchedSchemeId), sources: hit.sources, source: 'cache' };
  };
  return (cacheFirst ? fromCache() || fromCard() : fromCard() || fromCache())
    || { answerText: msg.NO_VERIFIED_INFO[lang], card: null, sources: [], source: 'fallback' };
}

function validateInput({ queryText, languageCode, category, role, channel }) {
  const text = String(queryText ?? '').trim();
  if (!text) throw new AppError('ERR_VALIDATION', 'queryText is required');
  if (text.length > MAX_QUERY_CHARS) throw new AppError('ERR_VALIDATION', `queryText is longer than ${MAX_QUERY_CHARS} characters`);
  if (!LANGUAGES.includes(languageCode)) throw new AppError('ERR_VALIDATION', `Invalid languageCode: ${languageCode}`);
  if (category != null && !CATEGORIES.includes(category)) throw new AppError('ERR_VALIDATION', `Invalid category: ${category}`);
  if (role != null && !ROLES.includes(role)) throw new AppError('ERR_VALIDATION', `Invalid role: ${role}`);
  if (!['web', 'ivr', 'sms'].includes(channel)) throw new AppError('ERR_VALIDATION', `Invalid channel: ${channel}`);
  return text;
}

async function answerQuery({
  queryText, languageCode, category = null, role = null, channel = 'web',
  sessionKey = null, phone = null, forVoice = false, persist = true, deliverSms = null,
}) {
  const started = performance.now();
  const text = validateInput({ queryText, languageCode, category, role, channel });
  const safety = safetyService.screen(text, { category });
  if (channel !== 'sms') eventBus.emit('transcript', { channel, phone, speaker: 'user', text });

  const history = sessionKey ? sessionService.toRagHistory(await sessionService.getHistory(sessionKey)) : [];

  // No category chosen (e.g. web voice without a category card) but the user named a scheme:
  // send that scheme's category as RAG's filter, so retrieval cannot drift to a neighbour
  // (seen live: "पीएम किसान" unfiltered ranked PMFBY first). RAG retries unfiltered on a weak hit.
  const ragCategory = category || matchCard(text)?.category || null;

  let rag = null;
  let ragError = null;
  if (!config.useMockAi) {
    const t0 = performance.now();
    try {
      rag = await ragClient.query({ query: text, language: languageCode, category: ragCategory, role, forVoice, history });
      eventBus.pipeline('chroma_rag_retrieved', performance.now() - t0, { channel, phone });
      // mode tells /live whether Groq really ran (llm) or RAG answered extractively.
      eventBus.pipeline('groq_llm_synthesized', rag.latency_ms ?? 0, { channel, phone, mode: rag.mode || null });
    } catch (err) {
      ragError = err;
      console.warn(`[agent] RAG unavailable, falling back: ${err.name === 'TimeoutError' ? 'timeout' : err.message}`);
    }
  }

  let answerText;
  let card = null;
  let matchedSchemeId = null;
  let sources;
  let source;
  if (rag) {
    // Emergencies and dose requests never get model text. RAG-04's own fixed safety answer
    // (returned with confidence 1.0, no LLM) is kept when it carries the required helpline;
    // anything else is replaced by the gateway's fixed text.
    const fixed = ['emergency', 'doseAgri', 'doseMedical'].includes(safety.kind);
    const ragAnswer = String(rag.answer || '');
    const ragSafetyOverride = rag.confidence >= 0.999 && ragAnswer.includes(REQUIRED_HELPLINE[safety.kind]);
    answerText = fixed && !ragSafetyOverride ? msg.SAFETY_ANSWERS[safety.kind][msg.langOf(languageCode)] : ragAnswer;
    matchedSchemeId = fixed ? null : rag.matched_scheme_id ?? null;
    card = seedSchemes.getByCode(matchedSchemeId);
    sources = (rag.sources || []).map(sourceRefFromRag);
    source = 'rag';
    // A scheme the user names explicitly wins over RAG's ranking (deterministic, R7); a named scheme
    // that is not one of the 13 cards gets "no verified information", never a neighbouring card.
    const named = fixed ? null : matchCard(text);
    if (named && named.code !== matchedSchemeId) {
      card = named;
      matchedSchemeId = named.code;
      answerText = cardAnswer(named, languageCode);
    } else if (!fixed && !named && card && SCHEME_WORD_RE.test(text)) {
      card = null;
      matchedSchemeId = null;
      answerText = msg.UNKNOWN_SCHEME[msg.langOf(languageCode)];
    }
    // A call must never speak only "details are sent by SMS": a closing-only RAG answer
    // (seen with reasoning LLMs whose token budget runs out) is rebuilt from the scheme card.
    if (!fixed && isClosingOnly(answerText)) {
      if (card) {
        answerText = cardAnswer(card, languageCode);
        source = 'fallback';
      } else {
        ({ answerText, card, source } = degradedAnswer(text, { languageCode, category, safety, forVoice }));
      }
      matchedSchemeId = card ? card.code : null;
      ragError = new Error('RAG returned a closing-only answer');
    }
  } else {
    ({ answerText, card, sources, source } = degradedAnswer(text, { languageCode, category, safety, forVoice, cacheFirst: config.useMockAi }));
    matchedSchemeId = card ? card.code : null;
  }
  if (forVoice) answerText = voiceSafe(answerText);

  // R5: the receipt is the seed card text verbatim, never RAG or model text.
  const smsReceipt = smsReceiptFor(card, languageCode);
  if (smsReceipt && deliverSms) smsReceipt.delivery = await deliverSms(smsReceipt.smsReceiptText);

  const answer = {
    answerText,
    languageCode,
    category: category || card?.category || null,
    matchedSchemeId,
    sources,
    smsReceipt,
    safety: safetyService.toSafety(safety),
    source,
    latencyMs: Math.round(performance.now() - started),
  };

  if (channel !== 'sms') eventBus.emit('transcript', { channel, phone, speaker: 'assistant', text: answerText, source });

  if (persist && sessionKey) {
    await sessionService.appendTurns(sessionKey, [
      { channel, speaker: 'user', text, category: answer.category, language: languageCode },
      { channel, speaker: 'assistant', text: answerText, category: answer.category, language: languageCode },
    ], { phone });
  }
  // Logs never delay the reply (logCallOrSms swallows its own errors).
  dbAdapter.logCallOrSms({
    sessionKey, phone, channel, eventType: { fallback: 'fallback', cache: 'cache_hit' }[source] || 'answer',
    detail: { matchedSchemeId: answer.matchedSchemeId, source, safety: answer.safety.flagged, ragError: ragError?.message ?? null },
    latencyMs: answer.latencyMs,
  });
  // On the SMS channel the reply itself is the SMS; the parser logs sms_out.
  if (smsReceipt && channel !== 'sms') {
    dbAdapter.logCallOrSms({ sessionKey, phone, channel, eventType: 'sms_receipt', detail: { text: smsReceipt.smsReceiptText, delivery: smsReceipt.delivery } });
    eventBus.pipeline('sms_receipt_dispatched', 0, { channel, phone, text: smsReceipt.smsReceiptText });
  }
  return answer;
}

// SMS free text (B-05 hook): reply = matched card sms_summary (<=160, has portal + helpline),
// else the spoken-style answer clipped to maxChars. Turns are persisted by the SMS parser.
async function answerForSms({ queryText, languageCode, sessionKey, maxChars = config.smsMaxChars }) {
  const answer = await answerQuery({
    queryText, languageCode, channel: 'sms', sessionKey, phone: sessionKey, forVoice: true, persist: false,
  });
  // Safety replies must keep their helpline inside one SMS: use the short fixed text (all <=160).
  const kind = safetyService.screen(queryText).kind;
  if (kind) return { replyText: msg.SAFETY_ANSWERS[kind][msg.langOf(languageCode)], matchedSchemeId: null };
  const replyText = answer.smsReceipt?.smsReceiptText
    || (Array.from(answer.answerText).length <= maxChars ? answer.answerText : `${Array.from(answer.answerText).slice(0, maxChars - 1).join('')}…`);
  return { replyText, matchedSchemeId: answer.matchedSchemeId };
}

module.exports = { answerQuery, answerForSms, voiceSafe };
