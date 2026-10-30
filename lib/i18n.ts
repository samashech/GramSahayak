import { LanguageCode } from './types';

export interface UIStrings {
  appName: string;
  appSubtitle: string;
  // Tabs
  tabVoice: string;
  tabIvr: string;
  tabSms: string;
  tabEligibility: string;
  liveProjector: string;
  // Top bar
  language: string;
  persona: string;
  judgePresets: string;
  resetDemo: string;
  resetSuccess: string;
  resetting: string;
  // Personas
  farmer: string;
  asha: string;
  panchayat: string;
  student: string;
  // Common
  pressAndSpeak: string;
  listening: string;
  processing: string;
  send: string;
  tryAgain: string;
  offlineMode: string;
  loading: string;
  error: string;
  helpline: string;
  officialPortal: string;
  documents: string;
  smsReceipt: string;
  copySms: string;
  copied: string;
  // Categories
  catSchemes: string;
  catAgri: string;
  catHealth: string;
  catEducation: string;
  // Voice screen
  quickQuestions: string;
  textPlaceholder: string;
  safetyAlert: string;
  emergencyCall: string;
  stopRecording: string;
  cancelRecording: string;
  listenAudio: string;
  // IVR screen
  ivrTitle: string;
  ivrSubtitle: string;
  callButton: string;
  hangupButton: string;
  keypadPrompt: string;
  webhookLog: string;
  // SMS screen
  smsTitle: string;
  smsSubtitle: string;
  smsPlaceholder: string;
  quickKeywords: string;
  parts: string;
  rawSms: string;
  // Eligibility screen
  eligibilityTitle: string;
  eligibilitySubtitle: string;
  rulesNotice: string;
  eligibleHeader: string;
  ineligibleHeader: string;
  totalMatched: string;
  recommendedAction: string;
  checkEligibility: string;
  // Form fields
  occupation: string;
  landHectares: string;
  bplCard: string;
  age: string;
  gender: string;
  pregnant: string;
  annualIncome: string;
  socialCategory: string;
  yes: string;
  no: string;
}

export const I18N: Record<LanguageCode, UIStrings> = {
  'hi-IN': {
    appName: 'ग्राम सहायक',
    appSubtitle: 'ग्रामीण भारत का बहुभाषी आवाज़, कॉल और एसएमएस साथी',
    tabVoice: 'आवाज़ (Voice)',
    tabIvr: 'कॉल (IVR)',
    tabSms: 'एसएमएस (SMS)',
    tabEligibility: 'पात्रता (Eligibility)',
    liveProjector: 'लाइव स्क्रीन (Live)',
    language: 'भाषा',
    persona: 'उपयोगकर्ता',
    judgePresets: 'जज डेमो प्रीसेट',
    resetDemo: 'डेमो रीसेट करें',
    resetSuccess: 'डेमो डेटा रीसेट हो गया',
    resetting: 'रीसेट हो रहा है...',
    farmer: 'किसान',
    asha: 'आशा दीदी',
    panchayat: 'पंचायत',
    student: 'छात्र / छात्रा',
    pressAndSpeak: 'दबाएं और बोलें',
    listening: 'सुन रहे हैं...',
    processing: 'जानकारी खोजी जा रही है...',
    send: 'भेजें',
    tryAgain: 'फिर कोशिश करें',
    offlineMode: 'ऑफ़लाइन / कैश्ड मोड',
    loading: 'लोड हो रहा है...',
    error: 'कुछ गड़बड़ हुई। कृपया पुनः प्रयास करें।',
    helpline: 'हेल्पलाइन',
    officialPortal: 'आधिकारिक पोर्टल',
    documents: 'आवश्यक दस्तावेज़',
    smsReceipt: 'एसएमएस रसीद',
    copySms: 'एसएमएस कॉपी करें',
    copied: 'कॉपी हो गया!',
    catSchemes: 'सरकारी योजनाएं',
    catAgri: 'फसल एवं खेती',
    catHealth: 'मातृ एवं ग्रामीण स्वास्थ्य',
    catEducation: 'छात्रवृत्ति एवं शिक्षा',
    quickQuestions: 'डेमो प्रश्न (क्लिक करें)',
    textPlaceholder: 'अपनी समस्या या सवाल यहां लिखें...',
    safetyAlert: 'आपातकालीन चेतावनी: तुरंत नजदीकी अस्पताल या हेल्पलाइन से संपर्क करें!',
    emergencyCall: 'तुरंत कॉल करें',
    stopRecording: 'रोकें और भेजें',
    cancelRecording: 'रद्द करें',
    listenAudio: 'ऑडियो सुनें',
    ivrTitle: 'टोल-फ्री कॉल सिम्युलेटर',
    ivrSubtitle: 'डायल करें 1800-180-1551 (टोल-फ्री)',
    callButton: 'कॉल मिलाएं',
    hangupButton: 'कॉल काटें',
    keypadPrompt: 'विकल्प चुनने के लिए कीपैड दबाएं',
    webhookLog: 'क्लाउडटॉक वेबहुक लॉग (Judges View)',
    smsTitle: 'ऑफ़लाइन एसएमएस बॉट',
    smsSubtitle: 'बिना इंटरनेट किसी भी साधारण फोन पर एसएमएस भेजें',
    smsPlaceholder: 'कीवर्ड लिखें (जैसे PMKISAN या HELP)...',
    quickKeywords: 'त्वरित कीवर्ड',
    parts: 'एसएमएस भाग',
    rawSms: 'कच्चा एसएमएस संदेश देखें',
    eligibilityTitle: 'सरकारी योजना पात्रता जांच',
    eligibilitySubtitle: 'सटीक और निष्पक्ष पात्रता जांच — बिना किसी अनुमान के',
    rulesNotice: 'नियम निश्चित हैं और सीधे सरकारी डेटाबेस से जाँचे जाते हैं, AI द्वारा अंदाज़ा नहीं लगाया जाता।',
    eligibleHeader: 'आप इन योजनाओं के लिए पात्र हैं',
    ineligibleHeader: 'वर्तमान में अपात्र योजनाएं (कारण सहित)',
    totalMatched: 'कुल पात्र योजनाएं',
    recommendedAction: 'अनुशंसित कदम',
    checkEligibility: 'पात्रता जांचें',
    occupation: 'व्यवसाय',
    landHectares: 'कृषि भूमि (हेक्टेयर)',
    bplCard: 'बीपीएल राशन कार्ड',
    age: 'आयु (वर्ष)',
    gender: 'लिंग',
    pregnant: 'गर्भवती (हाँ/ना)',
    annualIncome: 'वार्षिक आय (₹)',
    socialCategory: 'सामाजिक वर्ग',
    yes: 'हाँ',
    no: 'नहीं',
  },
  'mr-IN': {
    appName: 'ग्राम सहायक',
    appSubtitle: 'ग्रामीण भारताचा बहुभाषिक आवाज, कॉल आणि एसएमएस सहाय्यक',
    tabVoice: 'आवाज (Voice)',
    tabIvr: 'कॉल (IVR)',
    tabSms: 'एसएमएस (SMS)',
    tabEligibility: 'पात्रता (Eligibility)',
    liveProjector: 'थेट पडदा (Live)',
    language: 'भाषा',
    persona: 'वापरकर्ता',
    judgePresets: 'परीक्षक डेमो प्रीसेट',
    resetDemo: 'डेमो रीसेट करा',
    resetSuccess: 'डेमो डेटा रीसेट झाला',
    resetting: 'रीसेट होत आहे...',
    farmer: 'शेतकरी',
    asha: 'आशा ताई',
    panchayat: 'ग्रामपंचायत',
    student: 'विद्यार्थी',
    pressAndSpeak: 'दाबा आणि बोला',
    listening: 'ऐकत आहोत...',
    processing: 'माहिती शोधत आहोत...',
    send: 'पाठवा',
    tryAgain: 'पुन्हा प्रयत्न करा',
    offlineMode: 'ऑफलाइन / कॅश मोड',
    loading: 'लोड होत आहे...',
    error: 'काहीतरी त्रुटी झाली. कृपया पुन्हा प्रयत्न करा.',
    helpline: 'हेल्पलाइन',
    officialPortal: 'अधिकृत पोर्टल',
    documents: 'आवश्यक कागदपत्रे',
    smsReceipt: 'एसएमएस पावती',
    copySms: 'एसएमएस कॉपी करा',
    copied: 'कॉपी झाले!',
    catSchemes: 'शासकीय योजना',
    catAgri: 'शेती व पिके',
    catHealth: 'माता व ग्रामीण आरोग्य',
    catEducation: 'शिष्यवृत्ती व शिक्षण',
    quickQuestions: 'डेमो प्रश्न (क्लिक करा)',
    textPlaceholder: 'तुमची समस्या किंवा प्रश्न येथे लिहा...',
    safetyAlert: 'तातडीचा इशारा: तातडीने जवळच्या रुग्णालयात किंवा हेल्पलाइनवर संपर्क साधा!',
    emergencyCall: 'त्वरित कॉल करा',
    stopRecording: 'थांबवा आणि पाठवा',
    cancelRecording: 'रद्द करा',
    listenAudio: 'ऑडिओ ऐका',
    ivrTitle: 'टोल-फ्री कॉल सिम्युलेटर',
    ivrSubtitle: 'डायल करा 1800-180-1551 (टोल-फ्री)',
    callButton: 'कॉल लावा',
    hangupButton: 'कॉल बंद करा',
    keypadPrompt: 'पर्याय निवडण्यासाठी कीपॅड दाबा',
    webhookLog: 'क्लाउडटॉक वेबहुक लॉग (Judges View)',
    smsTitle: 'ऑफलाइन एसएमएस बॉट',
    smsSubtitle: 'इंटरनेटशिवाय साध्या फोनवरून एसएमएस पाठवा',
    smsPlaceholder: 'कीवर्ड लिहा (उदा. PMKISAN किंवा HELP)...',
    quickKeywords: 'त्वरित कीवर्ड',
    parts: 'एसएमएस भाग',
    rawSms: 'मूळ एसएमएस संदेश पहा',
    eligibilityTitle: 'योजना पात्रता पडताळणी',
    eligibilitySubtitle: 'अचूक आणि पारदर्शक पात्रता पडताळणी',
    rulesNotice: 'नियम निश्चित आहेत आणि थेट शासकीय नियमांनुसार तपासले जातात, AI चा अंदाज नाही.',
    eligibleHeader: 'तुम्ही या योजनांसाठी पात्र आहात',
    ineligibleHeader: 'सध्या अपात्र योजना (कारणांसह)',
    totalMatched: 'एकूण पात्र योजना',
    recommendedAction: 'पुढील पायरी',
    checkEligibility: 'पात्रता तपासा',
    occupation: 'व्यवसाय',
    landHectares: 'शेतजमीन (हेक्टर)',
    bplCard: 'दारिद्र्यरेषेखालील (BPL) कार्ड',
    age: 'वय (वर्षे)',
    gender: 'लिंग',
    pregnant: 'गरोदर (होय/नाही)',
    annualIncome: 'वार्षिक उत्पन्न (₹)',
    socialCategory: 'सामाजिक प्रवर्ग',
    yes: 'होय',
    no: 'नाही',
  },
  'ta-IN': {
    appName: 'கிராம சகாயக்',
    appSubtitle: 'கிராமப்புற குடிமக்களுக்கான பலமொழி குரல், அழைப்பு மற்றும் எஸ்எம்எஸ் உதவியாளர்',
    tabVoice: 'குரல் (Voice)',
    tabIvr: 'அழைப்பு (IVR)',
    tabSms: 'எஸ்எம்எஸ் (SMS)',
    tabEligibility: 'தகுதி (Eligibility)',
    liveProjector: 'நேரலை திரை (Live)',
    language: 'மொழி',
    persona: 'பயனர்',
    judgePresets: 'நடுவர் டெமோ முன்னமைவுகள்',
    resetDemo: 'டெமோவை மீட்டமைக்கவும்',
    resetSuccess: 'டெமோ மீட்டமைக்கப்பட்டது',
    resetting: 'மீட்டமைக்கிறது...',
    farmer: 'விவசாயி',
    asha: 'ஆஷா சகோதரி',
    panchayat: 'பஞ்சாயத்து',
    student: 'மாணவர்',
    pressAndSpeak: 'அழுத்தி பேசவும்',
    listening: 'கேட்கிறது...',
    processing: 'தகவல் தேடப்படுகிறது...',
    send: 'அனுப்பவும்',
    tryAgain: 'மீண்டும் முயற்சிக்கவும்',
    offlineMode: 'ஆஃப்லைன் பயன்முறை',
    loading: 'ஏற்றுகிறது...',
    error: 'பிழை ஏற்பட்டது. தயவுசெய்து மீண்டும் முயற்சிக்கவும்.',
    helpline: 'உதவி எண்',
    officialPortal: 'அதிகாரப்பூர்வ தளம்',
    documents: 'தேவையான ஆவணங்கள்',
    smsReceipt: 'எஸ்எம்எஸ் ரசீது',
    copySms: 'எஸ்எம்எஸ் நகலெடு',
    copied: 'நகலெடுக்கப்பட்டது!',
    catSchemes: 'அரசு திட்டங்கள்',
    catAgri: 'பயிர் மற்றும் விவசாயம்',
    catHealth: 'தாய் மற்றும் கிராமப்புற நலம்',
    catEducation: 'கல்வி உதவித்தொகை',
    quickQuestions: 'டெமோ கேள்விகள் (கிளிக் செய்யவும்)',
    textPlaceholder: 'உங்கள் கேள்வியை இங்கே எழுதவும்...',
    safetyAlert: 'அவசர எச்சரிக்கை: உடனடியாக மருத்துவமனை அல்லது அவசர எண்ணைத் தொடர்பு கொள்ளவும்!',
    emergencyCall: 'உடனே அழைக்கவும்',
    stopRecording: 'நிறுத்தி அனுப்பவும்',
    cancelRecording: 'ரத்து செய்',
    listenAudio: 'ஆடியோவை கேளுங்கள்',
    ivrTitle: 'கட்டணமில்லா அழைப்பு சிமுலேட்டர்',
    ivrSubtitle: 'அழைக்கவும் 1800-180-1551 (கட்டணமில்லா எண்)',
    callButton: 'அழை',
    hangupButton: 'அழைப்பைத் துண்டி',
    keypadPrompt: 'விருப்பங்களைத் தேர்ந்தெடுக்க விசைப்பலகையைப் பயன்படுத்தவும்',
    webhookLog: 'கிளவுட்டாக் வெப்ஹூக் பதிவு (Judges View)',
    smsTitle: 'ஆஃப்லைன் எஸ்எம்எஸ் போட்',
    smsSubtitle: 'இணையம் இல்லாமல் சாதாரண போன் வழியாக எஸ்எம்எஸ் பெறலாம்',
    smsPlaceholder: 'முக்கிய வார்த்தையை தட்டச்சு செய்யவும் (எ.கா. PMKISAN அல்லது HELP)...',
    quickKeywords: 'விரைவு வார்த்தைகள்',
    parts: 'எஸ்எம்எஸ் பகுதிகள்',
    rawSms: 'உண்மை எஸ்எம்எஸ் உரை',
    eligibilityTitle: 'திட்ட தகுதி சரிபார்ப்பு',
    eligibilitySubtitle: 'துல்லியமான மற்றும் முறையான தகுதி சரிபார்ப்பு',
    rulesNotice: 'விதிகள் நிலையானவை மற்றும் அதிகாரப்பூர்வ விதிகளின்படி சரிபார்க்கப்படுகின்றன, AI யூகம் அல்ல.',
    eligibleHeader: 'நீங்கள் தகுதி பெற்றுள்ள திட்டங்கள்',
    ineligibleHeader: 'தற்போது தகுதியற்ற திட்டங்கள் (காரணத்துடன்)',
    totalMatched: 'மொத்த தகுதியான திட்டங்கள்',
    recommendedAction: 'பரிந்துரைக்கப்பட்ட நடவடிக்கை',
    checkEligibility: 'தகுதியை சரிபார்க்கவும்',
    occupation: 'தொழில்',
    landHectares: 'நிலம் (ஹெக்டேர்)',
    bplCard: 'வறுமைக்கோட்டு அட்டை (BPL)',
    age: 'வயது',
    gender: 'பாலினம்',
    pregnant: 'கர்ப்பிணி (ஆம்/இல்லை)',
    annualIncome: 'ஆண்டு வருமானம் (₹)',
    socialCategory: 'சமூக பிரிவு',
    yes: 'ஆம்',
    no: 'இல்லை',
  },
  'en-IN': {
    appName: 'GramSahayak',
    appSubtitle: 'Omnichannel Multilingual Voice, Call & SMS Assistant for Rural Citizens',
    tabVoice: 'Voice',
    tabIvr: 'Call (IVR)',
    tabSms: 'SMS',
    tabEligibility: 'Eligibility',
    liveProjector: 'Live View',
    language: 'Language',
    persona: 'Persona',
    judgePresets: 'Judge Presets',
    resetDemo: 'Reset Demo',
    resetSuccess: 'Demo data reset successfully',
    resetting: 'Resetting...',
    farmer: 'Farmer',
    asha: 'ASHA Worker',
    panchayat: 'Panchayat',
    student: 'Student',
    pressAndSpeak: 'Press and speak',
    listening: 'Listening...',
    processing: 'Finding verified answer...',
    send: 'Send',
    tryAgain: 'Try again',
    offlineMode: 'Offline / Cached Mode',
    loading: 'Loading...',
    error: 'Something went wrong. Please try again.',
    helpline: 'Helpline',
    officialPortal: 'Official Portal',
    documents: 'Required Documents',
    smsReceipt: 'SMS Receipt',
    copySms: 'Copy SMS Text',
    copied: 'Copied!',
    catSchemes: 'Govt Schemes',
    catAgri: 'Crop & Farming',
    catHealth: 'Maternal & Rural Health',
    catEducation: 'Student Scholarships',
    quickQuestions: 'Golden Demo Questions (Click to test)',
    textPlaceholder: 'Type your question or query here...',
    safetyAlert: 'Emergency Warning: Please contact nearest medical center or dial emergency services immediately!',
    emergencyCall: 'Emergency Call Now',
    stopRecording: 'Stop and Send',
    cancelRecording: 'Cancel',
    listenAudio: 'Listen Answer',
    ivrTitle: 'Toll-Free IVR Call Simulator',
    ivrSubtitle: 'Dial 1800-180-1551 (Toll-Free)',
    callButton: 'Call',
    hangupButton: 'Hang Up',
    keypadPrompt: 'Press keypad numbers to navigate options',
    webhookLog: 'CloudTalk Webhook Logs (Judges View)',
    smsTitle: 'Offline SMS Bot Simulator',
    smsSubtitle: 'No internet required — works on any basic feature phone',
    smsPlaceholder: 'Type keyword (e.g. PMKISAN or HELP)...',
    quickKeywords: 'Quick Keywords',
    parts: 'SMS segments',
    rawSms: 'Show Raw SMS Preview',
    eligibilityTitle: 'Government Scheme Eligibility Checker',
    eligibilitySubtitle: 'Deterministic and verifiable rules-based eligibility screening',
    rulesNotice: 'Rules are fixed and checked by the system, not guessed by AI.',
    eligibleHeader: 'Schemes You May Be Eligible For',
    ineligibleHeader: 'Currently Ineligible Schemes (with reasons)',
    totalMatched: 'Total Eligible Schemes',
    recommendedAction: 'Recommended Action',
    checkEligibility: 'Check Eligibility',
    occupation: 'Occupation',
    landHectares: 'Agricultural Land (Hectares)',
    bplCard: 'BPL Ration Card',
    age: 'Age (Years)',
    gender: 'Gender',
    pregnant: 'Pregnant (Yes/No)',
    annualIncome: 'Annual Income (₹)',
    socialCategory: 'Social Category',
    yes: 'Yes',
    no: 'No',
  },
};

export function getTranslation(lang: LanguageCode): UIStrings {
  return I18N[lang] || I18N['hi-IN'];
}
