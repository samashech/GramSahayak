const fs = require('node:fs');
const path = require('node:path');
const { config } = require('../config');

// R7: /data/seed/schemes.json is the only ground truth for scheme data.
// The DB `schemes` table is a mirror loaded by db/seed_db.py; the gateway reads the seed file.
let cache = null;

function load() {
  const file = path.join(config.paths.seedDir, 'schemes.json');
  const cards = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(cards)) throw new Error(`${file} must be a JSON array`);
  cache = { cards, byCode: new Map(cards.map((c) => [String(c.code).toUpperCase(), c])) };
  return cache;
}

function ensure() {
  return cache || load();
}

function getAll(category) {
  const { cards } = ensure();
  return category ? cards.filter((c) => c.category === category) : cards.slice();
}

function getByCode(code) {
  if (!code) return null;
  return ensure().byCode.get(String(code).toUpperCase()) || null;
}

module.exports = { load, reload: load, getAll, getByCode };
