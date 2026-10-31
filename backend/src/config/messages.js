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

// ---- Agent brain (B-06): fixed safe answers, never model output ----
const SAFETY_ANSWERS = {
  emergency: {
    'en-IN': 'This is an emergency. Call 108 for an ambulance now and go to the nearest government hospital. Do not try home remedies.',
    'hi-IN': 'यह आपात स्थिति है। तुरंत 108 पर एम्बुलेंस बुलाएं और नज़दीकी सरकारी अस्पताल जाएं। घरेलू उपचार न करें।',
    'mr-IN': 'ही आपत्कालीन स्थिती आहे. लगेच 108 वर रुग्णवाहिका बोलवा आणि जवळच्या सरकारी रुग्णालयात जा. घरगुती उपाय करू नका.',
    'ta-IN': 'இது அவசர நிலை. உடனே 108 ஆம்புலன்ஸை அழைத்து அருகிலுள்ள அரசு மருத்துவமனைக்குச் செல்லுங்கள். வீட்டு வைத்தியம் செய்ய வேண்டாம்.',
  },
  pregnancy: {
    'en-IN': 'These can be pregnancy danger signs. Go to the nearest health centre now and call 102 or 108 for an ambulance.',
    'hi-IN': 'ये गर्भावस्था के खतरे के लक्षण हो सकते हैं। तुरंत नज़दीकी स्वास्थ्य केंद्र जाएं, 102 या 108 पर एम्बुलेंस बुलाएं।',
    'mr-IN': 'ही गर्भधारणेतील धोक्याची लक्षणे असू शकतात. लगेच जवळच्या आरोग्य केंद्रात जा, 102 किंवा 108 वर रुग्णवाहिका बोलवा.',
    'ta-IN': 'இவை கர்ப்பகால ஆபத்து அறிகுறிகளாக இருக்கலாம். உடனே அருகிலுள்ள சுகாதார நிலையத்திற்குச் செல்லுங்கள், 102 அல்லது 108 ஆம்புலன்ஸை அழைக்கவும்.',
  },
  doseAgri: {
    'en-IN': 'We do not give pesticide doses or brands. For the right advice, contact the Krishi Vigyan Kendra or Kisan Call Centre 1800-180-1551.',
    'hi-IN': 'हम कीटनाशक की मात्रा या ब्रांड नहीं बताते। सही सलाह के लिए कृषि विज्ञान केंद्र या किसान कॉल सेंटर 1800-180-1551 पर संपर्क करें।',
    'mr-IN': 'आम्ही कीटकनाशकाची मात्रा किंवा ब्रँड सांगत नाही. योग्य सल्ल्यासाठी कृषी विज्ञान केंद्र किंवा किसान कॉल सेंटर 1800-180-1551 वर संपर्क करा.',
    'ta-IN': 'பூச்சிக்கொல்லி அளவு அல்லது பிராண்டை நாங்கள் சொல்வதில்லை. சரியான ஆலோசனைக்கு வேளாண் அறிவியல் மையம் அல்லது கிசான் அழைப்பு மையம் 1800-180-1551 ஐ அழைக்கவும்.',
  },
  doseMedical: {
    'en-IN': 'We do not give medicine doses. Please ask a doctor or the nearest health centre, or call 104.',
    'hi-IN': 'हम दवा की खुराक नहीं बताते। कृपया डॉक्टर या नज़दीकी स्वास्थ्य केंद्र से पूछें, या 104 पर कॉल करें।',
    'mr-IN': 'आम्ही औषधाचा डोस सांगत नाही. कृपया डॉक्टर किंवा जवळच्या आरोग्य केंद्राला विचारा, किंवा 104 वर कॉल करा.',
    'ta-IN': 'மருந்து அளவை நாங்கள் சொல்வதில்லை. மருத்துவரிடம் அல்லது அருகிலுள்ள சுகாதார நிலையத்தில் கேளுங்கள், அல்லது 104 ஐ அழைக்கவும்.',
  },
};

const NO_VERIFIED_INFO = {
  'en-IN': 'We do not have verified information on this right now. Please call Kisan Call Centre 1800-180-1551 or the health helpline 104.',
  'hi-IN': 'अभी हमारे पास इस विषय पर सत्यापित जानकारी नहीं है। कृपया किसान कॉल सेंटर 1800-180-1551 या स्वास्थ्य हेल्पलाइन 104 पर कॉल करें।',
  'mr-IN': 'सध्या आमच्याकडे या विषयावर सत्यापित माहिती नाही. कृपया किसान कॉल सेंटर 1800-180-1551 किंवा आरोग्य हेल्पलाईन 104 वर कॉल करा.',
  'ta-IN': 'இது குறித்த சரிபார்க்கப்பட்ட தகவல் இப்போது எங்களிடம் இல்லை. கிசான் அழைப்பு மையம் 1800-180-1551 அல்லது சுகாதார உதவி எண் 104 ஐ அழைக்கவும்.',
  'gu-IN': 'અત્યારે આ વિષય પર અમારી પાસે ચકાસાયેલી માહિતી નથી. કૃપા કરીને કિસાન કૉલ સેન્ટર 1800-180-1551 અથવા આરોગ્ય હેલ્પલાઇન 104 પર કૉલ કરો.',
};

// Asked about a named scheme that is not one of the 13 seed cards (fake or state scheme):
// never answer with a neighbouring card (LD-04 F1/F2).
const UNKNOWN_SCHEME = {
  'en-IN': 'We have no verified information on a scheme by this name. We cover 13 central schemes; send HELP or ask at your nearest CSC or Gram Panchayat.',
  'hi-IN': 'इस नाम की योजना की सत्यापित जानकारी हमारे पास नहीं है। हम 13 केंद्रीय योजनाओं की जानकारी देते हैं; HELP भेजें या नज़दीकी CSC / ग्राम पंचायत से पूछें।',
  'mr-IN': 'या नावाच्या योजनेची सत्यापित माहिती आमच्याकडे नाही. आम्ही 13 केंद्रीय योजनांची माहिती देतो; HELP पाठवा किंवा जवळच्या CSC / ग्रामपंचायतीत विचारा.',
  'ta-IN': 'இந்தப் பெயரில் உள்ள திட்டம் பற்றி சரிபார்த்த தகவல் இல்லை. 13 மத்திய திட்டங்கள் மட்டும்; HELP அனுப்பவும் அல்லது CSC / கிராம பஞ்சாயத்தில் கேட்கவும்.',
};

// R4: an answer never says "you are / are not eligible"; such a sentence is replaced with this pointer.
const ELIGIBILITY_POINTER = {
  'en-IN': 'The Eligibility Checker or your nearest CSC will confirm whether you qualify.',
  'hi-IN': 'आप पात्र हैं या नहीं, यह पात्रता जाँच या नज़दीकी जन सेवा केंद्र पर पक्का होगा।',
  'mr-IN': 'तुम्ही पात्र आहात की नाही, हे पात्रता तपासणी किंवा जवळच्या सेवा केंद्रात निश्चित होईल.',
  'gu-IN': 'તમે પાત્ર છો કે નહીં, તે પાત્રતા ચકાસણી અથવા નજીકના જન સેવા કેન્દ્રમાં નક્કી થશે.',
  'ta-IN': 'நீங்கள் தகுதியானவரா என்பதை தகுதிச் சரிபார்ப்பு அல்லது அருகிலுள்ள பொது சேவை மையம் உறுதி செய்யும்.',
};

const SMS_CLOSING = {
  'en-IN': 'Full details are being sent by SMS.',
  'hi-IN': 'पूरी जानकारी SMS से भेजी जा रही है।',
  'mr-IN': 'संपूर्ण माहिती SMS ने पाठवली जात आहे.',
  'ta-IN': 'முழு விவரங்கள் SMS மூலம் அனுப்பப்படுகின்றன.',
};

// ---- IVR prompts (B-07, contract section 7) ----
const IVR = {
  greeting: 'ग्राम सहायक में आपका स्वागत है। हिंदी के लिए 1 दबाएं। मराठीसाठी 2 दाबा. தமிழுக்கு 3 அழுத்தவும்.',
  // The same greeting split by language, so each part is spoken by a voice of that language.
  greetingParts: [
    ['hi-IN', 'ग्राम सहायक में आपका स्वागत है। हिंदी के लिए 1 दबाएं।'],
    ['mr-IN', 'मराठीसाठी 2 दाबा.'],
    ['ta-IN', 'தமிழுக்கு 3 அழுத்தவும்.'],
  ],
  followUp: {
    'en-IN': 'To ask another question, speak after the beep, or hang up.',
    'hi-IN': 'दूसरा सवाल पूछने के लिए बीप के बाद बोलें, या फ़ोन रख दें।',
    'mr-IN': 'दुसरा प्रश्न विचारण्यासाठी बीपनंतर बोला, किंवा फोन ठेवा.',
    'ta-IN': 'வேறு கேள்வி கேட்க பீப் ஒலிக்குப் பிறகு பேசுங்கள், அல்லது அழைப்பை முடிக்கவும்.',
  },
  categoryMenu: {
    'en-IN': 'Press 1 for government schemes, 2 for farming, 3 for health, 4 for scholarships.',
    'hi-IN': 'सरकारी योजना के लिए 1, खेती के लिए 2, स्वास्थ्य के लिए 3, छात्रवृत्ति के लिए 4 दबाएं।',
    'mr-IN': 'सरकारी योजनांसाठी 1, शेतीसाठी 2, आरोग्यासाठी 3, शिष्यवृत्तीसाठी 4 दाबा.',
    'ta-IN': 'அரசு திட்டங்களுக்கு 1, விவசாயத்துக்கு 2, சுகாதாரத்துக்கு 3, உதவித்தொகைக்கு 4 அழுத்தவும்.',
  },
  speak: {
    'en-IN': 'Please speak your question after the beep.',
    'hi-IN': 'बीप के बाद अपना सवाल बोलें।',
    'mr-IN': 'बीपनंतर तुमचा प्रश्न बोला.',
    'ta-IN': 'பீப் ஒலிக்குப் பிறகு உங்கள் கேள்வியைச் சொல்லுங்கள்.',
  },
  invalid: {
    'en-IN': 'Invalid choice.',
    'hi-IN': 'गलत बटन।',
    'mr-IN': 'चुकीचे बटण.',
    'ta-IN': 'தவறான எண்.',
  },
  silence: {
    'en-IN': 'We did not hear you.',
    'hi-IN': 'हमें आपकी आवाज़ नहीं मिली।',
    'mr-IN': 'तुमचा आवाज आला नाही.',
    'ta-IN': 'உங்கள் குரல் கேட்கவில்லை.',
  },
  goodbye: {
    'en-IN': 'Thank you. The details have been sent by SMS. Goodbye.',
    'hi-IN': 'धन्यवाद। जानकारी SMS से भेजी गई है। नमस्ते।',
    'mr-IN': 'धन्यवाद. माहिती SMS ने पाठवली आहे. नमस्कार.',
    'ta-IN': 'நன்றி. விவரங்கள் SMS மூலம் அனுப்பப்பட்டன. வணக்கம்.',
  },
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
  SAFETY_ANSWERS,
  NO_VERIFIED_INFO,
  ELIGIBILITY_POINTER,
  UNKNOWN_SCHEME,
  SMS_CLOSING,
  IVR,
};
