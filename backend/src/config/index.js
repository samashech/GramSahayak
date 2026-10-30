const path = require('node:path');
const dotenv = require('dotenv');

// Contract section 10: one root .env shared by all services.
const REPO_ROOT = path.resolve(__dirname, '../../..');
dotenv.config({ path: path.join(REPO_ROOT, '.env'), quiet: true });

const env = process.env;

const bool = (value, fallback) => {
  if (value === undefined || value === '') return fallback;
  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
};

const list = (value) =>
  String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const resolveFromRoot = (p) => (path.isAbsolute(p) ? p : path.join(REPO_ROOT, p));

// Vocabulary: contract section 3 (exact strings, no variants).
const DEMO_LANGUAGES = ['hi-IN', 'mr-IN', 'ta-IN'];
const LANGUAGES = [
  ...DEMO_LANGUAGES,
  'en-IN', 'te-IN', 'bn-IN', 'gu-IN', 'kn-IN', 'ml-IN', 'pa-IN', 'od-IN',
];
const CATEGORIES = ['schemes', 'agri', 'health', 'education'];
const CATEGORY_BY_DIGIT = { 1: 'schemes', 2: 'agri', 3: 'health', 4: 'education' };
const LANGUAGE_BY_DIGIT = { 1: 'hi-IN', 2: 'mr-IN', 3: 'ta-IN' };
const ROLES = ['farmer', 'asha', 'panchayat', 'student'];
const CHANNELS = ['web', 'ivr', 'sms'];
const OCCUPATIONS = ['farmer', 'agri_labourer', 'daily_wage', 'student', 'homemaker', 'other'];
const SOCIAL_CATEGORIES = ['general', 'obc', 'sc', 'st'];
const GENDERS = ['male', 'female', 'other'];
const EVENT_TYPES = [
  'call_incoming', 'dtmf', 'stt', 'answer', 'sms_in', 'sms_out',
  'sms_receipt', 'cache_hit', 'fallback', 'error',
];
const SCHEME_CODES = [
  'PMKISAN', 'PMFBY', 'KCC', 'SHC', 'PMJAY', 'JSY', 'PMMVY',
  'MGNREGA', 'UJJWALA', 'PMAY', 'NSP', 'PMYASASVI', 'PRAGATI',
];
const SMS_KEYWORDS = [...SCHEME_CODES, 'AGRI', 'HEALTH', 'SCHOLARSHIP', 'HELP'];
const DEMO_USERS = ['farmer-hi', 'farmer-mr', 'asha-ta', 'student-hi', 'panchayat-hi'];
const DB_DRIVERS = ['postgres', 'sqlite', 'memory'];

const dbDriver = String(env.DB_DRIVER || 'memory').toLowerCase();

const config = {
  repoRoot: REPO_ROOT,
  port: Number(env.PORT) || 5000,
  appEnv: env.APP_ENV || 'development',
  isProduction: (env.APP_ENV || 'development') === 'production',
  frontendOrigins: list(env.FRONTEND_ORIGIN || 'http://localhost:3000'),
  aiRagUrl: (env.AI_RAG_URL || 'http://localhost:8000').replace(/\/+$/, ''),
  ragTimeoutMs: 4000,

  demoMode: bool(env.DEMO_MODE, true),
  translatePivot: bool(env.TRANSLATE_PIVOT, false),
  useMockAi: bool(env.USE_MOCK_AI, false),

  db: {
    driver: DB_DRIVERS.includes(dbDriver) ? dbDriver : 'memory',
    databaseUrl: env.DATABASE_URL || '',
    sqlitePath: resolveFromRoot(env.SQLITE_PATH || 'data/gram_sahayak.sqlite'),
    sqliteSchemaPath: path.join(REPO_ROOT, 'db/schema.sqlite.sql'),
  },

  sarvamApiKey: env.SARVAM_API_KEY || '',
  sarvamBaseUrl: 'https://api.sarvam.ai',
  llmApiKey: env.LLM_API_KEY || '',
  llmModel: env.LLM_MODEL || 'llama-3.3-70b-versatile',

  cloudtalk: {
    apiKeyId: env.CLOUDTALK_API_KEY_ID || '',
    apiSecret: env.CLOUDTALK_API_SECRET || '',
    webhookSecret: env.CLOUDTALK_WEBHOOK_SECRET || '',
  },

  paths: {
    seedDir: path.join(REPO_ROOT, 'data/seed'),
    rawDir: path.join(REPO_ROOT, 'data/raw'),
    uploadsDir: path.join(__dirname, '../../uploads'),
  },

  historyLimit: 20,
  ragHistoryTurns: 6,
  smsMaxChars: 160,
};

module.exports = {
  config,
  DEMO_LANGUAGES,
  LANGUAGES,
  CATEGORIES,
  CATEGORY_BY_DIGIT,
  LANGUAGE_BY_DIGIT,
  ROLES,
  CHANNELS,
  OCCUPATIONS,
  SOCIAL_CATEGORIES,
  GENDERS,
  EVENT_TYPES,
  SCHEME_CODES,
  SMS_KEYWORDS,
  DEMO_USERS,
  DB_DRIVERS,
};
