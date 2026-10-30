// Phrases that make the gateway flag Safety (contract section 6) and, for emergencies and dose
// requests, answer with a fixed safe text instead of model output. Mirrors the RAG-04 rules so the
// web, IVR and SMS channels stay safe even when the RAG service or its guardrails are down.
// A bare word like "सांप" (snake) is NOT enough: phrases describe an event or a request.
// Lead reviews and extends these lists (LD-04).

module.exports = {
  // Act now: call 108 (no model answer).
  emergency: [
    // snake bite
    'सांप ने काट', 'साँप ने काट', 'सांप काट', 'साँप काट', 'सर्पदंश',
    'साप चावला', 'सापाने चावले', 'साप चावल',
    'பாம்பு கடி', 'பாம்பு கடித்',
    'snake bite', 'snakebite', 'bitten by a snake', 'snake bit',
    // unconscious, chest pain, poisoning, breathing
    'बेहोश', 'सीने में तेज दर्द', 'सीने में दर्द', 'जहर खा', 'ज़हर खा', 'कीटनाशक पी', 'सांस नहीं',
    'बेशुद्ध', 'छातीत दुखत', 'विष प्याय', 'कीटकनाशक प्याय', 'श्वास घेता येत नाही',
    'மயக்கம்', 'நெஞ்சு வலி', 'விஷம் குடித்', 'பூச்சிக்கொல்லி குடித்', 'மூச்சு விட முடியவில்லை',
    'unconscious', 'chest pain', 'swallowed pesticide', 'drank pesticide', 'consumed poison', 'not breathing',
  ],
  // Pregnancy danger signs: answer from RAG (it lists the signs) but always flag 108 / 102.
  pregnancy: [
    'खतरे के लक्षण', 'खतरनाक लक्षण', 'खून बह', 'रक्तस्राव', 'दौरा पड़', 'झटके आ', 'बच्चा हिल नहीं', 'हलचल नहीं', 'हलचल कम',
    'धोक्याची लक्षणे', 'रक्तस्त्राव', 'झटके येत', 'बाळाची हालचाल',
    'ஆபத்தான அறிகுறி', 'ஆபத்து அறிகுறி', 'இரத்தப்போக்கு', 'ரத்தப்போக்கு', 'வலிப்பு', 'அசைவு இல்லை', 'அசைவு குறைவு',
    'danger sign', 'bleeding', 'convulsion', 'baby not moving', 'no fetal movement', 'reduced fetal movement',
  ],
  // Dose or quantity requests: fixed refusal (no model answer).
  dose: [
    'कितना डालें', 'कितना डाले', 'कितनी मात्रा', 'खुराक', 'कितना छिड़क', 'कितनी गोली',
    'किती टाकू', 'किती टाकावे', 'किती फवार', 'डोस',
    'எவ்வளவு தெளிக்க', 'எவ்வளவு போட', 'எத்தனை மாத்திரை', 'டோஸ்',
    'how much pesticide', 'dose', 'dosage', 'how many ml', 'how many tablets',
  ],
  // Words that make a dose request an agriculture one (Kisan Call Centre) instead of medical (104).
  agriContext: [
    'कीटनाशक', 'दवा छिड़क', 'छिड़काव', 'कीटकनाशक', 'फवारणी', 'பூச்சிக்கொல்லி', 'தெளி', 'pesticide', 'spray', 'insecticide', 'fungicide',
  ],
};
