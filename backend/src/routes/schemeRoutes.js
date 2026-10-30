const { Router } = require('express');
const { sendSuccess } = require('../utils/response');
const { documentUpload } = require('../middlewares/upload');
const ingestService = require('../services/ingestService');

const router = Router();

// POST /api/schemes/ingest  multipart file (pdf/md/txt/json) + category, or a JSON card
//   -> {savedPath, ragIngest:{ingested_chunks, vector_count}|null}
router.post('/ingest', documentUpload.single('file'), async (req, res) => {
  const result = await ingestService.ingest({ file: req.file, body: req.body });
  sendSuccess(res, result, 201);
});

module.exports = router;
