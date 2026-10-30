/**
 * GramSahayak API Client & Mock Layer (FE-02)
 * Follows /docs/api-contract.md (Contract v1)
 */

import {
  AnswerData,
  VoiceAnswerData,
  EligibilityResult,
  SchemeView,
  Profile,
  ProfileResponse,
  IvrStep,
  SmsSimulateResult,
  DemoResetResult,
  Envelope,
  ApiError,
  LanguageCode,
  Category,
  Role,
  SseEvent,
} from './types';

// Import mock JSON fixtures
import g1Fixture from '@/mocks/g1_pmkisan_hi.json';
import g2Fixture from '@/mocks/g2_cotton_pest_mr.json';
import g3Fixture from '@/mocks/g3_yellow_rust_hi.json';
import g4Fixture from '@/mocks/g4_pregnancy_ta.json';
import g5Fixture from '@/mocks/g5_jsy_ta.json';
import g6Fixture from '@/mocks/g6_eligibility_hi.json';
import g7Fixture from '@/mocks/g7_nsp_hi.json';
import g8Fixture from '@/mocks/g8_sms_pmkisan.json';
import s1Fixture from '@/mocks/s1_snake_bite_hi.json';
import ivrStagesFixture from '@/mocks/ivr_stages.json';
import profileFixture from '@/mocks/profile.json';
import demoResetFixture from '@/mocks/demo_reset.json';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === 'true';

// Helper for fake delay 600-1200 ms in mock mode
function fakeDelay(minMs = 600, maxMs = 1200): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Retrieve session and demo user headers safely from browser
function getClientHeaders(extraHeaders?: HeadersInit): HeadersInit {
  const headers: Record<string, string> = {};

  if (typeof window !== 'undefined') {
    try {
      const sid = localStorage.getItem('gs_session_id');
      if (sid) headers['x-session-id'] = sid;
      const demoUser = localStorage.getItem('gs_demoUser');
      if (demoUser) headers['x-demo-user'] = demoUser;
    } catch {
      // Fallback
    }
  }

  return {
    ...headers,
    ...extraHeaders,
  };
}

/**
 * Fetch wrapper with timeout, single network retry, and Envelope unwrapper.
 */
async function fetchWithRetry<T>(
  url: string,
  options: RequestInit = {},
  timeoutMs = 8000
): Promise<T> {
  let attempt = 0;
  const maxAttempts = 2; // initial + 1 retry on network error

  while (attempt < maxAttempts) {
    attempt++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        headers: getClientHeaders(options.headers),
        signal: controller.signal,
      });
      clearTimeout(timer);

      const json = (await response.json()) as Envelope<T>;

      if (!response.ok || !json.success) {
        const code = json.error?.code || `ERR_HTTP_${response.status}`;
        const message = json.error?.message || `Request failed with status ${response.status}`;
        throw new ApiError(code, message);
      }

      return json.data as T;
    } catch (err: unknown) {
      clearTimeout(timer);

      const isNetworkError =
        err instanceof TypeError ||
        (err instanceof Error && (err.name === 'AbortError' || err.message.includes('network')));

      if (attempt < maxAttempts && isNetworkError) {
        // Retry once on network error after a short backoff
        await new Promise((r) => setTimeout(r, 400));
        continue;
      }

      if (err instanceof ApiError) {
        throw err;
      }

      if (err instanceof Error && err.name === 'AbortError') {
        throw new ApiError('ERR_TIMEOUT', `Request timed out after ${timeoutMs}ms`);
      }

      throw new ApiError('ERR_NETWORK', err instanceof Error ? err.message : 'Network error');
    }
  }

  throw new ApiError('ERR_NETWORK', 'Max retry attempts exceeded');
}

// -------------------------------------------------------------
// ENDPOINTS
// -------------------------------------------------------------

/**
 * POST /api/chat
 */
export async function chat(params: {
  queryText: string;
  languageCode: LanguageCode;
  category?: Category | null;
  role: Role;
  sessionId?: string;
}): Promise<AnswerData> {
  if (USE_MOCKS) {
    await fakeDelay(600, 1100);
    const q = params.queryText.toLowerCase();

    if (q.includes('सांप') || q.includes('काट') || q.includes('snake')) {
      return s1Fixture.data as AnswerData;
    }
    if (q.includes('बोंडअळी') || q.includes('कापूस') || q.includes('cotton')) {
      return g2Fixture.data as AnswerData;
    }
    if (q.includes('पीला रतुआ') || q.includes('गेहूं') || q.includes('wheat')) {
      return g3Fixture.data as AnswerData;
    }
    if (q.includes('ஆபத்தான') || q.includes('கர்ப்பிணி') || q.includes('danger')) {
      return g4Fixture.data as AnswerData;
    }
    if (q.includes('ஜனனி') || q.includes('சுரக்ஷா') || q.includes('jsy')) {
      return g5Fixture.data as AnswerData;
    }
    if (q.includes('स्कॉलरशिप') || q.includes('scholarship') || q.includes('nsp')) {
      return g7Fixture.data as AnswerData;
    }
    // Default to G1 (PM-KISAN)
    return g1Fixture.data as AnswerData;
  }

  return fetchWithRetry<AnswerData>(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  }, 8000);
}

/**
 * POST /api/voice-chat (multipart FormData)
 */
export async function voiceChat(formData: FormData): Promise<VoiceAnswerData> {
  if (USE_MOCKS) {
    await fakeDelay(700, 1100);
    const hint = String(formData.get('transcriptHint') || '').toLowerCase();
    const lang = (formData.get('languageCode') as LanguageCode) || 'hi-IN';
    const cat = formData.get('category') as Category | null;

    let matchedFixture = g1Fixture.data as AnswerData;
    let transcript = 'पीएम किसान योजना के लिए कौन पात्र है?';

    if (hint.includes('सांप') || hint.includes('काट') || hint.includes('snake')) {
      matchedFixture = s1Fixture.data as AnswerData;
      transcript = 'सांप ने काट लिया है क्या करूं?';
    } else if (hint.includes('बोंडअळी') || hint.includes('कापूस') || hint.includes('cotton') || (lang === 'mr-IN' && !hint)) {
      matchedFixture = g2Fixture.data as AnswerData;
      transcript = 'कपाशीवरील बोंडअळी कशी रोखावी?';
    } else if (hint.includes('पीला रतुआ') || hint.includes('गेहूं') || hint.includes('wheat') || (cat === 'agri' && lang === 'hi-IN' && !hint)) {
      matchedFixture = g3Fixture.data as AnswerData;
      transcript = 'गेहूं में पीला रतुआ लग गया है क्या करें?';
    } else if (hint.includes('ஆபத்தான') || hint.includes('கர்ப்பிணி') || hint.includes('danger')) {
      matchedFixture = g4Fixture.data as AnswerData;
      transcript = 'கர்ப்ப காலத்தில் என்னென்ன ஆபத்தான அறிகுறிகள்?';
    } else if (hint.includes('ஜனனி') || hint.includes('சுரக்ஷா') || hint.includes('jsy') || (lang === 'ta-IN' && !hint)) {
      matchedFixture = g5Fixture.data as AnswerData;
      transcript = 'ஜனனி சுரக்ஷா யோஜனா திட்டத்தில் எவ்வளவு பணம் கிடைக்கும்?';
    } else if (hint.includes('स्कॉलरशिप') || hint.includes('scholarship') || hint.includes('nsp') || cat === 'education') {
      matchedFixture = g7Fixture.data as AnswerData;
      transcript = 'नेशनल स्कॉलरशिप पोर्टल पर आवेदन कैसे करें?';
    }

    if (hint && hint.trim().length > 3) {
      transcript = String(formData.get('transcriptHint'));
    }

    return {
      ...matchedFixture,
      transcript,
      detectedLanguage: matchedFixture.languageCode,
      audioBase64: null,
      useBrowserTts: true,
    };
  }

  // 12s timeout for voice STT/RAG/TTS processing
  return fetchWithRetry<VoiceAnswerData>(`${API_URL}/api/voice-chat`, {
    method: 'POST',
    body: formData,
  }, 12000);
}

/**
 * POST /api/eligibility
 */
export async function checkEligibility(params: {
  profile?: Partial<Profile>;
  languageCode?: LanguageCode;
}): Promise<EligibilityResult> {
  if (USE_MOCKS) {
    await fakeDelay(700, 1100);
    return g6Fixture.data as unknown as EligibilityResult;
  }

  return fetchWithRetry<EligibilityResult>(`${API_URL}/api/eligibility`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  }, 8000);
}

/**
 * GET /api/schemes?category=&languageCode=
 */
export async function getSchemes(params?: {
  category?: Category;
  languageCode?: LanguageCode;
}): Promise<SchemeView[]> {
  if (USE_MOCKS) {
    await fakeDelay(500, 900);
    return (g6Fixture.data.eligibleSchemes as unknown as SchemeView[]).concat(
      g6Fixture.data.ineligibleSchemes.map((s) => s.scheme as unknown as SchemeView)
    );
  }

  const query = new URLSearchParams();
  if (params?.category) query.set('category', params.category);
  if (params?.languageCode) query.set('languageCode', params.languageCode);

  const res = await fetchWithRetry<{ schemes: SchemeView[] }>(
    `${API_URL}/api/schemes?${query.toString()}`,
    { method: 'GET' },
    6000
  );
  return res.schemes;
}

/**
 * GET /api/profile
 */
export async function getProfile(): Promise<ProfileResponse> {
  if (USE_MOCKS) {
    await fakeDelay(400, 800);
    return profileFixture as unknown as ProfileResponse;
  }

  return fetchWithRetry<ProfileResponse>(`${API_URL}/api/profile`, {
    method: 'GET',
  }, 6000);
}

/**
 * POST /api/profile
 */
export async function saveProfile(profile: Partial<Profile>): Promise<{ profile: Profile }> {
  if (USE_MOCKS) {
    await fakeDelay(500, 800);
    return { profile: { ...profileFixture.profile, ...profile } as unknown as Profile };
  }

  return fetchWithRetry<{ profile: Profile }>(`${API_URL}/api/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  }, 6000);
}

/**
 * POST /api/ivr-simulate
 */
export async function ivrSimulate(params: {
  callerPhone: string;
  stage: IvrStep['stage'];
  dtmfDigit?: string;
  languageCode?: LanguageCode;
  text?: string;
  audio?: Blob;
}): Promise<IvrStep> {
  if (USE_MOCKS) {
    await fakeDelay(500, 1000);
    // Comprehensive two-stage IVR mock engine (DEC-06, B-07, Contract v1)
    const phone = params.callerPhone || '+919829011111';
    const lang = params.languageCode || 'hi-IN';

    if (params.stage === 'greeting') {
      return {
        stage: 'language',
        promptText:
          'नमस्ते, ग्राम सहायक में आपका स्वागत है। हिंदी के लिए 1 दबाएं। मराठीसाठी 2 दाबा। தமிழுக்கு 3 அழுத்தவும்। For English press 4.',
        audioBase64: null,
        useBrowserTts: true,
        dtmfOptions: { '1': 'hi-IN', '2': 'mr-IN', '3': 'ta-IN', '4': 'en-IN' },
        inputExpected: 'dtmf',
        callerPhone: phone,
        session: { languageCode: 'hi-IN', category: null },
        webhookLog: {
          stage: 'greeting',
          request: { event: 'call_incoming', caller_number: phone, channel: 'ivr' },
          response: { status: 200, prompt: 'language_menu', valid_digits: '1,2,3,4' },
        },
      };
    }

    if (params.stage === 'language') {
      const digitToLang: Record<string, LanguageCode> = {
        '1': 'hi-IN',
        '2': 'mr-IN',
        '3': 'ta-IN',
        '4': 'en-IN',
      };
      const chosenLang = (params.dtmfDigit && digitToLang[params.dtmfDigit]) || lang || 'hi-IN';

      const categoryPrompts: Record<LanguageCode, string> = {
        'hi-IN': 'सरकारी योजनाओं के लिए 1, फसल व खेती के लिए 2, स्वास्थ्य के लिए 3, छात्रवृत्ति के लिए 4 दबाएं।',
        'mr-IN': 'शासकीय योजनांसाठी 1, शेतीसाठी 2, आरोग्यासाठी 3, शिष्यवृत्तीसाठी 4 दाबा.',
        'ta-IN': 'அரசு திட்டங்களுக்கு 1, விவசாயத்திற்கு 2, சுகாதாரத்திற்கு 3, உதவித்தொகைக்கு 4 அழுத்தவும்.',
        'en-IN': 'Press 1 for Schemes, 2 for Agriculture, 3 for Health, 4 for Education.',
      };

      return {
        stage: 'category',
        promptText: categoryPrompts[chosenLang] || categoryPrompts['hi-IN'],
        audioBase64: null,
        useBrowserTts: true,
        dtmfOptions: { '1': 'schemes', '2': 'agri', '3': 'health', '4': 'education' },
        inputExpected: 'dtmf',
        callerPhone: phone,
        session: { languageCode: chosenLang, category: null },
        webhookLog: {
          stage: 'language',
          request: {
            endpoint: '/api/cloudtalk/voice/dtmf-category',
            caller_number: phone,
            dtmf_digit: params.dtmfDigit || '1',
            stage: 'language',
          },
          response: {
            status: 200,
            languageCode: chosenLang,
            next_stage: 'category',
            dtmf_options: { '1': 'schemes', '2': 'agri', '3': 'health', '4': 'education' },
          },
        },
      };
    }

    if (params.stage === 'category') {
      const digitToCategory: Record<string, Category> = {
        '1': 'schemes',
        '2': 'agri',
        '3': 'health',
        '4': 'education',
      };
      const chosenCategory =
        (params.dtmfDigit && digitToCategory[params.dtmfDigit]) || 'schemes';

      const speechPrompts: Record<LanguageCode, string> = {
        'hi-IN': 'कृपया बीप के बाद अपना सवाल बोलें या नीचे विकल्प चुनें...',
        'mr-IN': 'कृपया बीप नंतर आपला प्रश्न बोला किंवा खाली पर्याय निवडा...',
        'ta-IN': 'தயவுசெய்து பீப் சத்தத்திற்குப் பிறகு உங்கள் கேள்வியைக் கேட்கவும்...',
        'en-IN': 'Please speak your question after the beep...',
      };

      return {
        stage: 'speech',
        promptText: speechPrompts[lang] || speechPrompts['hi-IN'],
        audioBase64: null,
        useBrowserTts: true,
        inputExpected: 'speech',
        callerPhone: phone,
        session: { languageCode: lang, category: chosenCategory },
        webhookLog: {
          stage: 'category',
          request: {
            endpoint: '/api/cloudtalk/voice/dtmf-category',
            caller_number: phone,
            dtmf_digit: params.dtmfDigit || '1',
            stage: 'category',
          },
          response: {
            status: 200,
            category: chosenCategory,
            next_stage: 'speech',
            action: 'record_audio_and_beep',
          },
        },
      };
    }

    if (params.stage === 'speech') {
      const query = (params.text || '').toLowerCase();
      let matchedAnswer = g1Fixture.data as AnswerData;

      if (query.includes('सांप') || query.includes('काट') || query.includes('snake')) {
        matchedAnswer = s1Fixture.data as AnswerData;
      } else if (query.includes('बोंडअळी') || lang === 'mr-IN') {
        matchedAnswer = g2Fixture.data as AnswerData;
      } else if (query.includes('पीला रतुआ') || (lang === 'hi-IN' && query.includes('गेहूं'))) {
        matchedAnswer = g3Fixture.data as AnswerData;
      } else if (query.includes('ஆபத்தான') || (lang === 'ta-IN' && query.includes('கர்ப்ப'))) {
        matchedAnswer = g4Fixture.data as AnswerData;
      } else if (query.includes('ஜனனி') || lang === 'ta-IN') {
        matchedAnswer = g5Fixture.data as AnswerData;
      } else if (query.includes('स्कॉलरशिप') || query.includes('nsp')) {
        matchedAnswer = g7Fixture.data as AnswerData;
      }

      return {
        stage: 'answer',
        promptText: `${matchedAnswer.answerText} आपके फोन पर एसएमएस रसीद भेज दी गई है। (SMS receipt dispatched to ${phone})`,
        audioBase64: null,
        useBrowserTts: true,
        inputExpected: 'none',
        callerPhone: phone,
        session: { languageCode: lang, category: matchedAnswer.category },
        answer: matchedAnswer,
        webhookLog: {
          stage: 'speech',
          request: {
            endpoint: '/api/cloudtalk/voice/process-speech',
            caller_number: phone,
            transcript: params.text || 'Voice Question',
            category: matchedAnswer.category,
            languageCode: lang,
          },
          response: {
            status: 200,
            answerText: matchedAnswer.answerText,
            matchedSchemeId: matchedAnswer.matchedSchemeId,
            smsDispatched: true,
            delivery: 'simulated',
          },
        },
      };
    }

    // Default: goodbye stage
    const goodbyePrompts: Record<LanguageCode, string> = {
      'hi-IN': 'ग्राम सहायक से संपर्क करने के लिए धन्यवाद। आपका दिन शुभ हो!',
      'mr-IN': 'ग्राम सहायकाशी संपर्क केल्याबद्दल धन्यवाद. आपला दिवस चांगला जावो!',
      'ta-IN': 'கிராம சகாயக்கை தொடர்பு கொண்டதற்கு நன்றி. நல்வாழ்த்துகள்!',
      'en-IN': 'Thank you for calling GramSahayak. Have a great day!',
    };

    return {
      stage: 'goodbye',
      promptText: goodbyePrompts[lang] || goodbyePrompts['hi-IN'],
      audioBase64: null,
      useBrowserTts: true,
      inputExpected: 'none',
      callerPhone: phone,
      session: { languageCode: lang, category: null },
      webhookLog: {
        stage: 'goodbye',
        request: { event: 'call_terminate', caller_number: phone },
        response: { status: 200, action: 'hangup' },
      },
    };
  }

  const isMultipart = Boolean(params.audio);
  let body: BodyInit;
  const headers: Record<string, string> = {};

  if (isMultipart) {
    const formData = new FormData();
    formData.append('callerPhone', params.callerPhone);
    formData.append('stage', params.stage);
    if (params.dtmfDigit) formData.append('dtmfDigit', params.dtmfDigit);
    if (params.languageCode) formData.append('languageCode', params.languageCode);
    if (params.text) formData.append('text', params.text);
    if (params.audio) formData.append('audio', params.audio);
    body = formData;
  } else {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(params);
  }

  return fetchWithRetry<IvrStep>(`${API_URL}/api/ivr-simulate`, {
    method: 'POST',
    headers,
    body,
  }, 10000);
}

/**
 * POST /api/sms-simulate
 */
export async function smsSimulate(params: {
  fromPhone: string;
  body: string;
  languageCode?: LanguageCode;
}): Promise<SmsSimulateResult> {
  if (USE_MOCKS) {
    await fakeDelay(150, 300); // SMS keyword feels instant (< 300 ms)
    const b = params.body.trim().toUpperCase();
    const lang = params.languageCode || 'hi-IN';

    // Seed-aligned SMS summaries for all 13 schemes in 4 languages (Rule R5 verbatim from schemes.json)
    const SMS_SUMMARIES: Record<string, Record<LanguageCode, string>> = {
      PMKISAN: {
        'hi-IN': 'पीएम-किसान: भूमिधारक किसान परिवार को ₹6000/वर्ष, 3 किस्तों में। दस्तावेज़: आधार, भूमि रिकॉर्ड, बैंक खाता, eKYC। pmkisan.gov.in हेल्पलाइन: 155261',
        'mr-IN': 'पीएम-किसान: जमीनधारक शेतकरी कुटुंबाला ₹6000/वर्ष, 3 हप्त्यांत. कागदपत्रे: आधार, सातबारा, बँक खाते, eKYC. pmkisan.gov.in हेल्पलाइन: 155261',
        'ta-IN': 'பிஎம்-கிசான்: நில உரிமை விவசாய குடும்பத்திற்கு ஆண்டுக்கு ₹6000, 3 தவணைகளில். ஆவணங்கள்: ஆதார், நில பதிவு, வங்கி கணக்கு. pmkisan.gov.in உதவி: 155261',
        'en-IN': 'PM-KISAN: Rs 6000/yr in 3 instalments of Rs 2000 to landholding farmers. Docs: Aadhaar, land record, bank a/c, eKYC. pmkisan.gov.in Help: 155261',
      },
      PMFBY: {
        'hi-IN': 'फसल बीमा PMFBY: किसान प्रीमियम खरीफ 2%, रबी 1.5%, व्यावसायिक फसल 5%। दस्तावेज़: आधार, भूमि/बुवाई प्रमाण, बैंक खाता। pmfby.gov.in हेल्पलाइन: 14447',
        'mr-IN': 'पीक विमा PMFBY: शेतकरी हप्ता खरीप 2%, रब्बी 1.5%, व्यावसायिक पिके 5%. कागदपत्रे: आधार, सातबारा/पेरणी दाखला, बँक खाते. pmfby.gov.in हेल्पलाइन: 14447',
        'ta-IN': 'பயிர் காப்பீடு PMFBY: விவசாயி பிரீமியம் காரிஃப் 2%, ரபி 1.5%, வணிக பயிர் 5%. ஆவணங்கள்: ஆதார், நில/விதைப்பு பதிவு, வங்கி கணக்கு. pmfby.gov.in உதவி: 14447',
        'en-IN': 'PMFBY crop insurance: farmer premium 2% Kharif, 1.5% Rabi, 5% commercial crops. Docs: Aadhaar, land/sowing record, bank a/c. pmfby.gov.in Help: 14447',
      },
      KCC: {
        'hi-IN': 'किसान क्रेडिट कार्ड: ₹3 लाख तक फसल ऋण, समय पर चुकाने पर 4% ब्याज। दस्तावेज़: आधार, भूमि रिकॉर्ड, फोटो। बैंक या pmkisan.gov.in हेल्पलाइन: 1800-180-1551',
        'mr-IN': 'किसान क्रेडिट कार्ड: ₹3 लाखांपर्यंत पीक कर्ज, वेळेवर फेड केल्यास 4% व्याज. कागदपत्रे: आधार, सातबारा, फोटो. बँक किंवा pmkisan.gov.in हेल्पलाइन: 1800-180-1551',
        'ta-IN': 'கிசான் கடன் அட்டை: ₹3 லட்சம் வரை பயிர் கடன், சரியான நேரத்தில் செலுத்தினால் 4% வட்டி. ஆதார், நில பதிவு. வங்கி/pmkisan.gov.in உதவி: 1800-180-1551',
        'en-IN': 'Kisan Credit Card: crop loan up to Rs 3 lakh, 4% interest on timely repayment. Docs: Aadhaar, land record, photo. Bank or pmkisan.gov.in Help: 1800-180-1551',
      },
      SHC: {
        'hi-IN': 'मृदा स्वास्थ्य कार्ड: खेत की मिट्टी की मुफ्त जांच और खाद की सलाह। दस्तावेज़: आधार, खेत का विवरण। soilhealth.dac.gov.in हेल्पलाइन: 1800-180-1551',
        'mr-IN': 'मृदा आरोग्य पत्रिका: शेतातील मातीची मोफत तपासणी व खताचा सल्ला. कागदपत्रे: आधार, शेताचा तपशील. soilhealth.dac.gov.in हेल्पलाइन: 1800-180-1551',
        'ta-IN': 'மண் வள அட்டை: உங்கள் வயல் மண்ணுக்கு இலவச பரிசோதனை, உர ஆலோசனை. ஆவணங்கள்: ஆதார், நில விவரம். soilhealth.dac.gov.in உதவி: 1800-180-1551',
        'en-IN': 'Soil Health Card: free soil test of your field with fertiliser advice. Docs: Aadhaar, plot details. soilhealth.dac.gov.in Help: 1800-180-1551',
      },
      PMJAY: {
        'hi-IN': 'आयुष्मान भारत: ₹5 लाख/वर्ष मुफ्त अस्पताल इलाज प्रति परिवार। दस्तावेज़: आधार, राशन कार्ड। मेरा पीएमजय या mera.pmjay.gov.in हेल्पलाइन: 14555',
        'mr-IN': 'आयुष्मान भारत: प्रति कुटुंब ₹5 लाख/वर्ष मोफत रुग्णालय उपचार. कागदपत्रे: आधार, रेशन कार्ड. mera.pmjay.gov.in हेल्पलाइन: 14555',
        'ta-IN': 'ஆயுஷ்மான் பாரத்: குடும்பத்திற்கு ஆண்டுக்கு ₹5 லட்சம் வரை இலவச மருத்துவ சிகிச்சை. mera.pmjay.gov.in உதவி: 14555',
        'en-IN': 'Ayushman Bharat PM-JAY: free hospital care up to Rs 5 lakh/family/yr at empanelled hospitals. Docs: Aadhaar, ration card. mera.pmjay.gov.in Help: 14555',
      },
      JSY: {
        'hi-IN': 'जननी सुरक्षा योजना: सरकारी अस्पताल में प्रसव पर ग्रामीण मां को ₹1400 (LPS राज्य) या ₹700 (HPS)। दस्तावेज़: MCP कार्ड, आधार, बैंक। nhm.gov.in हेल्पलाइन: 104',
        'mr-IN': 'जननी सुरक्षा योजना: सरकारी रुग्णालयात प्रसूतीसाठी ग्रामीण मातेला ₹1400 (LPS राज्ये) किंवा ₹700 (HPS). कागदपत्रे: MCP कार्ड, आधार, बँक. nhm.gov.in हेल्पलाइन: 104',
        'ta-IN': 'ஜனனி சுரக்ஷா: அரசு மருத்துவமனை பிரசவத்துக்கு கிராமப்புற தாய்க்கு ₹700 (HPS மாநிலம்) / ₹1400 (LPS). MCP அட்டை, ஆதார், வங்கி. nhm.gov.in உதவி: 104',
        'en-IN': 'JSY: cash for delivery in govt hospital. Rural mother Rs 1400 (LPS states) or Rs 700 (HPS, BPL/SC/ST). Docs: MCP card, Aadhaar, bank. nhm.gov.in Help: 104',
      },
      PMMVY: {
        'hi-IN': 'मातृत्व वंदना PMMVY: पहले बच्चे पर ₹5000 (2 किस्तों में), दूसरी बालिका पर ₹6000 एकमुश्त। आधार, MCP कार्ड, बैंक खाता। pmmvy.wcd.gov.in हेल्पलाइन: 104',
        'mr-IN': 'मातृत्व वंदना PMMVY: पहिल्या अपत्यासाठी ₹5000 (2 हप्त्यांत), दुसरी मुलगी झाल्यास ₹6000 एकरकमी. आधार, MCP कार्ड, बँक. pmmvy.wcd.gov.in हेल्पलाइन: 104',
        'ta-IN': 'மாத்ரு வந்தனா PMMVY: முதல் குழந்தைக்கு ₹5000 (2 தவணை), 2-வது பெண் குழந்தைக்கு ₹6000 ஒரே தவணை. ஆதார், MCP அட்டை, வங்கி. pmmvy.wcd.gov.in உதவி: 104',
        'en-IN': 'PMMVY maternity: Rs 5000 for first child in 2 instalments, Rs 6000 for second girl child. Docs: Aadhaar, MCP card, bank a/c. pmmvy.wcd.gov.in Help: 104',
      },
      MGNREGA: {
        'hi-IN': 'मनरेगा: ग्रामीण परिवार को 100 दिन का अकुशल गारंटी रोज़गार। 15 दिन में काम न मिले तो बेरोज़गारी भत्ता। दस्तावेज़: जॉब कार्ड, आधार। nrega.nic.in हेल्पलाइन: 1800-345-2244',
        'mr-IN': 'मनरेगा: ग्रामीण कुटुंबाला 100 दिवसांचा हमी अकुशल रोजगार. 15 दिवसांत काम न मिळाल्यास बेरोजगारी भत्ता. कागदपत्रे: जॉब कार्ड, आधार. nrega.nic.in हेल्पलाइन: 1800-345-2244',
        'ta-IN': 'மகாத்மா காந்தி ஊரக வேலைவாய்ப்பு: ஆண்டுக்கு 100 நாள் உத்திரவாத வேலை. 15 நாளில் வேலை கிடைக்காவிடில் உதவித்தொகை. ஜாப் கார்டு, ஆதார். nrega.nic.in உதவி: 1800-345-2244',
        'en-IN': 'MGNREGA: 100 days guaranteed wage employment per rural household. Unemployment allowance if work not given within 15 days. Job card, Aadhaar. nrega.nic.in',
      },
      UJJWALA: {
        'hi-IN': 'उज्ज्वला 2.0: गरीब परिवार की वयस्क महिला को मुफ्त LPG कनेक्शन, पहला सिलेंडर व चूल्हा मुफ्त। दस्तावेज़: आधार, राशन कार्ड, बैंक खाता। pmuy.gov.in हेल्पलाइन: 1800-266-6696',
        'mr-IN': 'उज्ज्वला 2.0: गरीब कुटुंबातील महिलेला मोफत एलपीजी गॅस जोडणी, पहिला सिलिंडर व शेगडी मोफत. कागदपत्रे: आधार, रेशन कार्ड, बँक. pmuy.gov.in हेल्पलाइन: 1800-266-6696',
        'ta-IN': 'உஜ்வாலா 2.0: ஏழை குடும்ப பெண்ணுக்கு இலவச LPG இணைப்பு, முதல் சிலிண்டர் மற்றும் அடுப்பு இலவசம். ஆதார், குடும்ப அட்டை, வங்கி. pmuy.gov.in உதவி: 1800-233-3555',
        'en-IN': 'PM Ujjwala: free LPG connection to adult woman of poor household, first refill & stove free. Docs: Aadhaar, ration card, bank a/c. pmuy.gov.in Help: 1800-266-6696',
      },
      PMAY: {
        'hi-IN': 'आवास योजना-ग्रामीण: बेघर/कच्चे घर वाले परिवार को पक्का घर बनाने हेतु ₹1.20 लाख (पहाड़ी क्षेत्र ₹1.30 लाख)। आधार, जॉब कार्ड। pmayg.nic.in हेल्पलाइन: 1800-11-6446',
        'mr-IN': 'आवास योजना-ग्रामीण: बेघर/कच्च्या घरातील कुटुंबाला पक्के घर बांधण्यासाठी ₹1.20 लाख (डोंगरी भाग ₹1.30 लाख). आधार, जॉब कार्ड. pmayg.nic.in हेल्पलाइन: 1800-11-6446',
        'ta-IN': 'வீட்டு வசதி-கிராமம்: வீடில்லா/குடிசை குடும்பத்துக்கு கான்கிரீட் வீடு கட்ட ₹1.20 லட்சம் (மலைப்பகுதி ₹1.30 லட்சம்). ஆதார். pmayg.nic.in உதவி: 1800-11-6446',
        'en-IN': 'PMAY-Gramin: Rs 1.20 lakh (Rs 1.30 lakh hilly areas) to build a pucca house for houseless/kutcha house families. Aadhaar. pmayg.nic.in Help: 1800-11-6446',
      },
      NSP: {
        'hi-IN': 'राष्ट्रीय छात्रवृत्ति पोर्टल: केंद्र व राज्य छात्रवृत्ति के लिए एक जगह आवेदन। आधार, आय/जाति प्रमाणपत्र, अंकपत्र। scholarships.gov.in हेल्पलाइन: 0120-6619540',
        'mr-IN': 'राष्ट्रीय शिष्यवृत्ती पोर्टल: केंद्र व राज्य शिष्यवृत्तींसाठी एकाच ठिकाणी अर्ज. आधार, उत्पन्न/जात दाखला, गुणपत्रक. scholarships.gov.in हेल्पलाइन: 0120-6619540',
        'ta-IN': 'தேசிய உதவித்தொகை இணையதளம்: மத்திய, மாநில உதவித்தொகைக்கு ஒரே இடத்தில் விண்ணப்பம். ஆதார், வருமான/சாதி சான்று. scholarships.gov.in உதவி: 0120-6619540',
        'en-IN': 'National Scholarship Portal: apply for central & state scholarships in one place. Aadhaar, income/caste cert, marksheet. scholarships.gov.in Help: 0120-6619540',
      },
      PMYASASVI: {
        'hi-IN': 'पीएम यशस्वी: OBC, EBC, DNT छात्रों को छात्रवृत्ति, पारिवारिक आय ₹2.5 लाख/वर्ष तक। NSP पर आवेदन। scholarships.gov.in हेल्पलाइन: 0120-6619540',
        'mr-IN': 'पीएम यशस्वी: OBC, EBC, DNT विद्यार्थ्यांना शिष्यवृत्ती, कौटुंबिक उत्पन्न ₹2.5 लाख/वर्षपर्यंत. NSP वर अर्ज. scholarships.gov.in हेल्पलाइन: 0120-6619540',
        'ta-IN': 'பிஎம் யசஸ்வி: OBC, EBC, DNT மாணவர்களுக்கு உதவித்தொகை, குடும்ப வருமானம் ₹2.5 லட்சம் வரை. NSP-ல் விண்ணப்பம். scholarships.gov.in உதவி: 0120-6619540',
        'en-IN': 'PM YASASVI: scholarship for OBC, EBC, DNT students, family income up to Rs 2.5 lakh/yr. Apply on NSP. scholarships.gov.in Help: 0120-6619540',
      },
      PRAGATI: {
        'hi-IN': 'AICTE प्रगति: AICTE डिग्री/डिप्लोमा की छात्राओं को ₹50,000/वर्ष, पारिवारिक आय ₹8 लाख तक। NSP पर आवेदन। scholarships.gov.in हेल्पलाइन: 0120-6619540',
        'mr-IN': 'AICTE प्रगती: AICTE पदवी/पदविका शिकणाऱ्या मुलींना ₹50,000/वर्ष, कौटुंबिक उत्पन्न ₹8 लाखांपर्यंत. NSP वर अर्ज. scholarships.gov.in हेल्पलाइन: 0120-6619540',
        'ta-IN': 'AICTE பிரகதி: பட்டம்/டிப்ளமோ மாணவிகளுக்கு ஆண்டுக்கு ₹50,000, குடும்ப வருமானம் ₹8 லட்சம் வரை. NSP-ல் விண்ணப்பம். scholarships.gov.in உதவி: 0120-6619540',
        'en-IN': 'AICTE Pragati: Rs 50,000/yr for girls in AICTE degree/diploma courses, family income up to Rs 8 lakh. Apply on NSP. scholarships.gov.in Help: 0120-6619540',
      },
    };

    const SMS_CATEGORY_REPLIES: Record<string, Record<LanguageCode, string>> = {
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

    const KEYWORD_ALIASES: Record<string, string> = {
      PMUY: 'UJJWALA',
      NREGA: 'MGNREGA',
      MNREGA: 'MGNREGA',
      AYUSHMAN: 'PMJAY',
      SCHOLARSHIPS: 'SCHOLARSHIP',
      YASASVI: 'PMYASASVI',
      HELPME: 'HELP',
      MENU: 'HELP',
    };

    // Keyword parsing: clean candidate tokens
    const compact = b.replace(/[^A-Z0-9]/g, '');
    const firstToken = (b.split(/\s+/)[0] || '').replace(/[^A-Z0-9]/g, '');
    let matchedKey: string | null = null;

    for (const cand of [compact, firstToken]) {
      const resolved = KEYWORD_ALIASES[cand] || cand;
      if (SMS_SUMMARIES[resolved] || SMS_CATEGORY_REPLIES[resolved] || resolved === 'HELP') {
        matchedKey = resolved;
        break;
      }
    }

    if (!matchedKey) {
      // Substring check for known schemes
      const foundScheme = Object.keys(SMS_SUMMARIES).find((k) => b.includes(k));
      if (foundScheme) matchedKey = foundScheme;
    }

    // 1. Direct Scheme Keyword Matches (< 300 ms, Rule R5)
    if (matchedKey && SMS_SUMMARIES[matchedKey]) {
      const replyText = SMS_SUMMARIES[matchedKey][lang] || SMS_SUMMARIES[matchedKey]['hi-IN'];
      return {
        replyText,
        charCount: Array.from(replyText).length,
        matchedSchemeId: matchedKey,
        mode: 'keyword',
        delivery: 'simulated',
      };
    }

    // 2. Category Keyword Matches (AGRI, HEALTH, SCHOLARSHIP)
    if (matchedKey && SMS_CATEGORY_REPLIES[matchedKey]) {
      const replyText = SMS_CATEGORY_REPLIES[matchedKey][lang] || SMS_CATEGORY_REPLIES[matchedKey]['hi-IN'];
      return {
        replyText,
        charCount: Array.from(replyText).length,
        matchedSchemeId: null,
        mode: 'keyword',
        delivery: 'simulated',
      };
    }

    // 3. HELP Keyword
    if (matchedKey === 'HELP' || b.includes('HELP') || b.includes('मदद') || b.includes('உதவி')) {
      const helpTexts: Record<LanguageCode, string> = {
        'hi-IN': 'ग्राम सहायक: PMKISAN PMFBY KCC SHC PMJAY JSY PMMVY MGNREGA UJJWALA PMAY NSP PMYASASVI PRAGATI या AGRI HEALTH SCHOLARSHIP भेजें, या सवाल लिखें',
        'mr-IN': 'ग्राम सहायक: PMKISAN PMFBY KCC SHC PMJAY JSY PMMVY MGNREGA UJJWALA PMAY NSP PMYASASVI PRAGATI किंवा AGRI HEALTH SCHOLARSHIP पाठवा, किंवा प्रश्न लिहा',
        'ta-IN': 'கிராம சகாயக்: PMKISAN PMFBY KCC SHC PMJAY JSY PMMVY MGNREGA UJJWALA PMAY NSP PMYASASVI PRAGATI அல்லது AGRI HEALTH SCHOLARSHIP அனுப்பவும்',
        'en-IN': 'GramSahayak: send PMKISAN PMFBY KCC SHC PMJAY JSY PMMVY MGNREGA UJJWALA PMAY NSP PMYASASVI PRAGATI, or AGRI HEALTH SCHOLARSHIP, or your question',
      };
      const replyText = helpTexts[lang] || helpTexts['en-IN'];
      return {
        replyText,
        charCount: Array.from(replyText).length,
        matchedSchemeId: null,
        mode: 'help',
        delivery: 'simulated',
      };
    }

    // 3. Free-text Tamil query
    if (/[஀-௿]/.test(params.body) || lang === 'ta-IN') {
      const replyText = 'கிராம சகாயக்: தகவல் பெறப்பட்டது. ஜனனி சுரக்ஷா திட்டம் அரசு மருத்துவமனை பிரசவத்திற்கு ₹1400 வரை நிதியுதவி. விவரங்களுக்கு 104 அழைக்கவும்.';
      return {
        replyText,
        charCount: Array.from(replyText).length,
        matchedSchemeId: 'JSY',
        mode: 'rag',
        delivery: 'simulated',
      };
    }

    // 4. Free-text Marathi query
    if (lang === 'mr-IN') {
      const replyText = 'ग्राम सहायक: चौकशी प्राप्त झाली. पीएम-किसान अंतर्गत वर्षाला ₹6000 अनुदान मिळते. अधिक माहितीसाठी 1800-180-1551 वर कॉल करा किंवा pmkisan.gov.in पहा.';
      return {
        replyText,
        charCount: Array.from(replyText).length,
        matchedSchemeId: 'PMKISAN',
        mode: 'rag',
        delivery: 'simulated',
      };
    }

    // 5. Default free text (Hindi / English)
    const replyText = 'ग्राम सहायक: संदेश प्राप्त हुआ। पीएम-किसान योजना के तहत ₹6000/वर्ष 3 किस्तों में मिलते हैं। हेल्पलाइन 1800-180-1551 या pmkisan.gov.in देखें।';
    return {
      replyText,
      charCount: Array.from(replyText).length,
      matchedSchemeId: 'PMKISAN',
      mode: 'rag',
      delivery: 'simulated',
    };
  }

  return fetchWithRetry<SmsSimulateResult>(`${API_URL}/api/sms-simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  }, 6000);
}

/**
 * POST /api/demo/reset
 */
export async function demoReset(): Promise<DemoResetResult> {
  if (USE_MOCKS) {
    await fakeDelay(500, 900);
    return demoResetFixture.data as DemoResetResult;
  }

  return fetchWithRetry<DemoResetResult>(`${API_URL}/api/demo/reset`, {
    method: 'POST',
  }, 8000);
}

/**
 * Mock SSE Pipeline Stream Emitter (FE-02 requirement)
 * Emits the 6 pipeline steps, DTMF, and transcript for rehearsing /live and latency visualizers.
 */
export function createMockPipelineStream(
  onEvent: (event: SseEvent) => void,
  phone = '+919829011111'
): () => void {
  const steps: Array<{ step: SseEvent['step']; ms: number; text?: string; digit?: string }> = [
    { step: 'audio_normalized', ms: 142 },
    { step: 'sarvam_stt_done', ms: 720, text: 'पीएम किसान योजना के लिए कौन पात्र है?' },
    { step: 'chroma_rag_retrieved', ms: 380 },
    { step: 'groq_llm_synthesized', ms: 520 },
    { step: 'sarvam_tts_ready', ms: 680 },
    { step: 'sms_receipt_dispatched', ms: 110, text: 'SMS Sent via CloudTalk' },
  ];

  let stepIdx = 0;
  let active = true;

  const runStep = () => {
    if (!active || stepIdx >= steps.length) return;
    const item = steps[stepIdx];
    stepIdx++;

    onEvent({
      type: 'pipeline',
      step: item.step,
      ms: item.ms,
      channel: 'web',
      phone,
      text: item.text,
      ts: new Date().toISOString(),
    });

    if (stepIdx < steps.length) {
      setTimeout(runStep, item.ms + 100);
    }
  };

  const timer = setTimeout(runStep, 200);

  return () => {
    active = false;
    clearTimeout(timer);
  };
}
