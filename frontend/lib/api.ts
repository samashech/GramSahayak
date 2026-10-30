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
    await fakeDelay(800, 1200);
    const mockAnswer = g1Fixture.data as AnswerData;
    return {
      ...mockAnswer,
      transcript: 'पीएम किसान योजना के लिए कौन पात्र है?',
      detectedLanguage: 'hi-IN',
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
    const stages = ivrStagesFixture as Record<string, IvrStep>;

    // State transition logic for mock simulator:
    // greeting -> language -> category -> speech -> answer -> goodbye
    if (params.stage === 'greeting') {
      return { ...stages.language, callerPhone: params.callerPhone };
    }
    if (params.stage === 'language') {
      return { ...stages.category, callerPhone: params.callerPhone };
    }
    if (params.stage === 'category') {
      return { ...stages.speech, callerPhone: params.callerPhone };
    }
    if (params.stage === 'speech') {
      return { ...stages.answer, callerPhone: params.callerPhone };
    }
    if (params.stage === 'answer') {
      return { ...stages.goodbye, callerPhone: params.callerPhone };
    }

    return { ...stages.greeting, callerPhone: params.callerPhone };
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
    await fakeDelay(300, 600); // SMS keyword feels instant
    const b = params.body.trim().toUpperCase();

    if (b.includes('PMKISAN')) {
      return g8Fixture.data as SmsSimulateResult;
    }
    if (b.includes('HELP')) {
      return {
        replyText:
          'GramSahayak Keywords: PMKISAN, PMFBY, KCC, SHC, PMJAY, JSY, PMMVY, MGNREGA, UJJWALA, PMAY, NSP, SCHOLARSHIP, HELP. Send any keyword for details.',
        charCount: 147,
        matchedSchemeId: null,
        mode: 'help',
        delivery: 'simulated',
      };
    }
    // Default reply for arbitrary question
    return {
      replyText:
        'GramSahayak: Enquiry received. PM-KISAN grants Rs 6000/yr. Check https://pmkisan.gov.in or call toll-free 1800-180-1551.',
      charCount: 119,
      matchedSchemeId: 'PMKISAN',
      mode: 'keyword',
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
