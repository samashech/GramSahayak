// Scheme card (snake_case seed entity) -> SchemeView (camelCase, contract section 6).
// benefits/eligibility/documents stay English from the seed; Sarvam translation is a later step.

const NAME_FIELD = { 'hi-IN': 'name_hi', 'mr-IN': 'name_mr', 'ta-IN': 'name_ta' };

function localName(card, languageCode) {
  return card[NAME_FIELD[languageCode]] || card.name_en;
}

// R5: always the card text, verbatim, in the requested language (else en-IN).
function smsSummaryFor(card, languageCode) {
  const s = card.sms_summary || {};
  return s[languageCode] || s['en-IN'] || null;
}

function toSchemeView(card, languageCode) {
  return {
    id: card.id,
    code: card.code,
    name: localName(card, languageCode),
    category: card.category,
    targetRole: card.target_role,
    benefits: card.benefits,
    eligibility: card.eligibility,
    documents: Array.isArray(card.documents) ? card.documents.slice() : [],
    howToApply: card.how_to_apply,
    helpline: card.helpline,
    portalUrl: card.portal_url,
    smsSummary: smsSummaryFor(card, languageCode),
  };
}

module.exports = { toSchemeView, localName, smsSummaryFor };
