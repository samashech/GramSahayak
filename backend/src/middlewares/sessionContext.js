const { DEMO_USERS } = require('../config');
const { AppError } = require('../utils/response');
const sessionService = require('../services/sessionService');
const seedService = require('../services/seedService');

// B-04: attaches req.sessionUser to every request.
// Precedence: x-demo-user (persona phone) > caller phone in the body > x-session-id > Bearer token.
// Only channel caller fields identify a session; a profile's own `phone` field never does.
// A persona resolves to its phone, so a judge's web turns land in the same session
// as that phone's IVR and SMS turns (Loophole #1).
// Multipart bodies are parsed later by multer; those controllers call resolveSessionUser(req) again.

const PHONE_FIELDS = ['callerPhone', 'fromPhone', 'caller_number'];

function bearerToken(req) {
  const m = /^Bearer\s+(.+)$/i.exec(req.get('authorization') || '');
  return m ? m[1].trim() : null;
}

async function resolveSessionUser(req) {
  const demoUser = req.get('x-demo-user') || null;
  let phone = null;
  if (demoUser) {
    const persona = DEMO_USERS.includes(demoUser) ? seedService.getPersona(demoUser) : null;
    if (!persona) throw new AppError('ERR_VALIDATION', `Unknown x-demo-user: ${demoUser}. Allowed: ${DEMO_USERS.join(', ')}`);
    phone = sessionService.normalizePhone(persona.phone);
  }
  if (!phone && req.body && typeof req.body === 'object') {
    const raw = PHONE_FIELDS.map((f) => req.body[f]).find(Boolean);
    phone = sessionService.normalizePhone(raw);
  }
  const sessionId = req.get('x-session-id') || req.body?.sessionId || bearerToken(req);
  const sessionKey = sessionService.resolveSessionKey({ phone, sessionId });
  const profile = sessionKey ? await sessionService.getProfile(sessionKey) : null;

  req.sessionUser = {
    sessionKey,
    phone,
    demoUser,
    profile,
    role: profile?.role || null,
    language: profile?.language || null,
  };
  return req.sessionUser;
}

async function sessionContext(req, res, next) {
  await resolveSessionUser(req);
  next();
}

function requireSession(req) {
  if (!req.sessionUser?.sessionKey) {
    throw new AppError('ERR_VALIDATION', 'Missing session: send the x-session-id header (or x-demo-user)');
  }
  return req.sessionUser.sessionKey;
}

module.exports = { sessionContext, resolveSessionUser, requireSession };
