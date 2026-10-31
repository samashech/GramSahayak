// Whisper "prompt" per language: domain words the recogniser should prefer (scheme names, crops, pests).
// Without it Marathi pest names came out garbled; with it the transcript matched. Rules:
//  - plain vocabulary only (no instructions);
//  - NEVER safety-trigger words (snake bite, danger signs, pesticide): Whisper can echo the prompt on
//    unclear audio, and an echoed emergency word would trigger a false emergency answer.
// groqSttService also rejects transcripts that echo this list.
module.exports = {
  'hi-IN': 'पीएम किसान योजना, फसल बीमा, किसान क्रेडिट कार्ड, आयुष्मान भारत, जननी सुरक्षा योजना, मनरेगा, उज्ज्वला, नेशनल स्कॉलरशिप पोर्टल, छात्रवृत्ति, पात्र, गेहूं, पीला रतुआ, कपास',
  'mr-IN': 'पीएम किसान योजना, पीक विमा, किसान क्रेडिट कार्ड, आयुष्मान भारत, जननी सुरक्षा योजना, नॅशनल स्कॉलरशिप पोर्टल, शिष्यवृत्ती, पात्र, कापूस, कापसावर गुलाबी बोंडअळी, गव्हावर तांबेरा, काय करावे',
  'ta-IN': 'பிஎம் கிசான் திட்டம், பயிர் காப்பீடு, ஆயுஷ்மான் பாரத், ஜனனி சுரக்ஷா யோஜனா திட்டம், தேசிய உதவித்தொகை இணையதளம், பருத்தி, எவ்வளவு பணம் கிடைக்கும்',
  'en-IN': 'PM-KISAN, PMFBY crop insurance, Kisan Credit Card, Ayushman Bharat, Janani Suraksha Yojana, MGNREGA, Ujjwala, National Scholarship Portal, eligible, wheat yellow rust, cotton pink bollworm',
};
