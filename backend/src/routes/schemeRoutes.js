const { Router } = require('express');
const { sendSuccess } = require('../utils/response');
const { documentUpload } = require('../middlewares/upload');
const ingestService = require('../services/ingestService');
const dbAdapter = require('../adapters/dbAdapter');
const { toSchemeView } = require('../services/schemeView');
const { languageCodeOr, categoryOr } = require('../utils/validate');

const router = Router();

// GET /api/schemes?category=&languageCode= -> {schemes:[SchemeView]}
router.get('/', async (req, res) => {
  const category = categoryOr(req.query.category);
  const languageCode = languageCodeOr(req.query.languageCode, req.sessionUser?.language || 'hi-IN');
  const cards = await dbAdapter.getAllSchemes(category);
  sendSuccess(res, { schemes: cards.map((c) => toSchemeView(c, languageCode)) });
});

// POST /api/schemes/ingest  multipart file (pdf/md/txt/json) + category, or a JSON card
//   -> {savedPath, ragIngest:{ingested_chunks, vector_count}|null}
router.post('/ingest', documentUpload.single('file'), async (req, res) => {
  const result = await ingestService.ingest({ file: req.file, body: req.body });
  sendSuccess(res, result, 201);
});

module.exports = router;
