const { test } = require('node:test');
const assert = require('node:assert/strict');
const { localizeTerms } = require('../src/config/glossary');

// DEC-20: answers in Hindi / Marathi / Gujarati / Tamil carry no leftover English abbreviations.
test('Hindi: abbreviations become Hindi words, no duplicated word, no empty brackets', () => {
  const out = localizeTerms('NSP पोर्टल पर OTR करें। CSC जाएं, eKYC कराएं। वेबसाइट () देखें।', 'hi-IN');
  assert.equal(out, 'राष्ट्रीय छात्रवृत्ति पोर्टल पर एक बार पंजीकरण करें। जन सेवा केंद्र जाएं, ई-केवाईसी कराएं। वेबसाइट देखें।');
  assert.doesNotMatch(out, /[A-Za-z]/);
});

test('Gujarati and Marathi use their own words; "X (X)" collapses', () => {
  assert.equal(localizeTerms('One Time Registration (OTR) કરો, CSC પર જાઓ.', 'gu-IN'), 'એક વખત નોંધણી કરો, જન સેવા કેન્દ્ર પર જાઓ.');
  assert.equal(localizeTerms('कृषी विज्ञान केंद्र (KVK) शी संपर्क साधा.', 'mr-IN'), 'कृषी विज्ञान केंद्र शी संपर्क साधा.');
});

test('English answers, normal repetition and URLs are left alone', () => {
  assert.equal(localizeTerms('Visit the CSC.', 'en-IN'), 'Visit the CSC.');
  assert.equal(localizeTerms('धीरे धीरे बोलें।', 'hi-IN'), 'धीरे धीरे बोलें।');
  assert.equal(localizeTerms('pmkisan.gov.in पर जाएं।', 'hi-IN'), 'pmkisan.gov.in पर जाएं।');
});
