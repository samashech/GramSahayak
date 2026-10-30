/**
 * GramSahayak (ग्राम सहायक) — API Contract Types (v1)
 * Single source of truth: /docs/api-contract.md
 */

// Supported Language Codes
export type LanguageCode = 'hi-IN' | 'mr-IN' | 'ta-IN' | 'en-IN';

// Supported Categories
export type Category = 'schemes' | 'agri' | 'health' | 'education';

// Target Roles
export type Role = 'farmer' | 'asha' | 'panchayat' | 'student';

// Channels
export type Channel = 'web' | 'ivr' | 'sms';

// Demographics & Social Categories
export type Occupation = 'farmer' | 'agri_labourer' | 'daily_wage' | 'student' | 'homemaker' | 'other';
export type SocialCategory = 'general' | 'obc' | 'sc' | 'st';
export type Gender = 'male' | 'female' | 'other';

// Universal API Response Envelope
export interface Envelope<T> {
  success: boolean;
  data: T | null;
  error: {
    code: string;
    message: string;
  } | null;
  timestamp: string;
}

// Localised Scheme View presented to the frontend
export interface SchemeView {
  id: string;
  code: string;
  name: string; // localised
  category: Category;
  targetRole: Role;
  benefits: string;
  eligibility: string;
  documents: string[];
  howToApply: string;
  helpline: string;
  portalUrl: string;
  smsSummary: string; // localised <=160 chars
}

// Reference source attached to an answer
export interface SourceRef {
  id: string;
  title: string;
  category: Category;
  helpline: string;
  portalUrl: string;
}

// SMS Receipt card attached to voice answers
export interface SmsReceipt {
  smsReceiptText: string;
  helpline: string;
  portalUrl: string;
  documents: string[];
  delivery: 'sent' | 'simulated' | 'failed';
}

// Medical / Pesticide Safety flag
export interface Safety {
  flagged: boolean;
  helplines: string[];
}

// Standard Answer Data returned from POST /api/chat
export interface AnswerData {
  answerText: string;
  languageCode: LanguageCode;
  category: Category | null;
  matchedSchemeId: string | null;
  smsReceipt: SmsReceipt | null;
  sources: SourceRef[];
  safety: Safety;
  latencyMs: number;
  source: 'rag' | 'groq' | 'cache' | 'fallback';
}

// Extended Answer Data returned from POST /api/voice-chat
export interface VoiceAnswerData extends AnswerData {
  transcript: string;
  detectedLanguage: LanguageCode;
  audioBase64: string | null; // WAV 22.05 kHz or null
  useBrowserTts: boolean;
}

// IVR Interaction Step returned from POST /api/ivr-simulate
export interface IvrStep {
  // Contract section 7: where the call now is. greeting -> send "language" next, language -> "category",
  // category -> "speech" (text or audio), answer -> "goodbye". See lib/ivr.ts.
  stage: 'greeting' | 'language' | 'category' | 'speech' | 'answer' | 'goodbye';
  promptText: string;
  audioBase64: string | null;
  useBrowserTts: boolean;
  session: {
    languageCode: LanguageCode;
    category: Category | null;
  };
  answer: AnswerData | null;
  webhookLog: {
    request: Record<string, unknown>;
    response: Record<string, unknown>;
  };
}

// SSE Pipeline Event from GET /api/stream/events
export interface SseEvent {
  type: 'pipeline' | 'dtmf' | 'transcript' | 'sms' | 'hello';
  step?:
    | 'audio_normalized'
    | 'sarvam_stt_done'
    | 'chroma_rag_retrieved'
    | 'groq_llm_synthesized'
    | 'sarvam_tts_ready'
    | 'sms_receipt_dispatched';
  ms?: number;
  channel?: Channel;
  phone?: string;
  digit?: string;
  text?: string;
  speaker?: 'user' | 'assistant'; // transcript
  direction?: 'in' | 'out'; // sms
  mode?: string; // pipeline groq_llm_synthesized: 'llm' | 'extractive'; sms: keyword | rag | help
  delivery?: 'sent' | 'simulated' | 'failed';
  source?: string; // transcript (assistant): rag | cache | fallback
  ts: string;
}

// Database / Stored Profile (snake_case as per contract section 4 & 5)
export interface Profile {
  session_key?: string;
  phone: string | null;
  role: Role;
  language: LanguageCode;
  occupation: Occupation;
  land_hectares: number;
  bpl: boolean;
  age: number;
  gender: Gender;
  pregnant: boolean;
  annual_income: number; // INR/yr
  social_category: SocialCategory;
  state?: string;
  district?: string;
  updated_at?: string;
}

// Conversation Turn (inside sessions.history)
export interface Turn {
  ts: string;
  channel: Channel;
  speaker: 'user' | 'assistant';
  text: string;
  category: Category | null;
  language: LanguageCode;
}

// Eligibility Check Response
export interface IneligibleSchemeReason {
  scheme: SchemeView;
  reason: string;
}

export interface EligibilityResult {
  eligibleSchemes: SchemeView[];
  ineligibleSchemes: IneligibleSchemeReason[];
  totalMatched: number;
  recommendedAction: string;
}

// SMS Simulator Response
export interface SmsSimulateResult {
  replyText: string;
  charCount: number;
  matchedSchemeId: string | null;
  mode: 'keyword' | 'rag' | 'help';
  delivery: 'sent' | 'simulated' | 'failed';
}

// Demo Reset Response
export interface DemoResetResult {
  reset: boolean;
  users: Array<{
    id: string;
    phone: string;
    name: string;
    role: Role;
    language: LanguageCode;
  }>;
}

// Profile API Response
export interface ProfileResponse {
  profile: Profile | null;
  history: Turn[];
}

// Schemes API Response
export interface SchemesResponse {
  schemes: SchemeView[];
}

// Standard Api Error
export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}
