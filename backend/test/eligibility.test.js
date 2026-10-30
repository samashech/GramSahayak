const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestEnv, startApp } = require('./helpers');

const env = setupTestEnv();
const { checkEligibility, evaluateRules } = require('../src/services/eligibilityEngine');

let app;
before(async () => { app = await startApp(); });
after(async () => { await app.close(); env.cleanup(); });

// Appendix G6: farmer, 1.0 ha, BPL yes, 35, female, not pregnant, income 90000, obc
const G6 = { occupation: 'farmer', land_hectares: 1.0, bpl: true, age: 35, gender: 'female', pregnant: false, annual_income: 90000, social_category: 'obc' };

test('G6: deterministic result matches the seed rules', async () => {
  const r = await checkEligibility(G6, 'hi-IN');
  const eligible = r.eligibleSchemes.map((s) => s.code);
  for (const code of ['PMKISAN', 'PMJAY', 'UJJWALA', 'MGNREGA', 'PMAY']) assert.ok(eligible.includes(code), code);
  assert.deepEqual(eligible.sort(), ['KCC', 'MGNREGA', 'PMAY', 'PMFBY', 'PMJAY', 'PMKISAN', 'SHC', 'UJJWALA']);
  const reasons = Object.fromEntries(r.ineligibleSchemes.map((x) => [x.scheme.code, x.reason]));
  assert.equal(reasons.JSY, 'केवल गर्भवती महिलाओं के लिए');
  assert.equal(reasons.PMMVY, 'केवल गर्भवती महिलाओं के लिए');
  assert.equal(reasons.NSP, 'केवल छात्र के लिए');
  assert.equal(r.totalMatched, 8);
  assert.match(r.recommendedAction, /^आप 8 योजनाओं/);
  assert.equal(r.eligibleSchemes[0].name, 'प्रधानमंत्री किसान सम्मान निधि');
  assert.equal(r.eligibleSchemes[0].smsSummary.includes('pmkisan.gov.in'), true);
});

test('same profile is checked identically in every language; only the text changes', async () => {
  const codes = async (lang) => (await checkEligibility(G6, lang)).eligibleSchemes.map((s) => s.code).sort();
  const hi = await codes('hi-IN');
  for (const lang of ['mr-IN', 'ta-IN', 'en-IN', 'te-IN']) assert.deepEqual(await codes(lang), hi);
  const ta = await checkEligibility(G6, 'ta-IN');
  assert.match(ta.ineligibleSchemes.find((x) => x.scheme.code === 'JSY').reason, /கர்ப்பிணி/);
  const te = await checkEligibility(G6, 'te-IN');
  assert.equal(te.ineligibleSchemes.find((x) => x.scheme.code === 'JSY').reason, 'Only for pregnant women');
});

test('unknown fields never count as eligible; reason asks for the missing data', async () => {
  const r = await checkEligibility({ occupation: 'farmer' }, 'en-IN');
  const pmkisan = r.ineligibleSchemes.find((x) => x.scheme.code === 'PMKISAN');
  assert.equal(pmkisan.reason, 'Tell us your age to check this scheme');
  assert.ok(r.eligibleSchemes.some((s) => s.code === 'SHC'), 'SHC needs only occupation');
  const empty = await checkEligibility({}, 'en-IN');
  assert.equal(empty.totalMatched, 0);
  assert.match(empty.recommendedAction, /^No scheme matched/);
});

test('rule edges: income, age, social category, gender, land', () => {
  const rules = { occupations: ['student'], max_annual_income: 250000, social_categories: ['obc'], min_age: null, max_age: null, gender: null, bpl_only: false, pregnant_only: false, max_land_hectares: null };
  const base = { occupation: 'student', annual_income: 250000, social_category: 'obc' };
  assert.equal(evaluateRules(rules, base).eligible, true, 'limit is inclusive');
  assert.deepEqual(evaluateRules(rules, { ...base, annual_income: 250001 }).failures.map((f) => f.key), ['income']);
  assert.deepEqual(evaluateRules(rules, { ...base, social_category: 'sc' }).failures.map((f) => f.key), ['social']);
  assert.deepEqual(evaluateRules({ gender: 'female' }, { gender: 'male' }).failures.map((f) => f.key), ['female']);
  assert.deepEqual(evaluateRules({ max_land_hectares: 2 }, { land_hectares: 2.5 }).failures.map((f) => f.key), ['land']);
  assert.deepEqual(evaluateRules({ min_age: 18, max_age: 75 }, { age: 80 }).failures.map((f) => f.key), ['max_age']);
  // pregnant_only for a man: decided without asking about pregnancy
  assert.deepEqual(evaluateRules({ pregnant_only: true }, { gender: 'male' }), { eligible: false, failures: [{ key: 'pregnant' }], missing: [] });
});

test('demo personas: Ramesh gets farmer schemes first, Priya gets scholarships', async () => {
  const ramesh = await app.call('POST', '/api/eligibility', { headers: { 'x-demo-user': 'farmer-hi' }, body: {} });
  assert.equal(ramesh.status, 200);
  assert.equal(ramesh.json.data.eligibleSchemes[0].targetRole, 'farmer');
  assert.ok(!ramesh.json.data.eligibleSchemes.some((s) => s.code === 'UJJWALA'), 'UJJWALA is for women');
  const priya = await app.call('POST', '/api/eligibility', { headers: { 'x-demo-user': 'student-hi' }, body: {} });
  const codes = priya.json.data.eligibleSchemes.map((s) => s.code);
  for (const c of ['NSP', 'PMYASASVI', 'PRAGATI']) assert.ok(codes.includes(c), c);
  assert.ok(!codes.includes('MGNREGA'), 'age 16 < 18');
});

test('POST /api/eligibility validates profile and languageCode', async () => {
  assert.equal((await app.call('POST', '/api/eligibility', { body: { profile: { age: 'old' } } })).status, 400);
  assert.equal((await app.call('POST', '/api/eligibility', { body: { profile: G6, languageCode: 'xx-IN' } })).status, 400);
  const ok = await app.call('POST', '/api/eligibility', { body: { profile: G6, languageCode: 'mr-IN' } });
  assert.equal(ok.json.data.eligibleSchemes[0].name, 'प्रधानमंत्री किसान सन्मान निधी');
});

test('GET /api/schemes filters by category and localises', async () => {
  const { json } = await app.call('GET', '/api/schemes?category=health&languageCode=ta-IN');
  assert.deepEqual(json.data.schemes.map((s) => s.code), ['PMJAY', 'JSY', 'PMMVY']);
  const jsy = json.data.schemes[1];
  assert.deepEqual(Object.keys(jsy), ['id', 'code', 'name', 'category', 'targetRole', 'benefits', 'eligibility', 'documents', 'howToApply', 'helpline', 'portalUrl', 'smsSummary']);
  assert.equal(jsy.name, 'ஜனனி சுரக்ஷா யோஜனா');
  assert.match(jsy.smsSummary, /nhm\.gov\.in/);
  assert.equal((await app.call('GET', '/api/schemes')).json.data.schemes.length, 13);
  assert.equal((await app.call('GET', '/api/schemes?category=sports')).status, 400);
});
