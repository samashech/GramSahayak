const { config } = require('../config');

// HTTP bridge to the Python RAG service (contract section 9).
// R2/R3: RAG is stateless and Node is its only caller.

async function getJson(url, { timeoutMs }) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`RAG ${url} -> HTTP ${res.status}`);
  return res.json();
}

async function health({ timeoutMs = 1500 } = {}) {
  try {
    const body = await getJson(`${config.aiRagUrl}/health`, { timeoutMs });
    return {
      ok: body.status === 'ok',
      vectorCount: Number.isFinite(body.vector_count) ? body.vector_count : null,
      mode: body.mode || null,
    };
  } catch (err) {
    return { ok: false, vectorCount: null, mode: null, error: err.name === 'TimeoutError' ? 'timeout' : err.message };
  }
}

// POST /rag/ingest {file_path, category} -> {ingested_chunks, vector_count}; null when RAG is down.
async function ingest({ filePath, category, timeoutMs = 20000 }) {
  try {
    const res = await fetch(`${config.aiRagUrl}/rag/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_path: filePath, category }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    return { ingested_chunks: body.ingested_chunks ?? null, vector_count: body.vector_count ?? null };
  } catch (err) {
    console.warn(`[rag] ingest ${filePath} failed: ${err.message}`);
    return null;
  }
}

// POST /rag/query (contract section 9). RAG's request model forbids extra keys and rejects
// null role/language, so only valid values are sent. Throws on timeout or non-2xx so the
// agent brain can fall back (local card match, then demo cache).
async function query({ query: text, language, category, role, forVoice, history }, { timeoutMs = config.ragTimeoutMs } = {}) {
  const body = { query: text, for_voice: Boolean(forVoice), history: history || [] };
  if (language) body.language = language;
  if (role) body.role = role;
  if (category) body.category = category;
  const res = await fetch(`${config.aiRagUrl}/rag/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`RAG /rag/query -> HTTP ${res.status} ${detail.slice(0, 200)}`);
  }
  return res.json();
}

module.exports = { health, ingest, query };
