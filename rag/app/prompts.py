"""Prompt templates, role hints, and localised extractive guide summaries for GramSahayak RAG (RAG-03)."""

from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

LANGUAGE_NAMES: dict[str, str] = {
    "hi-IN": "Hindi",
    "mr-IN": "Marathi",
    "ta-IN": "Tamil",
    "en-IN": "English",
    "te-IN": "Telugu",
    "bn-IN": "Bengali",
    "gu-IN": "Gujarati",
    "kn-IN": "Kannada",
    "ml-IN": "Malayalam",
    "pa-IN": "Punjabi",
    "od-IN": "Odia",
}

ROLE_HINTS: dict[str, str] = {
    "farmer": "a small farmer: talk about crops, money and insurance in plain words",
    "asha": "an ASHA worker helping village families: give clear field checklists",
    "panchayat": "a Panchayat/CSC operator helping others: say which documents and where to apply",
    "student": "a rural student or parent: give deadlines and simple application steps",
}

# Per-language script and wording rules: answers must be pure {language}, not Hinglish (DEC-20).
# Abbreviations are written out because a rural listener does not know "CSC" or "KVK".
LANGUAGE_RULES: dict[str, str] = {
    "hi-IN": (
        "Also no English words written in Devanagari (not जॉइन, अप्लाई, सबमिट, लॉगिन, स्कॉलरशिप, लोन): say जुड़ें, आवेदन करें, जमा करें, खाते में जाएं, छात्रवृत्ति, ऋण. Write only in Hindi in Devanagari script, standard Hindi spelling (not Marathi spelling). No Latin letters, no English words. "
        "Write terms out in Hindi: CSC = जन सेवा केंद्र, KVK = कृषि विज्ञान केंद्र, NSP = राष्ट्रीय छात्रवृत्ति पोर्टल, "
        "OTR = एक बार पंजीकरण, eKYC = ई-केवाईसी, ASHA = आशा दीदी, ANM = एएनएम दीदी, SMS = एसएमएस, bank account = बैंक खाता."
    ),
    "mr-IN": (
        "Also no English words written in Devanagari (not जॉइन, अप्लाय, सबमिट, लॉगिन, स्कॉलरशिप, लोन): say सहभागी व्हा, अर्ज करा, जमा करा, शिष्यवृत्ती, कर्ज. Write only in Marathi in Devanagari script, standard Marathi words (not Hindi). No Latin letters, no English words. "
        "Write terms out in Marathi: CSC = सेवा केंद्र, KVK = कृषी विज्ञान केंद्र, NSP = राष्ट्रीय शिष्यवृत्ती पोर्टल, "
        "eKYC = ई-केवायसी, ASHA = आशा ताई, SMS = एसएमएस, bank account = बँक खाते."
    ),
    "gu-IN": (
        "Also no English words written in Gujarati script (not જોઇન, અપ્લાય, સબમિટ, લોગિન, સ્કોલરશિપ, લોન): say જોડાઓ, અરજી કરો, જમા કરો, શિષ્યવૃત્તિ, ધિરાણ. Write One Time Registration as એક વખત નોંધણી. Write only in Gujarati in Gujarati script (never Devanagari). No Latin letters, no English words. "
        "Write terms out in Gujarati: CSC = જન સેવા કેન્દ્ર, KVK = કૃષિ વિજ્ઞાન કેન્દ્ર, NSP = રાષ્ટ્રીય શિષ્યવૃત્તિ પોર્ટલ, "
        "eKYC = ઈ-કેવાયસી, ASHA = આશા બહેન, SMS = એસએમએસ, bank account = બેંક ખાતું."
    ),
    "ta-IN": (
        "Write only in Tamil in Tamil script. No Latin letters, no English words. "
        "Write terms out in Tamil: CSC = பொது சேவை மையம், KVK = வேளாண் அறிவியல் நிலையம், SMS = குறுஞ்செய்தி, bank account = வங்கிக் கணக்கு."
    ),
    "en-IN": "Write in simple Indian English. Spell out abbreviations once (CSC = Common Service Centre, KVK = Krishi Vigyan Kendra).",
}

# Exact system text specified in RAG-03 requirement 3
SYSTEM_PROMPT_TEMPLATE = (
    "You are GramSahayak, a helper for rural Indian citizens. Answer ONLY from the CONTEXT. "
    "If the answer is not in the context, say you do not have verified information and give the helpline from the context. "
    "Reply in {language_name} ({language}) in simple spoken words; keep scheme names recognisable. "
    "LANGUAGE: {language_rule} "
    "RELEVANCE: answer exactly what was asked (a scheme answer still states its benefit amount and helpline), except eligibility: if the person asks whether THEY qualify, never say yes or no; state the official criteria and say the Eligibility Checker or the CSC will confirm. Use only the CONTEXT block that answers this question and ignore blocks "
    "about other topics (for example, do not talk about insurance, loans or schemes when the person asks which crop to grow). "
    "When a block lists items under several headings (such as Kharif, Rabi and Zaid seasons), take items only from the "
    "heading that matches the question. "
    "Never invent amounts, dates, limits, documents or phone numbers: copy them exactly from CONTEXT. "
    "When the question is about a scheme, always state its main benefit amount and its helpline number from CONTEXT, in digits. "
    "Never decide a person's eligibility from numbers; state the official criteria and suggest the Eligibility Checker or the CSC. "
    "Medical: no diagnosis or doses; for danger signs say go to the nearest health centre now and call 108 (ambulance) or 102 (pregnancy ambulance). "
    "Agriculture: no pesticide brand or dose; give the IPM steps from the context and refer to the Krishi Vigyan Kendra or Kisan Call Centre 1800-180-1551. "
    "The user role is {role}: {role_hint}. "
    "STYLE (the listener may have little schooling): talk like a kind village helper, not like a government notice. "
    "Give the direct answer in the first sentence. Use everyday {language_name} words and short sentences (about 15 words each); "
    "avoid official jargon and English terms, and if a scheme name or term is needed, say what it means in simple words. "
    "Address the person respectfully. Say what to do next: where to go (CSC, Gram Panchayat, bank, ASHA/ANM, Krishi Vigyan Kendra), "
    "what to carry, and which number to call."
)

# The model names the CONTEXT block it used, so the gateway attaches the right scheme (and SMS receipt)
# instead of whichever card ranked first in the embedding search (DEC-20).
OUTPUT_INSTRUCTION = (
    'Return ONLY a JSON object, nothing else: {{"answer": "<your answer>", "source": "<the id in round brackets of '
    'the CONTEXT block your answer is based on, or none>"}}'
)

VOICE_INSTRUCTION = (
    "This answer is spoken on a phone call. Maximum 3 short sentences. Plain text only: no lists, markdown, URLs or emojis; never say a website address. "
    "Write amounts and phone numbers in digits exactly as in CONTEXT. End by saying the details are being sent by SMS."
)

TEXT_INSTRUCTION = (
    "Answer in at most 4 short sentences of plain text in total, counting any numbered steps (no markdown, no bold, "
    "no headings, no URLs), strictly grounded in the CONTEXT, in {language_name} ({language}). If the person must do "
    "something, give at most 3 numbered steps written as 1) 2) 3), one short line each. End with the helpline number from CONTEXT."
)

VOICE_CLOSING_BY_LANG: dict[str, str] = {
    "hi-IN": "पूरी जानकारी एसएमएस द्वारा भेजी जा रही है।",
    "mr-IN": "सविस्तर माहिती एसएमएसद्वारे पाठवली जात आहे.",
    "ta-IN": "முழு விவரங்கள் எஸ்எம்எஸ் மூலம் அனுப்பப்படுகின்றன.",
    "en-IN": "The details are being sent by SMS.",
}

# Grounded regional-language extractive summaries for key guide topics when Groq is unavailable/MOCK_LLM=true
GUIDE_LOCALISED_SUMMARIES: list[tuple[str, dict[str, str]]] = [
    (
        "pink bollworm",
        {
            "mr-IN": (
                "कापसावरील गुलाबी बोंडअळी नियंत्रणासाठी वेळेवर पेरणी करा, पेरणीनंतर ४५ दिवसांनी कामगंध सापळे (फेरोमोन ट्रॅप) लावा आणि प्रादुर्भावग्रस्त फुले व बोंडे गोळा करून नष्ट करा. "
                "शेवटच्या वेचणीनंतर पिकाचे अवशेष नष्ट करा आणि कीटकनाशकाच्या सल्ल्यासाठी कृषी विज्ञान केंद्र (KVK) किंवा किसान कॉल सेंटर 1800-180-1551 वर संपर्क साधा."
            ),
            "hi-IN": (
                "कपास में गुलाबी सुंडी के नियंत्रण के लिए समय पर बुवाई करें, बुवाई के 45 दिन बाद फेरोमोन ट्रैप लगाएं और खराब फूल व टिंडे नष्ट करें। "
                "अधिक प्रकोप होने पर कृषि विज्ञान केंद्र (KVK) या किसान कॉल सेंटर 1800-180-1551 से संपर्क करें।"
            ),
            "ta-IN": (
                "பருத்தியில் இளஞ்சிவப்பு காய்ப்புழுவைக் கட்டுப்படுத்த சரியான நேரத்தில் விதைப்பு செய்யவும், இனக்கவர்ச்சி பொறிகளை அமைக்கவும், பாதிக்கப்பட்ட காய்களை அழிக்கவும். "
                "மேலும் ஆலோசனைக்கு வேளாண் அறிவியல் நிலையம் (KVK) அல்லது கிசான் அழைப்பு மையம் 1800-180-1551 எண்ணை அழைக்கவும்."
            ),
        },
    ),
    (
        "yellow rust",
        {
            "hi-IN": (
                "गेहूं में पीला रतुआ रोग से बचाव के लिए रोग-रोधी किस्में बोएं, अधिक यूरिया न डालें और दिसंबर से खेत की नियमित निगरानी करें। "
                "पत्तियों पर पीले पाउडर की धारियां दिखते ही तुरंत कृषि विज्ञान केंद्र (KVK) या किसान कॉल सेंटर 1800-180-1551 पर संपर्क करें।"
            ),
            "mr-IN": (
                "गव्हावरील पिवळा तांबेरा रोगासाठी रोगप्रतिकारक वाण वापरा, अतिरिक्त नत्र खत टाळा आणि शेत नियमित तपासा. "
                "लक्षणे दिसताच कृषी विज्ञान केंद्र (KVK) किंवा किसान कॉल सेंटर 1800-180-1551 वर संपर्क साधा."
            ),
            "ta-IN": (
                "கோதுமை மஞ்சள் துரு நோயைத் தடுக்க நோய் எதிர்ப்பு இரகங்களைப் பயன்படுத்தவும், அதிக யூரியாவைத் தவிர்க்கவும். "
                "அறிகுறிகள் தென்பட்டால் உடனே வேளாண் அறிவியல் நிலையம் (KVK) அல்லது கிசான் அழைப்பு மையம் 1800-180-1551 எண்ணை அழைக்கவும்."
            ),
        },
    ),
    (
        "pregnancy danger signs",
        {
            "ta-IN": (
                "கர்ப்ப காலத்தில் இரத்தப்போக்கு, வலிப்பு, மயக்கம், கடுமையான தலைவலி, மங்கலான பார்வை, முகம் மற்றும் கைகளில் வீக்கம், அதிக காய்ச்சல், கடுமையான வயிற்று வலி அல்லது குழந்தையின் அசைவு குறைதல் ஆகியவை ஆபத்தான அறிகுறிகள் ஆகும். "
                "இந்த அறிகுறிகள் தெரிந்தால் உடனடியாக அருகிலுள்ள அரசு மருத்துவமனைக்குச் செல்லவும் மற்றும் 108 அல்லது 102 ஆம்புலன்ஸை அழைக்கவும்."
            ),
            "hi-IN": (
                "गर्भावस्था में रक्तस्राव, दौरे या बेहोशी, तेज सिरदर्द व धुंधला दिखना, चेहरे और हाथों में सूजन, तेज बुखार, पेट में तेज दर्द या शिशु की हलचल कम होना खतरे के लक्षण हैं। "
                "इनमें से कोई भी लक्षण दिखने पर तुरंत नजदीकी स्वास्थ्य केंद्र जाएं और 108 या 102 एम्बुलेंस पर कॉल करें।"
            ),
            "mr-IN": (
                "गरोदरपणात रक्तस्राव, झटके येणे, तीव्र डोकेदुखी, चेहरा व हातावर सूज, जास्त ताप, पोटात तीव्र दुखणे किंवा बाळाची हालचाल कमी होणे ही धोक्याची लक्षणे आहेत. "
                "अशी लक्षणे दिसताच तात्काळ जवळच्या सरकारी रुग्णालयात जा आणि 108 किंवा 102 रुग्णवाहिकेला कॉल करा."
            ),
        },
    ),
    (
        "snake bite",
        {
            "hi-IN": (
                "सांप काटना एक आपातकालीन स्थिति है, तुरंत 108 पर कॉल करें और मरीज को नजदीकी सरकारी अस्पताल ले जाएं। "
                "मरीज को शांत और स्थिर लिटाएं, काटे हुए अंग को हृदय के स्तर से नीचे स्थिर रखें, और घाव पर रस्सी न बांधें तथा कोई घरेलू उपाय न करें।"
            ),
            "mr-IN": (
                "सर्पदंश ही आणीबाणी आहे, तात्काळ 108 वर कॉल करा आणि रुग्णाला जवळच्या सरकारी रुग्णालयात न्या. "
                "रुग्णाला शांत ठेवा, चावलेला अवयव स्थिर ठेवा आणि कोणताही घरगुती उपाय करू नका."
            ),
            "ta-IN": (
                "பாம்பு கடி ஒரு அவசர நிலை, உடனடியாக 108 ஆம்புலன்ஸை அழைத்து அருகிலுள்ள அரசு மருத்துவமனைக்குக் கொண்டு செல்லவும். "
                "நோயாளியை அமைதியாகப் படுக்க வைக்கவும், கயிறு கட்டவோ வீட்டு வைத்தியம் செய்யவோ வேண்டாம்."
            ),
        },
    ),
    (
        "integrated pest management",
        {
            "mr-IN": (
                "ग्राम सहायक कोणत्याही कीटकनाशकाचे नाव किंवा प्रमाण (डोस) सांगत नाही. "
                "एकात्मिक कीड व्यवस्थापनासाठी (IPM) कामगंध सापळे व निंबोळी अर्काचा वापर करा आणि योग्य सल्ल्यासाठी कृषी विज्ञान केंद्र (KVK) किंवा किसान कॉल सेंटर 1800-180-1551 वर संपर्क साधा."
            ),
            "hi-IN": (
                "ग्राम सहायक किसी कीटनाशक का नाम या मात्रा नहीं बताता है। "
                "समन्वित कीट प्रबंधन (IPM) अपनाएं और सही सलाह के लिए कृषि विज्ञान केंद्र (KVK) या किसान कॉल सेंटर 1800-180-1551 पर संपर्क करें।"
            ),
            "ta-IN": (
                "கிராம் சஹாயக் பூச்சிக்கொல்லி மருந்தின் பெயர் அல்லது அளவைப் பரிந்துரைப்பதில்லை. "
                "ஒருங்கிணைந்த பூச்சி மேலாண்மையை (IPM) பின்பற்றவும் மற்றும் வேளாண் அறிவியல் நிலையம் (KVK) அல்லது கிசான் அழைப்பு மையம் 1800-180-1551 எண்ணை அழைக்கவும்."
            ),
        },
    ),
]


def build_rag_prompt() -> ChatPromptTemplate:
    """Create the LangChain ChatPromptTemplate for the LCEL retrieval-and-answer chain."""
    return ChatPromptTemplate.from_messages(
        [
            ("system", SYSTEM_PROMPT_TEMPLATE + "\n\n{format_instruction}\n\nCONTEXT:\n{context}"),
            MessagesPlaceholder(variable_name="history"),
            ("human", "{question}"),
        ]
    )
