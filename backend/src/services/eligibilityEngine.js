const dbAdapter = require('../adapters/dbAdapter');
const { toSchemeView, localName } = require('./schemeView');
const msg = require('../config/messages');

// Loophole #4 / R4: eligibility is decided ONLY by the deterministic `rules` of each
// seed card. No LLM is called here. A rule whose profile field is unknown never counts
// as passed: the scheme goes to ineligibleSchemes with a "tell us ..." reason.

function evaluateRules(rules = {}, profile = {}) {
  const failures = []; // [{key, vars}]
  const missing = []; // profile fields we need to decide
  const has = (f) => profile[f] !== null && profile[f] !== undefined;

  if (Array.isArray(rules.occupations) && rules.occupations.length) {
    if (!has('occupation')) missing.push('occupation');
    else if (!rules.occupations.includes(profile.occupation)) failures.push({ key: 'occupation', vars: { list: rules.occupations } });
  }
  if (rules.max_land_hectares != null) {
    if (!has('land_hectares')) missing.push('land_hectares');
    else if (profile.land_hectares > rules.max_land_hectares) failures.push({ key: 'land', vars: { max: rules.max_land_hectares } });
  }
  if (rules.bpl_only) {
    if (!has('bpl')) missing.push('bpl');
    else if (profile.bpl !== true) failures.push({ key: 'bpl' });
  }
  if (rules.gender) {
    if (!has('gender')) missing.push('gender');
    else if (profile.gender !== rules.gender) failures.push({ key: rules.gender === 'female' ? 'female' : 'male' });
  }
  if (rules.pregnant_only) {
    if (has('gender') && profile.gender !== 'female') failures.push({ key: 'pregnant' });
    else if (!has('pregnant')) missing.push('pregnant');
    else if (profile.pregnant !== true) failures.push({ key: 'pregnant' });
  }
  if (rules.min_age != null || rules.max_age != null) {
    if (!has('age')) missing.push('age');
    else {
      if (rules.min_age != null && profile.age < rules.min_age) failures.push({ key: 'min_age', vars: { n: rules.min_age } });
      if (rules.max_age != null && profile.age > rules.max_age) failures.push({ key: 'max_age', vars: { n: rules.max_age } });
    }
  }
  if (rules.max_annual_income != null) {
    if (!has('annual_income')) missing.push('annual_income');
    else if (profile.annual_income > rules.max_annual_income) failures.push({ key: 'income', vars: { n: rules.max_annual_income } });
  }
  if (Array.isArray(rules.social_categories) && rules.social_categories.length) {
    if (!has('social_category')) missing.push('social_category');
    else if (!rules.social_categories.includes(profile.social_category)) failures.push({ key: 'social', vars: { list: rules.social_categories } });
  }
  return { eligible: failures.length === 0 && missing.length === 0, failures, missing: [...new Set(missing)] };
}

function reasonText({ failures, missing }, languageCode) {
  const lang = msg.langOf(languageCode);
  const t = msg.REASONS[lang];
  if (failures.length) {
    return failures.map(({ key, vars = {} }) => {
      const v = { ...vars };
      if (key === 'occupation') v.list = vars.list.map((o) => msg.OCCUPATION_LABELS[lang][o] || o).join(', ');
      if (key === 'social') v.list = vars.list.map((c) => msg.SOCIAL_LABELS[c] || c).join(', ');
      if (key === 'income') v.n = msg.formatInr(vars.n);
      return msg.fill(t[key], v);
    }).join(t.sep);
  }
  const fields = missing.map((f) => msg.FIELD_LABELS[lang][f] || f).join(', ');
  return msg.fill(t.missing, { list: fields });
}

// checkEligibility(profile (partial ok, sanitized), languageCode)
//   -> {eligibleSchemes:[SchemeView], ineligibleSchemes:[{scheme, reason}], totalMatched, recommendedAction}
async function checkEligibility(profile = {}, languageCode = 'hi-IN') {
  const cards = await dbAdapter.getAllSchemes();
  const eligible = [];
  const ineligibleSchemes = [];
  for (const card of cards) {
    const result = evaluateRules(card.rules, profile);
    if (result.eligible) eligible.push(card);
    else ineligibleSchemes.push({ scheme: toSchemeView(card, languageCode), reason: reasonText(result, languageCode) });
  }
  // Schemes aimed at the user's role first; seed order otherwise (stable sort).
  if (profile.role) eligible.sort((a, b) => (b.target_role === profile.role) - (a.target_role === profile.role));

  const lang = msg.langOf(languageCode);
  const recommendedAction = eligible.length
    ? msg.fill(msg.RECOMMENDED_ACTION[lang].some, { n: eligible.length, first: localName(eligible[0], languageCode) })
    : msg.RECOMMENDED_ACTION[lang].none;

  return {
    eligibleSchemes: eligible.map((c) => toSchemeView(c, languageCode)),
    ineligibleSchemes,
    totalMatched: eligible.length,
    recommendedAction,
  };
}

module.exports = { checkEligibility, evaluateRules, reasonText };
