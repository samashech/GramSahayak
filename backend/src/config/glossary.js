// Leftover English abbreviations in an answer -> words a rural listener knows, per language (DEC-20).
// The RAG prompt already asks for pure Hindi / Marathi / Gujarati / Tamil; this is the deterministic
// safety net for model slips and for card text spoken as an answer. SMS receipts are never touched (R5).
const TERMS = {
  'hi-IN': {
    'One Time Registration': 'एक बार पंजीकरण',
    CSC: 'जन सेवा केंद्र', KVK: 'कृषि विज्ञान केंद्र', NSP: 'राष्ट्रीय छात्रवृत्ति पोर्टल', OTR: 'एक बार पंजीकरण',
    eKYC: 'ई-केवाईसी', KYC: 'केवाईसी', ASHA: 'आशा दीदी', ANM: 'एएनएम दीदी', SMS: 'एसएमएस', OTP: 'ओटीपी',
    IPM: 'समन्वित कीट प्रबंधन', PHC: 'प्राथमिक स्वास्थ्य केंद्र', BPL: 'गरीबी रेखा', DBT: 'सीधे खाते में भुगतान',
    PMFBY: 'प्रधानमंत्री फसल बीमा योजना', KCC: 'किसान क्रेडिट कार्ड',
  },
  'mr-IN': {
    'One Time Registration': 'एकदाच नोंदणी',
    CSC: 'सेवा केंद्र', KVK: 'कृषी विज्ञान केंद्र', NSP: 'राष्ट्रीय शिष्यवृत्ती पोर्टल', OTR: 'एकदाच नोंदणी',
    eKYC: 'ई-केवायसी', KYC: 'केवायसी', ASHA: 'आशा ताई', ANM: 'एएनएम ताई', SMS: 'एसएमएस', OTP: 'ओटीपी',
    IPM: 'एकात्मिक कीड व्यवस्थापन', PHC: 'प्राथमिक आरोग्य केंद्र', BPL: 'दारिद्र्य रेषा', DBT: 'थेट खात्यात पैसे',
    PMFBY: 'प्रधानमंत्री पीक विमा योजना', KCC: 'किसान क्रेडिट कार्ड',
  },
  'gu-IN': {
    'One Time Registration': 'એક વખત નોંધણી',
    CSC: 'જન સેવા કેન્દ્ર', KVK: 'કૃષિ વિજ્ઞાન કેન્દ્ર', NSP: 'રાષ્ટ્રીય શિષ્યવૃત્તિ પોર્ટલ', OTR: 'એક વખત નોંધણી',
    eKYC: 'ઈ-કેવાયસી', KYC: 'કેવાયસી', ASHA: 'આશા બહેન', ANM: 'એએનએમ બહેન', SMS: 'એસએમએસ', OTP: 'ઓટીપી',
    IPM: 'સંકલિત જીવાત વ્યવસ્થાપન', PHC: 'પ્રાથમિક આરોગ્ય કેન્દ્ર', BPL: 'ગરીબી રેખા', DBT: 'સીધા ખાતામાં પૈસા',
    PMFBY: 'પ્રધાનમંત્રી પાક વીમા યોજના', KCC: 'કિસાન ક્રેડિટ કાર્ડ',
  },
  'ta-IN': {
    CSC: 'பொது சேவை மையம்', KVK: 'வேளாண் அறிவியல் நிலையம்', SMS: 'குறுஞ்செய்தி', OTP: 'ஓடிபி',
    ASHA: 'ஆஷா பணியாளர்', PHC: 'ஆரம்ப சுகாதார நிலையம்', BPL: 'வறுமைக் கோட்டுக்குக் கீழ்',
  },
};

const PATTERNS = Object.fromEntries(Object.entries(TERMS).map(([lang, map]) => [
  lang,
  // Longest first so "eKYC" wins over "KYC"; Latin-only word boundaries (Indic letters are not \w).
  Object.keys(map).sort((a, b) => b.length - a.length).map((k) => [new RegExp(`(?<![A-Za-z])${k}(?![A-Za-z])`, 'gi'), map[k]]),
]));

function localizeTerms(text, languageCode) {
  const patterns = PATTERNS[languageCode];
  if (!patterns || !text) return text;
  let out = text;
  for (const [re, word] of patterns) {
    if (!re.test(out)) continue;
    re.lastIndex = 0;
    out = out.replace(re, word);
    // "NSP पोर्टल" -> "...पोर्टल पोर्टल": drop the word the expansion now repeats.
    const last = word.split(' ').pop();
    if (last !== word) out = out.replaceAll(`${last} ${last}`, last);
  }
  // A term already followed by its own abbreviation, e.g. "कृषि विज्ञान केंद्र (कृषि विज्ञान केंद्र)".
  out = out.replace(/([^\s()]+(?:\s[^\s()]+){0,3})\s*\(\s*\1\s*\)/g, '$1');
  return out.replace(/\(\s*\)/g, '').replace(/\s+([,.।])/g, '$1').replace(/\s{2,}/g, ' ').trim();
}

module.exports = { localizeTerms, TERMS };
