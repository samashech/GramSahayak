"""Safety guardrails, dose/brand refusals, out-of-scope, and prompt-injection handling (RAG-04)."""

import re
from typing import Any, List, Optional

from app.prompts import VOICE_CLOSING_BY_LANG
from app.safety_terms import (
    AGRI_DOSE_TERMS_BY_LANG,
    EMERGENCY_TERMS_BY_LANG,
    MEDICAL_DOSE_TERMS_BY_LANG,
    NON_EMERGENCY_SCHEME_MARKERS_BY_LANG,
    OUT_OF_SCOPE_TERMS_BY_LANG,
    PROMPT_INJECTION_PATTERNS_BY_LANG,
    SNAKE_BARE_WORDS_BY_LANG,
    URGENT_ACTION_MARKERS_BY_LANG,
)
from app.schemas import SourceItem

HEALTH_GUIDE_SOURCE = SourceItem(
    id="GUIDE_HEALTH_1",
    title="GramSahayak Health Guide for ASHA and Anganwadi Workers (health) — Emergency numbers",
    category="health",
    helpline="108 / 102 / 104",
    portal="https://nhm.gov.in",
)

SNAKE_BITE_GUIDE_SOURCE = SourceItem(
    id="GUIDE_HEALTH_7",
    title="GramSahayak Health Guide for ASHA and Anganwadi Workers (health) — Snake bite first aid",
    category="health",
    helpline="108 / 102 / 104",
    portal="https://nhm.gov.in",
)

PREGNANCY_GUIDE_SOURCE = SourceItem(
    id="GUIDE_HEALTH_3",
    title="GramSahayak Health Guide for ASHA and Anganwadi Workers (health) — Pregnancy danger signs (go to hospital now)",
    category="health",
    helpline="108 / 102 / 104",
    portal="https://nhm.gov.in",
)

AGRI_IPM_GUIDE_SOURCE = SourceItem(
    id="GUIDE_AGRI_2",
    title="GramSahayak Agriculture Guide (agri) — Integrated Pest Management (IPM) basics",
    category="agri",
    helpline="1800-180-1551",
    portal="https://soilhealth.dac.gov.in",
)

EMERGENCY_ANSWERS: dict[str, dict[str, str]] = {
    "snake_bite": {
        "hi-IN": (
            "तुरंत 108 एम्बुलेंस पर कॉल करें और मरीज को तुरंत नजदीकी सरकारी अस्पताल ले जाएं। "
            "मरीज को शांत और स्थिर लिटाएं, काटे हुए अंग को हृदय के स्तर से नीचे स्थिर रखें, और घाव पर रस्सी न बांधें तथा कोई घरेलू उपाय या झाड़-फूंक न करें।"
        ),
        "mr-IN": (
            "तात्काळ 108 रुग्णवाहिकेवर कॉल करा आणि रुग्णाला ताबडतोब जवळच्या सरकारी रुग्णालयात न्या. "
            "रुग्णाला शांत व स्थिर झोपवा, चावलेला अवयव हृदयाच्या पातळीखाली स्थिर ठेवा आणि कोणताही दोर बांधू नका किंवा घरगुती उपाय करू नका."
        ),
        "ta-IN": (
            "உடனடியாக 108 ஆம்புலன்ஸை அழைத்து, நோயாளியை உடனே அருகிலுள்ள அரசு மருத்துவமனைக்குக் கொண்டு செல்லவும். "
            "நோயாளியை அமைதியாகவும் அசையாமலும் படுக்க வைக்கவும்; கயிறு கட்டவோ, கீறவோ அல்லது எந்த வீட்டு வைத்தியமும் செய்யவோ வேண்டாம்."
        ),
        "en-IN": (
            "Call 108 ambulance immediately and take the person to the nearest government hospital with anti-snake venom now. "
            "Keep the person calm and still with the bitten limb below heart level; do not tie a tourniquet, cut the wound, or try any home remedies."
        ),
    },
    "pregnancy": {
        "hi-IN": (
            "यह गर्भावस्था में खतरे का लक्षण है — तुरंत 108 या 102 गर्भवती एम्बुलेंस पर कॉल करें और महिला को तुरंत नजदीकी सरकारी स्वास्थ्य केंद्र या अस्पताल ले जाएं। "
            "बिल्कुल देरी न करें, कोई घरेलू उपाय न करें और साथ में MCP कार्ड व आधार कार्ड ले जाएं।"
        ),
        "mr-IN": (
            "हे गरोदरपणातील धोक्याचे लक्षण आहे — तात्काळ 108 किंवा 102 रुग्णवाहिकेला कॉल करा आणि महिलेला ताबडतोब जवळच्या सरकारी रुग्णालयात न्या. "
            "वेळ घालवू नका, कोणताही घरगुती उपाय करू नका आणि MCP कार्ड सोबत ठेवा."
        ),
        "ta-IN": (
            "இது கர்ப்ப கால ஆபத்தான அறிகுறியாகும் — உடனடியாக 108 அல்லது 102 ஆம்புலன்ஸை அழைத்து அருகிலுள்ள அரசு மருத்துவமனைக்கு உடனே செல்லவும். "
            "தாமதிக்க வேண்டாம், எந்த வீட்டு வைத்தியமும் செய்ய வேண்டாம், MCP அட்டையை உடன் எடுத்துச் செல்லவும்."
        ),
        "en-IN": (
            "This is a pregnancy danger sign — call 108 or 102 pregnancy ambulance immediately and go to the nearest government health centre now. "
            "Do not wait or try any home remedies, and carry the MCP card with you."
        ),
    },
    "general_medical": {
        "hi-IN": (
            "यह एक गंभीर चिकित्सा आपातकाल है — तुरंत 108 एम्बुलेंस पर कॉल करें और मरीज को तुरंत नजदीकी सरकारी अस्पताल या स्वास्थ्य केंद्र ले जाएं। "
            "मरीज को सुरक्षित व शांत रखें और बिना डॉक्टर की सलाह के कोई दवा या घरेलू उपाय न दें (स्वास्थ्य हेल्पलाइन: 104)।"
        ),
        "mr-IN": (
            "ही एक गंभीर वैद्यकीय आणीबाणी आहे — तात्काळ 108 रुग्णवाहिकेवर कॉल करा आणि रुग्णाला ताबडतोब जवळच्या सरकारी रुग्णालयात न्या. "
            "रुग्णाला शांत ठेवा आणि डॉक्टरांच्या सल्ल्याशिवाय कोणतेही औषध किंवा घरगुती उपाय देऊ नका (आरोग्य हेल्पलाइन: 104)."
        ),
        "ta-IN": (
            "இது ஒரு அவசர மருத்துவ நிலை — உடனடியாக 108 ஆம்புலன்ஸை அழைத்து நோயாளியை உடனே அருகிலுள்ள அரசு மருத்துவமனைக்குக் கொண்டு செல்லவும். "
            "நோயாளியை அமைதியாக வைத்திருங்கள், மருத்துவர் ஆலோசனையின்றி எந்த மருந்தும் கொடுக்க வேண்டாம் (சுகாதார உதவி எண்: 104)."
        ),
        "en-IN": (
            "This is a medical emergency — call 108 ambulance immediately and take the person to the nearest government hospital or health centre now. "
            "Keep the person calm and safe, and do not give any medicine or home remedy without a doctor (health helpline: 104)."
        ),
    },
}

AGRI_DOSE_REFUSAL_ANSWERS: dict[str, str] = {
    "hi-IN": (
        "ग्राम सहायक किसी कीटनाशक का ब्रांड नाम या मात्रा (डोस) नहीं बताता है। "
        "कृपया समन्वित कीट प्रबंधन (IPM) के सुरक्षित तरीके जैसे फेरोमोन ट्रैप और नीम आधारित उपाय अपनाएं, और सही सलाह व मात्रा के लिए अपने जिले के कृषि विज्ञान केंद्र (KVK) या किसान कॉल सेंटर 1800-180-1551 पर संपर्क करें।"
    ),
    "mr-IN": (
        "ग्राम सहायक कोणत्याही कीटकनाशकाचे नाव किंवा प्रमाण (डोस) सांगत नाही. "
        "कृपया एकात्मिक कीड व्यवस्थापनाचे (IPM) सुरक्षित उपाय जसे कामगंध सापळे व निंबोळी अर्क वापरा, आणि अचूक सल्ल्यासाठी कृषी विज्ञान केंद्र (KVK) किंवा किसान कॉल सेंटर 1800-180-1551 वर संपर्क साधा."
    ),
    "ta-IN": (
        "கிராம் சஹாயக் எந்தப் பூச்சிக்கொல்லி மருந்தின் பெயரையோ அல்லது அளவையோ (டோஸ்) பரிந்துரைப்பதில்லை. "
        "ஒருங்கிணைந்த பூச்சி மேலாண்மை (IPM) முறைகளைப் பின்பற்றவும்; சரியான ஆலோசனைக்கு உங்கள் மாவட்ட வேளாண் அறிவியல் நிலையம் (KVK) அல்லது கிசான் அழைப்பு மையம் 1800-180-1551 எண்ணை அழைக்கவும்."
    ),
    "en-IN": (
        "GramSahayak does not recommend pesticide brands or chemical doses. "
        "Please follow safe Integrated Pest Management (IPM) steps such as pheromone traps and neem-based measures, and contact your district Krishi Vigyan Kendra (KVK) or the Kisan Call Centre at 1800-180-1551 for exact advice."
    ),
}

MEDICAL_DOSE_REFUSAL_ANSWERS: dict[str, str] = {
    "hi-IN": (
        "ग्राम सहायक बीमारी का निदान या किसी दवा की खुराक (डोस) नहीं बताता है। "
        "कृपया तुरंत नजदीकी सरकारी स्वास्थ्य केंद्र, आशा/एएनएम कार्यकर्ता से मिलें या स्वास्थ्य हेल्पलाइन 104 (आपातकाल में 108 / 102) पर कॉल करें।"
    ),
    "mr-IN": (
        "ग्राम सहायक आजाराचे निदान किंवा औषधाचा डोस सांगत नाही. "
        "कृपया जवळच्या सरकारी आरोग्य केंद्रात, आशा/एएनएम कार्यकर्त्यांशी संपर्क साधा किंवा आरोग्य हेल्पलाइन 104 (आपत्कालीन स्थितीत 108 / 102) वर कॉल करा."
    ),
    "ta-IN": (
        "கிராம் சஹாயக் நோய் கண்டறிதல் அல்லது மருந்து அளவுகளை (டோஸ்) வழங்குவதில்லை. "
        "தயவுசெய்து அருகிலுள்ள அரசு ஆரம்ப சுகாதார நிலையம், ஆஷா/ஏஎன்எம் பணியாளரை அணுகவும் அல்லது சுகாதார உதவி எண் 104 (அவசரத்திற்கு 108 / 102) எண்ணை அழைக்கவும்."
    ),
    "en-IN": (
        "GramSahayak does not diagnose illness or provide medicine doses. "
        "Please visit the nearest government health centre or ANM/ASHA worker, or call the health helpline 104 (or 108 / 102 in an emergency)."
    ),
}

OUT_OF_SCOPE_ANSWERS: dict[str, str] = {
    "hi-IN": (
        "ग्राम सहायक केवल सरकारी योजनाओं, खेती-किसानी, मातृ एवं ग्रामीण स्वास्थ्य और छात्रवृत्ति से जुड़े सवालों में मदद करता है। "
        "कृपया इन विषयों से जुड़ा प्रश्न पूछें, या सहायता के लिए किसान कॉल सेंटर 1800-180-1551 अथवा स्वास्थ्य हेल्पलाइन 104 पर संपर्क करें।"
    ),
    "mr-IN": (
        "ग्राम सहायक फक्त सरकारी योजना, शेती, माता व ग्रामीण आरोग्य आणि शिष्यवृत्ती या विषयांवर मदत करतो. "
        "कृपया या विषयांशी संबंधित प्रश्न विचारा, किंवा मदतीसाठी किसान कॉल सेंटर 1800-180-1551 किंवा आरोग्य हेल्पलाइन 104 वर संपर्क साधा."
    ),
    "ta-IN": (
        "கிராம் சஹாயக் அரசுத் திட்டங்கள், விவசாயம், தாய் சேய் மற்றும் கிராமப்புற சுகாதாரம், மற்றும் மாணவர் உதவித்தொகை குறித்த கேள்விகளுக்கு மட்டுமே உதவுகிறது. "
        "தயவுசெய்து இவை தொடர்பான கேள்விகளைக் கேட்கவும், அல்லது கிசான் அழைப்பு மையம் 1800-180-1551 / சுகாதார உதவி எண் 104-ஐ அழைக்கவும்."
    ),
    "en-IN": (
        "GramSahayak helps only with government schemes, farming, maternal and rural health, and student scholarships. "
        "Please ask a question on those topics, or call the Kisan Call Centre at 1800-180-1551 or health helpline 104 for assistance."
    ),
}

UNVERIFIED_SCHEME_ANSWERS: dict[str, str] = {
    "hi-IN": (
        "हमारे पास इस विशिष्ट योजना पर सत्यापित जानकारी उपलब्ध नहीं है; ग्राम सहायक प्रमुख केंद्रीय योजनाओं, खेती, स्वास्थ्य और छात्रवृत्ति में मदद करता है। "
        "सत्यापित जानकारी के लिए कृपया अपने नजदीकी सीएससी (CSC), ग्राम पंचायत, किसान कॉल सेंटर 1800-180-1551 या हेल्पलाइन 104 पर संपर्क करें।"
    ),
    "mr-IN": (
        "आमच्याकडे या विशिष्ट योजनेची सत्यापित माहिती उपलब्ध नाही; ग्राम सहायक प्रमुख केंद्रीय योजना, शेती, आरोग्य आणि शिष्यवृत्तीमध्ये मदत करतो. "
        "अधिकृत माहितीसाठी कृपया जवळच्या CSC, ग्रामपंचायत, किसान कॉल सेंटर 1800-180-1551 किंवा हेल्पलाइन 104 वर संपर्क साधा."
    ),
    "ta-IN": (
        "இந்தக் குறிப்பிட்ட திட்டம் பற்றிய சரிபார்க்கப்பட்ட தகவல் எங்களிடம் இல்லை; கிராம் சஹாயக் முக்கிய மத்திய திட்டங்கள், விவசாயம், சுகாதாரம் மற்றும் உதவித்தொகைக்கு உதவுகிறது. "
        "உறுதியான தகவலுக்கு அருகிலுள்ள CSC, கிராம பஞ்சாயத்து, கிசான் அழைப்பு மையம் 1800-180-1551 அல்லது 104 எண்ணை அணுகவும்."
    ),
    "en-IN": (
        "We do not have verified information on that specific scheme in our verified database; GramSahayak helps with flagship central schemes, farming, health, and scholarships. "
        "Please check with your nearest CSC, Gram Panchayat, Kisan Call Centre 1800-180-1551, or helpline 104."
    ),
}


def _contains_any(text_lower: str, phrases: List[str]) -> bool:
    return any(p.lower() in text_lower for p in phrases)


def _all_terms(lang_map: dict[str, list[str]]) -> List[str]:
    out: List[str] = []
    for terms in lang_map.values():
        out.extend(terms)
    return out


def _is_scheme_or_compensation_inquiry(query_lower: str) -> bool:
    """Return True if the query asks about a compensation scheme/policy rather than an active emergency."""
    has_scheme_marker = _contains_any(query_lower, _all_terms(NON_EMERGENCY_SCHEME_MARKERS_BY_LANG))
    has_urgent_marker = _contains_any(query_lower, _all_terms(URGENT_ACTION_MARKERS_BY_LANG))
    return has_scheme_marker and not has_urgent_marker


def detect_prompt_injection(query: str) -> bool:
    """Return True if user text attempts prompt injection, rule changes, system-prompt leaks, or role-play."""
    q_lower = query.lower().strip()
    if _contains_any(q_lower, _all_terms(PROMPT_INJECTION_PATTERNS_BY_LANG)):
        return True
    injection_regexes = [
        r"\bignore\b.*\b(?:instructions|rules|prompt)\b",
        r"\b(?:reveal|print|show|output|repeat)\b.*\b(?:system\s+prompt|hidden\s+prompt|instructions)\b",
        r"\b(?:act\s+as|pretend\s+to\s+be|you\s+are\s+now)\b.*\b(?:dan|unrestricted|doctor|dealer)\b",
    ]
    return any(re.search(pattern, q_lower) for pattern in injection_regexes)


def detect_emergency(query: str) -> Optional[str]:
    """
    Return the emergency type ('snake_bite', 'pregnancy', or 'general_medical') if an active
    emergency is detected, else None.
    Ensures normal questions that merely contain 'सांप' (e.g. about a snake-bite compensation scheme)
    are NOT treated as emergencies unless they ask what to do now.
    """
    q_lower = query.lower().strip()

    if _is_scheme_or_compensation_inquiry(q_lower):
        return None

    # Check snake bite specifically
    snake_bite_phrases = _all_terms(EMERGENCY_TERMS_BY_LANG["snake_bite"])
    snake_bare_words = _all_terms(SNAKE_BARE_WORDS_BY_LANG)
    urgent_markers = _all_terms(URGENT_ACTION_MARKERS_BY_LANG)

    if _contains_any(q_lower, snake_bite_phrases):
        return "snake_bite"
    if _contains_any(q_lower, snake_bare_words) and _contains_any(q_lower, urgent_markers):
        return "snake_bite"

    # Check pregnancy emergencies
    if _contains_any(q_lower, _all_terms(EMERGENCY_TERMS_BY_LANG["pregnancy_bleeding"])) or _contains_any(
        q_lower, _all_terms(EMERGENCY_TERMS_BY_LANG["no_fetal_movement"])
    ):
        return "pregnancy"

    # Check general medical emergencies
    for key in ("chest_pain", "unconscious", "poisoning", "convulsions"):
        if _contains_any(q_lower, _all_terms(EMERGENCY_TERMS_BY_LANG[key])):
            return "general_medical"

    return None


def detect_dose_or_brand_request(query: str, category: Optional[str] = None) -> Optional[str]:
    """Return 'agri_dose' or 'medical_dose' when the user asks for pesticide/medicine quantity or brand."""
    q_lower = query.lower().strip()

    if _contains_any(q_lower, _all_terms(AGRI_DOSE_TERMS_BY_LANG)):
        return "agri_dose"
    if _contains_any(q_lower, _all_terms(MEDICAL_DOSE_TERMS_BY_LANG)):
        return "medical_dose"

    # Generic pattern for pesticide quantity in Marathi/Hindi/Tamil/English
    if any(w in q_lower for w in ("कीटकनाशक", "कीटनाशक", "pesticide", "insecticide", "fungicide", "பூச்சிக்கொல்லி")) and any(
        q in q_lower for q in ("किती", "कितना", "कितनी", "डोस", "मात्रा", "प्रमाण", "अளவு", "எவ்வளவு", "dose", "how much", "quantity")
    ):
        return "agri_dose"

    return None


def detect_explicit_out_of_scope(query: str) -> bool:
    """Return True if the query explicitly asks about an off-topic subject (cricket, movies, stocks, etc.)."""
    q_lower = query.lower().strip()
    return _contains_any(q_lower, _all_terms(OUT_OF_SCOPE_TERMS_BY_LANG))


def detect_unverified_snake_scheme_inquiry(query: str) -> bool:
    """Return True when a query asks about a snake-bite compensation/scheme not in the 13 flagship cards."""
    q_lower = query.lower().strip()
    has_snake = _contains_any(q_lower, _all_terms(SNAKE_BARE_WORDS_BY_LANG))
    return has_snake and _is_scheme_or_compensation_inquiry(q_lower)


def build_out_of_scope_override(language: str, for_voice: bool = False) -> dict[str, Any]:
    """Return the standardized out-of-scope response dictionary."""
    ans = OUT_OF_SCOPE_ANSWERS.get(language, OUT_OF_SCOPE_ANSWERS["en-IN"])
    if for_voice:
        closing = VOICE_CLOSING_BY_LANG.get(language, VOICE_CLOSING_BY_LANG["en-IN"])
        ans = f"{ans} {closing}"
    return {
        "answer": ans,
        "sources": [],
        "matched_scheme_id": None,
        "sms_summary": None,
        "confidence": 0.0,
    }


def sanitize_retrieved_context(text: str) -> str:
    """Treat retrieved text strictly as data only by neutralizing instruction-override strings."""
    sanitized = re.sub(
        r"(?i)(ignore\s+(?:all\s+)?previous\s+instructions|system\s+prompt|you\s+are\s+now\s+dan)",
        "[filtered-data]",
        text,
    )
    return sanitized


def check_safety_override(
    query: str,
    language: str,
    category: Optional[str] = None,
    for_voice: bool = False,
) -> Optional[dict[str, Any]]:
    """
    Evaluate safety, prompt-injection, dose refusal, and explicit out-of-scope rules before calling the LLM.
    Returns a pre-built response dict when triggered, or None for normal queries.
    """
    lang_key = language if language in ("hi-IN", "mr-IN", "ta-IN", "en-IN") else "en-IN"

    # 1. Prompt-injection guard (RAG-04 requirement 4)
    if detect_prompt_injection(query):
        return build_out_of_scope_override(lang_key, for_voice=for_voice)

    # 2. Emergency guard (RAG-04 requirement 1)
    emergency_kind = detect_emergency(query)
    if emergency_kind is not None:
        ans = EMERGENCY_ANSWERS[emergency_kind][lang_key]
        if for_voice:
            closing = VOICE_CLOSING_BY_LANG.get(lang_key, VOICE_CLOSING_BY_LANG["en-IN"])
            ans = f"{ans} {closing}"
        if emergency_kind == "snake_bite":
            sources = [SNAKE_BITE_GUIDE_SOURCE, HEALTH_GUIDE_SOURCE]
        elif emergency_kind == "pregnancy":
            sources = [PREGNANCY_GUIDE_SOURCE, HEALTH_GUIDE_SOURCE]
        else:
            sources = [HEALTH_GUIDE_SOURCE]
        return {
            "answer": ans,
            "sources": sources,
            "matched_scheme_id": None,
            "sms_summary": None,
            "confidence": 1.0,
        }

    # 3. Dose and brand refusal guard (RAG-04 requirement 2)
    dose_kind = detect_dose_or_brand_request(query, category=category)
    if dose_kind == "agri_dose":
        ans = AGRI_DOSE_REFUSAL_ANSWERS[lang_key]
        if for_voice:
            closing = VOICE_CLOSING_BY_LANG.get(lang_key, VOICE_CLOSING_BY_LANG["en-IN"])
            ans = f"{ans} {closing}"
        return {
            "answer": ans,
            "sources": [AGRI_IPM_GUIDE_SOURCE],
            "matched_scheme_id": None,
            "sms_summary": None,
            "confidence": 1.0,
        }
    if dose_kind == "medical_dose":
        ans = MEDICAL_DOSE_REFUSAL_ANSWERS[lang_key]
        if for_voice:
            closing = VOICE_CLOSING_BY_LANG.get(lang_key, VOICE_CLOSING_BY_LANG["en-IN"])
            ans = f"{ans} {closing}"
        return {
            "answer": ans,
            "sources": [HEALTH_GUIDE_SOURCE],
            "matched_scheme_id": None,
            "sms_summary": None,
            "confidence": 1.0,
        }

    # 4. Non-emergency snake compensation / unverified state-specific scheme inquiry
    if detect_unverified_snake_scheme_inquiry(query):
        ans = UNVERIFIED_SCHEME_ANSWERS[lang_key]
        if for_voice:
            closing = VOICE_CLOSING_BY_LANG.get(lang_key, VOICE_CLOSING_BY_LANG["en-IN"])
            ans = f"{ans} {closing}"
        return {
            "answer": ans,
            "sources": [],
            "matched_scheme_id": None,
            "sms_summary": None,
            "confidence": 0.4,
        }

    # 5. Explicit out-of-scope topic detection (RAG-04 requirement 3, e.g. S3 cricket score)
    if detect_explicit_out_of_scope(query):
        return build_out_of_scope_override(lang_key, for_voice=for_voice)

    return None
