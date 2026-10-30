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
const { localName, smsSummaryFor } = require('./schemeView');

// B-06: one agent brain for web, IVR and SMS (Loopholes #1, #2, #3, #7).
//   1. deterministic safety screen (fixed answers for emergencies and dose requests)
//   2. POST {AI_RAG_URL}/rag/query with the regional text as-is (R6), 4000 ms timeout
//   3. on failure or USE_MOCK_AI: local scheme-card match, else a fixed "no verified info" answer
//   4. call-to-SMS receipt = matched seed card sms_summary, verbatim (R5)
// Returns AnswerData (contract section 6).

const MAX_QUERY_CHARS = 2000;
const DOMAIN_RE = /\s*\b(?:https?:\/\/)?[\w.-]+\.(?:gov|nic|org|com)\.in\b\S*/gi;

const sourceRefFromRag = (s) => ({
  id: s.id, title: s.title, category: s.category, helpline: s.helpline, portalUrl: s.portal,
});

const sourceRefFromCard = (card, languageCode) => ({
  id: card.code, title: localName(card, languageCode), category: card.category,
  helpline: card.helpline, portalUrl: card.portal_url,
});

// Spoken text must not carry URLs (contract section 6); the SMS receipt carries them.
function voiceSafe(text) {
  return text.replace(DOMAIN_RE, '').replace(/\s{2,}/g, ' ').trim();
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

function fallbackAnswer(queryText, { languageCode, category, safety }) {
  const lang = msg.langOf(languageCode);
  if (safety.kind && msg.SAFETY_ANSWERS[safety.kind]) {
    return { answerText: msg.SAFETY_ANSWERS[safety.kind][lang], card: null };
  }
  const card = matchCard(queryText, { category }) || matchCard(queryText);
  if (card) {
    const summary = voiceSafe(smsSummaryFor(card, languageCode) || '');
    const name = localName(card, languageCode);
    // Card summaries start with their own short label ("पीएम-किसान: ..."); add the name only if not.
    const labelled = summary.includes(name) || /^[^:]{2,40}:/.test(summary);
    const lead = labelled ? summary : `${name}: ${summary}`;
    return { answerText: `${lead} ${msg.SMS_CLOSING[lang]}`, card };
  }
  return { answerText: msg.NO_VERIFIED_INFO[lang], card: null };
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

  const history = sessionKey ? sessionService.toRagHistory(await sessionService.getHistory(sessionKey)) : [];

  let rag = null;
  let ragError = null;
  if (!config.useMockAi) {
    const t0 = performance.now();
    try {
      rag = await ragClient.query({ query: text, language: languageCode, category, role, forVoice, history });
      eventBus.pipeline('chroma_rag_retrieved', performance.now() - t0, { channel, phone });
      eventBus.pipeline('groq_llm_synthesized', rag.latency_ms ?? 0, { channel, phone });
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
    // Emergencies and dose requests always get the fixed safe text, even when RAG answers.
    const fixed = ['emergency', 'doseAgri', 'doseMedical'].includes(safety.kind);
    answerText = fixed ? msg.SAFETY_ANSWERS[safety.kind][msg.langOf(languageCode)] : String(rag.answer || '');
    matchedSchemeId = fixed ? null : rag.matched_scheme_id ?? null;
    card = seedSchemes.getByCode(matchedSchemeId);
    sources = (rag.sources || []).map(sourceRefFromRag);
    source = 'rag';
  } else {
    ({ answerText, card } = fallbackAnswer(text, { languageCode, category, safety }));
    matchedSchemeId = card ? card.code : null;
    sources = card ? [sourceRefFromCard(card, languageCode)] : [];
    source = 'fallback';
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

  if (persist && sessionKey) {
    await sessionService.appendTurn(sessionKey, { channel, speaker: 'user', text, category: answer.category, language: languageCode }, { phone });
    await sessionService.appendTurn(sessionKey, { channel, speaker: 'assistant', text: answerText, category: answer.category, language: languageCode }, { phone });
  }
  await dbAdapter.logCallOrSms({
    sessionKey, phone, channel, eventType: source === 'fallback' ? 'fallback' : 'answer',
    detail: { matchedSchemeId: answer.matchedSchemeId, source, safety: answer.safety.flagged, ragError: ragError?.message ?? null },
    latencyMs: answer.latencyMs,
  });
  // On the SMS channel the reply itself is the SMS; the parser logs sms_out.
  if (smsReceipt && channel !== 'sms') {
    await dbAdapter.logCallOrSms({ sessionKey, phone, channel, eventType: 'sms_receipt', detail: { text: smsReceipt.smsReceiptText, delivery: smsReceipt.delivery } });
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
  const replyText = answer.smsReceipt?.smsReceiptText
    || (Array.from(answer.answerText).length <= maxChars ? answer.answerText : `${Array.from(answer.answerText).slice(0, maxChars - 1).join('')}…`);
  return { replyText, matchedSchemeId: answer.matchedSchemeId };
}

module.exports = { answerQuery, answerForSms, voiceSafe };
