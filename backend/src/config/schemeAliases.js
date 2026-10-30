// Search terms people actually type or say for each scheme (not scheme facts; facts live in
// /data/seed). Used for deterministic local matching when RAG is down and for SMS free text.
// Card names (name_en/hi/mr/ta) and the code are matched in addition to these.
module.exports = {
  PMKISAN: ['pm kisan', 'pm-kisan', 'kisan samman', 'पीएम किसान', 'पीएम-किसान', 'किसान सम्मान', 'किसान सन्मान', 'பிஎம் கிசான்', 'பிஎம்-கிசான்', 'கிசான் சம்மான்'],
  PMFBY: ['fasal bima', 'crop insurance', 'फसल बीमा', 'पीक विमा', 'பயிர் காப்பீடு'],
  KCC: ['kisan credit', 'किसान क्रेडिट', 'கிசான் கடன் அட்டை'],
  SHC: ['soil health', 'मृदा स्वास्थ्य', 'मृदा आरोग्य', 'मिट्टी की जांच', 'மண் வள'],
  PMJAY: ['ayushman', 'आयुष्मान', 'ஆயுஷ்மான்'],
  JSY: ['janani suraksha', 'जननी सुरक्षा', 'ஜனனி சுரக்ஷா'],
  PMMVY: ['matru vandana', 'मातृ वंदना', 'மாத்ரு வந்தனா'],
  MGNREGA: ['nrega', 'mnrega', 'मनरेगा', 'नरेगा', 'रोजगार गारंटी', 'रोजगार हमी', '100 நாள் வேலை'],
  UJJWALA: ['ujjwala', 'pmuy', 'उज्ज्वला', 'உஜ்வாலா'],
  PMAY: ['awas yojana', 'आवास योजना', 'घरकुल', 'வீட்டு வசதி'],
  NSP: ['national scholarship', 'scholarship portal', 'नेशनल स्कॉलरशिप', 'नॅशनल स्कॉलरशिप', 'राष्ट्रीय शिष्यवृत्ती', 'राष्ट्रीय छात्रवृत्ति', 'शिष्यवृत्ती पोर्टल', 'தேசிய உதவித்தொகை'],
  PMYASASVI: ['yasasvi', 'यशस्वी', 'யசஸ்வி'],
  PRAGATI: ['pragati', 'प्रगति', 'प्रगती', 'பிரகதி'],
};
