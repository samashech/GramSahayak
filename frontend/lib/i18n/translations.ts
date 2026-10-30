import type { Language } from "./config";

/**
 * Centralised UI dictionaries for the landing page.
 *
 * Every supported language must implement the full `Dictionary` shape, so
 * TypeScript will flag any missing string at build time.
 */

export interface Dictionary {
  common: {
    skipToContent: string;
    tagline: string;
    homeLabel: string;
  };
  header: {
    menu: string;
    closeMenu: string;
    chooseLanguage: string;
    navigation: string;
  };
  nav: {
    services: string;
    howItWorks: string;
    languages: string;
    lowBandwidth: string;
    login: string;
  };
  hero: {
    eyebrow: string;
    titleLine1: string;
    titleLine2: string;
    description: string;
    cta: string;
    helper: string;
    imageAlt: string;
  };
  languageSection: {
    title: string;
    description: string;
    selected: string;
  };
  services: {
    title: string;
    subtitle: string;
    schemes: { title: string; description: string };
    farming: { title: string; description: string };
    health: { title: string; description: string };
  };
  howItWorks: {
    title: string;
    stepLabel: string;
    speak: { title: string; description: string };
    understand: { title: string; description: string };
    know: { title: string; description: string };
  };
  lowBandwidth: {
    title: string;
    description: string;
    lightweight: { title: string; description: string };
    lowData: { title: string; description: string };
    textOption: { title: string; description: string };
    sms: { title: string; description: string };
  };
  ctaBanner: {
    title: string;
    description: string;
    cta: string;
  };
  footer: {
    rights: string;
    photoCredit: string;
  };
  login: {
    title: string;
    description: string;
    backHome: string;
  };
}

const hi: Dictionary = {
  common: {
    skipToContent: "मुख्य सामग्री पर जाएँ",
    tagline: "आपकी भाषा। आपका सहायक।",
    homeLabel: "GramSathi मुख्य पेज",
  },
  header: {
    menu: "मेन्यू खोलें",
    closeMenu: "मेन्यू बंद करें",
    chooseLanguage: "भाषा चुनें",
    navigation: "मुख्य नेविगेशन",
  },
  nav: {
    services: "सेवाएँ",
    howItWorks: "यह कैसे काम करता है",
    languages: "भाषा",
    lowBandwidth: "कम डेटा में",
    login: "लॉग इन करें",
  },
  hero: {
    eyebrow: "गाँव-गाँव का अपना सहायक",
    titleLine1: "आपकी भाषा।",
    titleLine2: "आपका सहायक।",
    description: "सरकारी योजना, खेती और ज़रूरी जानकारी। अब अपनी भाषा में, सिर्फ़ बोलकर।",
    cta: "शुरू करें",
    helper: "अपनी भाषा में जानकारी पाएँ।",
    imageAlt: "धान के खेत में फ़सल काटती ग्रामीण महिलाएँ",
  },
  languageSection: {
    title: "अपनी भाषा चुनें",
    description: "आप जो भाषा चुनेंगे, पूरा पेज उसी भाषा में दिखेगा। आप इसे कभी भी बदल सकते हैं।",
    selected: "चुनी गई",
  },
  services: {
    title: "हम आपकी क्या मदद कर सकते हैं?",
    subtitle: "रोज़ की ज़रूरी जानकारी, एक ही जगह पर।",
    schemes: {
      title: "सरकारी योजना",
      description: "सरकारी योजनाओं और उनके लाभों की जानकारी।",
    },
    farming: {
      title: "खेती की सलाह",
      description: "फ़सलों, खेती और कृषि मार्गदर्शन की जानकारी।",
    },
    health: {
      title: "स्वास्थ्य",
      description: "बुनियादी स्वास्थ्य जानकारी और जागरूकता।",
    },
  },
  howItWorks: {
    title: "यह कैसे काम करता है?",
    stepLabel: "चरण",
    speak: { title: "बोलिए", description: "अपना सवाल अपनी भाषा में पूछें।" },
    understand: { title: "समझिए", description: "सहायक आपका सवाल समझेगा।" },
    know: { title: "जानिए", description: "आपको आसान भाषा में जवाब मिलेगा।" },
  },
  lowBandwidth: {
    title: "कमज़ोर नेटवर्क में भी आसान",
    description: "कमज़ोर नेटवर्क और साधारण फ़ोन को ध्यान में रखकर बनाया गया।",
    lightweight: {
      title: "हल्का इंटरफ़ेस",
      description: "पेज जल्दी खुलता है और साधारण स्मार्टफ़ोन पर भी आसानी से चलता है।",
    },
    lowData: {
      title: "कम डेटा खर्च",
      description: "कम तस्वीरें और हल्की फ़ाइलें, ताकि आपका डेटा बचे।",
    },
    textOption: {
      title: "लिखकर भी पूछें",
      description: "बोलना संभव न हो, तो अपना सवाल लिखकर भी पूछ सकते हैं।",
    },
    sms: {
      title: "SMS सहायता",
      description: "इंटरनेट न होने पर SMS के ज़रिए जानकारी पाने का विकल्प।",
    },
  },
  ctaBanner: {
    title: "आज ही शुरू करें",
    description: "अपने मोबाइल नंबर से लॉग इन करें और अपनी भाषा में जानकारी पाएँ।",
    cta: "शुरू करें",
  },
  footer: {
    rights: "सर्वाधिकार सुरक्षित।",
    photoCredit: "फ़ोटो",
  },
  login: {
    title: "लॉग इन",
    description: "मोबाइल OTP से लॉग इन की सुविधा जल्द ही यहाँ उपलब्ध होगी।",
    backHome: "मुख्य पेज पर वापस जाएँ",
  },
};

const mr: Dictionary = {
  common: {
    skipToContent: "मुख्य मजकुराकडे जा",
    tagline: "तुमची भाषा. तुमचा सहाय्यक.",
    homeLabel: "GramSathi मुख्य पान",
  },
  header: {
    menu: "मेनू उघडा",
    closeMenu: "मेनू बंद करा",
    chooseLanguage: "भाषा निवडा",
    navigation: "मुख्य नेव्हिगेशन",
  },
  nav: {
    services: "सेवा",
    howItWorks: "हे कसे काम करते",
    languages: "भाषा",
    lowBandwidth: "कमी डेटामध्ये",
    login: "लॉग इन करा",
  },
  hero: {
    eyebrow: "गावागावांचा हक्काचा सहाय्यक",
    titleLine1: "तुमची भाषा.",
    titleLine2: "तुमचा सहाय्यक.",
    description: "सरकारी योजना, शेती आणि महत्त्वाची माहिती. आता तुमच्या भाषेत, फक्त बोलून.",
    cta: "सुरू करा",
    helper: "तुमच्या भाषेत माहिती मिळवा.",
    imageAlt: "भातशेतीत कापणी करणाऱ्या ग्रामीण महिला",
  },
  languageSection: {
    title: "तुमची भाषा निवडा",
    description: "तुम्ही निवडलेल्या भाषेत संपूर्ण पान दिसेल. तुम्ही ती कधीही बदलू शकता.",
    selected: "निवडलेली",
  },
  services: {
    title: "आम्ही तुमची काय मदत करू शकतो?",
    subtitle: "रोजच्या गरजेची माहिती, एकाच ठिकाणी.",
    schemes: {
      title: "सरकारी योजना",
      description: "सरकारी योजना आणि त्यांच्या लाभांची माहिती.",
    },
    farming: {
      title: "शेतीविषयक सल्ला",
      description: "पिके, शेती आणि कृषी मार्गदर्शनाची माहिती.",
    },
    health: {
      title: "आरोग्य",
      description: "मूलभूत आरोग्य माहिती आणि जनजागृती.",
    },
  },
  howItWorks: {
    title: "हे कसे काम करते?",
    stepLabel: "पायरी",
    speak: { title: "बोला", description: "तुमचा प्रश्न तुमच्या भाषेत विचारा." },
    understand: { title: "समजून घ्या", description: "सहाय्यक तुमचा प्रश्न समजून घेईल." },
    know: { title: "जाणून घ्या", description: "तुम्हाला सोप्या भाषेत उत्तर मिळेल." },
  },
  lowBandwidth: {
    title: "कमकुवत नेटवर्कमध्येही सोपे",
    description: "कमकुवत नेटवर्क आणि साध्या फोनचा विचार करून बनवलेले.",
    lightweight: {
      title: "हलका इंटरफेस",
      description: "पान लवकर उघडते आणि साध्या स्मार्टफोनवरही सहज चालते.",
    },
    lowData: {
      title: "कमी डेटा वापर",
      description: "कमी चित्रे आणि हलक्या फायली, जेणेकरून तुमचा डेटा वाचेल.",
    },
    textOption: {
      title: "लिहूनही विचारा",
      description: "बोलणे शक्य नसेल, तर तुमचा प्रश्न लिहूनही विचारू शकता.",
    },
    sms: {
      title: "SMS सुविधा",
      description: "इंटरनेट नसताना SMS द्वारे माहिती मिळवण्याचा पर्याय.",
    },
  },
  ctaBanner: {
    title: "आजच सुरुवात करा",
    description: "तुमच्या मोबाइल नंबरने लॉग इन करा आणि तुमच्या भाषेत माहिती मिळवा.",
    cta: "सुरू करा",
  },
  footer: {
    rights: "सर्व हक्क राखीव.",
    photoCredit: "छायाचित्र",
  },
  login: {
    title: "लॉग इन",
    description: "मोबाइल OTP द्वारे लॉग इन करण्याची सुविधा लवकरच येथे उपलब्ध होईल.",
    backHome: "मुख्य पानावर परत जा",
  },
};

const gu: Dictionary = {
  common: {
    skipToContent: "મુખ્ય સામગ્રી પર જાઓ",
    tagline: "તમારી ભાષા. તમારો સહાયક.",
    homeLabel: "GramSathi મુખ્ય પેજ",
  },
  header: {
    menu: "મેનૂ ખોલો",
    closeMenu: "મેનૂ બંધ કરો",
    chooseLanguage: "ભાષા પસંદ કરો",
    navigation: "મુખ્ય નેવિગેશન",
  },
  nav: {
    services: "સેવાઓ",
    howItWorks: "આ કેવી રીતે કામ કરે છે",
    languages: "ભાષા",
    lowBandwidth: "ઓછા ડેટામાં",
    login: "લૉગ ઇન કરો",
  },
  hero: {
    eyebrow: "ગામેગામનો પોતાનો સહાયક",
    titleLine1: "તમારી ભાષા.",
    titleLine2: "તમારો સહાયક.",
    description: "સરકારી યોજના, ખેતી અને જરૂરી માહિતી. હવે તમારી ભાષામાં, ફક્ત બોલીને.",
    cta: "શરૂ કરો",
    helper: "તમારી ભાષામાં માહિતી મેળવો.",
    imageAlt: "ડાંગરના ખેતરમાં પાકની કાપણી કરતી ગ્રામીણ મહિલાઓ",
  },
  languageSection: {
    title: "તમારી ભાષા પસંદ કરો",
    description: "તમે પસંદ કરેલી ભાષામાં આખું પેજ દેખાશે. તમે તેને ગમે ત્યારે બદલી શકો છો.",
    selected: "પસંદ કરેલી",
  },
  services: {
    title: "અમે તમારી શું મદદ કરી શકીએ?",
    subtitle: "રોજબરોજની જરૂરી માહિતી, એક જ જગ્યાએ.",
    schemes: {
      title: "સરકારી યોજના",
      description: "સરકારી યોજનાઓ અને તેના લાભોની માહિતી.",
    },
    farming: {
      title: "ખેતીની સલાહ",
      description: "પાક, ખેતી અને કૃષિ માર્ગદર્શનની માહિતી.",
    },
    health: {
      title: "આરોગ્ય",
      description: "પાયાની આરોગ્ય માહિતી અને જાગૃતિ.",
    },
  },
  howItWorks: {
    title: "આ કેવી રીતે કામ કરે છે?",
    stepLabel: "પગલું",
    speak: { title: "બોલો", description: "તમારો સવાલ તમારી ભાષામાં પૂછો." },
    understand: { title: "સમજો", description: "સહાયક તમારો સવાલ સમજશે." },
    know: { title: "જાણો", description: "તમને સરળ ભાષામાં જવાબ મળશે." },
  },
  lowBandwidth: {
    title: "નબળા નેટવર્કમાં પણ સરળ",
    description: "નબળા નેટવર્ક અને સાદા ફોનને ધ્યાનમાં રાખીને બનાવેલું.",
    lightweight: {
      title: "હળવું ઇન્ટરફેસ",
      description: "પેજ ઝડપથી ખૂલે છે અને સાદા સ્માર્ટફોન પર પણ સરળતાથી ચાલે છે.",
    },
    lowData: {
      title: "ઓછો ડેટા વપરાશ",
      description: "ઓછા ફોટા અને હળવી ફાઇલો, જેથી તમારો ડેટા બચે.",
    },
    textOption: {
      title: "લખીને પણ પૂછો",
      description: "બોલવું શક્ય ન હોય, તો તમારો સવાલ લખીને પણ પૂછી શકો છો.",
    },
    sms: {
      title: "SMS સુવિધા",
      description: "ઇન્ટરનેટ ન હોય ત્યારે SMS દ્વારા માહિતી મેળવવાનો વિકલ્પ.",
    },
  },
  ctaBanner: {
    title: "આજે જ શરૂઆત કરો",
    description: "તમારા મોબાઇલ નંબરથી લૉગ ઇન કરો અને તમારી ભાષામાં માહિતી મેળવો.",
    cta: "શરૂ કરો",
  },
  footer: {
    rights: "સર્વાધિકાર સુરક્ષિત.",
    photoCredit: "ફોટો",
  },
  login: {
    title: "લૉગ ઇન",
    description: "મોબાઇલ OTP વડે લૉગ ઇન કરવાની સુવિધા ટૂંક સમયમાં અહીં ઉપલબ્ધ થશે.",
    backHome: "મુખ્ય પેજ પર પાછા જાઓ",
  },
};

export const dictionaries: Record<Language, Dictionary> = { hi, mr, gu };

export function getDictionary(language: Language): Dictionary {
  return dictionaries[language];
}
