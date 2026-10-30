const fs = require('node:fs');
const path = require('node:path');
const { config, CATEGORIES } = require('../config');
const { AppError } = require('../utils/response');
const ragClient = require('./ragClient');

// POST /api/schemes/ingest: a Panchayat/admin adds a circular (pdf/md/txt) or a JSON card.
// The upload is saved to /data/raw and handed to RAG /rag/ingest so it becomes searchable live.
// /data/seed stays untouched (R7): new cards are searchable but never drive eligibility.

const repoRelative = (abs) => path.relative(config.repoRoot, abs).split(path.sep).join('/');

const safeBase = (name) =>
  path.basename(name, path.extname(name)).replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 60) || 'upload';

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

// Plain-text rendering of a card so RAG can chunk it like a guide.
function cardToMarkdown(card) {
  const docs = Array.isArray(card.documents) ? card.documents.map((d) => `- ${d}`).join('\n') : '';
  return [
    `# ${card.name_en} (${card.code})`,
    `## Benefits\n${card.benefits || ''}`,
    `## Eligibility\n${card.eligibility || ''}`,
    `## Exclusions\n${card.exclusions || ''}`,
    `## Documents\n${docs}`,
    `## How to apply\n${card.how_to_apply || ''}`,
    `## Helpline and portal\nHelpline: ${card.helpline || ''}\nPortal: ${card.portal_url || ''}`,
  ].join('\n\n');
}

function validateCard(card) {
  if (!card || typeof card !== 'object' || Array.isArray(card)) {
    throw new AppError('ERR_VALIDATION', 'Send a multipart "file" or a JSON scheme card');
  }
  if (!/^[A-Z0-9_]{2,20}$/.test(String(card.code || ''))) {
    throw new AppError('ERR_VALIDATION', 'card.code must be 2-20 uppercase letters/digits');
  }
  if (!card.name_en) throw new AppError('ERR_VALIDATION', 'card.name_en is required');
  normalizeCategory(card.category);
}

async function ingest({ file, body }) {
  fs.mkdirSync(config.paths.rawDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  let savedAbs;
  let ragAbs;
  let category;

  if (file) {
    category = normalizeCategory(body?.category);
    const ext = path.extname(file.originalname || '').toLowerCase();
    savedAbs = path.join(config.paths.rawDir, `${safeBase(file.originalname || 'upload')}-${stamp}${ext}`);
    moveFile(file.path, savedAbs);
    ragAbs = savedAbs;
  } else {
    const card = body?.card && typeof body.card === 'object' ? body.card : body;
    validateCard(card);
    category = card.category;
    savedAbs = path.join(config.paths.rawDir, `${card.code}-${stamp}.json`);
    fs.writeFileSync(savedAbs, `${JSON.stringify(card, null, 2)}\n`);
    ragAbs = path.join(config.paths.rawDir, `${card.code}-${stamp}.md`);
    fs.writeFileSync(ragAbs, `${cardToMarkdown(card)}\n`);
  }

  const ragIngest = await ragClient.ingest({ filePath: repoRelative(ragAbs), category });
  return { savedPath: repoRelative(savedAbs), ragIngest };
}

module.exports = { ingest, cardToMarkdown };
