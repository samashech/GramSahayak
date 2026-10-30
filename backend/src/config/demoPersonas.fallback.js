// Used ONLY when /data/seed/demo_personas.json (owned by the Database role, DB-05) is missing.
// Verbatim from contract section 12. Once DB-05 lands, the seed file wins.
module.exports = [
  {
    id: 'farmer-hi', phone: '+919829011111', name: 'Ramesh Kumar',
    role: 'farmer', language: 'hi-IN', occupation: 'farmer',
    land_hectares: 1.2, bpl: true, age: 45, gender: 'male',
    pregnant: false, annual_income: 90000, social_category: 'obc',
  },
  {
    id: 'farmer-mr', phone: '+919822022222', name: 'Tukaram Patil',
    role: 'farmer', language: 'mr-IN', occupation: 'farmer',
    land_hectares: 1.8, bpl: false, age: 50, gender: 'male',
    pregnant: false, annual_income: 180000, social_category: 'general',
  },
  {
    id: 'asha-ta', phone: '+919840033333', name: 'Kavitha M.',
    role: 'asha', language: 'ta-IN', occupation: 'other',
    land_hectares: 0, bpl: false, age: 34, gender: 'female',
    pregnant: false, annual_income: 120000, social_category: 'general',
  },
  {
    id: 'student-hi', phone: '+919829044444', name: 'Priya Verma',
    role: 'student', language: 'hi-IN', occupation: 'student',
    land_hectares: 0, bpl: false, age: 16, gender: 'female',
    pregnant: false, annual_income: 90000, social_category: 'obc',
  },
  {
    id: 'panchayat-hi', phone: '+919829055555', name: 'Sunita Devi',
    role: 'panchayat', language: 'hi-IN', occupation: 'other',
    land_hectares: 0, bpl: false, age: 40, gender: 'female',
    pregnant: false, annual_income: 150000, social_category: 'general',
  },
];
