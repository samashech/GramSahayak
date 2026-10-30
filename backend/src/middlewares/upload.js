const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const multer = require('multer');
const { config } = require('../config');
const { AppError } = require('../utils/response');

const AUDIO_EXT = ['.webm', '.wav', '.mp3', '.ogg', '.m4a', '.mp4', '.aac'];
const DOC_EXT = ['.pdf', '.md', '.txt', '.json'];

fs.mkdirSync(config.paths.uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: config.paths.uploadsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
  },
});

function filterBy(allowed, label) {
  return (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    // MediaRecorder blobs often arrive without an extension; trust the audio mimetype then.
    const ok = allowed.includes(ext) || (label === 'audio' && /^audio\//.test(file.mimetype || ''));
    if (ok) return cb(null, true);
    return cb(new AppError('ERR_VALIDATION', `Unsupported ${label} file type: ${ext || file.mimetype}`));
  };
}

const audioUpload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  fileFilter: filterBy(AUDIO_EXT, 'audio'),
});

const documentUpload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: filterBy(DOC_EXT, 'document'),
});

module.exports = { audioUpload, documentUpload, AUDIO_EXT, DOC_EXT };
