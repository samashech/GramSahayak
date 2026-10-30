const fs = require('node:fs');
const path = require('node:path');
const { config, CATEGORIES, DEMO_USERS } = require('../config');
const seedSchemes = require('../adapters/seedSchemes');
const dbAdapter = require('../adapters/dbAdapter');
const sessionService = require('./sessionService');
const fallbackPersonas = require('../config/demoPersonas.fallback');

// B-03: loads /data/seed at startup (R7) and owns the judge demo personas.

const GUIDE_FILES = { agri: 'agri.md', health: 'health.md', education: 'education.md' };
const PROFILE_FIELDS = [
  'role', 'language', 'occupation', 'land_hectares', 'bpl', 'age', 'gender',
  'pregnant', 'annual_income', 'social_category', 'state', 'district',
];

let guides = []; // [{ category, source, docTitle, heading, text }]
let personas = [];
let personaSource = 'none';

// Split a guide on ## / ### headings; each section keeps its heading and the file title.
function parseGuide(markdown, category, source) {
  const lines = markdown.split(/\r?\n/);
  const docTitle = (lines.find((l) => /^#\s+/.test(l)) || '').replace(/^#\s+/, '').trim() || source;
  const sections = [];
  let h2 = null;
  let current = null;
  const flush = () => {
    if (current && current.body.join('\n').trim()) {
      sections.push({
        category, source, docTitle, heading: current.heading, text: current.body.join('\n').trim(),
      });
    }
  };
  for (const line of lines) {
    const m = /^(#{2,3})\s+(.*)$/.exec(line);
    if (m) {
      flush();
      if (m[1] === '##') h2 = m[2].trim();
      const heading = m[1] === '###' && h2 ? `${h2} > ${m[2].trim()}` : m[2].trim();
      current = { heading, body: [] };
    } else if (current) {
      current.body.push(line);
    }
  }
  flush();
  return sections;
}

function loadGuides() {
  guides = [];
  for (const [category, file] of Object.entries(GUIDE_FILES)) {
    const full = path.join(config.paths.seedDir, file);
    if (!fs.existsSync(full)) {
      console.warn(`[seed] missing guide ${file}`);
      continue;
    }
    guides.push(...parseGuide(fs.readFileSync(full, 'utf8'), category, file));
  }
  return guides;
}

function loadPersonas() {
  const file = path.join(config.paths.seedDir, 'demo_personas.json');
  if (fs.existsSync(file)) {
    try {
      const list = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!Array.isArray(list)) throw new Error('not an array');
      personas = list;
      personaSource = 'data/seed/demo_personas.json';
      return personas;
    } catch (err) {
      console.warn(`[seed] demo_personas.json unreadable (${err.message}), using contract section 12`);
    }
  }
  personas = fallbackPersonas;
  personaSource = 'contract-section-12-fallback';
  return personas;
}

function getPersona(id) {
  return personas.find((p) => p.id === id) || null;
}

function listPersonas() {
  return personas.map(({ id, name, phone, role, language }) => ({ id, name, phone, role, language }));
}

function personaProfile(persona) {
  return Object.fromEntries(PROFILE_FIELDS.filter((f) => f in persona).map((f) => [f, persona[f]]));
}

// Upsert every persona's session + profile (keyed by its phone). With wipe=true the
// persona sessions are deleted first, so history and profile edits are cleared.
async function seedDemoUsers({ wipe = false } = {}) {
  const seeded = [];
  for (const persona of personas) {
    const key = sessionService.normalizePhone(persona.phone);
    if (!key) {
      console.warn(`[seed] persona ${persona.id} has an invalid phone, skipped`);
      continue;
    }
    if (wipe) await dbAdapter.deleteSession(key);
    await sessionService.updateProfile(key, { ...personaProfile(persona), phone: key }, { phone: key });
    seeded.push(persona.id);
  }
  return seeded;
}

async function init() {
  seedSchemes.reload();
  loadGuides();
  loadPersonas();
  const unknown = personas.map((p) => p.id).filter((id) => !DEMO_USERS.includes(id));
  if (unknown.length) console.warn(`[seed] personas outside the contract x-demo-user list: ${unknown.join(', ')}`);
  if (config.demoMode) await seedDemoUsers();
  console.log(
    `[seed] ${seedSchemes.getAll().length} schemes, ${guides.length} guide sections, `
    + `${personas.length} personas (${personaSource})`,
  );
}

function getGuideSections(category) {
  return category && CATEGORIES.includes(category) ? guides.filter((g) => g.category === category) : guides.slice();
}

module.exports = {
  init,
  parseGuide,
  loadGuides,
  loadPersonas,
  getPersona,
  listPersonas,
  seedDemoUsers,
  getGuideSections,
  personaSource: () => personaSource,
};
