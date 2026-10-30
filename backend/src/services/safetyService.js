const TERMS = require('../config/safetyTerms');

// Deterministic safety screen for every channel (Loophole #7). Returns the contract Safety
// shape plus `kind`, which tells agentBrain whether to answer with a fixed safe text:
//   emergency -> fixed "call 108 now" answer
//   pregnancy -> RAG answers (it lists the danger signs), helplines 108 / 102 always shown
//   dose      -> fixed refusal (Kisan Call Centre for agriculture, 104 for medicine)

const includesAny = (text, list) => list.some((t) => text.includes(t.toLowerCase()));

function screen(queryText, { category } = {}) {
  const text = String(queryText || '').toLowerCase().normalize('NFC');
  if (includesAny(text, TERMS.emergency)) return { flagged: true, helplines: ['108'], kind: 'emergency' };
  if (includesAny(text, TERMS.dose)) {
    const agri = category === 'agri' || includesAny(text, TERMS.agriContext);
    return { flagged: true, helplines: [agri ? '1800-180-1551' : '104'], kind: agri ? 'doseAgri' : 'doseMedical' };
  }
  if (includesAny(text, TERMS.pregnancy)) return { flagged: true, helplines: ['108', '102'], kind: 'pregnancy' };
  return { flagged: false, helplines: [], kind: null };
}

// Contract Safety = {flagged, helplines}
const toSafety = ({ flagged, helplines }) => ({ flagged, helplines });

module.exports = { screen, toSafety };
