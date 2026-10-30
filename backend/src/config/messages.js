// Fixed, human-written UI/SMS strings for hi-IN, mr-IN, ta-IN, en-IN (never LLM-written).
// Other languages fall back to en-IN. Marathi and Tamil need a native-speaker check (LD-02).

const SUPPORTED = ['en-IN', 'hi-IN', 'mr-IN', 'ta-IN'];
const langOf = (languageCode) => (SUPPORTED.includes(languageCode) ? languageCode : 'en-IN');

const fill = (template, vars = {}) => template.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));

const formatInr = (n) => Number(n).toLocaleString('en-IN');

// ---- Eligibility reasons (B-05) ----
const REASONS = {
  'en-IN': {
    occupation: 'Only for {list}',
    land: 'Land must be at most {max} hectares',
    bpl: 'Only for BPL families',
    female: 'Only for women',
    male: 'Only for men',
    pregnant: 'Only for pregnant women',
    min_age: 'Minimum age is {n} years',
    max_age: 'Maximum age is {n} years',
    income: 'Family income must be at most Rs {n} per year',
    social: 'Only for {list} categories',
    missing: 'Tell us your {list} to check this scheme',
    sep: '; ',
  },
  'hi-IN': {
    occupation: 'केवल {list} के लिए',
    land: 'ज़मीन अधिकतम {max} हेक्टेयर होनी चाहिए',
    bpl: 'केवल BPL परिवारों के लिए',
    female: 'केवल महिलाओं के लिए',
    male: 'केवल पुरुषों के लिए',
    pregnant: 'केवल गर्भवती महिलाओं के लिए',
    min_age: 'न्यूनतम आयु {n} वर्ष',
    max_age: 'अधिकतम आयु {n} वर्ष',
    income: 'पारिवारिक आय ₹{n}/वर्ष से अधिक नहीं होनी चाहिए',
    social: 'केवल {list} वर्ग के लिए',
    missing: 'इस योजना की जांच के लिए बताएं: {list}',
    sep: '; ',
  },
  'mr-IN': {
    occupation: 'फक्त {list} साठी',
    land: 'जमीन जास्तीत जास्त {max} हेक्टर असावी',
    bpl: 'फक्त BPL कुटुंबांसाठी',
    female: 'फक्त महिलांसाठी',
    male: 'फक्त पुरुषांसाठी',
    pregnant: 'फक्त गर्भवती महिलांसाठी',
    min_age: 'किमान वय {n} वर्षे',
    max_age: 'कमाल वय {n} वर्षे',
    income: 'कौटुंबिक उत्पन्न ₹{n}/वर्ष पेक्षा जास्त नसावे',
    social: 'फक्त {list} प्रवर्गासाठी',
    missing: 'या योजनेच्या तपासणीसाठी सांगा: {list}',
    sep: '; ',
  },
  'ta-IN': {
    occupation: '{list} மட்டும்',
    land: 'நிலம் அதிகபட்சம் {max} ஹெக்டேர் இருக்க வேண்டும்',
    bpl: 'வறுமைக் கோட்டுக்குக் கீழ் (BPL) உள்ள குடும்பங்களுக்கு மட்டும்',
    female: 'பெண்களுக்கு மட்டும்',
    male: 'ஆண்களுக்கு மட்டும்',
    pregnant: 'கர்ப்பிணிப் பெண்களுக்கு மட்டும்',
    min_age: 'குறைந்தபட்ச வயது {n}',
    max_age: 'அதிகபட்ச வயது {n}',
    income: 'குடும்ப வருமானம் ஆண்டுக்கு ₹{n} க்கு மேல் இருக்கக்கூடாது',
    social: '{list} பிரிவினருக்கு மட்டும்',
    missing: 'இந்தத் திட்டத்தைச் சரிபார்க்க சொல்லுங்கள்: {list}',
    sep: '; ',
  },
};

const OCCUPATION_LABELS = {
  'en-IN': { farmer: 'farmers', agri_labourer: 'farm labourers', daily_wage: 'daily wage workers', student: 'students', homemaker: 'homemakers', other: 'others' },
  'hi-IN': { farmer: 'किसान', agri_labourer: 'खेतिहर मज़दूर', daily_wage: 'दिहाड़ी मज़दूर', student: 'छात्र', homemaker: 'गृहिणी', other: 'अन्य' },
  'mr-IN': { farmer: 'शेतकरी', agri_labourer: 'शेतमजूर', daily_wage: 'रोजंदारी कामगार', student: 'विद्यार्थी', homemaker: 'गृहिणी', other: 'इतर' },
  'ta-IN': { farmer: 'விவசாயிகள்', agri_labourer: 'விவசாயத் தொழிலாளர்கள்', daily_wage: 'தினக்கூலித் தொழிலாளர்கள்', student: 'மாணவர்கள்', homemaker: 'இல்லத்தரசிகள்', other: 'மற்றவர்கள்' },
};

const SOCIAL_LABELS = { general: 'General', obc: 'OBC', sc: 'SC', st: 'ST' };

const FIELD_LABELS = {
  'en-IN': { occupation: 'occupation', land_hectares: 'land (hectares)', bpl: 'BPL card', gender: 'gender', pregnant: 'pregnancy', age: 'age', annual_income: 'annual income', social_category: 'social category' },
  'hi-IN': { occupation: 'व्यवसाय', land_hectares: 'ज़मीन (हेक्टेयर)', bpl: 'BPL कार्ड', gender: 'लिंग', pregnant: 'गर्भावस्था', age: 'आयु', annual_income: 'वार्षिक आय', social_category: 'सामाजिक वर्ग' },
  'mr-IN': { occupation: 'व्यवसाय', land_hectares: 'जमीन (हेक्टर)', bpl: 'BPL कार्ड', gender: 'लिंग', pregnant: 'गर्भधारणा', age: 'वय', annual_income: 'वार्षिक उत्पन्न', social_category: 'सामाजिक प्रवर्ग' },
  'ta-IN': { occupation: 'தொழில்', land_hectares: 'நிலம் (ஹெக்டேர்)', bpl: 'BPL அட்டை', gender: 'பாலினம்', pregnant: 'கர்ப்பம்', age: 'வயது', annual_income: 'ஆண்டு வருமானம்', social_category: 'சமூகப் பிரிவு' },
};

const RECOMMENDED_ACTION = {
  'en-IN': {
    some: 'You may get {n} schemes. Start with {first}: keep the documents ready and apply on the portal, at a CSC or at the Gram Panchayat.',
    none: 'No scheme matched these details. Check the details, or visit the nearest CSC or Gram Panchayat for help.',
  },
  'hi-IN': {
    some: 'आप {n} योजनाओं के पात्र हो सकते हैं। पहले {first} से शुरू करें: दस्तावेज़ तैयार रखें और पोर्टल, CSC या ग्राम पंचायत पर आवेदन करें।',
    none: 'इन जानकारियों से कोई योजना मेल नहीं खाई। जानकारी जांचें, या मदद के लिए नज़दीकी CSC या ग्राम पंचायत जाएं।',
  },
  'mr-IN': {
    some: 'तुम्ही {n} योजनांसाठी पात्र असू शकता. आधी {first} पासून सुरुवात करा: कागदपत्रे तयार ठेवा आणि पोर्टल, CSC किंवा ग्रामपंचायतीत अर्ज करा.',
    none: 'या माहितीनुसार कोणतीही योजना जुळली नाही. माहिती तपासा, किंवा मदतीसाठी जवळच्या CSC किंवा ग्रामपंचायतीत जा.',
  },
  'ta-IN': {
    some: 'நீங்கள் {n} திட்டங்களுக்குத் தகுதி பெறலாம். முதலில் {first}: ஆவணங்களைத் தயாராக வைத்து இணையதளம், பொது சேவை மையம் (CSC) அல்லது கிராம பஞ்சாயத்தில் விண்ணப்பிக்கவும்.',
    none: 'இந்த விவரங்களுக்கு எந்தத் திட்டமும் பொருந்தவில்லை. விவரங்களைச் சரிபார்க்கவும், அல்லது அருகிலுள்ள பொது சேவை மையம் (CSC) அல்லது கிராம பஞ்சாயத்தை அணுகவும்.',
  },
};

// ---- SMS category keywords and HELP (B-05); each <=160 chars, has helpline / portal ----
const SMS_CATEGORY_REPLIES = {
  AGRI: {
    'en-IN': 'Farming: send PMFBY, KCC or SHC. Crop advice: Kisan Call Centre 1800-180-1551',
    'hi-IN': 'खेती: PMFBY, KCC या SHC भेजें। फसल सलाह: किसान कॉल सेंटर 1800-180-1551',
    'mr-IN': 'शेती: PMFBY, KCC किंवा SHC पाठवा. पीक सल्ला: किसान कॉल सेंटर 1800-180-1551',
    'ta-IN': 'விவசாயம்: PMFBY, KCC அல்லது SHC அனுப்பவும். பயிர் ஆலோசனை: கிசான் அழைப்பு மையம் 1800-180-1551',
  },
  HEALTH: {
    'en-IN': 'Health: send PMJAY, JSY or PMMVY. Emergency: 108 ambulance, 102 pregnancy ambulance, 104 helpline',
    'hi-IN': 'स्वास्थ्य: PMJAY, JSY या PMMVY भेजें। आपात: 108 एम्बुलेंस, 102 गर्भवती एम्बुलेंस, 104 हेल्पलाइन',
    'mr-IN': 'आरोग्य: PMJAY, JSY किंवा PMMVY पाठवा. आपत्काल: 108 रुग्णवाहिका, 102 गर्भवती रुग्णवाहिका, 104 हेल्पलाइन',
    'ta-IN': 'சுகாதாரம்: PMJAY, JSY அல்லது PMMVY அனுப்பவும். அவசரம்: 108 ஆம்புலன்ஸ், 102 கர்ப்பிணி ஆம்புலன்ஸ், 104 உதவி',
  },
  SCHOLARSHIP: {
    'en-IN': 'Scholarships: send NSP, PMYASASVI or PRAGATI. Apply: scholarships.gov.in Help: 0120-6619540',
    'hi-IN': 'छात्रवृत्ति: NSP, PMYASASVI या PRAGATI भेजें। आवेदन: scholarships.gov.in हेल्पलाइन: 0120-6619540',
    'mr-IN': 'शिष्यवृत्ती: NSP, PMYASASVI किंवा PRAGATI पाठवा. अर्ज: scholarships.gov.in हेल्पलाइन: 0120-6619540',
    'ta-IN': 'உதவித்தொகை: NSP, PMYASASVI அல்லது PRAGATI அனுப்பவும். விண்ணப்பம்: scholarships.gov.in உதவி: 0120-6619540',
  },
};

const SMS_HELP = {
  'en-IN': 'GramSahayak: send PMKISAN PMFBY KCC SHC PMJAY JSY PMMVY MGNREGA UJJWALA PMAY NSP PMYASASVI PRAGATI, or AGRI HEALTH SCHOLARSHIP, or your question',
  'hi-IN': 'ग्राम सहायक: PMKISAN PMFBY KCC SHC PMJAY JSY PMMVY MGNREGA UJJWALA PMAY NSP PMYASASVI PRAGATI या AGRI HEALTH SCHOLARSHIP भेजें, या सवाल लिखें',
  'mr-IN': 'ग्राम सहायक: PMKISAN PMFBY KCC SHC PMJAY JSY PMMVY MGNREGA UJJWALA PMAY NSP PMYASASVI PRAGATI किंवा AGRI HEALTH SCHOLARSHIP पाठवा, किंवा प्रश्न लिहा',
  'ta-IN': 'கிராம சகாயக்: PMKISAN PMFBY KCC SHC PMJAY JSY PMMVY MGNREGA UJJWALA PMAY NSP PMYASASVI PRAGATI அல்லது AGRI HEALTH SCHOLARSHIP அனுப்பவும்',
};

module.exports = {
  langOf,
  fill,
  formatInr,
  REASONS,
  OCCUPATION_LABELS,
  SOCIAL_LABELS,
  FIELD_LABELS,
  RECOMMENDED_ACTION,
  SMS_CATEGORY_REPLIES,
  SMS_HELP,
};
