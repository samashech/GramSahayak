const fs = require('node:fs');
const path = require('node:path');
const { config, CATEGORIES, SCHEME_CODES } = require('../config');
const { AppError } = require('../utils/response');
const ragClient = require('./ragClient');

// POST /api/schemes/ingest: a Panchayat/admin adds a circular (pdf/md/txt) or a JSON card.
// The upload is saved to /data/raw and handed to RAG /rag/ingest so it becomes searchable live.
// RAG reads .pdf/.md/.txt and single-card .json natively, and re-ingests everything in /data/raw
// on a full ingest, so exactly one file is written per upload.
// /data/seed stays untouched (R7): new cards are searchable but never drive eligibility, and a card
// may not reuse one of the 13 seed codes (that would put unverified text under a verified code).

const repoRelative = (abs) => path.relative(config.repoRoot, abs).split(path.sep).join('/');

const safeBase = (name) =>
  path.basename(name, path.extname(name)).replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 60) || 'upload';

// CCR-06: RAG's full re-index falls back to a category token in the filename when its manifest
// has no entry (e.g. RAG was down at upload). Saved name = <category>-<base>-<time>; category
// words are removed from <base> so RAG's token scan cannot pick the wrong one.
const CATEGORY_WORD_RE = /(^|[_-])(agri|health|education|schemes)(?=$|[_-])/gi;
const rawFileName = (originalName, category, stamp, ext) => {
  const base = safeBase(originalName).replace(CATEGORY_WORD_RE, '$1').replace(/[_-]{2,}/g, '_').replace(/^[_-]+|[_-]+$/g, '') || 'upload';
  return `${category}-${base}-${stamp}${ext}`;
};

function moveFile(from, to) {
  try {
    fs.renameSync(from, to);
  } catch (err) {
    if (err.code !== 'EXDEV') throw err;
    fs.copyFileSync(from, to);
    fs.unlinkSync(from);
  }
}

function normalizeCategory(category) {
  if (category == null || category === '') return 'schemes';
  if (!CATEGORIES.includes(category)) {
    throw new AppError('ERR_VALIDATION', `Invalid category: ${category}. Allowed: ${CATEGORIES.join(', ')}`);
  }
  return category;
}

function validateCard(card) {
  if (!card || typeof card !== 'object' || Array.isArray(card)) {
    throw new AppError('ERR_VALIDATION', 'Send a multipart "file" or a JSON scheme card');
  }
  if (!/^[A-Z0-9_]{2,20}$/.test(String(card.code || ''))) {
    throw new AppError('ERR_VALIDATION', 'card.code must be 2-20 uppercase letters/digits');
  }
  if (SCHEME_CODES.includes(card.code)) {
    throw new AppError('ERR_VALIDATION', `${card.code} is a seed scheme; corrections go to /data/seed via the Lead (LD-02)`);
  }
  if (!card.name_en) throw new AppError('ERR_VALIDATION', 'card.name_en is required');
  if (!card.category) throw new AppError('ERR_VALIDATION', 'card.category is required');
  normalizeCategory(card.category);
  // R5: an SMS summary, if given, must already fit one SMS.
  if (card.sms_summary != null) {
    if (typeof card.sms_summary !== 'object' || Array.isArray(card.sms_summary)) {
      throw new AppError('ERR_VALIDATION', 'card.sms_summary must be an object keyed by languageCode');
    }
    for (const [lang, text] of Object.entries(card.sms_summary)) {
      if (Array.from(String(text)).length > config.smsMaxChars) {
        throw new AppError('ERR_VALIDATION', `card.sms_summary[${lang}] is over ${config.smsMaxChars} characters`);
      }
    }
  }
}

async function ingest({ file, body }) {
  fs.mkdirSync(config.paths.rawDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  let savedAbs;
  let category;

  if (file) {
    category = normalizeCategory(body?.category);
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (ext === '.json') {
      // RAG treats a .json upload as a scheme card, so it gets the same checks as a JSON body.
      try {
        validateCard(JSON.parse(fs.readFileSync(file.path, 'utf8')));
      } catch (err) {
        fs.rmSync(file.path, { force: true });
        throw err instanceof AppError ? err : new AppError('ERR_VALIDATION', 'Uploaded .json is not a valid scheme card');
      }
    }
    savedAbs = path.join(config.paths.rawDir, rawFileName(file.originalname || 'upload', category, stamp, ext));
    moveFile(file.path, savedAbs);
  } else {
    const card = body?.card && typeof body.card === 'object' ? body.card : body;
    validateCard(card);
    category = card.category;
    savedAbs = path.join(config.paths.rawDir, `${card.code}-${stamp}.json`);
    fs.writeFileSync(savedAbs, `${JSON.stringify(card, null, 2)}\n`);
  }

  const ragIngest = await ragClient.ingest({ filePath: repoRelative(savedAbs), category });
  return { savedPath: repoRelative(savedAbs), ragIngest };
}

module.exports = { ingest };
